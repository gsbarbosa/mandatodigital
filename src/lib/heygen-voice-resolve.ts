import type { HeyGenAssetInput, HeyGenVoiceListItem } from "@/lib/heygen";
import {
  heygenCloneVoice,
  heygenDeleteVoice,
  heygenGetVoiceReadiness,
  heygenListAllPrivateVoices,
  heygenWaitForVoiceReady,
  isHeyGenVoiceGenerationError,
} from "@/lib/heygen";

/** Limite de clones privados por conta na API HeyGen (planos comuns). */
export const HEYGEN_PRIVATE_VOICE_CLONE_LIMIT = 10;

export const HEYGEN_VOICE_CLONE_LIMIT_MESSAGE =
  "Voice clone limit reached (10). Delete unused clones or contact support to increase your limit.";

function normalizeVoiceName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Nome estável por áudio: mesmo asset → reuso; áudio novo → outro nome → clone novo.
 * (Evita o bug de reutilizar qualquer privado "Nome (clone)" após troca de amostra.)
 */
export function buildHeyGenCloneVoiceName(avatarName: string, voiceAudioAssetId: string) {
  const base = avatarName.trim() || "Avatar";
  const shortId = voiceAudioAssetId.trim().slice(0, 8).toLowerCase();
  if (!shortId) {
    return `${base} (clone)`;
  }
  return `${base} (${shortId})`;
}

/** Escolhe um clone privado existente compatível com o nome do avatar. */
export function pickReusablePrivateVoice(
  voices: HeyGenVoiceListItem[],
  voiceName: string,
): string | null {
  const target = normalizeVoiceName(voiceName);
  if (!target) {
    return null;
  }

  const exact = voices.find(
    (voice) =>
      Boolean(voice.voice_id?.trim()) &&
      normalizeVoiceName(String(voice.name ?? "")) === target,
  );
  if (exact?.voice_id?.trim()) {
    return exact.voice_id.trim();
  }

  // Fallback só para nomes legado "... (clone)" ou novos "... (abcd1234)".
  // Não usa includes(base) amplo — pegava qualquer voz do mesmo político.
  return null;
}

/**
 * Órfãos elegíveis a limpeza quando a cota está cheia.
 * Protege o voiceId solicitado e o clone cujo nome bate com o áudio atual.
 */
export function pickPrivateVoicesEligibleForPrune(
  voices: HeyGenVoiceListItem[],
  protectVoiceIds: string[],
): HeyGenVoiceListItem[] {
  const protect = new Set(
    protectVoiceIds.map((id) => id.trim()).filter(Boolean),
  );

  return voices.filter((voice) => {
    const id = voice.voice_id?.trim();
    if (!id || protect.has(id)) {
      return false;
    }
    return true;
  });
}

async function freePrivateVoiceSlot(input: {
  privateVoices: HeyGenVoiceListItem[];
  protectVoiceIds: string[];
}) {
  const candidates = pickPrivateVoicesEligibleForPrune(
    input.privateVoices,
    input.protectVoiceIds,
  );
  if (candidates.length === 0) {
    return false;
  }

  // Remove um órfão (primeiro da lista) para abrir slot; se falhar, tenta o próximo.
  for (const candidate of candidates) {
    const id = candidate.voice_id?.trim();
    if (!id) {
      continue;
    }
    try {
      await heygenDeleteVoice(id);
      return true;
    } catch {
      // template ativo / 403 → tenta outro
    }
  }

  return false;
}

export async function resolveHeyGenClonedVoiceId(input: {
  requestedVoiceId?: string | null;
  voiceName: string;
  audio: HeyGenAssetInput;
  forceReclone?: boolean;
}) {
  let voiceId = input.forceReclone ? "" : String(input.requestedVoiceId ?? "").trim();

  if (voiceId) {
    const readiness = await heygenGetVoiceReadiness(voiceId);
    if (readiness === "ready" || readiness === "processing") {
      return heygenWaitForVoiceReady(voiceId);
    }
    // missing/failed → tentar reuso ou novo clone
    voiceId = "";
  }

  let privateVoices: HeyGenVoiceListItem[] = [];
  try {
    privateVoices = await heygenListAllPrivateVoices();
  } catch {
    privateVoices = [];
  }

  // forceReclone = voz anterior missing/failed; não reutilizar a mesma pelo nome.
  if (!input.forceReclone) {
    const reusable = pickReusablePrivateVoice(privateVoices, input.voiceName);
    if (reusable) {
      const readiness = await heygenGetVoiceReadiness(reusable);
      if (readiness === "ready" || readiness === "processing") {
        return heygenWaitForVoiceReady(reusable);
      }
    }
  }

  if (privateVoices.length >= HEYGEN_PRIVATE_VOICE_CLONE_LIMIT) {
    const protect = [
      String(input.requestedVoiceId ?? "").trim(),
      pickReusablePrivateVoice(privateVoices, input.voiceName) ?? "",
    ];
    const freed = await freePrivateVoiceSlot({
      privateVoices,
      protectVoiceIds: protect,
    });
    if (!freed) {
      throw new Error(HEYGEN_VOICE_CLONE_LIMIT_MESSAGE);
    }
    try {
      privateVoices = await heygenListAllPrivateVoices();
    } catch {
      // segue mesmo assim — a cota pode ter aberto
    }
    if (privateVoices.length >= HEYGEN_PRIVATE_VOICE_CLONE_LIMIT) {
      throw new Error(HEYGEN_VOICE_CLONE_LIMIT_MESSAGE);
    }
  }

  const cloned = await heygenCloneVoice({
    voiceName: input.voiceName,
    audio: input.audio,
  });
  voiceId = cloned.voiceId;

  return heygenWaitForVoiceReady(voiceId);
}

export async function resolveHeyGenClonedVoiceIdWithRetry<T>(input: {
  requestedVoiceId?: string | null;
  voiceName: string;
  audio: HeyGenAssetInput;
  run: (voiceId: string) => Promise<T>;
}) {
  let voiceId = await resolveHeyGenClonedVoiceId({
    requestedVoiceId: input.requestedVoiceId,
    voiceName: input.voiceName,
    audio: input.audio,
  });

  try {
    const value = await input.run(voiceId);
    return { voiceId, value };
  } catch (error) {
    if (!isHeyGenVoiceGenerationError(error)) {
      throw error;
    }

    // Revalida o mesmo id antes de queimar um slot novo.
    const readiness = await heygenGetVoiceReadiness(voiceId);
    if (readiness === "ready" || readiness === "processing") {
      const readyId = await heygenWaitForVoiceReady(voiceId);
      const value = await input.run(readyId);
      return { voiceId: readyId, value };
    }

    // Só reclona se a voz sumiu/falhou de verdade.
    if (readiness !== "missing" && readiness !== "failed") {
      throw error;
    }

    voiceId = await resolveHeyGenClonedVoiceId({
      voiceName: input.voiceName,
      audio: input.audio,
      forceReclone: true,
    });
    const value = await input.run(voiceId);
    return { voiceId, value };
  }
}
