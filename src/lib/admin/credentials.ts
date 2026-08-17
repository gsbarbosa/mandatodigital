/**
 * Chave de criptografia do cofre de provider secrets (ver src/lib/admin/provider-secrets.ts)
 * e da assinatura do state do OAuth Instagram.
 *
 * Não autentica ninguém — acesso ao /admin é só via flag `isAdmin` no cadastro do usuário
 * (ver src/lib/admin/session.ts).
 *
 * Não há fallback: sem ADMIN_SESSION_SECRET cadastrado, quem depende do cofre falha alto.
 * Um valor embutido aqui seria uma chave pública no repositório, capaz de decifrar o que
 * está guardado no banco.
 */

export function getAdminSessionSecret() {
  const fromEnv = process.env.ADMIN_SESSION_SECRET?.trim();
  if (!fromEnv) {
    throw new Error(
      "ADMIN_SESSION_SECRET nao configurado. Cadastre o secret dedicado (npm run firebase:secrets:apply) — sem ele o cofre de provider secrets nao abre.",
    );
  }
  return fromEnv;
}

export function isAdminSessionSecretConfigured() {
  return Boolean(process.env.ADMIN_SESSION_SECRET?.trim());
}
