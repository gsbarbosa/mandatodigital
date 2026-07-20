import { randomUUID } from "node:crypto";

import {
  AUDIT_TIMEZONE,
  type AuditEvent,
} from "@/lib/audit/types";
import { formatAuditTimestampLocal } from "@/lib/audit/format";
import { COLLECTIONS, col } from "@/lib/firebase/collections";
import {
  extractClientIp,
  extractUserAgent,
} from "@/lib/legal/request-meta";
import { toDatabaseOwnerUserId } from "@/lib/owner-user-id";
import { getStorageOwnerUserId } from "@/lib/storage-context";

export type RecordAuditEventInput = {
  request?: Request | null;
  ownerUserId?: string;
  profileId?: string | null;
  projectId?: string | null;
  action: string;
  payload?: Record<string, unknown>;
  consentTextVersion?: string;
  ip?: string;
  userAgent?: string;
};

function resolveOwnerUserId(explicit?: string) {
  const fromContext = getStorageOwnerUserId()?.trim() || "";
  const raw = explicit?.trim() || fromContext;
  if (!raw) {
    return "";
  }
  return toDatabaseOwnerUserId(raw);
}

function resolveIp(
  input: RecordAuditEventInput,
  payload: Record<string, unknown>,
) {
  if (input.ip?.trim()) {
    return input.ip.trim();
  }
  if (typeof payload.ip === "string" && payload.ip.trim()) {
    return payload.ip.trim();
  }
  if (input.request) {
    return extractClientIp(input.request);
  }
  return "unknown";
}

function resolveUserAgent(
  input: RecordAuditEventInput,
  payload: Record<string, unknown>,
) {
  if (input.userAgent?.trim()) {
    return input.userAgent.trim();
  }
  if (typeof payload.userAgent === "string" && payload.userAgent.trim()) {
    return payload.userAgent.trim();
  }
  if (input.request) {
    return extractUserAgent(input.request);
  }
  return "unknown";
}

export function buildAuditEvent(input: RecordAuditEventInput): AuditEvent | null {
  const ownerUserId = resolveOwnerUserId(input.ownerUserId);
  if (!ownerUserId) {
    return null;
  }

  const payload = input.payload ?? {};
  const now = new Date();
  const timestamp = now.toISOString();
  const action = input.action.trim() || "unknown";

  return {
    id: randomUUID(),
    ownerUserId,
    profileId: input.profileId ?? null,
    projectId: input.projectId ?? null,
    action,
    eventType: action,
    ip: resolveIp(input, payload),
    userAgent: resolveUserAgent(input, payload),
    timestamp,
    timezone: AUDIT_TIMEZONE,
    timestampLocal: formatAuditTimestampLocal(now),
    payload,
    consentTextVersion: input.consentTextVersion ?? "v1",
    createdAt: timestamp,
  };
}

/**
 * Persiste evento de auditoria. Nunca lança — falhas são logadas em console
 * para nao quebrar a API de produto.
 */
export async function recordAuditEvent(
  input: RecordAuditEventInput,
): Promise<AuditEvent | null> {
  try {
    const row = buildAuditEvent(input);
    if (!row) {
      return null;
    }

    await col(COLLECTIONS.auditLog).doc(row.id).set(row);
    return row;
  } catch (error) {
    console.error("[audit] recordAuditEvent failed:", error);
    return null;
  }
}

/** Dispara gravação sem aguardar (ainda captura rejeicoes). */
export function recordAuditEventFireAndForget(input: RecordAuditEventInput) {
  void recordAuditEvent(input);
}
