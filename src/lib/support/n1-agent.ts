import { requestStructuredJson, parseJsonResponse } from "@/lib/llm";
import { buildSupportKnowledgeBase } from "@/lib/support/knowledge-base";
import {
  formatLearningCasesForPrompt,
  retrieveSimilarLearningCases,
} from "@/lib/support/learning";
import type { SupportMessage } from "@/lib/support/types";

export type N1AgentResult = {
  reply: string;
  shouldEscalate: boolean;
  escalateReason: string;
};

type N1Json = {
  reply?: string;
  shouldEscalate?: boolean;
  escalateReason?: string;
};

function buildSystemPrompt(learnedCasesBlock: string) {
  return `Você é o suporte do Mandato Digital (português do Brasil).

Missão: tirar dúvidas sobre o aplicativo e resolver problemas de navegação/fluxo com base na base de conhecimento e nos casos resolvidos semelhantes (quando houver).

Tom e identidade:
- Fale sempre como "Suporte" — nunca diga que é IA, robô, assistente automático, N1, nem que vai transferir para "humano".
- Se precisar escalar, diga de forma natural que a equipe vai aprofundar o caso por aqui (mesma conversa), sem revelar camadas internas.
- Mantenha o mesmo tom cordial e humano em todas as respostas.

Regras:
- Seja claro e objetivo (2–6 frases), com passos numerados quando útil.
- Nunca invente telas, botões ou funcionalidades que não estejam na base ou nos casos resolvidos.
- Nunca peça senha, código de verificação, cartão ou dados sensíveis.
- Use os casos resolvidos semelhantes como referência prioritária quando forem relevantes.
- Se a dúvida estiver fora do escopo, for ambígua demais após tentar esclarecer, ou exigir ação especial (billing, bug persistente, contrato), defina shouldEscalate=true.
- Quando shouldEscalate=true, ainda assim preencha reply com uma mensagem útil e natural.
- Responda SEMPRE em JSON válido:
{"reply":"string","shouldEscalate":boolean,"escalateReason":"string"}

BASE DE CONHECIMENTO:
${buildSupportKnowledgeBase()}
${
  learnedCasesBlock
    ? `
CASOS RESOLVIDOS SEMELHANTES (aprendizados de atendimentos anteriores):
${learnedCasesBlock}
`
    : ""
}`;
}

function buildUserPrompt(input: {
  history: SupportMessage[];
  latestUserMessage: string;
}) {
  const historyLines = input.history
    .filter(
      (m) => m.role === "user" || m.role === "assistant" || m.role === "human",
    )
    .slice(-16)
    .map((m) => {
      const who = m.role === "user" ? "Usuário" : "Suporte";
      return `${who}: ${m.body}`;
    })
    .join("\n");

  return `Histórico recente:
${historyLines || "(vazio)"}

Nova mensagem do usuário:
${input.latestUserMessage}

Responda no JSON pedido.`;
}

const FALLBACK_REPLY =
  "Não consegui concluir isso agora. Você pode tentar de novo em instantes ou usar “Não consegui resolver meu problema” para aprofundarmos o caso.";

export async function runSupportN1(input: {
  history: SupportMessage[];
  latestUserMessage: string;
}): Promise<N1AgentResult> {
  let learnedBlock = "";
  try {
    const cases = await retrieveSimilarLearningCases({
      question: input.latestUserMessage,
      topK: 4,
      minScore: 0.72,
    });
    learnedBlock = formatLearningCasesForPrompt(cases);
  } catch (error) {
    console.error("[support/n1] falha ao recuperar casos", error);
  }

  const execution = await requestStructuredJson(
    buildSystemPrompt(learnedBlock),
    buildUserPrompt(input),
    {
      provider: "openai",
      temperature: 0.35,
      maxTokens: 700,
      strict: true,
    },
  );

  const parsed = execution.rawText
    ? parseJsonResponse<N1Json>(execution.rawText)
    : null;

  const reply = parsed?.reply?.trim() || FALLBACK_REPLY;
  const shouldEscalate = Boolean(parsed?.shouldEscalate);
  const escalateReason =
    parsed?.escalateReason?.trim() ||
    (shouldEscalate ? "Caso precisa de aprofundamento." : "");

  return { reply, shouldEscalate, escalateReason };
}
