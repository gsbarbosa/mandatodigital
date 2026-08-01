/** Contas internas com premium forçado (sem limites de convidado). */
export const DEV_ACCOUNT_MODE_ALLOWLIST = [
  "gsbarbosa180@gmail.com",
  "tribeiro81@gmail.com",
] as const;

/** Domínio de contas E2E/local — premium liberado para validar Sentinela com rank.
 *  Usa example.com (RFC 2606) — Firebase Auth aceita sem verificação de e-mail.
 */
export const E2E_ACCOUNT_EMAIL_DOMAIN = "example.com";

export const DEV_ACCOUNT_MODE_COOKIE = "mandato-dev-account-mode";

export type DevAccountMode = "guest" | "premium";

export function normalizeAccountEmail(email: string | null | undefined) {
  return (email ?? "").trim().toLowerCase();
}

export function isE2eAccountEmail(email: string | null | undefined) {
  const normalized = normalizeAccountEmail(email);
  return normalized.startsWith("e2e.") && normalized.endsWith(`@${E2E_ACCOUNT_EMAIL_DOMAIN}`);
}

/** Sócios: sempre premium (não dependem do cookie convidado/premium). */
export function isForcePremiumAccountEmail(email: string | null | undefined) {
  const normalized = normalizeAccountEmail(email);
  return (DEV_ACCOUNT_MODE_ALLOWLIST as readonly string[]).includes(normalized);
}

export function isDevAccountModeEmail(email: string | null | undefined) {
  if (isForcePremiumAccountEmail(email)) {
    return true;
  }
  return isE2eAccountEmail(email);
}

export function parseDevAccountMode(value: string | null | undefined): DevAccountMode {
  return value === "premium" ? "premium" : "guest";
}

export function readDevAccountModeFromDocumentCookie(): DevAccountMode {
  if (typeof document === "undefined") {
    return "guest";
  }

  const match = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${DEV_ACCOUNT_MODE_COOKIE}=`));

  if (!match) {
    return "guest";
  }

  return parseDevAccountMode(decodeURIComponent(match.slice(DEV_ACCOUNT_MODE_COOKIE.length + 1)));
}

export function writeDevAccountModeDocumentCookie(mode: DevAccountMode) {
  if (typeof document === "undefined") {
    return;
  }

  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${DEV_ACCOUNT_MODE_COOKIE}=${encodeURIComponent(mode)}; path=/; max-age=${maxAge}; samesite=lax`;
}
