export const TSE_SEAL_VERSION = "2026-06-25";

export type CreativeAiMetadata = {
  aiGenerated: true;
  sealVersion: string;
  technologies: string[];
  factCheckId?: string;
  factCheckVerdict?: string;
  usedFreePrompt?: boolean;
  generatedAt: string;
};

export function buildCreativeAiMetadata(input: {
  factCheckVerdict?: string;
  factCheckId?: string;
  usedFreePrompt?: boolean;
  technologies?: string[];
}): CreativeAiMetadata {
  return {
    aiGenerated: true,
    sealVersion: TSE_SEAL_VERSION,
    technologies: input.technologies ?? ["HeyGen"],
    factCheckId: input.factCheckId,
    factCheckVerdict: input.factCheckVerdict,
    usedFreePrompt: input.usedFreePrompt,
    generatedAt: new Date().toISOString(),
  };
}
