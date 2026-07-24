/**
 * Gate de pré-requisitos do Criativo / Independente.
 * Mantém links alinhados à remodelagem (treino vs Personalizar).
 */

export type CriativoGate = {
  reason: string;
  href: string;
  cta: string;
};

export function getCriativoGate(input: {
  spectrum: string;
  hasVoiceAudio: boolean;
  hasPhotoAvatar: boolean;
  hasCaricaturePair: boolean;
}): CriativoGate | null {
  if (!input.spectrum.trim()) {
    return {
      reason: "Defina o posicionamento ideológico em Personalizar.",
      href: "/curador#persona",
      cta: "Ir para Personalizar",
    };
  }
  if (!input.hasVoiceAudio) {
    return {
      reason: "Envie o áudio de voz em Configurar avatar.",
      href: "/avatares/foto-real/treinar#audio",
      cta: "Configurar avatar",
    };
  }
  if (!input.hasPhotoAvatar && !input.hasCaricaturePair) {
    return {
      reason:
        "Envie a foto em Configurar avatar e/ou gere as caricaturas no hub de Avatares.",
      href: "/avatares/foto-real/treinar#foto",
      cta: "Configurar avatar",
    };
  }
  return null;
}
