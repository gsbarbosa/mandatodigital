import type {
  ContentRequestInput,
  LlmExecutionOptionsInput,
} from "@/lib/schemas";
import {
  GENERATION_PROMPT_TEMPLATE_ID,
  GENERATION_PROMPT_VERSION,
} from "@/lib/prompt-builder";
import { evaluateGeneratedCandidates } from "@/lib/llm-evaluator";
import { getRepository } from "@/lib/storage";
import type {
  ContentRequest,
  GeneratedContent,
  PoliticianProfile,
} from "@/lib/types";
import type { ContentGenerationResult } from "@/lib/llm";

type RunGeneratedContentEvaluationInput = {
  profile: PoliticianProfile;
  request: ContentRequestInput;
  contentRequest: ContentRequest;
  generation: ContentGenerationResult;
  generatedContents?: GeneratedContent[];
  judge?: LlmExecutionOptionsInput;
  mode?: "judge" | "manual";
};

type NamedExecutionTarget = {
  provider: "openai" | "anthropic";
  model: string;
};

function getDefaultModel(provider: "openai" | "anthropic") {
  return provider === "openai"
    ? process.env.OPENAI_MODEL || "gpt-4.1-mini"
    : process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest";
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
      provider: "openai",
      model: process.env.EVAL_JUDGE_MODEL?.trim() || getDefaultModel("openai"),
    };
  }

  if (process.env.EVAL_JUDGE_PROVIDER === "anthropic") {
    return {
      provider: "anthropic",
      model:
        process.env.EVAL_JUDGE_MODEL?.trim() || getDefaultModel("anthropic"),
    };
  }

  if (process.env.OPENAI_API_KEY) {
    return {
      provider: "openai",
      model: process.env.EVAL_JUDGE_MODEL?.trim() || getDefaultModel("openai"),
    };
  }

  if (process.env.ANTHROPIC_API_KEY) {
    return {
      provider: "anthropic",
      model:
        process.env.EVAL_JUDGE_MODEL?.trim() || getDefaultModel("anthropic"),
    };
  }

  return null;
}

export function isJudgeEvaluationEnabled() {
  return process.env.EVAL_JUDGE_ENABLED === "true";
}

export async function runGeneratedContentEvaluation({
  profile,
  request,
  contentRequest,
  generation,
  generatedContents = [],
  judge,
  mode = "judge",
}: RunGeneratedContentEvaluationInput) {
  if (generation.usedFallback) {
    throw new Error(
      "A avaliacao do core exige uma resposta real de LLM, sem fallback-local.",
    );
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
    primaryProvider: generation.provider,
    primaryModel: generation.model,
    judgeProvider: "",
    judgeModel: "",
    winnerCandidateId: null,
    winnerRecommendation: "",
    judgeSummary: "",
    errorMessage: "",
  });

  try {
    const [candidate] = await repository.createEvaluationCandidates([
      {
        evaluationRunId: run.id,
        contentRequestId: contentRequest.id,
        generatedContentIds: generatedContents.map((item) => item.id),
        role: "primary",
        provider: generation.provider,
        model: generation.model,
        promptVersion: generation.prompt.promptVersion,
        templateId: generation.prompt.templateId,
        latencyMs: generation.latencyMs,
        promptPreview: generation.prompt.preview,
        rawResponse: generation.rawText ?? "",
        tokenUsage: generation.tokenUsage,
        outputVariants: generation.variants.map((item) => ({
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
          provider: candidate.provider,
          model: candidate.model,
          promptVersion: candidate.promptVersion,
          templateId: candidate.templateId,
          promptPreview: candidate.promptPreview,
          outputVariants: candidate.outputVariants,
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

    const primaryAnalysis = judgement.analysis.candidates[0];

    await repository.createEvaluationScores(run.id, candidate.id, primaryAnalysis.scores);

    await repository.updateEvaluationRun(run.id, {
      status: "completed",
      winnerCandidateId: candidate.id,
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
        error instanceof Error ? error.message : "Falha ao avaliar a geracao.",
      judgeProvider: "",
      judgeModel: "",
    });
    throw error;
  }
}

export async function runStoredContentEvaluation(input: {
  profile: PoliticianProfile;
  contentRequest: ContentRequest;
  generatedContents: GeneratedContent[];
  judge?: LlmExecutionOptionsInput;
}) {
  const generation: ContentGenerationResult = {
    prompt: {
      templateId: GENERATION_PROMPT_TEMPLATE_ID,
      promptVersion: GENERATION_PROMPT_VERSION,
      preview: input.generatedContents[0]?.promptPreview || "prompt nao disponivel",
      system: "",
      user: "",
      fingerprint: "",
    },
    variants: input.generatedContents.map((item) => ({
      title: item.title,
      angle: item.angle,
      body: item.body,
      promptPreview: item.promptPreview,
      provider: item.provider,
      model: "desconhecido",
      templateId: GENERATION_PROMPT_TEMPLATE_ID,
      promptVersion: GENERATION_PROMPT_VERSION,
      rawResponse: "",
      latencyMs: 0,
      tokenUsage: null,
    })),
    rawText: null,
    provider: input.generatedContents[0]?.provider || "desconhecido",
    model: "desconhecido",
    latencyMs: 0,
    tokenUsage: null,
    usedFallback: false,
  };

  return runGeneratedContentEvaluation({
    profile: input.profile,
    request: input.contentRequest,
    contentRequest: input.contentRequest,
    generation,
    generatedContents: input.generatedContents,
    judge: input.judge,
    mode: "manual",
  });
}
