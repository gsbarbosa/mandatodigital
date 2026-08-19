/**
 * Disparo nomeado de WhatsApp: o operador escolhe template + nomes,
 * vê o preview e só então confirma o envio.
 *
 * Não passa pelo segmento da campanha. A trilha vai para
 * `marketingSends` com campaignId `named:{template}`.
 */

import { listCampaignSends, listWhatsappSends, recordSends } from "@/lib/outbound/campaigns-storage";
import { listMarketingContacts, recordDispatchContact } from "@/lib/outbound/contacts-storage";
import { getBrazilDateParts } from "@/lib/guest-limits";
import { matchContactsByName } from "@/lib/outbound/match-contacts";
import { renderTemplate, type MarketingContact, type MarketingSend } from "@/lib/outbound/types";
import {
  fetchApprovedTemplate,
  fillTemplatePlaceholders,
  resolveTemplateCatalogEntry,
  type LiveWhatsappTemplate,
  type WhatsappTemplateCatalogEntry,
} from "@/lib/outbound/whatsapp-templates";
import { resolveWhatsappConfig, sendTemplate } from "@/lib/outbound/whatsapp";

export const NAMED_DISPATCH_DAILY_CAP = 100;
/** Piso/teto do intervalo aleatório entre envios (anti-rajada). */
export const NAMED_DISPATCH_INTERVAL_MIN_MS = 20_000;
export const NAMED_DISPATCH_INTERVAL_MAX_MS = 60_000;
export const NAMED_CAMPAIGN_PREFIX = "named:";

export function namedCampaignId(templateName: string): string {
  return `${NAMED_CAMPAIGN_PREFIX}${templateName}`;
}

export function randomDispatchIntervalMs(random: () => number = Math.random): number {
  const span = NAMED_DISPATCH_INTERVAL_MAX_MS - NAMED_DISPATCH_INTERVAL_MIN_MS;
  return Math.round(NAMED_DISPATCH_INTERVAL_MIN_MS + random() * span);
}

export type NamedRowStatus =
  | "ready"
  | "ambiguous"
  | "missing"
  | "no_phone"
  | "suspended"
  | "already_sent"
  | "opt_out";

export type NamedPreviewRow = {
  query: string;
  status: NamedRowStatus;
  contactId: string;
  name: string;
  uf: string;
  parties: string[];
  phoneE164: string;
  relevanceTier: string;
  vip: boolean;
  params: string[];
  rendered: string;
  warnings: string[];
  candidates: Array<{ name: string; uf: string; phoneE164: string; id: string }>;
  profile: MarketingContact | null;
};

export type NamedPreview = {
  template: WhatsappTemplateCatalogEntry;
  live: LiveWhatsappTemplate | null;
  bodySource: "meta" | "catalog" | "params-only";
  body: string;
  language: string;
  todaySent: number;
  dailyCap: number;
  rows: NamedPreviewRow[];
  ready: NamedPreviewRow[];
};

export function brazilTodayKey(now: Date | number = Date.now()): string {
  const parts = getBrazilDateParts(now);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function rowFromContact(
  query: string,
  contact: MarketingContact,
  status: NamedRowStatus,
  params: string[],
  body: string | null,
  extraWarnings: string[] = [],
): NamedPreviewRow {
  const warnings = [...extraWarnings];
  const vip = contact.relevanceTier === "vip";
  if (vip) {
    warnings.push("VIP — custo de template frio é alto; só envie se for contato pessoal consciente.");
  }
  const rendered = body
    ? fillTemplatePlaceholders(body, params)
    : params.map((value, index) => `{{${index + 1}}} ${value}`).join(" · ");

  return {
    query,
    status,
    contactId: contact.id,
    name: contact.name,
    uf: contact.uf,
    parties: contact.parties,
    phoneE164: contact.phoneE164,
    relevanceTier: contact.relevanceTier,
    vip,
    params,
    rendered,
    warnings,
    candidates: [],
    profile: contact,
  };
}

export function buildNamedPreview(input: {
  queries: string[];
  contacts: MarketingContact[];
  template: WhatsappTemplateCatalogEntry;
  body: string | null;
  alreadySentIds: Set<string>;
  todaySent: number;
}): NamedPreview {
  const matches = matchContactsByName(input.contacts, input.queries);
  const rows: NamedPreviewRow[] = matches.map((match) => {
    if (match.status === "missing") {
      return {
        query: match.query,
        status: "missing",
        contactId: "",
        name: "",
        uf: "",
        parties: [],
        phoneE164: "",
        relevanceTier: "",
        vip: false,
        params: [],
        rendered: "",
        warnings: [],
        candidates: [],
        profile: null,
      };
    }
    if (match.status === "ambiguous") {
      return {
        query: match.query,
        status: "ambiguous",
        contactId: "",
        name: "",
        uf: "",
        parties: [],
        phoneE164: "",
        relevanceTier: "",
        vip: false,
        params: [],
        rendered: "",
        warnings: [],
        candidates: match.candidates.slice(0, 8).map((contact) => ({
          name: contact.name,
          uf: contact.uf,
          phoneE164: contact.phoneE164,
          id: contact.id,
        })),
        profile: null,
      };
    }

    const contact = match.contact;
    const params = input.template.defaultParams.map((expression) =>
      renderTemplate(expression, contact),
    );
    if (contact.optOut) {
      return rowFromContact(
        match.query,
        contact,
        "opt_out",
        params,
        input.body,
        ["Opt-out — não envia template."],
      );
    }
    if (contact.suspended) {
      return rowFromContact(match.query, contact, "suspended", params, input.body);
    }
    if (!contact.phoneE164) {
      return rowFromContact(match.query, contact, "no_phone", params, input.body);
    }
    if (input.alreadySentIds.has(contact.id)) {
      return rowFromContact(
        match.query,
        contact,
        "already_sent",
        params,
        input.body,
        ["Já recebeu este template neste disparo nomeado."],
      );
    }
    return rowFromContact(match.query, contact, "ready", params, input.body);
  });

  return {
    template: input.template,
    live: null,
    bodySource: input.body ? "catalog" : "params-only",
    body: input.body ?? "",
    language: "pt_BR",
    todaySent: input.todaySent,
    dailyCap: NAMED_DISPATCH_DAILY_CAP,
    rows,
    ready: rows.filter((row) => row.status === "ready"),
  };
}

export async function previewNamedWhatsappDispatch(input: {
  templateRaw: string;
  namesRaw: string;
  queries?: string[];
  contacts?: MarketingContact[];
}): Promise<NamedPreview> {
  const template = resolveTemplateCatalogEntry(input.templateRaw);
  if (!template) {
    throw new Error(
      `Template não reconhecido: "${input.templateRaw}". Use um dos nomes md_intro_* ou um apelido do catálogo.`,
    );
  }

  const { parseNameList } = await import("@/lib/outbound/match-contacts");
  const queries = input.queries ?? parseNameList(input.namesRaw);
  if (queries.length === 0) {
    throw new Error("Informe pelo menos um nome.");
  }

  let live: LiveWhatsappTemplate | null = null;
  try {
    live = await fetchApprovedTemplate(template.name);
  } catch {
    live = null;
  }

  const body = live?.body || template.body;
  const stored = await listMarketingContacts();
  const storedByPhone = new Map(stored.map((item) => [item.phoneE164, item]));
  const contacts = (input.contacts ?? stored).map((contact) => {
    const existing = storedByPhone.get(contact.phoneE164);
    if (!existing || existing.id === contact.id) {
      return existing && input.contacts
        ? { ...contact, optOut: existing.optOut, lastTemplate: existing.lastTemplate }
        : contact;
    }
    return {
      ...contact,
      id: existing.id,
      optOut: existing.optOut,
      lastTemplate: existing.lastTemplate,
    };
  });
  const previous = await listCampaignSends(namedCampaignId(template.name));
  const alreadySentIds = new Set(
    previous.filter((send) => send.status === "enviado").map((send) => send.contactId),
  );
  const todayKey = brazilTodayKey();
  let todaySent = 0;
  try {
    const whatsappSends = await listWhatsappSends();
    todaySent = whatsappSends.filter((send) => {
      const at = Date.parse(send.createdAt);
      return send.status === "enviado" && Number.isFinite(at) && brazilTodayKey(at) === todayKey;
    }).length;
  } catch {
    todaySent = 0;
  }

  const preview = buildNamedPreview({
    queries,
    contacts,
    template:
      live && live.paramCount > 0 && live.paramCount !== template.paramCount
        ? { ...template, paramCount: live.paramCount }
        : template,
    body,
    alreadySentIds,
    todaySent,
  });

  preview.live = live;
  preview.bodySource = live?.body ? "meta" : body ? "catalog" : "params-only";
  preview.body = body ?? "";
  preview.language = live?.language || "pt_BR";
  return preview;
}

export type NamedSendResult = {
  sent: number;
  failed: number;
  skipped: number;
  rows: Array<{
    name: string;
    phoneE164: string;
    status: "enviado" | "falhou";
    error: string;
    providerMessageId: string;
  }>;
};

export async function sendNamedWhatsappDispatch(preview: NamedPreview): Promise<NamedSendResult> {
  if (preview.live && preview.live.status && preview.live.status !== "APPROVED") {
    throw new Error(`Template ${preview.template.name} não está APPROVED na Meta (${preview.live.status}).`);
  }

  const config = await resolveWhatsappConfig();
  if (!config) {
    throw new Error(
      "WhatsApp não configurado (WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN). Sem token local, não envia.",
    );
  }

  const remainingCap = Math.max(0, preview.dailyCap - preview.todaySent);
  const lote = preview.ready.slice(0, remainingCap);
  const skipped = preview.ready.length - lote.length;

  const sends: Omit<MarketingSend, "id">[] = [];
  const rows: NamedSendResult["rows"] = [];
  let sent = 0;
  let failed = 0;

  for (const [index, row] of lote.entries()) {
    const base = {
      campaignId: namedCampaignId(preview.template.name),
      contactId: row.contactId,
      channel: "whatsapp" as const,
      destination: row.phoneE164,
      contactName: row.name,
      createdAt: new Date().toISOString(),
    };

    try {
      const { messageId } = await sendTemplate({
        config,
        to: row.phoneE164,
        templateName: preview.template.name,
        languageCode: preview.language,
        params: row.params,
      });
      sends.push({ ...base, status: "enviado", error: "", providerMessageId: messageId });
      if (row.profile) {
        await recordDispatchContact({
          contact: row.profile,
          templateName: preview.template.name,
          status: "enviado",
          providerMessageId: messageId,
        });
      }
      rows.push({
        name: row.name,
        phoneE164: row.phoneE164,
        status: "enviado",
        error: "",
        providerMessageId: messageId,
      });
      sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha no envio (WhatsApp).";
      sends.push({ ...base, status: "falhou", error: message, providerMessageId: "" });
      if (row.profile) {
        await recordDispatchContact({
          contact: row.profile,
          templateName: preview.template.name,
          status: "falhou",
          providerMessageId: "",
        });
      }
      rows.push({
        name: row.name,
        phoneE164: row.phoneE164,
        status: "falhou",
        error: message,
        providerMessageId: "",
      });
      failed += 1;
    }

    if (index < lote.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, randomDispatchIntervalMs()));
    }
  }

  if (sends.length > 0) {
    await recordSends(sends);
  }

  return { sent, failed, skipped, rows };
}

export function formatNamedPreview(preview: NamedPreview): string {
  const lines: string[] = [];
  lines.push(`Template: ${preview.template.name} (${preview.template.paramCount} param${preview.template.paramCount === 1 ? "" : "s"})`);
  lines.push(`Público: ${preview.template.audience}`);
  if (preview.template.notes) {
    lines.push(`Nota: ${preview.template.notes}`);
  }
  lines.push(`Corpo: ${preview.bodySource === "meta" ? "oficial da Meta" : preview.bodySource === "catalog" ? "catálogo local" : "só parâmetros — puxe o token para ver o texto"}`);
  lines.push(`Hoje já saíram ${preview.todaySent}/${preview.dailyCap} WhatsApp (teto do dia).`);
  lines.push("");

  if (preview.body) {
    lines.push("Texto do template:");
    lines.push(preview.body);
    lines.push("");
  }

  for (const row of preview.rows) {
    if (row.status === "missing") {
      lines.push(`✘ ${row.query} — não achei na lista de trabalho`);
      continue;
    }
    if (row.status === "ambiguous") {
      lines.push(`? ${row.query} — ambíguo:`);
      for (const candidate of row.candidates) {
        lines.push(`    - ${candidate.name} (${candidate.uf}) ${candidate.phoneE164 || "sem WhatsApp"}`);
      }
      continue;
    }
    const flag =
      row.status === "ready"
        ? "✓"
        : row.status === "already_sent"
          ? "·"
          : row.status === "opt_out"
            ? "·"
            : "✘";
    lines.push(`${flag} ${row.name} (${row.uf}${row.parties[0] ? `/${row.parties[0]}` : ""}) ${row.phoneE164} [${row.status}]`);
    if (row.rendered) {
      lines.push(`    Como vai ficar:`);
      for (const line of row.rendered.split("\n")) {
        lines.push(`    ${line}`);
      }
    }
    for (const warning of row.warnings) {
      lines.push(`    ! ${warning}`);
    }
  }

  lines.push("");
  lines.push(
    preview.ready.length > 0
      ? `${preview.ready.length} prontos para enviar. Nada foi enviado. Confirme para disparar.`
      : "Ninguém pronto para enviar.",
  );
  return lines.join("\n");
}
