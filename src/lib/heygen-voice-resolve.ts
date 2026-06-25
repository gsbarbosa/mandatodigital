import type { HeyGenAssetInput } from "@/lib/heygen";
import {
  heygenCloneVoice,
  heygenGetVoiceReadiness,
  heygenWaitForVoiceReady,
  isHeyGenVoiceGenerationError,
} from "@/lib/heygen";

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
    voiceId = "";
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

    voiceId = await resolveHeyGenClonedVoiceId({
      voiceName: input.voiceName,
      audio: input.audio,
      forceReclone: true,
    });
    const value = await input.run(voiceId);
    return { voiceId, value };
  }
}
