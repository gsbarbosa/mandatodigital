import { createHash } from "node:crypto";

export function extractClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) {
    return forwarded;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }
  return "unknown";
}

export function extractUserAgent(request: Request) {
  return request.headers.get("user-agent")?.trim() || "unknown";
}

export function sha256Hex(text: string) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function formatAcceptedAt(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "long",
    timeStyle: "medium",
  });
  return `${formatter.format(date)} (America/Sao_Paulo)`;
}
