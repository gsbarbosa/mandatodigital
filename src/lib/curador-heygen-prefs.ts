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

/** Explica qual limite da plataforma foi atingido (pode haver mais de um na mesma resposta). */
export function formatProviderLimitHint(message: string): string | null {
  const normalized = message.toLowerCase();
  const hints: string[] = [];

  if (normalized.includes("verified avatar group")) {
    hints.push(
      "Limite de Gêmeo Digital verificado: no plano atual só é permitido 1 slot ativo. " +
        "Finalize o consentimento do treino em andamento, use \"Utilizar Gêmeo Digital Atual\" " +
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

  if (hints.length > 0) {
    return hints.join(" ");
  }

  if (isProviderLimitMessage(message)) {
    return "Limite do plano atingido. Tente novamente mais tarde.";
  }

  return null;
}
