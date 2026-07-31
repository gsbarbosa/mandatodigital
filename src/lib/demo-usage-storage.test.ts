import { describe, expect, it } from "vitest";

import { DEMO_MAX_VIDEOS_PER_AVATAR, DEMO_THEME_SAVE_LIMIT } from "./demo-mode";
import { buildDemoUsage, demoVideosExhaustedMessage } from "./demo-usage-storage";

describe("buildDemoUsage", () => {
  it("zera quando doc vazio", () => {
    const usage = buildDemoUsage(undefined);
    expect(usage.themeSaves).toBe(0);
    expect(usage.themeSavesRemaining).toBe(DEMO_THEME_SAVE_LIMIT);
    expect(usage.videosByAvatar).toEqual({});
    expect(usage.videosPerAvatarLimit).toBe(DEMO_MAX_VIDEOS_PER_AVATAR);
  });

  it("calcula remaining a partir do doc", () => {
    const usage = buildDemoUsage({
      demoThemeSaves: 2,
      demoVideosByAvatar: { avatar: 2, caricature: 1 },
    });
    expect(usage.themeSavesRemaining).toBe(1);
    expect(usage.videosByAvatar.avatar).toBe(2);
    expect(usage.videosByAvatar.caricature).toBe(1);
  });

  it("mensagem de video alinhada ao client", () => {
    expect(demoVideosExhaustedMessage()).toContain(String(DEMO_MAX_VIDEOS_PER_AVATAR));
  });
});
