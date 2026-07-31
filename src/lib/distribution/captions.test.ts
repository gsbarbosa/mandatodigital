import { describe, expect, it } from "vitest";

import { buildCaptionsByChannel, captionLimitsMap } from "@/lib/distribution/captions";

describe("buildCaptionsByChannel", () => {
  it("respeita limite do X (280)", () => {
    const long = "a".repeat(400);
    const captions = buildCaptionsByChannel(long, ["twitter", "instagram"]);
    expect(captions.twitter!.length).toBeLessThanOrEqual(280);
    expect(captions.instagram!.length).toBeLessThanOrEqual(2200);
  });

  it("aplica override por canal", () => {
    const captions = buildCaptionsByChannel("base", ["linkedin"], {
      linkedin: "override linkedin",
    });
    expect(captions.linkedin).toBe("override linkedin");
  });

  it("expoe mapa de limites", () => {
    const limits = captionLimitsMap();
    expect(limits.twitter).toBe(280);
    expect(limits.threads).toBe(500);
  });
});
