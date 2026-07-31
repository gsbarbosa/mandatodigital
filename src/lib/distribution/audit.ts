import { randomUUID } from "node:crypto";

import type { DistributionChannelId } from "@/lib/distribution/channels";
import type { DistributionAuditEntry } from "@/lib/distribution/types";
import { COLLECTIONS, col } from "@/lib/firebase/collections";

function nowIso() {
  return new Date().toISOString();
}

export async function appendDistributionAudit(input: {
  ownerUserId: string;
  profileId: string;
  distributionPostId: string;
  action: string;
  actorUserId?: string | null;
  channels?: DistributionChannelId[];
  payload?: Record<string, unknown>;
}): Promise<DistributionAuditEntry> {
  const entry: DistributionAuditEntry = {
    id: randomUUID(),
    ownerUserId: input.ownerUserId,
    profileId: input.profileId,
    distributionPostId: input.distributionPostId,
    action: input.action,
    actorUserId: input.actorUserId ?? null,
    channels: input.channels ?? [],
    payload: input.payload ?? {},
    createdAt: nowIso(),
  };
  await col(COLLECTIONS.distributionAuditLog).doc(entry.id).set(entry);
  return entry;
}

export function appendDistributionAuditFireAndForget(
  input: Parameters<typeof appendDistributionAudit>[0],
) {
  void appendDistributionAudit(input).catch((error) => {
    console.error("[distribution-audit] falha ao gravar", error);
  });
}
