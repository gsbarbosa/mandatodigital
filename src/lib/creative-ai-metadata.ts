export const TSE_SEAL_VERSION = "2026-07-10";

/** Texto queimado no rodapé de vídeos/imagens gerados por IA (Res. TSE 23.732). */
export const TSE_SEAL_OVERLAY_TEXT =
  "Imagem e voz sintéticas geradas por IA - Res. TSE 23.732";

/** Tag textual para legendas / clipboard. */
export const TSE_CAPTION_TAG =
  "(Conteúdo sintético gerado por IA - Res. TSE 23.732)";

export const EXPORT_COMPLIANCE_CONSENT_VERSION = "export-liability-v1";

export const EXPORT_COMPLIANCE_MESSAGE =
  "Ao exportar este material para publicação, você assume a responsabilidade integral de incluir na legenda da rede social o aviso de uso de Inteligência Artificial, conforme exigido pela Resolução 23.732 do TSE. O vídeo já contém a marca d'água exigida por lei.";

export type CreativeAiMetadata = {
  aiGenerated: true;
  sealVersion: string;
  technologies: string[];
  factCheckId?: string;
  factCheckVerdict?: string;
  usedFreePrompt?: boolean;
  sealed?: boolean;
  generatedAt: string;
};

export function buildCreativeAiMetadata(input: {
  factCheckVerdict?: string;
  factCheckId?: string;
  usedFreePrompt?: boolean;
  technologies?: string[];
  sealed?: boolean;
}): CreativeAiMetadata {
  return {
    aiGenerated: true,
    sealVersion: TSE_SEAL_VERSION,
    technologies: input.technologies ?? ["HeyGen"],
    factCheckId: input.factCheckId,
    factCheckVerdict: input.factCheckVerdict,
    usedFreePrompt: input.usedFreePrompt,
    sealed: input.sealed,
    generatedAt: new Date().toISOString(),
  };
}

export function withTseCaptionTag(captionOrUrl: string) {
  const base = captionOrUrl.trim();
  if (!base) {
    return TSE_CAPTION_TAG;
  }
  if (base.includes("23.732")) {
    return base;
  }
  return `${base}\n\n${TSE_CAPTION_TAG}`;
}
