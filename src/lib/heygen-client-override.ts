import { HEYGEN_CLIENT_API_KEY_HEADER } from "@/lib/heygen-api-key";

const STORAGE_KEY = "mandato:heygen-api-key-override";

export function readHeygenApiKeyOverride(): string {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    return window.localStorage.getItem(STORAGE_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function writeHeygenApiKeyOverride(apiKey: string) {
  if (typeof window === "undefined") {
    return;
  }

  const trimmed = apiKey.trim();
  try {
    if (!trimmed) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, trimmed);
  } catch {
    // quota / private mode
  }
}

export function clearHeygenApiKeyOverride() {
  writeHeygenApiKeyOverride("");
}

export function buildHeygenOverrideHeaders(
  initHeaders?: HeadersInit,
): HeadersInit {
  const headers = new Headers(initHeaders);
  const apiKey = readHeygenApiKeyOverride();
  if (apiKey) {
    headers.set(HEYGEN_CLIENT_API_KEY_HEADER, apiKey);
  }
  return headers;
}

/** fetch para rotas /api/heygen/* com API key de teste (se configurada no Distribuidor). */
export function fetchHeygenApi(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, {
    ...init,
    credentials: init?.credentials ?? "same-origin",
    headers: buildHeygenOverrideHeaders(init?.headers),
  });
}

export function maskHeygenApiKey(apiKey: string) {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.length <= 8) {
    return "••••••••";
  }
  return `${"•".repeat(Math.min(trimmed.length - 4, 24))}${trimmed.slice(-4)}`;
}
