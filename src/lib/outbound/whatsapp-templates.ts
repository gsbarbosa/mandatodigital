/**
 * Catálogo operacional dos templates de WhatsApp do outbound.
 * Contagem de parâmetros e defaults para preview; o corpo oficial vive na Meta.
 * `fetchApprovedTemplate` puxa o texto aprovado quando o token está no env.
 */

import { resolveWhatsappConfig } from "@/lib/outbound/whatsapp";

export const WHATSAPP_WABA_ID = "1736757104132656";

export type WhatsappTemplateCatalogEntry = {
  name: string;
  aliases: string[];
  paramCount: number;
  /** Expressões renderizadas por contato (`{{nome}}`, `{{uf}}`…). */
  defaultParams: string[];
  audience: string;
  approved: boolean;
  /**
   * Corpo conhecido. `null` = só sai no preview depois de puxar da Meta
   * (ou como lista de {{n}} preenchidos).
   */
  body: string | null;
  notes: string;
  /**
   * Clique no botão positivo do template: primeira resposta nossa, sem LLM.
   * `[Maria]` / `{{nome}}` viram o primeiro nome do contato.
   */
  cannedPositiveReply?: string;
  /** Título exato do botão na Meta (casamento normalizado). */
  positiveButtonLabels?: string[];
};

export const DEFAULT_OUTBOUND_PERSONA = "Anna";

export const WHATSAPP_TEMPLATE_CATALOG: WhatsappTemplateCatalogEntry[] = [
  {
    name: "md_intro_feito_candidatas_v1",
    aliases: ["feito candidatas v1", "feito v1"],
    paramCount: 1,
    defaultParams: ["{{nome}}"],
    audience: "Candidatas (não incumbentes) — legado",
    approved: true,
    body: "Bom dia, {{1}} — Marina, do Mandato Digital.\n\nMontamos a primeira plataforma de campanha pensada primeiro para candidatas: estúdio sem equipe de gravação, monitoramento 24h e registro documentado da candidatura.\n\nPosso te mandar a página de um minuto?",
    notes: "Legado. Saudação fixa (Bom dia) e diz Marina. Apagar na Meta quando o v3 estiver APPROVED.",
  },
  {
    name: "md_intro_feito_candidatas_v3",
    aliases: ["feito candidatas", "feito", "anna", "candidatas", "feito v3"],
    paramCount: 2,
    defaultParams: ["{{nome}}", "{{persona}}"],
    audience: "Candidatas (não incumbentes)",
    approved: true,
    body: "Olá *{{1}}*, aqui é a *{{2}}*, do Mandato Digital.\n\nMontamos a primeira plataforma de campanha com foco em candidatas: estúdio sem equipe de gravação, monitoramento 24h e registro documentado da candidatura.\n\nPosso te mandar a página de um minuto?",
    notes:
      "{{1}}=primeiro nome, {{2}}=persona (Anna). Botão positivo dispara a resposta pré-moldada (link /vozdelas), sem LLM.",
    positiveButtonLabels: ["Sim. Seja breve", "Sim"],
    cannedPositiveReply:
      "[Maria], vou te mandar o link de degustação para você conhecer a plataforma na prática - ver como monitoramos adversários, jornais, redes sociais e gravamos vídeos sobre essas pautas com o seu posicionamento, através do seu avatar de IA. Tudo registrado para fundamentar eventuais impugnações das chapas. Aqui está: https://mandatodigital.ia.br/vozdelas. Me conta depois o que achou!",
  },
  {
    name: "md_intro_generico_v1",
    aliases: ["generico", "genérico", "teste gratis", "teste grátis"],
    paramCount: 2,
    defaultParams: ["{{nome}}", "{{persona}}"],
    audience: "Genérico (qualquer público com WhatsApp)",
    approved: false,
    body: "Olá {{1}}. Sou {{2}}, do Mandato Digital.\n\nCriamos a primeira *plataforma de campanha* que entrega:\n• estúdio sem equipe de gravação\n• monitoramento 24h de adversários e mídias\n• registro documentado da candidatura\n\nQuer saber mais? Dá para testar grátis e sem cartão.",
    notes: "PENDING. CTA teste grátis sem cartão. Botões: Sim. Seja breve / Não, obrigado (Meta não aceita emoji no botão). Não disparar até APPROVED.",
  },
  {
    name: "md_intro_candidatas_soft_v1",
    aliases: ["candidatas soft", "soft"],
    paramCount: 3,
    defaultParams: ["{{nome}}", "{{partido}}", "{{uf}}"],
    audience: "Candidatas (versão consultiva)",
    approved: true,
    body: null,
    notes: "3 params. Conferir o corpo na Meta antes do primeiro lote.",
  },
  {
    name: "md_intro_candidatas_curta_v1",
    aliases: ["candidatas curta", "curta"],
    paramCount: 3,
    defaultParams: ["{{nome}}", "{{partido}}", "{{uf}}"],
    audience: "Candidatas (versão curta)",
    approved: true,
    body: null,
    notes: "3 params.",
  },
  {
    name: "md_followup_candidatas_v1",
    aliases: ["followup candidatas", "follow-up", "followup"],
    paramCount: 1,
    defaultParams: ["{{nome}}"],
    audience: "Follow-up de candidatas que abriram e não responderam",
    approved: true,
    body: null,
    notes: "Só em quem já recebeu intro. Não usar em homem.",
  },
  {
    name: "md_intro_vaga_sigla_v1",
    aliases: ["vaga sigla", "presidentes", "presidente", "vaga"],
    paramCount: 3,
    defaultParams: ["{{nome}}", "{{partido}}", "{{uf}}"],
    audience: "Presidentes de diretório",
    approved: true,
    body: null,
    notes: "Escassez: 3 campanhas por partido/estado. Não falar como se o contato fosse candidato.",
  },
  {
    name: "md_intro_materialidade_v1",
    aliases: ["materialidade", "reeleicao", "reeleição"],
    paramCount: 3,
    defaultParams: ["{{nome}}", "{{cargo}}", "{{uf}}"],
    audience: "Reeleição (cuidado: pode prometer material que não existe)",
    approved: true,
    body: null,
    notes: "Se o texto da Meta prometer 'página/vídeo de 1–3 minutos' que não existe, não usar.",
  },
  {
    name: "md_intro_prova_v1",
    aliases: ["prova", "candidatos", "homens"],
    paramCount: 4,
    defaultParams: ["{{nome}}", "{{uf}}", "{{partido}}", "{{cargo}}"],
    audience: "Candidatos homens",
    approved: true,
    body: null,
    notes: "4 params. Conferir o corpo na Meta — a ordem dos {{n}} precisa bater.",
  },
  {
    name: "md_intro_tempo_volume_v1",
    aliases: ["tempo volume", "volume"],
    paramCount: 1,
    defaultParams: ["{{nome}}"],
    audience: "Candidatos (volume de vídeo)",
    approved: true,
    body: null,
    notes: "1 param = primeiro nome.",
  },
  {
    name: "md_intro_adversario_v1",
    aliases: ["adversario", "adversário", "ataque"],
    paramCount: 1,
    defaultParams: ["{{nome}}"],
    audience: "Resposta a ataque (~20 min)",
    approved: true,
    body: null,
    notes: "Só faz sentido com contexto de ataque; não é intro fria.",
  },
];

export function normalizeTemplateKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function resolveTemplateCatalogEntry(
  rawName: string,
): WhatsappTemplateCatalogEntry | null {
  const key = normalizeTemplateKey(rawName);
  if (!key) return null;

  const exact = WHATSAPP_TEMPLATE_CATALOG.find(
    (entry) => normalizeTemplateKey(entry.name) === key.replace(/\s+/g, "_"),
  );
  if (exact) return exact;

  const byName = WHATSAPP_TEMPLATE_CATALOG.find(
    (entry) => normalizeTemplateKey(entry.name) === key,
  );
  if (byName) return byName;

  const aliased = WHATSAPP_TEMPLATE_CATALOG.filter((entry) =>
    entry.aliases.some((alias) => normalizeTemplateKey(alias) === key),
  );
  if (aliased.length === 1) return aliased[0] ?? null;
  return null;
}

export function fillTemplatePlaceholders(body: string, params: string[]): string {
  return body.replace(/\{\{\s*(\d+)\s*\}\}/g, (match, index: string) => {
    const value = params[Number(index) - 1];
    return value != null && value !== "" ? value : match;
  });
}

export function renderParamsPreview(params: string[]): string {
  if (params.length === 0) return "(sem parâmetros)";
  return params.map((value, index) => `{{${index + 1}}} = ${value || "(vazio)"}`).join("\n");
}

type GraphTemplateComponent = {
  type?: string;
  text?: string;
  example?: { body_text?: string[][] };
};

type GraphTemplate = {
  name?: string;
  status?: string;
  language?: string;
  components?: GraphTemplateComponent[];
};

export type LiveWhatsappTemplate = {
  name: string;
  status: string;
  language: string;
  body: string;
  paramCount: number;
};

export async function fetchApprovedTemplate(
  templateName: string,
  languageCode = "pt_BR",
): Promise<LiveWhatsappTemplate | null> {
  const config = await resolveWhatsappConfig();
  if (!config) return null;

  const wabaId = process.env.WHATSAPP_WABA_ID?.trim() || WHATSAPP_WABA_ID;
  const url = new URL(`https://graph.facebook.com/${config.graphVersion}/${wabaId}/message_templates`);
  url.searchParams.set("name", templateName);
  url.searchParams.set("fields", "name,status,language,components");
  url.searchParams.set("limit", "20");

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${config.accessToken}` },
  });
  const json = (await response.json()) as { data?: GraphTemplate[]; error?: { message?: string } };
  if (!response.ok) {
    throw new Error(json.error?.message || `Meta recusou listar templates (${response.status}).`);
  }

  const match = (json.data ?? []).find(
    (row) =>
      row.name === templateName &&
      (row.language === languageCode || row.language === languageCode.replace("_", "-")),
  );
  if (!match) return null;

  const body = match.components?.find((component) => component.type === "BODY")?.text ?? "";
  const placeholders = body.match(/\{\{\s*\d+\s*\}\}/g) ?? [];
  return {
    name: match.name ?? templateName,
    status: match.status ?? "",
    language: match.language ?? languageCode,
    body,
    paramCount: new Set(placeholders).size,
  };
}
