import type { HeyGenAssetInput, HeyGenVoiceListItem } from "@/lib/heygen";
import {
  heygenCloneVoice,
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

  // Fallback: qualquer privado cujo nome contenha o nome base (sem sufixo " (clone)").
  const base = target.replace(/\s*\(clone\)\s*$/i, "").trim();
  if (base) {
    const partial = voices.find(
      (voice) =>
        Boolean(voice.voice_id?.trim()) &&
        normalizeVoiceName(String(voice.name ?? "")).includes(base),
    );
    if (partial?.voice_id?.trim()) {
      return partial.voice_id.trim();
    }
  }

  return null;
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
    throw new Error(HEYGEN_VOICE_CLONE_LIMIT_MESSAGE);
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
