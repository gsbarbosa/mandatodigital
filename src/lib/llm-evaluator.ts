import type { ContentRequestInput, EvaluationJudgeResult, LlmExecutionOptionsInput } from "@/lib/schemas";
import { evaluationJudgeResultSchema } from "@/lib/schemas";
import { parseJsonResponse, requestStructuredJson } from "@/lib/llm";
import { evaluationCriteria, type GeneratedContentVariant, type PoliticianProfile } from "@/lib/types";

type EvaluationCandidateInput = {
  candidateKey: string;
  provider: string;
  model: string;
  promptVersion: string;
  templateId: string;
  promptPreview: string;
  outputVariants: GeneratedContentVariant[];
};

export type EvaluationJudgeOutcome = {
  analysis: EvaluationJudgeResult;
  judgeProvider: string;
  judgeModel: string;
};

function joinList(items: string[]) {
  return items.length ? items.join(", ") : "não informado";
}

function renderCandidate(candidate: EvaluationCandidateInput) {
  return [
    `CandidateKey: ${candidate.candidateKey}`,
    `Provider: ${candidate.provider}`,
    `Model: ${candidate.model || "não informado"}`,
    `PromptVersion: ${candidate.promptVersion}`,
    `TemplateId: ${candidate.templateId}`,
    `PromptPreview: ${candidate.promptPreview}`,
    "Versions:",
    ...candidate.outputVariants.map(
      (variant, index) =>
        `- Versao ${index + 1}\n  Titulo: ${variant.title}\n  Angulo: ${variant.angle}\n  Corpo: ${variant.body}`,
    ),
  ].join("\n");
}

function buildJudgePrompt(
  profile: PoliticianProfile,
  request: ContentRequestInput,
  candidates: EvaluationCandidateInput[],
) {
  const singleCandidateMode = candidates.length === 1;
  const system = [
    "Você e um juiz editorial para comunicação política.",
    singleCandidateMode
      ? "Avalie o candidato de geração de conteúdo para o briefing político."
      : "Compare candidatos de geração de conteúdo para o mesmo briefing político.",
    "Pontue cada candidato de 0 a 10 em todos os criterios informados.",
    `Use exatamente estes criterios: ${evaluationCriteria.join(", ")}.`,
    "Não invente contexto fora do que foi fornecido.",
    "Se o texto violar redLines, penalize fortemente.",
    "overall deve refletir a utilidade política final do candidato.",
    "Responda em JSON válido com as chaves winnerCandidateKey, winnerRecommendation, rationale, candidates e provider.",
    "Cada item de candidates deve conter candidateKey, summary e scores.",
    "Cada item de scores deve conter criterion, score, rationale e verdict.",
  ].join(" ");

  const user = [
    "Perfil do parlamentar:",
    `Nome: ${profile.fullName}`,
    `Cargo: ${profile.role}`,
    `Base geografica: ${profile.city}/${profile.state}`,
    `Publico principal: ${profile.audience}`,
    `Espectro: ${profile.spectrum}`,
    `Arquetipo: ${profile.archetype}`,
    `Tons de voz: ${joinList(profile.voiceTones)}`,
    `Pautas prioritarias: ${joinList(profile.keyIssues)}`,
    `Bordoes e assinaturas: ${joinList(profile.slogans)}`,
    `Linhas vermelhas: ${joinList(profile.redLines)}`,
    `Exemplos de fala: ${joinList(profile.referenceExamples)}`,
    `Resumo de identidade: ${profile.bio}`,
    "",
    "Briefing editorial:",
    `Topico: ${request.topic}`,
    `Objetivo: ${request.objective}`,
    `Formato: ${request.format}`,
    `Intensidade: ${request.intensity}`,
    `Contexto adicional: ${request.context || "não informado"}`,
    `Fatos confirmados: ${joinList(request.keyFacts)}`,
    `CTA desejado: ${request.desiredCallToAction || "não informado"}`,
    "",
    "Candidatos para comparar:",
    ...candidates.map(renderCandidate),
    "",
    "Regras de julgamento:",
    "- aderencia_perfil_politico: o texto soa como esse político e suas prioridades;",
    "- adequacao_cargo_cidade_base: respeita cargo, cidade e base eleitoral;",
    "- respeito_redlines: não cruza linhas vermelhas nem inventa fatos;",
    "- aderencia_objetivo_cta: persegue o objetivo e o CTA do briefing;",
    "- uso_keyfacts: usa ou respeita os fatos confirmados fornecidos;",
    "- adequacao_formato_intensidade: cabe no formato e intensidade pedidos;",
    "- clareza_utilidade_politica: e claro, aproveitavel e politicamente util;",
    "- overall: nota final consolidada.",
    singleCandidateMode
      ? "- winnerCandidateKey deve ser exatamente o unico candidateKey recebido."
      : "- winnerCandidateKey deve ser exatamente um dos candidateKey recebidos.",
    "- summary deve explicar em 1 ou 2 frases o desempenho do candidato.",
  ].join("\n");

  return { system, user };
}

function validateCandidateCoverage(
  candidates: EvaluationCandidateInput[],
  analysis: EvaluationJudgeResult,
) {
  const expectedKeys = new Set(candidates.map((candidate) => candidate.candidateKey));
  const receivedKeys = new Set(analysis.candidates.map((candidate) => candidate.candidateKey));

  if (expectedKeys.size !== receivedKeys.size) {
    throw new Error("O juiz não retornou todos os candidatos esperados.");
  }

  for (const key of expectedKeys) {
    if (!receivedKeys.has(key)) {
      throw new Error("O juiz não retornou todos os candidatos esperados.");
    }
  }

  if (!expectedKeys.has(analysis.winnerCandidateKey)) {
    throw new Error("O juiz indicou um vencedor inválido.");
  }
}

export async function evaluateGeneratedCandidates(
  profile: PoliticianProfile,
  request: ContentRequestInput,
  candidates: EvaluationCandidateInput[],
  options?: {
    judge?: LlmExecutionOptionsInput;
  },
): Promise<EvaluationJudgeOutcome> {
  if (candidates.length < 1) {
    throw new Error("A avaliacao exige pelo menos um candidato.");
  }

  const prompt = buildJudgePrompt(profile, request, candidates);
  const execution = await requestStructuredJson(prompt.system, prompt.user, {
    provider: options?.judge?.provider,
    model: options?.judge?.model,
    temperature: options?.judge?.temperature ?? 0.1,
    maxTokens: options?.judge?.maxTokens ?? 1800,
    strict: true,
  });

  if (!execution.rawText || !execution.provider || !execution.model) {
    throw new Error("O juiz LLM não retornou resposta utilizavel.");
  }

  const parsed = parseJsonResponse<EvaluationJudgeResult>(execution.rawText);
  const normalized = evaluationJudgeResultSchema.safeParse({
    ...parsed,
    provider: execution.provider,
  });

  if (!normalized.success) {
    throw new Error("O juiz LLM retornou um payload inválido.");
  }

  validateCandidateCoverage(candidates, normalized.data);

  return {
    analysis: normalized.data,
    judgeProvider: execution.provider,
    judgeModel: execution.model,
  };
}
