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
    normalized.includes("reached the limit")
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
    .replace(/Treinar \(HeyGen\)/gi, "treine no Curador")
    .replace(/Preparar voz \(HeyGen\)/gi, "prepare a voz no Curador")
    .replace(/\s*\(HeyGen[^)]*\)/gi, "")
    .replace(/\s*—\s*HeyGen/gi, "")
    .replace(/\bHeyGen\b/gi, "a plataforma")
    .replace(/\bOpenAI\b/gi, "o serviço de IA")
    .replace(/\bHeyGen\b/gi, "a plataforma")
    .replace(/OPENAI_API_KEY/gi, "configuração do servidor")
    .replace(/HEYGEN_API_KEY/gi, "configuração do servidor")
    .replace(/Utilizar Gêmeo Digital Atual/gi, "use o gêmeo já treinado no Curador")
    .replace(/Treinar outro Gêmeo Digital/gi, "use Refazer no Curador")
    .replace(/Remover personagem caricato/gi, "Refazer no card Caricatura")
    .replace(/Remover gêmeo digital/gi, "Refazer no card Gêmeo digital")
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
    "Saldo insuficiente na carteira da API. " +
    "O valor que você vê no plano web do HeyGen (ex.: US$ 8) não é o mesmo pool usado por esta integração — " +
    "a API debita de Settings → API → wallet (pay-as-you-go). " +
    "Recarregue essa carteira ou encurte o roteiro (~US$ 0,05 por segundo em caricatura 1080p)."
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
        "Aguarde o treinamento em andamento ou use Refazer no Curador para treinar outro.",
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
      "O plano da conta de voz (ElevenLabs) não inclui Instant Voice Cloning. " +
        "O sistema tenta usar o clone de voz da plataforma de vídeo automaticamente; " +
        "se o erro persistir, atualize o plano da API de voz ou use HEYGEN_VOICE_PROVIDER=heygen_clone.",
    );
  }

  if (normalized.includes("voice clone limit")) {
    hints.push(
      "Limite de clones de voz HeyGen (10 na conta): use HEYGEN_VOICE_PROVIDER=elevenlabs_audio " +
        "(TTS ElevenLabs → audio_url) ou remova clones órfãos no painel. " +
        "Não apague o vínculo local só para 'Refazer'.",
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
