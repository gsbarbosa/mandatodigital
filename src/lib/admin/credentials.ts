/**
 * Credenciais estáticas do painel de gestão.
 * Em App Hosting: defina ADMIN_PASSWORD + ADMIN_SESSION_SECRET via secrets.
 * Defaults locais só para bootstrap (dev); em serverless geram warning.
 */
import { isServerlessRuntime } from "@/lib/server-runtime";

export const ADMIN_SESSION_COOKIE = "md_admin_session";
export const ADMIN_SESSION_MAX_AGE_MS = 60 * 60 * 24 * 14 * 1000; // 14 dias

const DEFAULT_ADMIN_EMAIL = "admin@mandatodigital.com.br";
/** Só bootstrap local — nunca confiar nisto em produção sem secret. */
const DEFAULT_ADMIN_PASSWORD = "TarsSinistro1@#";

let warnedDefaultPassword = false;
let warnedDerivedSessionSecret = false;

function warnOnce(flag: "password" | "secret", message: string) {
  if (flag === "password") {
    if (warnedDefaultPassword || !isServerlessRuntime()) {
      return;
    }
    warnedDefaultPassword = true;
  } else {
    if (warnedDerivedSessionSecret || !isServerlessRuntime()) {
      return;
    }
    warnedDerivedSessionSecret = true;
  }
  console.warn(JSON.stringify({ scope: "admin", event: "insecure_bootstrap", message }));
}

export function getAdminEmail() {
  return (process.env.ADMIN_EMAIL?.trim() || DEFAULT_ADMIN_EMAIL).toLowerCase();
}

export function getAdminPassword() {
  const fromEnv = process.env.ADMIN_PASSWORD?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  warnOnce(
    "password",
    "ADMIN_PASSWORD ausente no App Hosting — usando default de bootstrap. Cadastre o secret.",
  );
  return DEFAULT_ADMIN_PASSWORD;
}

export function getAdminSessionSecret() {
  const fromEnv = process.env.ADMIN_SESSION_SECRET?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  warnOnce(
    "secret",
    "ADMIN_SESSION_SECRET ausente — derivando do email/senha. Cadastre o secret dedicado.",
  );
  // Derivado estável enquanto o secret dedicado não estiver no env.
  return `md-admin-v1:${getAdminEmail()}:${getAdminPassword()}`;
}

/** True quando a senha ainda vem do default hardcoded (dev/bootstrap). */
export function isUsingDefaultAdminPassword() {
  return !process.env.ADMIN_PASSWORD?.trim();
}

export function isUsingDerivedAdminSessionSecret() {
  return !process.env.ADMIN_SESSION_SECRET?.trim();
}
