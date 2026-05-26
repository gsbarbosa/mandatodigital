import type { ContentRequestInput, LlmExecutionOptionsInput } from "@/lib/schemas";
import { generateContentVariants, type ContentGenerationResult } from "@/lib/llm";
import { evaluateGeneratedCandidates } from "@/lib/llm-evaluator";
import { getRepository } from "@/lib/storage";
import type { ContentRequest, GeneratedContent, PoliticianProfile } from "@/lib/types";

type ShadowEvalOptions = {
  shadow?: LlmExecutionOptionsInput;
  judge?: LlmExecutionOptionsInput;
  mode?: "shadow" | "manual";
};

type NamedExecutionTarget = {
  provider: "openai" | "anthropic";
  model: string;
};

type RunShadowEvaluationInput = ShadowEvalOptions & {
  profile: PoliticianProfile;
  request: ContentRequestInput;
  contentRequest: ContentRequest;
  primaryResult: ContentGenerationResult;
  primaryGeneratedContents?: GeneratedContent[];
};

function getDefaultModel(provider: "openai" | "anthropic") {
  return provider === "openai"
    ? process.env.OPENAI_MODEL || "gpt-4.1-mini"
    : process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest";
}

function resolveShadowExecution(
  primaryProvider: string,
  primaryModel: string,
  overrides?: LlmExecutionOptionsInput,
): NamedExecutionTarget | null {
  if (overrides?.provider) {
    return {
      provider: overrides.provider,
      model: overrides.model?.trim() || getDefaultModel(overrides.provider),
    };
  }

  if (process.env.EVAL_SHADOW_PROVIDER === "openai") {
    return {
      provider: "openai" as const,
      model:
        process.env.EVAL_SHADOW_MODEL?.trim() || getDefaultModel("openai"),
    };
  }

  if (process.env.EVAL_SHADOW_PROVIDER === "anthropic") {
    return {
      provider: "anthropic" as const,
      model:
        process.env.EVAL_SHADOW_MODEL?.trim() || getDefaultModel("anthropic"),
    };
  }

  if (primaryProvider !== "openai" && process.env.OPENAI_API_KEY) {
    return {
      provider: "openai" as const,
      model: process.env.EVAL_SHADOW_MODEL?.trim() || getDefaultModel("openai"),
    };
  }

  if (primaryProvider !== "anthropic" && process.env.ANTHROPIC_API_KEY) {
    return {
      provider: "anthropic" as const,
      model:
        process.env.EVAL_SHADOW_MODEL?.trim() || getDefaultModel("anthropic"),
    };
  }

  if (
    process.env.EVAL_SHADOW_MODEL?.trim() &&
    (primaryProvider === "openai" || primaryProvider === "anthropic")
  ) {
    return {
      provider: primaryProvider as "openai" | "anthropic",
      model: process.env.EVAL_SHADOW_MODEL.trim(),
    };
  }

  if (primaryProvider === "openai" || primaryProvider === "anthropic") {
    return {
      provider: primaryProvider as "openai" | "anthropic",
      model: primaryModel,
    };
  }

  return null;
}

function resolveJudgeExecution(
  overrides?: LlmExecutionOptionsInput,
): NamedExecutionTarget | null {
  if (overrides?.provider) {
    return {
      provider: overrides.provider,
      model: overrides.model?.trim() || getDefaultModel(overrides.provider),
    };
  }

  if (process.env.EVAL_JUDGE_PROVIDER === "openai") {
    return {
      provider: "openai" as const,
      model: process.env.EVAL_JUDGE_MODEL?.trim() || getDefaultModel("openai"),
    };
  }

  if (process.env.EVAL_JUDGE_PROVIDER === "anthropic") {
    return {
      provider: "anthropic" as const,
      model:
        process.env.EVAL_JUDGE_MODEL?.trim() || getDefaultModel("anthropic"),
    };
  }

  if (process.env.OPENAI_API_KEY) {
    return {
      provider: "openai" as const,
      model: process.env.EVAL_JUDGE_MODEL?.trim() || getDefaultModel("openai"),
    };
  }

  if (process.env.ANTHROPIC_API_KEY) {
    return {
      provider: "anthropic" as const,
      model:
        process.env.EVAL_JUDGE_MODEL?.trim() || getDefaultModel("anthropic"),
    };
  }

  return null;
}

export function isShadowModeEnabled() {
  return process.env.EVAL_SHADOW_ENABLED === "true";
}

export async function runShadowEvaluation({
  profile,
  request,
  contentRequest,
  primaryResult,
  primaryGeneratedContents = [],
  shadow,
  judge,
  mode = "shadow",
}: RunShadowEvaluationInput) {
  if (primaryResult.usedFallback) {
    throw new Error(
      "O candidato primario usou fallback-local; shadow eval exige resposta real de LLM.",
    );
  }

  const shadowExecution = resolveShadowExecution(
    primaryResult.provider,
    primaryResult.model,
    shadow,
  );

  if (!shadowExecution) {
    throw new Error("Nao foi possivel resolver um alvo de shadow mode.");
  }

  const judgeExecution = resolveJudgeExecution(judge);

  if (!judgeExecution) {
    throw new Error("Nao foi possivel resolver um juiz LLM para a avaliacao.");
  }

  const repository = getRepository();
  const run = await repository.createEvaluationRun({
    contentRequestId: contentRequest.id,
    profileId: profile.id,
    mode,
    status: "pending",
    primaryProvider: primaryResult.provider,
    primaryModel: primaryResult.model,
    judgeProvider: "",
    judgeModel: "",
    winnerCandidateId: null,
    winnerRecommendation: "",
    judgeSummary: "",
    errorMessage: "",
  });

  try {
    const shadowResult = await generateContentVariants(profile, request, {
      execution: {
        provider: shadowExecution.provider,
        model: shadowExecution.model,
        temperature: shadow?.temperature ?? 0.8,
        maxTokens: shadow?.maxTokens ?? 1800,
        strict: true,
      },
      allowFallback: false,
    });

    const [primaryCandidate, shadowCandidate] =
      await repository.createEvaluationCandidates([
        {
          evaluationRunId: run.id,
          contentRequestId: contentRequest.id,
          generatedContentIds: primaryGeneratedContents.map((item) => item.id),
          role: "primary",
          provider: primaryResult.provider,
          model: primaryResult.model,
          promptVersion: primaryResult.prompt.promptVersion,
          templateId: primaryResult.prompt.templateId,
          latencyMs: primaryResult.latencyMs,
          promptPreview: primaryResult.prompt.preview,
          rawResponse: primaryResult.rawText ?? "",
          tokenUsage: primaryResult.tokenUsage,
          outputVariants: primaryResult.variants.map((item) => ({
            title: item.title,
            angle: item.angle,
            body: item.body,
          })),
          status: "completed",
        },
        {
          evaluationRunId: run.id,
          contentRequestId: contentRequest.id,
          generatedContentIds: [],
          role: "shadow",
          provider: shadowResult.provider,
          model: shadowResult.model,
          promptVersion: shadowResult.prompt.promptVersion,
          templateId: shadowResult.prompt.templateId,
          latencyMs: shadowResult.latencyMs,
          promptPreview: shadowResult.prompt.preview,
          rawResponse: shadowResult.rawText ?? "",
          tokenUsage: shadowResult.tokenUsage,
          outputVariants: shadowResult.variants.map((item) => ({
            title: item.title,
            angle: item.angle,
            body: item.body,
          })),
          status: "completed",
        },
      ]);

    const judgement = await evaluateGeneratedCandidates(
      profile,
      request,
      [
        {
          candidateKey: "primary",
          provider: primaryCandidate.provider,
          model: primaryCandidate.model,
          promptVersion: primaryCandidate.promptVersion,
          templateId: primaryCandidate.templateId,
          promptPreview: primaryCandidate.promptPreview,
          outputVariants: primaryCandidate.outputVariants,
        },
        {
          candidateKey: "shadow",
          provider: shadowCandidate.provider,
          model: shadowCandidate.model,
          promptVersion: shadowCandidate.promptVersion,
          templateId: shadowCandidate.templateId,
          promptPreview: shadowCandidate.promptPreview,
          outputVariants: shadowCandidate.outputVariants,
        },
      ],
      {
        judge: {
          provider: judgeExecution.provider,
          model: judgeExecution.model,
          temperature: judge?.temperature ?? 0.1,
          maxTokens: judge?.maxTokens ?? 1800,
          strict: true,
        },
      },
    );

    const candidateByKey = {
      primary: primaryCandidate,
      shadow: shadowCandidate,
    } as const;

    for (const candidate of judgement.analysis.candidates) {
      const mappedCandidate = candidateByKey[
        candidate.candidateKey as keyof typeof candidateByKey
      ];

      await repository.createEvaluationScores(
        run.id,
        mappedCandidate.id,
        candidate.scores,
      );
    }

    const winnerCandidate =
      candidateByKey[judgement.analysis.winnerCandidateKey as keyof typeof candidateByKey];

    await repository.updateEvaluationRun(run.id, {
      status: "completed",
      winnerCandidateId: winnerCandidate.id,
      winnerRecommendation: judgement.analysis.winnerRecommendation,
      judgeSummary: judgement.analysis.rationale,
      errorMessage: "",
      judgeProvider: judgement.judgeProvider,
      judgeModel: judgement.judgeModel,
    });

    return repository.getEvaluationReport(run.id);
  } catch (error) {
    await repository.updateEvaluationRun(run.id, {
      status: "failed",
      winnerCandidateId: null,
      winnerRecommendation: "",
      judgeSummary: "",
      errorMessage:
        error instanceof Error ? error.message : "Falha ao executar shadow eval.",
      judgeProvider: "",
      judgeModel: "",
    });
    throw error;
  }
}
