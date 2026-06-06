export type CuradorHeygenPrefs = {
  heygenAvatarId?: string;
  heygenVoiceId?: string;
  heygenAvatarGroupId?: string;
  lastCaricatureAssetId?: string;
  avatarTrack?: "realistic" | "caricature";
  productionSource?: "use_existing" | "train_new";
};

function storageKey(profileId: string) {
  return `mandato:curador-heygen:${profileId}`;
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
    normalized.includes("reached the limit")
  );
}

/** Remove nomes de fornecedores em mensagens exibidas ao usuario. */
export function sanitizeProviderFacingMessage(message: string) {
  return message
    .replace(/\s*\(HeyGen[^)]*\)/gi, "")
    .replace(/\s*—\s*HeyGen/gi, "")
    .replace(/HeyGen/gi, "a plataforma")
    .replace(/OpenAI/gi, "a IA")
    .replace(/Argil/gi, "a plataforma")
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
    "(política comum em gêmeos verificados). Até lá, use \"Utilizar Gêmeo Digital Atual\" para gerar vídeos."
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
      "Limite de Gêmeo Digital verificado: no plano atual só é permitido 1 slot ativo. " +
        "Aguarde o treino em andamento ou use \"Utilizar Gêmeo Digital Atual\" " +
        "ou remova o personagem na plataforma para treinar outro.",
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

  if (normalized.includes("voice clone limit")) {
    hints.push(
      "Limite de clones de voz (10 na conta): a API da plataforma não permite apagar vozes por aqui. " +
        "Abra o painel HeyGen → Voice Library, exclua clones antigos que não usa e volte ao treinamento. " +
        "Depois use \"Remover personagem caricato\" e treine de novo, ou reutilize a voz já vinculada sem gerar outra caricatura do zero.",
    );
  }

  if (hints.length > 0) {
    return hints.join(" ");
  }

  if (isProviderLimitMessage(message)) {
    return "Limite do plano atingido. Tente novamente mais tarde.";
  }

  return null;
}
