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

