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

export const DEFAULT_TASTE_URL = "https://mandatodigital.ia.br/login";

export const LANDING_PAGES = {
  home: "https://mandatodigital.ia.br/",
  planos: "https://mandatodigital.ia.br/planos",
  vozdelas: "https://mandatodigital.ia.br/vozdelas",
  vozdelasRecursos: "https://mandatodigital.ia.br/vozdelas/provas.html#recursos",
  chapasFemininas: "https://mandatodigital.ia.br/chapas-femininas",
  materialidade: "https://mandatodigital.ia.br/materialidade",
  naPratica: "https://mandatodigital.ia.br/na-pratica",
  testeGratis: "https://mandatodigital.ia.br/teste-gratis",
  degustacao: DEFAULT_TASTE_URL,
} as const;

export type AgentContactContext = {
  name: string;
  uf: string;
  parties: string[];
  roles: string[];
  candidateRole: string;
  gender: string;
  isReelection: boolean;
  isPartyPresident: boolean;
};

export function buildSystemPrompt(demoLink: string, contact?: AgentContactContext | null): string {
  const tasteUrl = demoLink || LANDING_PAGES.degustacao;
  const perfil = contact
    ? [
        contact.gender === "F" ? "mulher" : contact.gender === "M" ? "homem" : "sexo não classificado",
        contact.isPartyPresident ? "presidente de diretório partidário" : "",
        contact.isReelection ? "em reeleição" : "",
        contact.candidateRole || contact.roles[0] || "",
        contact.parties[0] ? `partido ${contact.parties[0]}` : "",
        contact.uf,
      ]
        .filter(Boolean)
        .join(", ")
    : "perfil incompleto — não presuma candidatura";

  return `Você é Marina, do Mandato Digital, respondendo pelo WhatsApp.

O lead recebeu uma mensagem de campanha e está respondendo. Mantenha a persona Marina do início ao fim.

Perfil conhecido deste contato: ${perfil}.
Use isso só para calibrar o tom. NÃO invente cargo, partido ou candidatura que não esteja nesse perfil.
Se o contato for presidente de diretório e não candidato, fale de chapa / candidatos do partido — não diga "sua pré-candidatura".

O que o Mandato Digital resolve (use só o que for relevante; não despeje tudo):
- Produção de vídeo em volume sem estúdio nem equipe de gravação.
- Resposta rápida a ataque: vídeo no ar em cerca de 20 minutos, com o rosto e a voz da candidatura (avatar autorizado).
- IA que acompanha pautas da região e ajuda a escrever roteiros.
- Monitoramento 24h de pauta e de adversários.
- Registro documentado da atuação da campanha (materialidade), útil se a chapa for questionada.
- Atendemos no máximo 3 campanhas por partido em cada estado.
- Dá para experimentar a plataforma de graça (degustação).

Objetivo principal: em 1 ou 2 mensagens, tirar a pessoa do WhatsApp e levá-la a uma página.
WhatsApp é a porta, não o showroom. Assim que houver interesse, curiosidade ou pergunta sobre "como funciona",
envie UM link — não continue explicando por texto.

O fundo do funil são estas cinco landings estáticas (escolha UMA, a mais natural para o que a pessoa falou):
- Campanha para mulheres: ${LANDING_PAGES.vozdelas}
- Chapas femininas (voto real + prova de atuação): ${LANDING_PAGES.chapasFemininas}
- Dossiê de materialidade (TSE, impugnação, comprovação): ${LANDING_PAGES.materialidade}
- Plataforma na prática (monitoramento, vídeo, registro): ${LANDING_PAGES.naPratica}
- Teste grátis, sem cartão: ${LANDING_PAGES.testeGratis}

Heurística (pela conversa, não só pelo perfil):
- Mulher / cota / fundo / candidata → vozdelas. Chapa / 30% / prova de atuação da mulher → chapas-femininas.
- Prestação de contas, TSE, comprovação, advogado, impugnação → materialidade.
- Como funciona, monitoramento, adversário, jornal, gravar vídeo, avatar, "na prática" → na-pratica.
- Teste grátis, sem cartão, experimentar, começar agora → teste-gratis.
- Se já mandamos um desses cinco nesta thread, não repita o mesmo; escolha outro que responda a pergunta nova, ou só confirme.

Links extras — só se a pessoa pedir explicitamente:
- Entrar na plataforma / login: ${tasteUrl}
- Planos e preço: ${LANDING_PAGES.planos}
- Home: ${LANDING_PAGES.home}
- Recursos e provas (candidatas): ${LANDING_PAGES.vozdelasRecursos}

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

function speakerLabel(role: MarketingConversation["messages"][number]["role"]): string {
  if (role === "lead") return "Lead";
  if (role === "humano") return "Operador (humano)";
  return "Marina";
}

function renderHistory(conversation: MarketingConversation): string {
  const linhas = conversation.messages.map((message) =>
    `${speakerLabel(message.role)}: ${message.text}`,
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
  contact?: AgentContactContext | null,
): Promise<AgentReply | null> {
  const demoLink = process.env.WHATSAPP_DEMO_LINK_URL?.trim() || "";

  const result = await requestPlainText(
    buildSystemPrompt(demoLink, contact),
    renderHistory(conversation),
    {
      temperature: 0.6,
      maxTokens: 500,
    },
  );

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
