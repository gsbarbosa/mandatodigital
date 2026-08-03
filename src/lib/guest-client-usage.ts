/**
 * Contadores client-side do free trial (UX). A cota real é server-side
 * em guest-usage-storage (Firestore).
 */

export const GUEST_STORAGE_KEYS = {
  themeSaves: "md-guest-theme-saves-v1",
  videosByAvatar: "md-guest-videos-by-avatar-v1",
  /** Legado da degustação — lido como fallback. */
  legacyThemeSaves: "md-demo-theme-saves-v1",
  legacyVideosByAvatar: "md-demo-videos-by-avatar-v1",
} as const;

export function readGuestThemeSaveCount(): number {
  if (typeof window === "undefined") {
    return 0;
  }
  const raw =
    window.localStorage.getItem(GUEST_STORAGE_KEYS.themeSaves) ??
    window.localStorage.getItem(GUEST_STORAGE_KEYS.legacyThemeSaves);
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function incrementGuestThemeSaveCount(): number {
  const next = readGuestThemeSaveCount() + 1;
  window.localStorage.setItem(GUEST_STORAGE_KEYS.themeSaves, String(next));
  return next;
}

export function readGuestVideosForAvatar(avatarKey: string): number {
  if (typeof window === "undefined") {
    return 0;
  }
  try {
    const raw =
      window.localStorage.getItem(GUEST_STORAGE_KEYS.videosByAvatar) ??
      window.localStorage.getItem(GUEST_STORAGE_KEYS.legacyVideosByAvatar);
    const map = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    return Math.max(0, Math.floor(map[avatarKey] ?? 0));
  } catch {
    return 0;
  }
}

export function incrementGuestVideosForAvatar(avatarKey: string): number {
  const current = readGuestVideosForAvatar(avatarKey);
  const next = current + 1;
  try {
    const raw =
      window.localStorage.getItem(GUEST_STORAGE_KEYS.videosByAvatar) ??
      window.localStorage.getItem(GUEST_STORAGE_KEYS.legacyVideosByAvatar);
    const map = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    map[avatarKey] = next;
    window.localStorage.setItem(GUEST_STORAGE_KEYS.videosByAvatar, JSON.stringify(map));
  } catch {
    window.localStorage.setItem(
      GUEST_STORAGE_KEYS.videosByAvatar,
      JSON.stringify({ [avatarKey]: next }),
    );
  }
  return next;
}
