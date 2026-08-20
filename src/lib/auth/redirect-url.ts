/** URL base publica do app (Vercel/producao). Preferir NEXT_PUBLIC_APP_BASE_URL na Vercel. */

export const CANONICAL_PRODUCT_HOST = "mandatodigital.ia.br";
export const CANONICAL_PRODUCT_ORIGIN = `https://${CANONICAL_PRODUCT_HOST}`;

const CANONICAL_PRODUCT_HOSTS = new Set([
  CANONICAL_PRODUCT_HOST,
  `www.${CANONICAL_PRODUCT_HOST}`,
]);

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

/** Continue URL do reset de senha: apex canônico em prod, origem atual nos demais hosts. */
export function getPasswordResetContinueUrl(pageOrigin?: string) {
  const origin = pageOrigin?.trim();
  if (!origin) {
    return `${CANONICAL_PRODUCT_ORIGIN}/login`;
  }

  try {
    const url = new URL(origin);
    if (CANONICAL_PRODUCT_HOSTS.has(url.hostname.toLowerCase())) {
      return `${CANONICAL_PRODUCT_ORIGIN}/login`;
    }
    return `${url.origin}/login`;
  } catch {
    return `${CANONICAL_PRODUCT_ORIGIN}/login`;
  }
}
