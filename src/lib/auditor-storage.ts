import type { FactCheckResult } from "@/lib/auditor/types";
import { isAuditorFactCheckEnabled } from "@/lib/feature-flags";
import { COLLECTIONS, col } from "@/lib/firebase/collections";
import { getStorageOwnerUserId } from "@/lib/storage-context";
import type { MockSentinelSuggestion } from "@/lib/sentinel-mock-suggestions";

type FactCheckRecord = {
  signalId: string;
  profileId: string;
  ownerUserId: string;
  status: "pending" | "done" | "error";
  verdict: string;
  confidence: number;
  result: FactCheckResult;
  checkedAt: string;
};

type AuditLogRow = {
  id: string;
  ownerUserId: string;
  profileId: string | null;
  projectId: string | null;
  eventType: string;
  payload: Record<string, unknown>;
  consentTextVersion: string;
  createdAt: string;
};

function nowIso() {
  return new Date().toISOString();
}

function resolveOwnerUserId() {
  return getStorageOwnerUserId()?.trim() || "";
}

function factCheckDocId(profileId: string, signalId: string) {
  return `${profileId}|${signalId}`;
}

export const auditorStorage = {
  async saveFactCheck(profileId: string, signalId: string, result: FactCheckResult) {
    if (!isAuditorFactCheckEnabled()) {
      return;
    }

    const ownerUserId = resolveOwnerUserId();
    const record: FactCheckRecord = {
      signalId,
      profileId,
      ownerUserId,
      status: "done",
      verdict: result.verdict,
      confidence: result.confidence,
      result,
      checkedAt: result.checkedAt || nowIso(),
    };

    await col(COLLECTIONS.sentinelFactChecks)
      .doc(factCheckDocId(profileId, signalId))
      .set(record);
  },

  async appendAuditLog(input: {
    profileId?: string | null;
    projectId?: string | null;
    eventType: string;
    payload?: Record<string, unknown>;
    consentTextVersion?: string;
  }) {
    const ownerUserId = resolveOwnerUserId();
    const row: AuditLogRow = {
      id: crypto.randomUUID(),
      ownerUserId,
      profileId: input.profileId ?? null,
      projectId: input.projectId ?? null,
      eventType: input.eventType,
      payload: input.payload ?? {},
      consentTextVersion: input.consentTextVersion ?? "v1",
      createdAt: nowIso(),
    };

    await col(COLLECTIONS.auditLog).doc(row.id).set(row);
  },
};

export async function factCheckTopSentinelSuggestions(input: {
  profileId: string;
  suggestions: MockSentinelSuggestion[];
  topicFor?: (suggestion: MockSentinelSuggestion) => string;
}) {
  if (!isAuditorFactCheckEnabled()) {
    return;
  }

  const { runFactCheck } = await import("@/lib/auditor/fact-check");

  for (const suggestion of input.suggestions.slice(0, 10)) {
    try {
      const result = await runFactCheck({
        script: suggestion.topic,
        topic: suggestion.topic,
        articles: suggestion.evidence.articles ?? [],
      });

      await auditorStorage.saveFactCheck(input.profileId, suggestion.id, result);
    } catch {
      // Nao bloqueia refresh por falha individual.
    }
  }
}
