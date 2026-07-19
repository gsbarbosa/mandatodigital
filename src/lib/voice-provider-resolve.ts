import { storeElevenLabsTtsAudio } from "@/lib/elevenlabs-tts-storage";
import {
  elevenLabsCloneVoice,
  elevenLabsListVoices,
  elevenLabsTextToSpeech,
  elevenLabsVoiceExists,
  type ElevenLabsVoiceListItem,
} from "@/lib/elevenlabs";
import { getHeyGenVoiceProvider } from "@/lib/feature-flags";
import {
  buildHeyGenCloneVoiceName,
  resolveHeyGenClonedVoiceId,
  resolveHeyGenClonedVoiceIdWithRetry,
} from "@/lib/heygen-voice-resolve";
import type { HeyGenAssetInput } from "@/lib/heygen";

export function buildElevenLabsCloneVoiceName(
  avatarName: string,
  voiceAudioAssetId: string,
) {
  const base = avatarName.trim() || "Avatar";
  const shortId = voiceAudioAssetId.trim().slice(0, 8).toLowerCase();
  if (!shortId) {
    return `${base} (IVC)`;
  }
  return `${base} (${shortId})`;
}

function normalizeVoiceName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Acha um clone ElevenLabs existente com nome igual (mesmo asset de audio). */
export function pickReusableElevenLabsVoice(
  voices: ElevenLabsVoiceListItem[],
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
  return exact?.voice_id?.trim() || null;
}

export async function resolveElevenLabsVoiceId(input: {
  requestedVoiceId?: string | null;
  voiceName: string;
  audioUrl: string;
  forceReclone?: boolean;
}) {
  let voiceId = input.forceReclone
    ? ""
    : String(input.requestedVoiceId ?? "").trim();

  if (voiceId) {
    const exists = await elevenLabsVoiceExists(voiceId);
    if (exists) {
      return voiceId;
    }
    voiceId = "";
  }

  // Sem voiceId valido em maos: procura um clone existente com o mesmo nome
  // (mesmo avatar + mesmo asset de audio) antes de gastar uma clonagem nova.
  if (!input.forceReclone) {
    try {
      const voices = await elevenLabsListVoices();
      const reusable = pickReusableElevenLabsVoice(voices, input.voiceName);
      if (reusable) {
        return reusable;
      }
    } catch {
      // listagem falhou -> segue para clonar
    }
  }

  const cloned = await elevenLabsCloneVoice({
    voiceName: input.voiceName,
    audioUrl: input.audioUrl,
  });
  return cloned.voiceId;
}

export type ResolvedVideoSpeech =
  | {
      provider: "heygen_clone";
      voiceId: string;
    }
  | {
      provider: "elevenlabs_audio";
      elevenLabsVoiceId: string;
      audioUrl: string;
    };

/**
 * Resolve fala para Create Video:
 * - elevenlabs_audio: IVC + TTS → URL pública MP3
 * - heygen_clone: path legado (voice_id + script)
 */
export async function resolveVideoSpeechForGeneration(input: {
  transcript: string;
  avatarName: string;
  voiceAudioAssetId: string;
  voiceAudioUrl: string;
  requestedHeygenVoiceId?: string | null;
  requestedElevenLabsVoiceId?: string | null;
  mediaId: string;
}): Promise<ResolvedVideoSpeech> {
  const provider = getHeyGenVoiceProvider();
  const voiceName = buildElevenLabsCloneVoiceName(
    input.avatarName,
    input.voiceAudioAssetId,
  );

  if (provider === "elevenlabs_audio") {
    const elevenLabsVoiceId = await resolveElevenLabsVoiceId({
      requestedVoiceId: input.requestedElevenLabsVoiceId,
      voiceName,
      audioUrl: input.voiceAudioUrl,
    });
    const mp3 = await elevenLabsTextToSpeech({
      voiceId: elevenLabsVoiceId,
      text: input.transcript,
    });
    const stored = await storeElevenLabsTtsAudio({
      mediaId: input.mediaId,
      buffer: mp3,
    });
    return {
      provider: "elevenlabs_audio",
      elevenLabsVoiceId,
      audioUrl: stored.audioUrl,
    };
  }

  const voiceId = await resolveHeyGenClonedVoiceId({
    requestedVoiceId: input.requestedHeygenVoiceId,
    voiceName: buildHeyGenCloneVoiceName(
      input.avatarName,
      input.voiceAudioAssetId,
    ),
    audio: { type: "url", url: input.voiceAudioUrl },
  });

  return { provider: "heygen_clone", voiceId };
}

export async function resolveHeyGenVoiceWithRetryForImageVideo<T>(input: {
  requestedVoiceId?: string | null;
  avatarName: string;
  voiceAudioAssetId: string;
  voiceAudioUrl: string;
  run: (voiceId: string) => Promise<T>;
}) {
  return resolveHeyGenClonedVoiceIdWithRetry({
    requestedVoiceId: input.requestedVoiceId,
    voiceName: buildHeyGenCloneVoiceName(
      input.avatarName,
      input.voiceAudioAssetId,
    ),
    audio: { type: "url", url: input.voiceAudioUrl } satisfies HeyGenAssetInput,
    run: input.run,
  });
}
