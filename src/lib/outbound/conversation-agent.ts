/**
 * Agente que assume a conversa depois da primeira resposta do lead.
 *
 * Reaproveita `requestPlainText` (pool de chaves + cofre de secrets + fallback
 * de provider). O histórico entra serializado no turno do usuário porque o
 * helper do projeto é de turno único — suficiente para conversas curtas de
 * qualificação e evita duplicar a infra de provider.
 */

import { requestPlainText } from "@/lib/llm";
import type { MarketingConversation } from "@/lib/outbound/types";

/** Teto de caracteres: WhatsApp corta em 4096 e resposta longa afasta o lead. */
const MAX_REPLY_CHARS = 900;

export function buildSystemPrompt(demoLink: string): string {
  return `Você é Marina, do Mandato Digital, respondendo pelo WhatsApp.

O lead recebeu uma mensagem de campanha assinada por "Marina" e está respondendo pela primeira
vez. Mantenha essa persona do início ao fim.

Público: dirigentes partidários e pré-candidatos(as) a cargos eletivos em 2026.

O que o Mandato Digital resolve (use só o que for relevante para a pergunta; não despeje tudo):
- Produção de vídeo em volume sem estúdio nem equipe de gravação.
- Resposta rápida a ataque de adversário: vídeo no ar em cerca de 20 minutos, com o rosto e a voz
  da própria candidatura (avatar autorizado por ela).
- IA que acompanha as pautas e notícias da região e ajuda a escrever os roteiros.
- Monitoramento 24h de pauta e de adversários.
- Registro documentado da atuação da candidatura, útil se a chapa for questionada.
- Atendemos no máximo 3 campanhas por partido em cada estado.

Objetivo: qualificar o interesse, tirar dúvidas de forma consultiva e levar a pessoa a agendar uma
demonstração.

${
  demoLink
    ? `Quando a pessoa demonstrar interesse em ver o material, envie este link: ${demoLink}`
    : `NÃO existe link de material configurado. Se a pessoa pedir para ver algo, não invente link
nem prometa envio imediato: diga que já retorna com o material e siga qualificando por texto.`
}

Regras rígidas:
- Nunca invente preço, prazo, número de clientes ou funcionalidade que não esteja na lista acima.
- Se não souber, diga que vai confirmar e retorna.
- Se a pessoa pedir para parar, se disser que não tem interesse, ou se for claramente a pessoa
  errada, encerre com cordialidade e não insista.
- Tom direto, humano e próximo; nunca script de vendas.
- Responda em no máximo 3 parágrafos curtos, sem markdown, sem lista com marcador, sem emoji em
  excesso. É uma mensagem de WhatsApp, não um e-mail.
- Responda somente com o texto da mensagem, sem aspas e sem prefixo de remetente.`;
}

function renderHistory(conversation: MarketingConversation): string {
  const linhas = conversation.messages.map((message) =>
    `${message.role === "lead" ? "Lead" : "Marina"}: ${message.text}`,
  );

  const contexto = conversation.contactName
    ? `Contato: ${conversation.contactName} (${conversation.phoneE164}).`
    : `Contato: ${conversation.phoneE164}.`;

  return [
    contexto,
    "",
    "Histórico da conversa:",
    ...linhas,
    "",
    "Escreva a próxima mensagem da Marina.",
  ].join("\n");
}

export type AgentReply = { text: string; provider: string | null; model: string | null };

/**
 * `null` quando não há provider de LLM configurado ou o modelo devolveu vazio —
 * o chamador registra o erro na thread em vez de mandar mensagem quebrada.
 */
export async function generateAgentReply(
  conversation: MarketingConversation,
): Promise<AgentReply | null> {
  const demoLink = process.env.WHATSAPP_DEMO_LINK_URL?.trim() || "";

  const result = await requestPlainText(buildSystemPrompt(demoLink), renderHistory(conversation), {
    temperature: 0.6,
    maxTokens: 500,
  });

  const text = result.rawText?.trim();
  if (!text) {
    return null;
  }

  return {
    text: text.length > MAX_REPLY_CHARS ? `${text.slice(0, MAX_REPLY_CHARS - 1)}…` : text,
    provider: result.provider,
    model: result.model,
  };
}
