import type {
  ProductFeedbackAnalysis,
  ProductFeedbackInput,
} from "@/lib/schemas";
import { productFeedbackAnalysisSchema } from "@/lib/schemas";
import {
  parseJsonResponse,
  requestStructuredJson,
} from "@/lib/llm";

const currentMvpScope = [
  "onboarding do perfil político",
  "entrada manual de pauta",
  "geração de 2 a 3 versões de texto com LLM",
  "revisao humana, aprovacao e historico",
  "feedback editorial da peça",
];

const outOfScopeItems = [
  "monitoramento automatico de sites, redes ou Apify",
  "publicacao automatica em redes sociais",
  "video, avatar ou HeyGen",
  "compliance avancado",
  "multiusuario, times ou permissoes",
];

function buildPrompt(input: ProductFeedbackInput) {
  const system = [
    "Você analisa feedback de produto para um MVP chamado Mandato Digital.",
    "Classifique cada feedback em exatamente uma categoria:",
    "bug, melhoria, fora_do_escopo_atual.",
    "Tambem classifique a criticidade em alta, media ou baixa.",
    "Considere bug quando algo existente deveria funcionar e falha.",
    "Considere melhoria quando o fluxo atual funciona, mas pode ser refinado.",
    "Considere fora_do_escopo_atual quando a pessoa pede algo fora do corte do MVP.",
    "Responda em JSON válido com as chaves:",
    "classification, criticality, rationale, scopeAssessment, suggestedAction, implementationPrompt, provider.",
    "Não invente contexto alem do que foi informado.",
  ].join(" ");

  const user = [
    "Escopo atual do MVP:",
    ...currentMvpScope.map((item) => `- ${item}`),
    "",
    "Itens explicitamente fora do escopo atual:",
    ...outOfScopeItems.map((item) => `- ${item}`),
    "",
    `Tela ou fluxo observado: ${input.screen || "não informado"}`,
    `O que funcionou bem: ${input.workedWell || "não informado"}`,
    `O que não funcionou / observação: ${input.issueObserved}`,
    "",
    "Regras:",
    "- se o relato indicar erro, quebra, travamento, dados não salvando ou comportamento inconsistente, priorize bug;",
    "- se o pedido for uma evolução do que já existe, classifique como melhoria;",
    "- se o pedido cair nos itens fora do corte atual, classifique como fora_do_escopo_atual;",
    "- criticidade alta quando bloquear uso, impedir salvamento, ou comprometer a entrega atual;",
    "- criticidade media quando atrapalhar bastante a experiência, mas houver contorno;",
    "- criticidade baixa quando for refinamento cosmetico, organizacional ou backlog distante;",
    "- suggestedAction deve orientar o proximo passo da equipe em uma frase objetiva;",
    "- implementationPrompt deve ser um prompt final, curto e acionável, descrevendo apenas o que realmente precisa ser implementado agora com base no relato;",
  ].join("\n");

  return { system, user };
}

function classifyHeuristically(
  input: ProductFeedbackInput,
): ProductFeedbackAnalysis {
  const fullText = `${input.screen} ${input.workedWell} ${input.issueObserved}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

  const outOfScopeHints = [
    "apify",
    "monitoramento automatico",
    "publicacao automatica",
    "postar automaticamente",
    "avatar",
    "heygen",
    "multiusuario",
    "multiplos usuarios",
    "permissoes",
    "compliance avancado",
  ];

  const bugHints = [
    "erro",
    "bug",
    "não salva",
    "não salvou",
    "não funciona",
    "travou",
    "quebrou",
    "quebra",
    "falhou",
    "sumiu",
  ];

  const normalizedHints = (hints: string[]) =>
    hints.map((hint) =>
      hint.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, ""),
    );

  const outOfScopeHintsNormalized = normalizedHints(outOfScopeHints);
  const bugHintsNormalized = normalizedHints(bugHints);

  if (outOfScopeHintsNormalized.some((hint) => fullText.includes(hint))) {
    return {
      classification: "fora_do_escopo_atual",
      criticality: "baixa",
      rationale:
        "O relato pede uma capacidade que não faz parte do corte atual do MVP.",
      scopeAssessment:
        "A observação aponta para uma fase posterior do produto, não para o fluxo atual de onboarding, geração e revisao.",
      suggestedAction:
        "Registrar no backlog de fase 2 e manter o foco do ciclo atual no fluxo manual com revisao humana.",
      implementationPrompt:
        "Não implementar agora no MVP. Registrar esta demanda no backlog de próxima fase com contexto e impacto percebido pelo usuário.",
      provider: "fallback-local",
    };
  }

  if (bugHintsNormalized.some((hint) => fullText.includes(hint))) {
    return {
      classification: "bug",
      criticality: "alta",
      rationale:
        "O relato sugere falha de comportamento em algo que já deveria funcionar no MVP atual.",
      scopeAssessment:
        "Isso entra no escopo da entrega atual porque afeta diretamente a experiência do fluxo já implementado.",
      suggestedAction:
        "Reproduzir o erro, validar o fluxo citado e corrigir antes de ampliar escopo.",
      implementationPrompt:
        "Investigue e corrija o fluxo relatado como falho. Reproduza o problema, identifique a causa raiz, ajuste o comportamento esperado e preserve o escopo atual do MVP.",
      provider: "fallback-local",
    };
  }

  return {
    classification: "melhoria",
    criticality: "media",
    rationale:
      "O fluxo descrito parece funcional, mas ha espaco para refinamento de usabilidade ou clareza.",
    scopeAssessment:
      "A sugestao e aderente ao MVP porque melhora o uso do fluxo atual sem ampliar a fronteira do produto.",
    suggestedAction:
      "Priorizar a melhoria conforme impacto no uso recorrente e custo de implementacao.",
    implementationPrompt:
      "Implemente apenas o ajuste necessário para melhorar a usabilidade do fluxo atual, sem expandir o escopo do MVP e sem introduzir automações fora da fase atual.",
    provider: "fallback-local",
  };
}

export async function analyzeProductFeedback(
  input: ProductFeedbackInput,
): Promise<ProductFeedbackAnalysis> {
  const prompt = buildPrompt(input);

  try {
    const execution = await requestStructuredJson(
      prompt.system,
      prompt.user,
      {
        temperature: 0.2,
        maxTokens: 700,
      },
    );

    if (!execution.rawText || !execution.provider) {
      return classifyHeuristically(input);
    }

    const parsed = parseJsonResponse<ProductFeedbackAnalysis>(execution.rawText);
    const normalized = productFeedbackAnalysisSchema.safeParse({
      ...parsed,
      provider: execution.provider,
    });

    if (!normalized.success) {
      return classifyHeuristically(input);
    }

    return normalized.data;
  } catch {
    return classifyHeuristically(input);
  }
}
