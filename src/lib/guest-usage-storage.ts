/**
 * Contadores server-side do free trial (convidado) — fonte da verdade.
 * Persistido em `guestCredits` (mesmo doc do owner).
 *
 * Campos Firestore legados `demoThemeSaves` / `demoVideosByAvatar` são reutilizados
 * para não zerar cotas de quem já usou a degustação.
 */

import {
  GUEST_MAX_VIDEOS_PER_AVATAR,
  GUEST_THEME_SAVE_BLOCKED_MESSAGE,
  GUEST_THEME_SAVE_LIMIT,
  guestVideosExhaustedMessage,
} from "@/lib/guest-limits";
import { getFirestore } from "@/lib/firebase/admin";
import { COLLECTIONS, col } from "@/lib/firebase/collections";

export type GuestVideoBucketKey = "avatar" | "caricature" | "photo_real";

export type GuestUsage = {
  themeSaves: number;
  themeSavesLimit: number;
  themeSavesRemaining: number;
  videosByAvatar: Record<string, number>;
  videosPerAvatarLimit: number;
};

type GuestCreditsUsageFields = {
  demoThemeSaves?: number;
  demoVideosByAvatar?: Record<string, number>;
};

function usageRef(ownerUserId: string) {
  return col(COLLECTIONS.guestCredits).doc(ownerUserId);
}

function normalizeVideosMap(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const n = Number(value);
    if (key.trim() && Number.isFinite(n) && n > 0) {
      out[key] = Math.floor(n);
    }
  }
  return out;
}

export function buildGuestUsage(data: GuestCreditsUsageFields | undefined): GuestUsage {
  const themeSaves = Math.max(0, Math.floor(Number(data?.demoThemeSaves ?? 0)));
  const videosByAvatar = normalizeVideosMap(data?.demoVideosByAvatar);
  return {
    themeSaves,
    themeSavesLimit: GUEST_THEME_SAVE_LIMIT,
    themeSavesRemaining: Math.max(0, GUEST_THEME_SAVE_LIMIT - themeSaves),
    videosByAvatar,
    videosPerAvatarLimit: GUEST_MAX_VIDEOS_PER_AVATAR,
  };
}

export { GUEST_THEME_SAVE_BLOCKED_MESSAGE, guestVideosExhaustedMessage };

export async function getGuestUsage(ownerUserId: string): Promise<GuestUsage> {
  const trimmed = ownerUserId.trim();
  if (!trimmed || trimmed === "anonymous") {
    return buildGuestUsage(undefined);
  }
  const snap = await usageRef(trimmed).get();
  return buildGuestUsage(snap.data() as GuestCreditsUsageFields | undefined);
}

export type ConsumeGuestResult =
  | { ok: true; usage: GuestUsage }
  | { ok: false; usage: GuestUsage };

/** Consome 1 slot de vídeo por bucket (generateMode). Transação. */
export async function tryConsumeGuestVideoQuota(
  ownerUserId: string,
  avatarKey: GuestVideoBucketKey | string,
): Promise<ConsumeGuestResult> {
  const trimmed = ownerUserId.trim();
  const key = avatarKey.trim() || "default";
  if (!trimmed || trimmed === "anonymous") {
    return { ok: false, usage: buildGuestUsage(undefined) };
  }

  const db = getFirestore();
  const ref = usageRef(trimmed);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = (snap.data() as GuestCreditsUsageFields | undefined) ?? {};
    const usage = buildGuestUsage(data);
    const current = usage.videosByAvatar[key] ?? 0;
    if (current >= GUEST_MAX_VIDEOS_PER_AVATAR) {
      return { ok: false, usage };
    }

    const nextMap = { ...usage.videosByAvatar, [key]: current + 1 };
    tx.set(
      ref,
      {
        demoVideosByAvatar: nextMap,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
    return { ok: true, usage: buildGuestUsage({ ...data, demoVideosByAvatar: nextMap }) };
  });
}

/** Devolve 1 slot (falha após consumir, antes do sucesso). */
export async function releaseGuestVideoQuota(
  ownerUserId: string,
  avatarKey: GuestVideoBucketKey | string,
): Promise<void> {
  const trimmed = ownerUserId.trim();
  const key = avatarKey.trim() || "default";
  if (!trimmed || trimmed === "anonymous") {
    return;
  }

  const db = getFirestore();
  const ref = usageRef(trimmed);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = (snap.data() as GuestCreditsUsageFields | undefined) ?? {};
    const map = normalizeVideosMap(data.demoVideosByAvatar);
    const current = map[key] ?? 0;
    if (current <= 0) {
      return;
    }
    const next = current - 1;
    if (next <= 0) {
      delete map[key];
    } else {
      map[key] = next;
    }
    tx.set(
      ref,
      {
        demoVideosByAvatar: map,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
  });
}

/** Consome 1 salvamento de temas no free trial. Transação. */
export async function tryConsumeGuestThemeSave(
  ownerUserId: string,
): Promise<ConsumeGuestResult> {
  const trimmed = ownerUserId.trim();
  if (!trimmed || trimmed === "anonymous") {
    return { ok: false, usage: buildGuestUsage(undefined) };
  }

  const db = getFirestore();
  const ref = usageRef(trimmed);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = (snap.data() as GuestCreditsUsageFields | undefined) ?? {};
    const usage = buildGuestUsage(data);
    if (usage.themeSaves >= GUEST_THEME_SAVE_LIMIT) {
      return { ok: false, usage };
    }

    const nextSaves = usage.themeSaves + 1;
    tx.set(
      ref,
      {
        demoThemeSaves: nextSaves,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
    return {
      ok: true,
      usage: buildGuestUsage({ ...data, demoThemeSaves: nextSaves }),
    };
  });
}
