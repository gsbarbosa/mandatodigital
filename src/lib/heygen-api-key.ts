/** Header enviado pelo browser quando há override em localStorage (painel oculto do Distribuidor). */
export const HEYGEN_CLIENT_API_KEY_HEADER = "x-mandato-heygen-api-key";

export function isHeygenClientKeyOverrideAllowed() {
  const explicit = (process.env.HEYGEN_ALLOW_CLIENT_KEY_OVERRIDE ?? "").trim().toLowerCase();
  if (explicit === "true" || explicit === "1" || explicit === "yes") {
    return true;
  }
  if (explicit === "false" || explicit === "0" || explicit === "no") {
    return false;
  }
  return process.env.NODE_ENV !== "production";
}

/** Lê API key de teste do request; só retorna valor se override estiver habilitado no servidor. */
export function readHeyGenOverrideFromRequest(request: Request): string | null {
  if (!isHeygenClientKeyOverrideAllowed()) {
    return null;
  }

  const value = request.headers.get(HEYGEN_CLIENT_API_KEY_HEADER)?.trim() ?? "";
  if (value.length < 8) {
    return null;
  }

  return value;
}
