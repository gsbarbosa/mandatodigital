import { getFirestore } from "@/lib/firebase/admin";
import { COLLECTIONS, col } from "@/lib/firebase/collections";
import {
  buildGuestSentinelCredits,
  GUEST_SENTINEL_FORCE_CREDITS,
  type GuestSentinelCredits,
} from "@/lib/guest-limits";

type GuestCreditsDoc = {
  sentinelForceUsed?: number;
  updatedAt?: string;
};

function creditsRef(ownerUserId: string) {
  return col(COLLECTIONS.guestCredits).doc(ownerUserId);
}

export async function getGuestSentinelCredits(ownerUserId: string): Promise<GuestSentinelCredits> {
  const trimmed = ownerUserId.trim();
  if (!trimmed || trimmed === "anonymous") {
    return buildGuestSentinelCredits(0);
  }

  const snap = await creditsRef(trimmed).get();
  const used = Number((snap.data() as GuestCreditsDoc | undefined)?.sentinelForceUsed ?? 0);
  return buildGuestSentinelCredits(used);
}

export type ConsumeGuestSentinelCreditResult =
  | { ok: true; credits: GuestSentinelCredits }
  | { ok: false; credits: GuestSentinelCredits };

/**
 * Consome 1 crédito de force-refresh (transação). Não consome se já esgotou.
 */
export async function tryConsumeGuestSentinelCredit(
  ownerUserId: string,
): Promise<ConsumeGuestSentinelCreditResult> {
  const trimmed = ownerUserId.trim();
  if (!trimmed || trimmed === "anonymous") {
    return { ok: false, credits: buildGuestSentinelCredits(GUEST_SENTINEL_FORCE_CREDITS) };
  }

  const db = getFirestore();
  const ref = creditsRef(trimmed);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const used = Number((snap.data() as GuestCreditsDoc | undefined)?.sentinelForceUsed ?? 0);
    if (used >= GUEST_SENTINEL_FORCE_CREDITS) {
      return { ok: false, credits: buildGuestSentinelCredits(used) };
    }

    const nextUsed = used + 1;
    tx.set(
      ref,
      {
        sentinelForceUsed: nextUsed,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
    return { ok: true, credits: buildGuestSentinelCredits(nextUsed) };
  });
}
