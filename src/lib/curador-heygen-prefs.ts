import type { AvatarTipoSlug } from "@/lib/avatar-tipos";

export type CuradorHeygenPrefs = {
  heygenAvatarId?: string;
  heygenVoiceId?: string;
  heygenVoiceAudioAssetId?: string;
  /** Clone Instant Voice na ElevenLabs (path audio_url). */
  elevenLabsVoiceId?: string;
  /** Asset de áudio que gerou o elevenLabsVoiceId. */
  elevenLabsVoiceAudioAssetId?: string;
  heygenAvatarGroupId?: string;
  lastCaricatureAssetId?: string;
  avatarTrack?: "realistic" | "caricature" | "photo_real";
  productionSource?: "use_existing" | "train_new";
  /** Último tipo escolhido no hub de avatares (/avatares/[tipo]). */
  lastAvatarTipoSlug?: AvatarTipoSlug;
};

function storageKey(profileId: string) {
  return `mandato:curador-heygen:${profileId}`;
}

export function shouldInvalidateHeygenVoiceClone(
  prefs: CuradorHeygenPrefs,
  voiceAudioAssetId: string,
) {
  const savedVoiceId = prefs.heygenVoiceId?.trim();
  const savedAudioAssetId = prefs.heygenVoiceAudioAssetId?.trim();
  const currentAudioAssetId = voiceAudioAssetId.trim();

  if (!savedVoiceId) {
    return false;
  }

  if (!currentAudioAssetId) {
    return false;
  }

  // Sem vínculo áudio↔clone, não dá pra saber se a voz ainda bate com a amostra atual.
  if (!savedAudioAssetId) {
    return true;
  }

  return savedAudioAssetId !== currentAudioAssetId;
}

/**
 * Depois de /api/heygen/train: no path `elevenlabs_audio` a clonagem é adiada
 * para a geração do vídeo (IVC efêmero). Exigir voiceId aqui bloqueia o Criativo
 * mesmo com o áudio já importado.
 */
export function isVoicePreparedForGeneration(input: {
  hasVoiceAudioAsset: boolean;
  voiceId?: string | null;
  elevenLabsVoiceId?: string | null;
  voiceProvider?: string | null;
}): boolean {
  if (!input.hasVoiceAudioAsset) {
    return false;
  }
  if (String(input.voiceProvider ?? "").trim() === "elevenlabs_audio") {
    return true;
  }
  return Boolean(
    String(input.voiceId ?? "").trim() ||
      String(input.elevenLabsVoiceId ?? "").trim(),
  );
}

/** Invalida vínculo ElevenLabs quando a amostra de áudio mudou. */
export function shouldInvalidateElevenLabsVoiceClone(
  prefs: CuradorHeygenPrefs,
  voiceAudioAssetId: string,
) {
  const savedVoiceId = prefs.elevenLabsVoiceId?.trim();
  const savedAudioAssetId = prefs.elevenLabsVoiceAudioAssetId?.trim();
  const currentAudioAssetId = voiceAudioAssetId.trim();

  if (!savedVoiceId) {
    return false;
  }

  if (!currentAudioAssetId) {
    return false;
  }

  if (!savedAudioAssetId) {
    return true;
  }

  return savedAudioAssetId !== currentAudioAssetId;
}

export function readCuradorHeygenPrefs(profileId: string): CuradorHeygenPrefs {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(storageKey(profileId));
    if (!raw) {
      return {};
    }
    return JSON.parse(raw) as CuradorHeygenPrefs;
  } catch {
    return {};
  }
}

export function writeCuradorHeygenPrefs(profileId: string, prefs: CuradorHeygenPrefs) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(storageKey(profileId), JSON.stringify(prefs));
  } catch {
    // ignore quota / private mode
  }
}

export function isProviderLimitMessage(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("100 submissions") ||
    normalized.includes("submissions per day") ||
    normalized.includes("verified avatar group") ||
    normalized.includes("voice clone limit") ||
    normalized.includes("instant voice cloning") ||
    normalized.includes("does not include instant voice") ||
    normalized.includes("reached the limit") ||
    normalized.includes("maximum amount of custom voices") ||
    normalized.includes("custom voice limit")
  );
}

/** Remove nomes de fornecedores e CTAs obsoletos em mensagens exibidas ao usuario. */
export function sanitizeProviderFacingMessage(message: string) {
  return message
    .replace(/painel HeyGen\s*→\s*Voice Library/gi, "biblioteca de vozes do painel")
    .replace(
      /biblioteca de vozes do painel HeyGen\s*\(Voice Library\)/gi,
      "biblioteca de vozes do painel",
    )
    .replace(/Voice Library do painel HeyGen/gi, "biblioteca de vozes do painel")
    .replace(/wallet da API da HeyGen/gi, "saldo da conta")
    .replace(/HeyGen falhou/gi, "A plataforma retornou um erro")
    .replace(/Treinar \(HeyGen\)/gi, "treine em Configurar avatar")
    .replace(/Preparar voz \(HeyGen\)/gi, "prepare a voz em Configurar avatar")
    .replace(/\s*\(HeyGen[^)]*\)/gi, "")
    .replace(/\s*—\s*HeyGen/gi, "")
    .replace(/\bHeyGen\b/gi, "a plataforma")
    .replace(/\bOpenAI\b/gi, "o serviço de IA")
    .replace(/\bElevenLabs\b/gi, "o serviço de voz")
    .replace(/\bAyrshare\b/gi, "o serviço de publicação")
    .replace(/\bApify\b/gi, "o serviço de coleta")
    .replace(/\bHeyGen\b/gi, "a plataforma")
    .replace(/OPENAI_API_KEY/gi, "configuração do servidor")
    .replace(/HEYGEN_API_KEY/gi, "configuração do servidor")
    .replace(/Utilizar Gêmeo Digital Atual/gi, "use o gêmeo já treinado")
    .replace(/Treinar outro Gêmeo Digital/gi, "use Refazer no hub de Avatares")
    .replace(/Remover personagem caricato/gi, "Refazer no card Caricatura")
    .replace(/Remover gêmeo digital/gi, "Refazer no card Gêmeo digital")
    .replace(/\bno Curador\b/gi, "em Configurar avatar")
    .replace(/\bVoice Library\b/gi, "biblioteca de vozes")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Bloqueio temporário da HeyGen em gêmeos verificados (não permite delete até uma data). */
export function formatHeyGenAvatarGroupLockMessage(message: string): string | null {
  const match = message.match(
    /cannot modify this avatar group until\s+(\d{4})-(\d{2})-(\d{2})/i,
  );
  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  const datePt = `${day}/${month}/${year}`;
  return (
    `Este gêmeo digital está bloqueado pela plataforma até ${datePt}. ` +
    "Não é possível remover ou substituir o personagem antes dessa data " +
    "(política comum em gêmeos verificados). Até lá, você pode gerar vídeos com o gêmeo atual no Criativo."
  );
}

export function formatHeyGenPurgeFailureMessage(
  errors?: Array<{ groupId: string; message: string }>,
  fallback?: string,
): string {
  const first = errors?.[0]?.message?.trim();
  if (first) {
    const lockMessage = formatHeyGenAvatarGroupLockMessage(first);
    if (lockMessage) {
      return lockMessage;
    }
    return sanitizeProviderFacingMessage(first);
  }

  return (
    sanitizeProviderFacingMessage(fallback ?? "") ||
    "Não foi possível remover o personagem na plataforma."
  );
}

/** Mensagem amigável quando a HeyGen rejeita por saldo da API (não confundir com créditos do plano web). */
export function formatHeyGenInsufficientCreditMessage(message: string) {
  const normalized = message.toLowerCase();
  if (
    !normalized.includes("insufficient credit") &&
    !normalized.includes("movio_payment_insufficient_credit")
  ) {
    return null;
  }

  return (
    "Saldo insuficiente para gerar este vídeo. " +
    "Encurte o roteiro ou tente novamente em alguns minutos."
  );
}

/** Explica qual limite da plataforma foi atingido (pode haver mais de um na mesma resposta). */
export function formatProviderLimitHint(message: string): string | null {
  const normalized = message.toLowerCase();
  const hints: string[] = [];

  const lockHint = formatHeyGenAvatarGroupLockMessage(message);
  if (lockHint) {
    hints.push(lockHint);
  }

  if (normalized.includes("verified avatar group")) {
    hints.push(
      "Limite de gêmeo digital verificado: no plano atual só é permitido 1 slot ativo. " +
        "Aguarde o treinamento em andamento ou use Refazer no hub de Avatares para treinar outro.",
    );
  }

  if (
    normalized.includes("100 submissions") ||
    normalized.includes("submissions per day")
  ) {
    hints.push(
      "Limite de operações diárias: no plano atual há até 100 envios por dia. " +
        "Tente novamente amanhã.",
    );
  }

  if (
    normalized.includes("instant voice cloning") ||
    normalized.includes("does not include instant voice") ||
    (normalized.includes("upgrade your plan") && normalized.includes("voice"))
  ) {
    hints.push(
      "O serviço de voz não inclui clonagem instantânea neste plano. " +
        "O sistema tenta usar a voz da plataforma de vídeo automaticamente; " +
        "se o erro persistir, tente novamente em alguns minutos.",
    );
  }

  if (
    normalized.includes("maximum amount of custom voices") ||
    normalized.includes("custom voice limit")
  ) {
    hints.push(
      "Limite de vozes customizadas atingido. Tente novamente em alguns minutos.",
    );
  }

  if (normalized.includes("voice clone limit")) {
    hints.push(
      "Limite de clones de voz atingido. Tente novamente em alguns minutos.",
    );
  }

  const creditHint = formatHeyGenInsufficientCreditMessage(message);
  if (creditHint) {
    hints.push(creditHint);
  }

  if (hints.length > 0) {
    return hints.join(" ");
  }

  if (isProviderLimitMessage(message)) {
    return "Limite do plano atingido. Tente novamente mais tarde.";
  }

  return null;
}
