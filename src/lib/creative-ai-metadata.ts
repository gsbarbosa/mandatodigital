export const TSE_SEAL_VERSION = "2026-08-15";

/**
 * Texto queimado no rodapé de vídeos/imagens gerados por IA.
 * Norma: art. 9º-B da Res. TSE 23.610/2019 (redação da Res. TSE 23.755/2026).
 */
export const TSE_SEAL_OVERLAY_TEXT =
  "Conteúdo gerado por Inteligência Artificial - Res. TSE 23.610/19 e 23.755/26";

/** Watermark adicional para contas convidado / sem validade legal de campanha. */
export const GUEST_TEST_WATERMARK_TEXT = "VERSÃO DE TESTE - SEM VALIDADE LEGAL";

/** Tag textual para legendas / clipboard. */
export const TSE_CAPTION_TAG =
  "(Conteúdo gerado por Inteligência Artificial - Res. TSE 23.610/19 e 23.755/26)";

export const EXPORT_COMPLIANCE_CONSENT_VERSION = "export-liability-v3";

export const EXPORT_COMPLIANCE_MESSAGE =
  "Ao exportar este material para publicação, você assume a responsabilidade integral de incluir na legenda da rede social o aviso de uso de Inteligência Artificial, conforme exigido pela Resolução TSE 23.610/19 e 23.755/26. O vídeo já contém a marca d'água exigida por lei. Se você editar o arquivo offline (recorte, filtros, reencode), a marca d'água pode ser removida — cabe a você garantir a conformidade na publicação.";

export type CreativeAiMetadata = {
  aiGenerated: true;
  sealVersion: string;
  technologies: string[];
  factCheckId?: string;
  factCheckVerdict?: string;
  usedFreePrompt?: boolean;
  sealed?: boolean;
  sealedStoragePath?: string;
  generatedAt: string;
};

export function buildCreativeAiMetadata(input: {
  factCheckVerdict?: string;
  factCheckId?: string;
  usedFreePrompt?: boolean;
  technologies?: string[];
  sealed?: boolean;
  sealedStoragePath?: string;
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
    ...(input.sealedStoragePath?.trim()
      ? { sealedStoragePath: input.sealedStoragePath.trim() }
      : {}),
  };
}

export function withTseCaptionTag(captionOrUrl: string) {
  const base = captionOrUrl.trim();
  if (!base) {
    return TSE_CAPTION_TAG;
  }
  if (
    base.includes("23.610") ||
    base.includes("23.755") ||
    base.includes("23.732") ||
    base.includes("Inteligência Artificial")
  ) {
    return base;
  }
  return `${base}\n\n${TSE_CAPTION_TAG}`;
}
