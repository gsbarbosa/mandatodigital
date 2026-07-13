import { describe, expect, it } from "vitest";

import {
  countCaricaturesForVariant,
  guestCaricatureQuota,
  MAX_GUEST_CARICATURES_PER_VARIANT,
} from "./caricature-asset-variant";
import type { ProfileTrainingAsset } from "./types";

function caricatureAsset(
  id: string,
  filename: string,
): ProfileTrainingAsset {
  return {
    id,
    profileId: "p1",
    draftProfileId: null,
    sourceType: "upload",
    trainingRole: "avatar_caricature",
    storageProvider: "local",
    storageBucket: null,
    storagePath: id,
    originalFilename: filename,
    mimeType: "image/png",
    sizeBytes: 10,
    status: "uploaded",
    errorMessage: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("guestCaricatureQuota", () => {
  it("conta por variante e respeita o limite de convidados", () => {
    const assets = [
      caricatureAsset("1", "caricatura-editorial.png"),
      caricatureAsset("2", "caricatura-editorial.png"),
      caricatureAsset("3", "caricatura-mascot-3d.png"),
    ];

    expect(countCaricaturesForVariant(assets, "editorial")).toBe(2);
    expect(guestCaricatureQuota({ assets, variant: "editorial" })).toEqual({
      used: 2,
      limit: MAX_GUEST_CARICATURES_PER_VARIANT,
      remaining: 1,
      reached: false,
    });
    expect(guestCaricatureQuota({ assets, variant: "mascot_3d" }).used).toBe(1);
  });

  it("marca limite atingido em 3 geracoes", () => {
    const assets = [
      caricatureAsset("1", "caricatura-editorial.png"),
      caricatureAsset("2", "caricatura-editorial.png"),
      caricatureAsset("3", "caricatura-editorial.png"),
    ];

    expect(guestCaricatureQuota({ assets, variant: "editorial" }).reached).toBe(true);
  });
});
