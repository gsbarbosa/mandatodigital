/**
 * Credenciais estáticas do painel de gestão.
 * Troque via env em produção; o default existe só para bootstrap compartilhado (Guga/Thiago).
 */
export const ADMIN_SESSION_COOKIE = "md_admin_session";
export const ADMIN_SESSION_MAX_AGE_MS = 60 * 60 * 24 * 14 * 1000; // 14 dias

const DEFAULT_ADMIN_EMAIL = "admin@mandatodigital.com.br";
const DEFAULT_ADMIN_PASSWORD = "TarsSinistro1@#";

export function getAdminEmail() {
  return (process.env.ADMIN_EMAIL?.trim() || DEFAULT_ADMIN_EMAIL).toLowerCase();
}

export function getAdminPassword() {
  return process.env.ADMIN_PASSWORD?.trim() || DEFAULT_ADMIN_PASSWORD;
}

export function getAdminSessionSecret() {
  const fromEnv = process.env.ADMIN_SESSION_SECRET?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  // Derivado estável enquanto o secret dedicado não estiver no env.
  return `md-admin-v1:${getAdminEmail()}:${getAdminPassword()}`;
}
