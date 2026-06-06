import { createHash } from "node:crypto";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Converte UID do Firebase (ou outro id externo) para UUID valido no Postgres. */
export function toDatabaseOwnerUserId(ownerUserId: string): string {
  const trimmed = ownerUserId.trim();
  if (!trimmed) {
    return trimmed;
  }

  if (UUID_PATTERN.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  const digest = createHash("sha256").update(`mandato:owner:${trimmed}`).digest();
  const bytes = Uint8Array.from(digest.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Buffer.from(bytes).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
