/**
 * Disparo das campanhas do painel de marketing (e-mail via Resend, WhatsApp
 * via Cloud API). Cada clique envia um lote; redisparar atinge só quem ficou
 * pendente. Ver docs/marketing-outbound.md.
 */

import { Resend } from "resend";

import {
  listCampaignSends,
  recordSends,
  setCampaignStatus,
} from "@/lib/outbound/campaigns-storage";
import { listMarketingContacts } from "@/lib/outbound/contacts-storage";
import { applySegment } from "@/lib/outbound/segment-filter";
import { getMarketingSegment } from "@/lib/outbound/segments-storage";
import {
  renderTemplate,
  type CampaignStats,
  type MarketingCampaign,
  type MarketingContact,
  type MarketingSend,
} from "@/lib/outbound/types";
import { resolveWhatsappConfig, sendTemplate } from "@/lib/outbound/whatsapp";

/** Limite da API de batch do Resend. */
const RESEND_BATCH_SIZE = 100;

/**
 * Teto por disparo. Segura o tempo da request (o envio é síncrono) e evita
 * queimar reputação de domínio com um blast grande de uma vez. Aumentar só
 * junto com um worker assíncrono.
 */
export const MAX_RECIPIENTS_PER_DISPATCH = 500;

/**
 * Teto menor no WhatsApp: número novo começa em tier baixo (na casa de algumas
 * centenas de conversas iniciadas por dia) e volume frio derruba a nota de
 * qualidade rápido. Subir só depois do tier subir.
 */
export const MAX_WHATSAPP_RECIPIENTS_PER_DISPATCH = 50;

/** Intervalo entre mensagens do WhatsApp (envio sequencial). */
const WHATSAPP_SEND_INTERVAL_MS = 1_200;

export class DispatchError extends Error {}

export function effectiveBatchSize(campaign: MarketingCampaign): number {
  const cap =
    campaign.channel === "whatsapp"
      ? MAX_WHATSAPP_RECIPIENTS_PER_DISPATCH
      : MAX_RECIPIENTS_PER_DISPATCH;
  const requested = campaign.batchSize > 0 ? campaign.batchSize : cap;
  return Math.min(Math.max(requested, 1), cap);
}

/**
 * Espelha o resolver de legal/email.ts (cofre de provider secrets → env).
 * Duplicado de propósito: o caminho de contrato é crítico de billing e não
 * deve ser refatorado por causa do outbound.
 */
async function resolveResendClient() {
  let apiKey = process.env.RESEND_API_KEY?.trim() || "";
  try {
    const { resolveProviderApiKey } = await import("@/lib/admin/provider-secrets");
    const resolved = await resolveProviderApiKey("resend");
    if (resolved.token) {
      apiKey = resolved.token;
    }
  } catch {
    // Firestore indisponível — usa env.
  }

  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) {
    return null;
  }

  return { resend: new Resend(apiKey), from };
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export type DispatchResult = {
  stats: CampaignStats;
  skippedAlreadySent: number;
  remaining: number;
};

/**
 * Resolve o público da campanha no momento do disparo (o segmento é um filtro,
 * não uma lista congelada) e remove quem já recebeu esta campanha — reenviar a
 * mesma campanha só atinge quem ficou pendente.
 */
async function resolveRecipients(
  campaign: MarketingCampaign,
): Promise<{ recipients: MarketingContact[]; skippedAlreadySent: number }> {
  const segment = await getMarketingSegment(campaign.segmentId);
  if (!segment) {
    throw new DispatchError("Segmento da campanha não existe mais.");
  }

  const contacts = await listMarketingContacts();
  const inSegment = applySegment(contacts, {
    ...segment.filter,
    // O canal da campanha manda: não adianta e-mail para quem não tem e-mail.
    channel: campaign.channel,
  });

  const previousSends = await listCampaignSends(campaign.id);
  const alreadySent = new Set(
    previousSends.filter((send) => send.status === "enviado").map((send) => send.contactId),
  );

  const recipients = inSegment.filter((contact) => !alreadySent.has(contact.id));

  return { recipients, skippedAlreadySent: inSegment.length - recipients.length };
}

type ChannelResult = {
  sends: Omit<MarketingSend, "id">[];
  sent: number;
  failed: number;
};

async function dispatchEmail(
  campaign: MarketingCampaign,
  recipients: MarketingContact[],
): Promise<ChannelResult> {
  const client = await resolveResendClient();
  if (!client) {
    throw new DispatchError("Resend não configurado (RESEND_API_KEY / EMAIL_FROM).");
  }

  const sends: Omit<MarketingSend, "id">[] = [];
  let sent = 0;
  let failed = 0;

  for (const group of chunk(recipients, RESEND_BATCH_SIZE)) {
    const payload = group.map((contact) => ({
      from: client.from,
      to: [contact.email],
      subject: renderTemplate(campaign.subject, contact),
      text: renderTemplate(campaign.body, contact),
    }));

    const createdAt = new Date().toISOString();
    let batchError = "";

    try {
      const { error } = await client.resend.batch.send(payload);
      if (error) {
        batchError = error.message || "Falha no envio (Resend).";
      }
    } catch (error) {
      batchError = error instanceof Error ? error.message : "Falha no envio (Resend).";
    }

    for (const contact of group) {
      sends.push({
        campaignId: campaign.id,
        contactId: contact.id,
        channel: "email",
        destination: contact.email,
        contactName: contact.name,
        status: batchError ? "falhou" : "enviado",
        error: batchError,
        providerMessageId: "",
        createdAt,
      });
    }

    if (batchError) {
      failed += group.length;
    } else {
      sent += group.length;
    }
  }

  return { sends, sent, failed };
}

/**
 * WhatsApp é um-a-um (não há batch na Cloud API) e o erro é por destinatário —
 * número inválido em um contato não pode derrubar a leva inteira.
 */
async function dispatchWhatsapp(
  campaign: MarketingCampaign,
  recipients: MarketingContact[],
): Promise<ChannelResult> {
  const config = await resolveWhatsappConfig();
  if (!config) {
    throw new DispatchError(
      "WhatsApp não configurado (WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN).",
    );
  }

  const sends: Omit<MarketingSend, "id">[] = [];
  let sent = 0;
  let failed = 0;

  for (const [index, contact] of recipients.entries()) {
    const params = campaign.templateParams.map((expression) =>
      renderTemplate(expression, contact),
    );

    const base = {
      campaignId: campaign.id,
      contactId: contact.id,
      channel: "whatsapp" as const,
      destination: contact.phoneE164,
      contactName: contact.name,
      createdAt: new Date().toISOString(),
    };

    try {
      const { messageId } = await sendTemplate({
        config,
        to: contact.phoneE164,
        templateName: campaign.templateName,
        languageCode: campaign.templateLanguage,
        params,
      });
      sends.push({ ...base, status: "enviado", error: "", providerMessageId: messageId });
      sent += 1;
    } catch (error) {
      sends.push({
        ...base,
        status: "falhou",
        error: error instanceof Error ? error.message : "Falha no envio (WhatsApp).",
        providerMessageId: "",
      });
      failed += 1;
    }

    // Espaça os envios: número novo com qualidade "pendente" é justamente o que
    // a Meta mais penaliza em rajada.
    if (index < recipients.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, WHATSAPP_SEND_INTERVAL_MS));
    }
  }

  return { sends, sent, failed };
}

export async function dispatchCampaign(campaign: MarketingCampaign): Promise<DispatchResult> {
  if (campaign.status === "enviando") {
    throw new DispatchError("Campanha já está sendo enviada.");
  }

  if (campaign.channel === "email") {
    if (!campaign.subject.trim()) {
      throw new DispatchError("Assunto é obrigatório para campanha de e-mail.");
    }
    if (!campaign.body.trim()) {
      throw new DispatchError("Corpo da mensagem é obrigatório.");
    }
  } else if (!campaign.templateName.trim()) {
    throw new DispatchError(
      "Template aprovado é obrigatório para campanha de WhatsApp (ex.: md_intro_vaga_sigla_v1).",
    );
  }

  const { recipients, skippedAlreadySent } = await resolveRecipients(campaign);
  const lote = recipients.slice(0, effectiveBatchSize(campaign));
  const remaining = recipients.length - lote.length;

  if (lote.length === 0) {
    throw new DispatchError(
      skippedAlreadySent > 0
        ? "Todos os contatos do segmento já receberam esta campanha."
        : "Nenhum contato no segmento para este canal.",
    );
  }

  await setCampaignStatus(campaign.id, "enviando");

  let sends: Omit<MarketingSend, "id">[] = [];
  let sent = 0;
  let failed = 0;

  try {
    const result =
      campaign.channel === "whatsapp"
        ? await dispatchWhatsapp(campaign, lote)
        : await dispatchEmail(campaign, lote);
    sends = result.sends;
    sent = result.sent;
    failed = result.failed;
  } catch (error) {
    // Erro inesperado (fora da falha de batch, que já é tratada acima): a
    // campanha não pode ficar presa em "enviando", senão o guard de reentrada
    // impede qualquer nova tentativa.
    if (sends.length > 0) {
      await recordSends(sends);
    }
    await setCampaignStatus(campaign.id, "erro", {
      stats: {
        total: campaign.stats.total + sent + failed,
        sent: campaign.stats.sent + sent,
        failed: campaign.stats.failed + failed,
      },
      lastError: error instanceof Error ? error.message : "Erro inesperado no disparo.",
    });
    throw error;
  }

  // Trilha só é gravada aqui no caminho feliz — o catch acima cobre o resto.
  if (sends.length > 0) {
    await recordSends(sends);
  }

  const stats: CampaignStats = {
    total: campaign.stats.total + lote.length,
    sent: campaign.stats.sent + sent,
    failed: campaign.stats.failed + failed,
  };

  await setCampaignStatus(campaign.id, failed > 0 && sent === 0 ? "erro" : "enviada", {
    stats,
    lastError: failed > 0 ? sends.find((send) => send.error)?.error ?? "" : "",
    sentAt: new Date().toISOString(),
  });

  return { stats, skippedAlreadySent, remaining };
}

/** Prévia do público sem enviar nada — usada no painel antes de disparar. */
export async function previewCampaignAudience(campaign: MarketingCampaign): Promise<{
  total: number;
  skippedAlreadySent: number;
  batchSize: number;
  thisBatch: number;
  sample: Array<{ name: string; destination: string }>;
}> {
  const { recipients, skippedAlreadySent } = await resolveRecipients(campaign);
  const batchSize = effectiveBatchSize(campaign);
  const thisBatch = Math.min(recipients.length, batchSize);

  return {
    total: recipients.length,
    skippedAlreadySent,
    batchSize,
    thisBatch,
    sample: recipients.slice(0, thisBatch).map((contact) => ({
      name: contact.name,
      destination: campaign.channel === "email" ? contact.email : contact.phoneE164,
    })),
  };
}
