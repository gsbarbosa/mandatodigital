/** URL base publica do app (Vercel/producao). Preferir NEXT_PUBLIC_APP_BASE_URL na Vercel. */
export function getPublicAppBaseUrl(fallbackOrigin?: string) {
  const configured = process.env.NEXT_PUBLIC_APP_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  if (fallbackOrigin) {
    return fallbackOrigin.replace(/\/$/, "");
  }

  return "";
}

/** Destino do link de confirmacao de e-mail (cadastro / magic link). */
export function getAuthCallbackUrl(fallbackOrigin?: string) {
  const base = getPublicAppBaseUrl(fallbackOrigin);
  if (!base) {
    return "";
  }

  return `${base}/auth/callback`;
}
