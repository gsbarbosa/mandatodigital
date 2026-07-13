/** Contas internas que podem alternar convidado ↔ premium no app. */
export const DEV_ACCOUNT_MODE_ALLOWLIST = [
  "gsbarbosa180@gmail.com",
  "tribeiro81@gmail.com",
] as const;

export const DEV_ACCOUNT_MODE_COOKIE = "mandato-dev-account-mode";

export type DevAccountMode = "guest" | "premium";

export function normalizeAccountEmail(email: string | null | undefined) {
  return (email ?? "").trim().toLowerCase();
}

export function isDevAccountModeEmail(email: string | null | undefined) {
  const normalized = normalizeAccountEmail(email);
  return (DEV_ACCOUNT_MODE_ALLOWLIST as readonly string[]).includes(normalized);
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
