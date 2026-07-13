import { describe, expect, it } from "vitest";

import {
  buildCreativeAiMetadata,
  withTseCaptionTag,
  TSE_CAPTION_TAG,
} from "@/lib/creative-ai-metadata";

describe("creative-ai-metadata", () => {
  it("marca conteudo como gerado por IA com versao do selo", () => {
    const metadata = buildCreativeAiMetadata({
      factCheckVerdict: "verified",
      technologies: ["HeyGen", "OpenAI"],
      sealed: true,
    });

    expect(metadata.aiGenerated).toBe(true);
    expect(metadata.sealVersion).toBeTruthy();
    expect(metadata.technologies).toContain("HeyGen");
    expect(metadata.factCheckVerdict).toBe("verified");
    expect(metadata.sealed).toBe(true);
  });

  it("injeta tag TSE ao copiar legenda", () => {
    expect(withTseCaptionTag("https://example.com/caption.srt")).toContain(TSE_CAPTION_TAG);
    expect(withTseCaptionTag(TSE_CAPTION_TAG)).toBe(TSE_CAPTION_TAG);
  });
});
