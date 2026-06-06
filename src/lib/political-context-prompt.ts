import { requestPlainText } from "@/lib/llm";

export const POLITICAL_CONTEXT_PROMPT_VERSION = "context-01";

export type PoliticalContextPromptInput = {
  topic: string;
  fieldIntelligence?: string;
};

export type PoliticalContextPromptBundle = {
  templateId: "political-context-01";
  promptVersion: typeof POLITICAL_CONTEXT_PROMPT_VERSION;
  system: string;
  user: string;
};

export function buildPoliticalContextPrompt(
  input: PoliticalContextPromptInput,
): PoliticalContextPromptBundle {
  const system = [
    "Voce e um Analista Politico Senior e Estrategista de Cenarios Imparcial.",
    "Sua missao e dissecar um tema ou noticia recente, fornecendo um raio-x do cenario politico atual.",
    "Voce nao deve tomar partido. Seu objetivo e mastigar a informacao de forma objetiva para que a equipe de marketing politico possa usa-la posteriormente.",
    "Para qualquer tema enviado, voce DEVE retornar a sua analise estritamente no seguinte formato:",
    "1. O FATO (O que esta acontecendo na realidade, resumo objetivo sem vies).",
    "2. A NARRATIVA DA ESQUERDA (Como os politicos e eleitores de esquerda estao interpretando este fato? Quais sao seus medos, argumentos e palavras de ordem sobre isso?).",
    "3. A NARRATIVA DA DIREITA (Como os politicos e eleitores de direita estao interpretando este fato? Quais sao seus medos, argumentos e palavras de ordem sobre isso?).",
    "4. A NARRATIVA DE CENTRO (Como os politicos de centro, moderados e independentes interpretam este fato? Qual e a visao pragmatica, institucional ou o meio-termo sobre o assunto?).",
    "5. O CLIMA POPULAR (Qual e a principal emocao da populacao em geral sobre este tema no momento? Ex: indignacao, medo, esperanca, confusao?).",
    "Seja direto, cirurgico e utilize topicos (bullet points) para facilitar a leitura.",
  ].join("\n");

  const userParts = [
    "Faca o raio-x do contexto politico para o seguinte tema ou noticia:",
    `Tema/Noticia: ${input.topic.trim()}`,
  ];

  if (input.fieldIntelligence?.trim()) {
    userParts.push(
      "",
      "Dados de campo verificados pela equipe (use como ancora factual; nao invente alem disso):",
      input.fieldIntelligence.trim(),
    );
  }

  return {
    templateId: "political-context-01",
    promptVersion: POLITICAL_CONTEXT_PROMPT_VERSION,
    system,
    user: userParts.join("\n"),
  };
}

function buildPoliticalContextFallback(topic: string) {
  const trimmed = topic.trim();
  return [
    "1. O FATO",
    `- Tema em discussao: ${trimmed}.`,
    "",
    "2. A NARRATIVA DA ESQUERDA",
    "- A definir com mais inteligencia de cenario.",
    "",
    "3. A NARRATIVA DA DIREITA",
    "- A definir com mais inteligencia de cenario.",
    "",
    "4. A NARRATIVA DE CENTRO",
    "- A definir com mais inteligencia de cenario.",
    "",
    "5. O CLIMA POPULAR",
    "- A definir com mais inteligencia de cenario.",
  ].join("\n");
}

export async function buildPoliticalContext(input: PoliticalContextPromptInput) {
  const prompt = buildPoliticalContextPrompt(input);
  const execution = await requestPlainText(prompt.system, prompt.user, {
    temperature: 0.45,
    maxTokens: 1400,
  });

  const raw = execution.rawText?.trim() ?? "";
  if (raw) {
    return raw;
  }

  return buildPoliticalContextFallback(input.topic);
}
