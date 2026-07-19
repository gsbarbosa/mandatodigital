import { describe, expect, it } from "vitest";

import {
  computeMaxAvatarCrop,
  isAvatarCompatibleAspectRatio,
  pickAvatarTargetRatio,
  AVATAR_LANDSCAPE_RATIO,
  AVATAR_PORTRAIT_RATIO,
} from "./avatar-image-crop";

describe("avatar-image-crop", () => {
  it("aceita 16:9 e 9:16", () => {
    expect(isAvatarCompatibleAspectRatio(1920, 1080)).toBe(true);
    expect(isAvatarCompatibleAspectRatio(1080, 1920)).toBe(true);
  });

  it("rejeita proporcao fora da tolerancia", () => {
    expect(isAvatarCompatibleAspectRatio(2316, 3088)).toBe(false);
  });

  it("escolhe target portrait/landscape", () => {
    expect(pickAvatarTargetRatio(2316, 3088)).toBe(AVATAR_PORTRAIT_RATIO);
    expect(pickAvatarTargetRatio(3088, 2316)).toBe(AVATAR_LANDSCAPE_RATIO);
  });

  it("calcula crop maximo portrait", () => {
    const crop = computeMaxAvatarCrop(2316, 3088, AVATAR_PORTRAIT_RATIO);
    expect(crop.width / crop.height).toBeCloseTo(AVATAR_PORTRAIT_RATIO, 5);
    expect(crop.width).toBeLessThanOrEqual(2316);
    expect(crop.height).toBeLessThanOrEqual(3088);
  });
});
