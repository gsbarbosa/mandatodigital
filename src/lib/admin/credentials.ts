/**
 * Chave de criptografia do cofre de provider secrets (ver src/lib/admin/provider-secrets.ts).
 * Não autentica ninguém — acesso ao /admin é só via flag `isAdmin` no cadastro do usuário
 * (ver src/lib/admin/session.ts). Cadastre ADMIN_SESSION_SECRET via secret dedicado; o
 * fallback abaixo existe só para não invalidar keys já criptografadas com o valor de bootstrap.
 */
import { isServerlessRuntime } from "@/lib/server-runtime";

/** Bootstrap local — nunca confiar nisto em produção sem ADMIN_SESSION_SECRET cadastrado. */
const FALLBACK_VAULT_SECRET = "admin@mandatodigital.com.br:TarsSinistro1@#";

let warnedDerivedSessionSecret = false;

function warnOnce(message: string) {
  if (warnedDerivedSessionSecret || !isServerlessRuntime()) {
    return;
  }
  warnedDerivedSessionSecret = true;
  console.warn(JSON.stringify({ scope: "admin", event: "insecure_bootstrap", message }));
}

export function getAdminSessionSecret() {
  const fromEnv = process.env.ADMIN_SESSION_SECRET?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  warnOnce(
    "ADMIN_SESSION_SECRET ausente — derivando do fallback de bootstrap. Cadastre o secret dedicado.",
  );
  return `md-admin-v1:${FALLBACK_VAULT_SECRET}`;
}

export function isUsingDerivedAdminSessionSecret() {
  return !process.env.ADMIN_SESSION_SECRET?.trim();
}
