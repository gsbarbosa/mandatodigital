import { recordAuditEvent } from "@/lib/audit/record";
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
    request?: Request | null;
    ip?: string;
    userAgent?: string;
  }) {
    await recordAuditEvent({
      request: input.request,
      profileId: input.profileId,
      projectId: input.projectId,
      action: input.eventType,
      payload: input.payload,
      consentTextVersion: input.consentTextVersion,
      ip: input.ip,
      userAgent: input.userAgent,
    });
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
