import { storeElevenLabsTtsAudio } from "@/lib/elevenlabs-tts-storage";
import {
  elevenLabsCloneVoice,
  elevenLabsListVoices,
  elevenLabsTextToSpeech,
  elevenLabsVoiceExists,
  formatElevenLabsError,
  isElevenLabsIvcSubscriptionError,
  type ElevenLabsVoiceListItem,
} from "@/lib/elevenlabs";
import { getHeyGenVoiceProvider } from "@/lib/feature-flags";
import {
  buildHeyGenCloneVoiceName,
  resolveHeyGenClonedVoiceId,
  resolveHeyGenClonedVoiceIdWithRetry,
} from "@/lib/heygen-voice-resolve";
import type { HeyGenAssetInput } from "@/lib/heygen";
import { appLog, appLogError, startTimer } from "@/lib/observability/log";

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
  const elapsed = startTimer();
  let voiceId = input.forceReclone
    ? ""
    : String(input.requestedVoiceId ?? "").trim();

  if (voiceId) {
    const exists = await elevenLabsVoiceExists(voiceId);
    if (exists) {
      appLog("voice", "elevenlabs_voice_reused", {
        source: "requested",
        durationMs: elapsed(),
      });
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
        appLog("voice", "elevenlabs_voice_reused", {
          source: "list_by_name",
          durationMs: elapsed(),
        });
        return reusable;
      }
    } catch (error) {
      appLogError("voice", "elevenlabs_list_voices_failed", error);
    }
  }

  appLog("voice", "elevenlabs_clone_started");
  const cloned = await elevenLabsCloneVoice({
    voiceName: input.voiceName,
    audioUrl: input.audioUrl,
  });
  appLog("voice", "elevenlabs_clone_completed", {
    durationMs: elapsed(),
  });
  return cloned.voiceId;
}

export type ResolvedVideoSpeech =
  | {
      provider: "heygen_clone";
      voiceId: string;
      fallbackFromElevenLabs?: boolean;
    }
  | {
      provider: "elevenlabs_audio";
      elevenLabsVoiceId: string;
      audioUrl: string;
    };

async function resolveHeyGenSpeech(input: {
  avatarName: string;
  voiceAudioAssetId: string;
  voiceAudioUrl: string;
  requestedHeygenVoiceId?: string | null;
  fallbackFromElevenLabs?: boolean;
}): Promise<ResolvedVideoSpeech> {
  const voiceId = await resolveHeyGenClonedVoiceId({
    requestedVoiceId: input.requestedHeygenVoiceId,
    voiceName: buildHeyGenCloneVoiceName(
      input.avatarName,
      input.voiceAudioAssetId,
    ),
    audio: { type: "url", url: input.voiceAudioUrl },
  });

  return {
    provider: "heygen_clone",
    voiceId,
    ...(input.fallbackFromElevenLabs ? { fallbackFromElevenLabs: true } : {}),
  };
}

/**
 * Resolve fala para Create Video:
 * - elevenlabs_audio: IVC + TTS → URL pública MP3
 * - heygen_clone: path legado (voice_id + script)
 *
 * Se o plano ElevenLabs não incluir IVC, faz fallback automático para heygen_clone.
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
  const elapsed = startTimer();
  appLog("voice", "speech_resolve_started", {
    provider,
    voiceAudioAssetId: input.voiceAudioAssetId,
    transcriptChars: input.transcript.length,
    mediaId: input.mediaId,
  });

  if (provider === "elevenlabs_audio") {
    try {
      const voiceName = buildElevenLabsCloneVoiceName(
        input.avatarName,
        input.voiceAudioAssetId,
      );
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
      appLog("voice", "speech_resolve_completed", {
        provider: "elevenlabs_audio",
        voiceAudioAssetId: input.voiceAudioAssetId,
        mediaId: input.mediaId,
        mp3Bytes: mp3.byteLength,
        durationMs: elapsed(),
      });
      return {
        provider: "elevenlabs_audio",
        elevenLabsVoiceId,
        audioUrl: stored.audioUrl,
      };
    } catch (error) {
      if (!isElevenLabsIvcSubscriptionError(error)) {
        appLogError("voice", "speech_resolve_failed", error, {
          provider: "elevenlabs_audio",
          voiceAudioAssetId: input.voiceAudioAssetId,
          durationMs: elapsed(),
        });
        throw error;
      }
      console.warn(
        "[voice] ElevenLabs sem IVC no plano — fallback para heygen_clone:",
        formatElevenLabsError(error),
      );
      appLog(
        "voice",
        "provider_fallback",
        {
          from: "elevenlabs_audio",
          to: "heygen_clone",
          reason: "ivc_subscription",
          voiceAudioAssetId: input.voiceAudioAssetId,
        },
        "warn",
      );
      return resolveHeyGenSpeech({
        avatarName: input.avatarName,
        voiceAudioAssetId: input.voiceAudioAssetId,
        voiceAudioUrl: input.voiceAudioUrl,
        requestedHeygenVoiceId: input.requestedHeygenVoiceId,
        fallbackFromElevenLabs: true,
      });
    }
  }

  const heygen = await resolveHeyGenSpeech({
    avatarName: input.avatarName,
    voiceAudioAssetId: input.voiceAudioAssetId,
    voiceAudioUrl: input.voiceAudioUrl,
    requestedHeygenVoiceId: input.requestedHeygenVoiceId,
  });
  appLog("voice", "speech_resolve_completed", {
    provider: "heygen_clone",
    voiceAudioAssetId: input.voiceAudioAssetId,
    durationMs: elapsed(),
  });
  return heygen;
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
