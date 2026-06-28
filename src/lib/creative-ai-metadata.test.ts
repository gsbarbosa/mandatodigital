import { describe, expect, it } from "vitest";

import { buildCreativeAiMetadata } from "@/lib/creative-ai-metadata";

describe("creative-ai-metadata", () => {
  it("marca conteudo como gerado por IA com versao do selo", () => {
    const metadata = buildCreativeAiMetadata({
      factCheckVerdict: "verified",
      technologies: ["HeyGen", "OpenAI"],
    });

    expect(metadata.aiGenerated).toBe(true);
    expect(metadata.sealVersion).toBeTruthy();
    expect(metadata.technologies).toContain("HeyGen");
    expect(metadata.factCheckVerdict).toBe("verified");
  });
});
