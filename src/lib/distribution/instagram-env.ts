const DEFAULT_REDIRECT_PATH = "/api/distribution/instagram/callback";
const DEFAULT_GRAPH_VERSION = "v21.0";

const ALLOWED_OAUTH_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "mandatodigital-stg--madatodigital.us-central1.hosted.app",
  "mandatodigital--madatodigital.us-central1.hosted.app",
  "madatodigital.web.app",
  "mandatodigital.ia.br",
  "www.mandatodigital.ia.br",
]);

export function getInstagramAppId() {
  return process.env.INSTAGRAM_APP_ID?.trim() || "";
}

export function getInstagramAppSecret() {
  return process.env.INSTAGRAM_APP_SECRET?.trim() || "";
}

export function getInstagramGraphVersion() {
  return process.env.INSTAGRAM_GRAPH_VERSION?.trim() || DEFAULT_GRAPH_VERSION;
}

export function getInstagramRedirectUri() {
  const explicit = process.env.INSTAGRAM_REDIRECT_URI?.trim();
  if (explicit) {
    return explicit;
  }
  const base = process.env.APP_BASE_URL?.trim().replace(/\/$/, "");
  if (base) {
    return `${base}${DEFAULT_REDIRECT_PATH}`;
  }
  return `https://mandatodigital--madatodigital.us-central1.hosted.app${DEFAULT_REDIRECT_PATH}`;
}

export function instagramRedirectUriFromRequest(request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  const host = forwardedHost.split(",")[0]?.trim().split(":")[0] || "";
  const protoHeader = request.headers.get("x-forwarded-proto") || "";
  const proto = protoHeader.split(",")[0]?.trim() || (host === "localhost" || host === "127.0.0.1" ? "http" : "https");
  if (host && ALLOWED_OAUTH_HOSTS.has(host)) {
    const originHost = forwardedHost.split(",")[0]?.trim() || host;
    return `${proto}://${originHost}${DEFAULT_REDIRECT_PATH}`;
  }
  try {
    const origin = new URL(request.url).origin;
    const hostname = new URL(origin).hostname;
    if (ALLOWED_OAUTH_HOSTS.has(hostname)) {
      return `${origin}${DEFAULT_REDIRECT_PATH}`;
    }
  } catch {
    // fallback abaixo
  }
  return getInstagramRedirectUri();
}

export function getEnvInstagramAccessToken() {
  return process.env.INSTAGRAM_ACCESS_TOKEN?.trim() || "";
}

export function getEnvInstagramUserId() {
  return process.env.INSTAGRAM_IG_USER_ID?.trim() || "";
}

export function getEnvInstagramUsername() {
  return process.env.INSTAGRAM_USERNAME?.trim() || "";
}

export function isInstagramOAuthConfigured() {
  return Boolean(getInstagramAppId() && getInstagramAppSecret());
}

export function isEnvInstagramFallbackAllowed() {
  if (process.env.INSTAGRAM_ALLOW_ENV_TOKEN?.trim().toLowerCase() === "true") {
    return true;
  }
  return process.env.NODE_ENV !== "production";
}

export function hasEnvInstagramPublishToken() {
  return (
    isEnvInstagramFallbackAllowed() &&
    Boolean(getEnvInstagramAccessToken() && getEnvInstagramUserId())
  );
}

/** App Instagram pronto para conectar (OAuth) ou já tem token de teste. */
export function isInstagramConfigured() {
  return isInstagramOAuthConfigured() || hasEnvInstagramPublishToken();
}
