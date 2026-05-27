import { describe, expect, it } from "vitest";

import {
  computeMaxArgilCrop,
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

  it("calcula recorte maximo 9:16 em foto retrato 3:4", () => {
    const crop = computeMaxArgilCrop(2316, 3088, ARGIL_PORTRAIT_RATIO);
    expect(Math.round(crop.width)).toBe(1737);
    expect(Math.round(crop.height)).toBe(3088);
    expect(Math.round(crop.x)).toBe(290);
  });
});
