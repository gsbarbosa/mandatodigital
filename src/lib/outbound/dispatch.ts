/**
 * Disparo das campanhas do painel de marketing.
 *
 * MVP: só e-mail (Resend). WhatsApp fica fail-closed até a Cloud API ser
 * configurada — a campanha pode ser criada e segmentada, mas o disparo recusa
 * em vez de fingir que enviou. Ver docs/marketing-outbound.md.
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

/** Limite da API de batch do Resend. */
const RESEND_BATCH_SIZE = 100;

/**
 * Teto por disparo. Segura o tempo da request (o envio é síncrono) e evita
 * queimar reputação de domínio com um blast grande de uma vez. Aumentar só
 * junto com um worker assíncrono.
 */
export const MAX_RECIPIENTS_PER_DISPATCH = 500;

export class DispatchError extends Error {}

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

export async function dispatchCampaign(campaign: MarketingCampaign): Promise<DispatchResult> {
  if (campaign.status === "enviando") {
    throw new DispatchError("Campanha já está sendo enviada.");
  }
  if (campaign.channel === "whatsapp") {
    throw new DispatchError(
      "Disparo por WhatsApp ainda não está ligado (Cloud API não configurada). A campanha continua salva como rascunho.",
    );
  }
  if (!campaign.subject.trim()) {
    throw new DispatchError("Assunto é obrigatório para campanha de e-mail.");
  }
  if (!campaign.body.trim()) {
    throw new DispatchError("Corpo da mensagem é obrigatório.");
  }

  const client = await resolveResendClient();
  if (!client) {
    throw new DispatchError("Resend não configurado (RESEND_API_KEY / EMAIL_FROM).");
  }

  const { recipients, skippedAlreadySent } = await resolveRecipients(campaign);

  if (recipients.length === 0) {
    throw new DispatchError(
      skippedAlreadySent > 0
        ? "Todos os contatos do segmento já receberam esta campanha."
        : "Nenhum contato no segmento para este canal.",
    );
  }
  if (recipients.length > MAX_RECIPIENTS_PER_DISPATCH) {
    throw new DispatchError(
      `Segmento tem ${recipients.length} contatos e o teto por disparo é ${MAX_RECIPIENTS_PER_DISPATCH}. Estreite o segmento (ex.: por UF) e dispare em levas.`,
    );
  }

  await setCampaignStatus(campaign.id, "enviando");

  const sends: Omit<MarketingSend, "id">[] = [];
  let sent = 0;
  let failed = 0;

  try {
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
          createdAt,
        });
      }

      if (batchError) {
        failed += group.length;
      } else {
        sent += group.length;
      }
    }
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
    total: campaign.stats.total + recipients.length,
    sent: campaign.stats.sent + sent,
    failed: campaign.stats.failed + failed,
  };

  await setCampaignStatus(campaign.id, failed > 0 && sent === 0 ? "erro" : "enviada", {
    stats,
    lastError: failed > 0 ? sends.find((send) => send.error)?.error ?? "" : "",
    sentAt: new Date().toISOString(),
  });

  return { stats, skippedAlreadySent };
}

/** Prévia do público sem enviar nada — usada no painel antes de disparar. */
export async function previewCampaignAudience(campaign: MarketingCampaign): Promise<{
  total: number;
  skippedAlreadySent: number;
  sample: Array<{ name: string; destination: string }>;
}> {
  const { recipients, skippedAlreadySent } = await resolveRecipients(campaign);

  return {
    total: recipients.length,
    skippedAlreadySent,
    sample: recipients.slice(0, 5).map((contact) => ({
      name: contact.name,
      destination: campaign.channel === "email" ? contact.email : contact.phoneE164,
    })),
  };
}
