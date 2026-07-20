import { AUDIT_TIMEZONE } from "@/lib/audit/types";

const localDateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: AUDIT_TIMEZONE,
  dateStyle: "short",
  timeStyle: "medium",
});

const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: AUDIT_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Ex.: `20/07/2026, 08:41:12 (America/Sao_Paulo)`. */
export function formatAuditTimestampLocal(date: Date = new Date()) {
  return `${localDateTimeFormatter.format(date)} (${AUDIT_TIMEZONE})`;
}

/** Chave YYYY-MM-DD no fuso de auditoria. */
export function auditDayKey(isoOrDate: string | Date) {
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return dayKeyFormatter.format(date);
}

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  session_login: "Login",
  session_logout: "Logout",
  content_generate: "Geracao de conteudo",
  creative_project_create: "Criativo criado",
  video_generate: "Geracao de video",
  seal_job: "Job de selagem",
  voice_job: "Job de voz",
  script_fact_check: "Fact-check",
  fact_check_bypass_free_prompt: "Fact-check ignorado (prompt livre)",
  contract_acceptance: "Aceite de contrato",
  manual_export: "Exportacao manual",
};

export function auditActionLabel(action: string) {
  return AUDIT_ACTION_LABELS[action] ?? action;
}
