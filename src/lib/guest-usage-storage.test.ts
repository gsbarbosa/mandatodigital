import { describe, expect, it } from "vitest";

import { GUEST_MAX_VIDEOS_PER_AVATAR, GUEST_THEME_SAVE_LIMIT } from "./guest-limits";
import { buildGuestUsage, guestVideosExhaustedMessage } from "./guest-usage-storage";

describe("buildGuestUsage", () => {
  it("zera quando doc vazio", () => {
    const usage = buildGuestUsage(undefined);
    expect(usage.themeSaves).toBe(0);
    expect(usage.themeSavesRemaining).toBe(GUEST_THEME_SAVE_LIMIT);
    expect(usage.videosByAvatar).toEqual({});
    expect(usage.videosPerAvatarLimit).toBe(GUEST_MAX_VIDEOS_PER_AVATAR);
  });

  it("calcula remaining a partir do doc", () => {
    const usage = buildGuestUsage({
      demoThemeSaves: 2,
      demoVideosByAvatar: { avatar: 2, caricature: 1 },
    });
    expect(usage.themeSavesRemaining).toBe(1);
    expect(usage.videosByAvatar.avatar).toBe(2);
    expect(usage.videosByAvatar.caricature).toBe(1);
  });

  it("mensagem de video alinhada ao client", () => {
    expect(guestVideosExhaustedMessage()).toContain(String(GUEST_MAX_VIDEOS_PER_AVATAR));
  });
});
