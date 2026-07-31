/**
 * Contadores server-side do modo DEMO (fonte da verdade).
 * O localStorage no client continua como UX; sem este módulo o limite era bypassável.
 *
 * Persistido em `guestCredits` (mesmo doc do owner) para não criar collection nova.
 */

import {
  DEMO_MAX_VIDEOS_PER_AVATAR,
  DEMO_THEME_SAVE_BLOCKED_MESSAGE,
  DEMO_THEME_SAVE_LIMIT,
} from "@/lib/demo-mode";
import { getFirestore } from "@/lib/firebase/admin";
import { COLLECTIONS, col } from "@/lib/firebase/collections";

export type DemoVideoBucketKey = "avatar" | "caricature" | "photo_real";

export type DemoUsage = {
  themeSaves: number;
  themeSavesLimit: number;
  themeSavesRemaining: number;
  videosByAvatar: Record<string, number>;
  videosPerAvatarLimit: number;
};

type GuestCreditsDemoFields = {
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

export function buildDemoUsage(data: GuestCreditsDemoFields | undefined): DemoUsage {
  const themeSaves = Math.max(0, Math.floor(Number(data?.demoThemeSaves ?? 0)));
  const videosByAvatar = normalizeVideosMap(data?.demoVideosByAvatar);
  return {
    themeSaves,
    themeSavesLimit: DEMO_THEME_SAVE_LIMIT,
    themeSavesRemaining: Math.max(0, DEMO_THEME_SAVE_LIMIT - themeSaves),
    videosByAvatar,
    videosPerAvatarLimit: DEMO_MAX_VIDEOS_PER_AVATAR,
  };
}

export function demoVideosExhaustedMessage(limit = DEMO_MAX_VIDEOS_PER_AVATAR) {
  return `Limite da degustação atingido: este avatar já gerou ${limit} vídeos. Escolha um plano para continuar produzindo.`;
}

export { DEMO_THEME_SAVE_BLOCKED_MESSAGE };

export async function getDemoUsage(ownerUserId: string): Promise<DemoUsage> {
  const trimmed = ownerUserId.trim();
  if (!trimmed || trimmed === "anonymous") {
    return buildDemoUsage(undefined);
  }
  const snap = await usageRef(trimmed).get();
  return buildDemoUsage(snap.data() as GuestCreditsDemoFields | undefined);
}

export type ConsumeDemoResult =
  | { ok: true; usage: DemoUsage }
  | { ok: false; usage: DemoUsage };

/**
 * Consome 1 slot de vídeo demo por bucket (generateMode). Transação.
 */
export async function tryConsumeDemoVideoQuota(
  ownerUserId: string,
  avatarKey: DemoVideoBucketKey | string,
): Promise<ConsumeDemoResult> {
  const trimmed = ownerUserId.trim();
  const key = avatarKey.trim() || "default";
  if (!trimmed || trimmed === "anonymous") {
    return { ok: false, usage: buildDemoUsage(undefined) };
  }

  const db = getFirestore();
  const ref = usageRef(trimmed);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = (snap.data() as GuestCreditsDemoFields | undefined) ?? {};
    const usage = buildDemoUsage(data);
    const current = usage.videosByAvatar[key] ?? 0;
    if (current >= DEMO_MAX_VIDEOS_PER_AVATAR) {
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
    return { ok: true, usage: buildDemoUsage({ ...data, demoVideosByAvatar: nextMap }) };
  });
}

/** Devolve 1 slot (falha após consumir, antes do sucesso). */
export async function releaseDemoVideoQuota(
  ownerUserId: string,
  avatarKey: DemoVideoBucketKey | string,
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
    const data = (snap.data() as GuestCreditsDemoFields | undefined) ?? {};
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

/**
 * Consome 1 salvamento de temas na degustação. Transação.
 */
export async function tryConsumeDemoThemeSave(
  ownerUserId: string,
): Promise<ConsumeDemoResult> {
  const trimmed = ownerUserId.trim();
  if (!trimmed || trimmed === "anonymous") {
    return { ok: false, usage: buildDemoUsage(undefined) };
  }

  const db = getFirestore();
  const ref = usageRef(trimmed);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = (snap.data() as GuestCreditsDemoFields | undefined) ?? {};
    const usage = buildDemoUsage(data);
    if (usage.themeSaves >= DEMO_THEME_SAVE_LIMIT) {
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
      usage: buildDemoUsage({ ...data, demoThemeSaves: nextSaves }),
    };
  });
}
