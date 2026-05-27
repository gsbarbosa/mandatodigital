import { describe, expect, it } from "vitest";

import {
  isArgilCompatibleAspectRatio,
  pickArgilTargetRatio,
  ARGIL_LANDSCAPE_RATIO,
  ARGIL_PORTRAIT_RATIO,
} from "./argil-image";

describe("argil-image", () => {
  it("aceita 16:9 e 9:16", () => {
    expect(isArgilCompatibleAspectRatio(1920, 1080)).toBe(true);
    expect(isArgilCompatibleAspectRatio(1080, 1920)).toBe(true);
  });

  it("rejeita 3:4 comum de celular", () => {
    expect(isArgilCompatibleAspectRatio(2316, 3088)).toBe(false);
  });

  it("escolhe retrato ou paisagem pelo formato", () => {
    expect(pickArgilTargetRatio(2316, 3088)).toBe(ARGIL_PORTRAIT_RATIO);
    expect(pickArgilTargetRatio(3088, 2316)).toBe(ARGIL_LANDSCAPE_RATIO);
  });
});
