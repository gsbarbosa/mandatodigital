/**
 * Tipos do módulo de marketing outbound (`/admin/marketing`).
 *
 * Base de prospects (dirigentes partidários + parlamentares em exercício),
 * segmentos salvos e campanhas de e-mail/WhatsApp. Só funções puras e
 * constantes aqui — Firestore vive nos `*-storage.ts`.
 *
 * Doc: docs/marketing-outbound.md
 */

export const CONTACT_SOURCES = [
  "diretorio_partidario",
  "camara_deputados",
  "instagram_enriquecido",
] as const;
export type ContactSource = (typeof CONTACT_SOURCES)[number];

export const CONTACT_SOURCE_LABELS: Record<ContactSource, string> = {
  diretorio_partidario: "Diretório partidário (TSE)",
  camara_deputados: "Câmara dos Deputados",
  instagram_enriquecido: "Instagram (validado)",
};

export const OFFICE_KEYS = ["estadual", "distrital", "federal"] as const;
export type OfficeKey = (typeof OFFICE_KEYS)[number];

export const OFFICE_KEY_LABELS: Record<OfficeKey, string> = {
  estadual: "Deputado(a) estadual",
  distrital: "Deputado(a) distrital",
  federal: "Deputado(a) federal",
};

export function isOfficeKey(value: unknown): value is OfficeKey {
  return OFFICE_KEYS.includes(value as OfficeKey);
}

/** Sexo conhecido. String vazia = não classificado (o filtro "só mulheres" exclui). */
export type ContactGender = "F" | "M" | "";

export const CAMPAIGN_CHANNELS = ["email", "whatsapp"] as const;
export type CampaignChannel = (typeof CAMPAIGN_CHANNELS)[number];

export const CAMPAIGN_CHANNEL_LABELS: Record<CampaignChannel, string> = {
  email: "E-mail",
  whatsapp: "WhatsApp",
};

export const CAMPAIGN_STATUSES = ["rascunho", "enviando", "enviada", "erro"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  rascunho: "Rascunho",
  enviando: "Enviando",
  enviada: "Enviada",
  erro: "Erro",
};

export const SEND_STATUSES = ["enviado", "falhou"] as const;
export type SendStatus = (typeof SEND_STATUSES)[number];

/**
 * Prospect da base outbound. Não confundir com `userRegistrations` (cliente
 * real do produto) nem com `tseCandidates2026` (prefill de cadastro).
 */
export type MarketingContact = {
  id: string;
  name: string;
  email: string;
  /** E.164 só quando o número foi classificado como móvel (apto a WhatsApp). */
  phoneE164: string;
  source: ContactSource;
  uf: string;
  /** Siglas partidárias associadas ao contato (pode ocupar cargo em mais de uma). */
  parties: string[];
  /** Cargos do contato na fonte (ex.: PRESIDENTE, TESOUREIRO). */
  roles: string[];
  municipality: string;
  /** Concorre em 2026 (confirmado por cruzamento com a base de candidaturas). */
  isCandidate2026: boolean;
  /** Cargo disputado em 2026, quando `isCandidate2026`. */
  candidateRole: string;
  /** `F`/`M` quando a fonte informa; vazio se não classificado. */
  gender: ContactGender;
  /** Diretório com situação suspensa no TSE (ex.: falta de prestação de contas). */
  suspended: boolean;
  /** Origem + data do import, para rastrear de onde o registro veio. */
  origin: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * Definição de público. Guardada como filtro (não como lista congelada) para a
 * campanha sempre resolver contra a base atual no momento do disparo.
 */
export type SegmentFilter = {
  sources: ContactSource[];
  ufs: string[];
  parties: string[];
  /** `email` exige e-mail; `whatsapp` exige telefone móvel. */
  channel: CampaignChannel | null;
  onlyCandidates2026: boolean;
  /** Exige `gender === "F"`. Contato sem sexo classificado fica de fora. */
  onlyWomen: boolean;
  /** Cargo disputado/ocupado: estadual, distrital, federal. Vazio = qualquer. */
  offices: OfficeKey[];
  excludeSuspended: boolean;
  /** Busca livre em nome, e-mail e município. */
  search: string;
};

export const EMPTY_SEGMENT_FILTER: SegmentFilter = {
  sources: [],
  ufs: [],
  parties: [],
  channel: null,
  onlyCandidates2026: false,
  onlyWomen: false,
  offices: [],
  excludeSuspended: true,
  search: "",
};

export type MarketingSegment = {
  id: string;
  name: string;
  description: string;
  filter: SegmentFilter;
  createdAt: string;
  updatedAt: string;
};

export type CampaignStats = {
  total: number;
  sent: number;
  failed: number;
};

export type MarketingCampaign = {
  id: string;
  name: string;
  channel: CampaignChannel;
  segmentId: string;
  /** Assunto (e-mail). Vazio no WhatsApp. */
  subject: string;
  /**
   * Corpo do e-mail em texto. Suporta `{{nome}}`, `{{uf}}`, `{{partido}}`,
   * `{{cargo}}` — ver `renderTemplate`.
   */
  body: string;
  /** Nome do template aprovado no Meta (WhatsApp). */
  templateName: string;
  /** Idioma do template aprovado (Meta exige bater exatamente). */
  templateLanguage: string;
  /**
   * Preenchimento posicional do template: o item 0 vira `{{1}}`. Cada entrada é
   * um texto com variáveis (ex.: `"{{nome}}"`), renderizado por contato.
   */
  templateParams: string[];
  /**
   * Teto deste disparo (não da campanha inteira). Clique de novo envia o
   * próximo lote, pulando quem já recebeu. `0` = usa o teto do canal.
   */
  batchSize: number;
  status: CampaignStatus;
  stats: CampaignStats;
  /** Preenchido quando o disparo falha por completo (ex.: Resend não configurado). */
  lastError: string;
  createdAt: string;
  updatedAt: string;
  sentAt: string;
};

export type MarketingSend = {
  id: string;
  campaignId: string;
  contactId: string;
  channel: CampaignChannel;
  /** E-mail ou telefone efetivamente usado no envio. */
  destination: string;
  contactName: string;
  status: SendStatus;
  error: string;
  /** Id da mensagem no provedor (`wamid...`), para casar com o webhook. */
  providerMessageId: string;
  createdAt: string;
};

export const CONVERSATION_ROLES = ["lead", "agente", "humano"] as const;
export type ConversationRole = (typeof CONVERSATION_ROLES)[number];

export function isConversationRole(value: unknown): value is ConversationRole {
  return CONVERSATION_ROLES.includes(value as ConversationRole);
}

export type ConversationMessage = {
  role: ConversationRole;
  text: string;
  /** `wamid` da Meta — usado também para idempotência do webhook. */
  providerMessageId: string;
  at: string;
};

/**
 * Thread de conversa por contato (doc id = telefone E.164). Criada quando o
 * lead responde ao disparo; é o estado que o agente de IA usa como histórico.
 */
export type MarketingConversation = {
  id: string;
  contactId: string;
  contactName: string;
  phoneE164: string;
  campaignId: string;
  messages: ConversationMessage[];
  /**
   * Última mensagem recebida do lead. A janela de 24h da Meta conta a partir
   * daqui — fora dela só template reabre a conversa.
   */
  lastInboundAt: string;
  /** Desliga a resposta automática desta thread (assumida por humano). */
  agentPaused: boolean;
  lastError: string;
  createdAt: string;
  updatedAt: string;
};

const WINDOW_MS = 24 * 60 * 60 * 1000;

/** Janela de atendimento de 24h da Meta ainda aberta? */
export function isWithinServiceWindow(lastInboundAt: string, now = Date.now()): boolean {
  const last = Date.parse(lastInboundAt);
  return Number.isFinite(last) && now - last < WINDOW_MS;
}

export function isContactSource(value: unknown): value is ContactSource {
  return CONTACT_SOURCES.includes(value as ContactSource);
}

export function isCampaignChannel(value: unknown): value is CampaignChannel {
  return CAMPAIGN_CHANNELS.includes(value as CampaignChannel);
}

export function isCampaignStatus(value: unknown): value is CampaignStatus {
  return CAMPAIGN_STATUSES.includes(value as CampaignStatus);
}

export function isSendStatus(value: unknown): value is SendStatus {
  return SEND_STATUSES.includes(value as SendStatus);
}

/** Primeiro nome, capitalizado — a base do TSE vem toda em caixa alta. */
export function firstName(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0] ?? "";
  if (!first) {
    return "";
  }
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

/**
 * Substitui as variáveis do corpo da mensagem. Placeholder sem valor vira
 * string vazia — nunca deixa `{{nome}}` cru chegar no destinatário.
 */
export function renderTemplate(template: string, contact: MarketingContact): string {
  const values: Record<string, string> = {
    nome: firstName(contact.name),
    nome_completo: contact.name,
    uf: contact.uf,
    partido: contact.parties[0] ?? "",
    cargo: contact.candidateRole || contact.roles[0] || "",
    municipio: contact.municipality,
  };

  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_match, key: string) => {
    return values[key.toLowerCase()] ?? "";
  });
}
