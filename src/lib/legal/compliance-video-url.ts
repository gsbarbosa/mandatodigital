/** Objetos de compliance no bucket (vídeo selado, PDFs, TTS). */
const COMPLIANCE_PREFIX = "compliance/";

function decodePath(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Extrai o path no bucket a partir de uma URL assinada do GCS/Firebase.
 * Só aceita objetos em `compliance/` — o vídeo selado vive em `compliance/sealed/`.
 */
export function extractComplianceStoragePathFromUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);

    if (url.hostname === "storage.googleapis.com") {
      const parts = url.pathname.replace(/^\/+/, "").split("/").filter(Boolean);
      if (parts.length < 2) {
        return null;
      }
      const objectPath = decodePath(parts.slice(1).join("/"));
      return objectPath.startsWith(COMPLIANCE_PREFIX) ? objectPath : null;
    }

    if (url.hostname === "firebasestorage.googleapis.com") {
      const match = url.pathname.match(/^\/v0\/b\/[^/]+\/o\/(.+)$/);
      if (!match?.[1]) {
        return null;
      }
      const objectPath = decodePath(match[1]);
      return objectPath.startsWith(COMPLIANCE_PREFIX) ? objectPath : null;
    }
  } catch {
    return null;
  }

  return null;
}

function parseGcsV4SignedAtMs(googDate: string): number | null {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(googDate.trim());
  if (!match) {
    return null;
  }
  const ms = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6]),
  );
  return Number.isFinite(ms) ? ms : null;
}

/** true se a URL GCS v4 já venceu ou vence dentro de `skewMs`. */
export function isGcsSignedUrlExpired(rawUrl: string, nowMs = Date.now(), skewMs = 60 * 60 * 1000) {
  try {
    const url = new URL(rawUrl.trim());
    const googDate = url.searchParams.get("X-Goog-Date");
    const expiresSec = Number(url.searchParams.get("X-Goog-Expires") || "");
    if (!googDate || !Number.isFinite(expiresSec) || expiresSec <= 0) {
      return false;
    }
    const signedAt = parseGcsV4SignedAtMs(googDate);
    if (signedAt == null) {
      return false;
    }
    return nowMs + skewMs >= signedAt + expiresSec * 1000;
  } catch {
    return false;
  }
}
