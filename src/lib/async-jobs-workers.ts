import {
  claimAsyncJob,
  completeAsyncJob,
  failAsyncJob,
  getAsyncJob,
  requeueAsyncJob,
} from "@/lib/async-jobs-storage";
import type { SealVideoPayload, VoiceTtsPayload } from "@/lib/async-jobs-types";
import { resolveVideoSpeechForGeneration } from "@/lib/voice-provider-resolve";
import { heygenCreateVideoFromImage } from "@/lib/heygen";
import { sealRemoteVideo } from "@/lib/media-tse-seal";
import { resolveAppBaseUrl } from "@/lib/training-asset-urls";

export async function processSealJob(jobId: string) {
  const claimed = await claimAsyncJob(jobId);
  if (!claimed) {
    const existing = await getAsyncJob(jobId);
    if (existing?.status === "succeeded") {
      return existing;
    }
    throw new Error(`Job ${jobId} indisponivel para claim (status=${existing?.status ?? "missing"}).`);
  }

  if (claimed.type !== "seal_video") {
    throw new Error(`Job ${jobId} nao e seal_video.`);
  }

  const payload = claimed.payload as unknown as SealVideoPayload;
  try {
    const sealed = await sealRemoteVideo({
      videoUrl: String(payload.videoUrl ?? ""),
      mediaId: String(payload.mediaId ?? jobId),
      guestTestWatermark: Boolean(payload.guestTestWatermark),
    });
    return await completeAsyncJob(jobId, {
      sealedUrl: sealed.sealedUrl,
      storagePath: sealed.storagePath,
      sealVersion: sealed.sealVersion,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha na selagem.";
    const failed = await failAsyncJob(jobId, message);
    if (failed.status === "failed" && failed.attempts < failed.maxAttempts) {
      await requeueAsyncJob(jobId);
    }
    throw error;
  }
}

export async function processVoiceJob(jobId: string) {
  const claimed = await claimAsyncJob(jobId);
  if (!claimed) {
    const existing = await getAsyncJob(jobId);
    if (existing?.status === "succeeded") {
      return existing;
    }
    throw new Error(`Job ${jobId} indisponivel para claim (status=${existing?.status ?? "missing"}).`);
  }

  if (claimed.type !== "voice_tts") {
    throw new Error(`Job ${jobId} nao e voice_tts.`);
  }

  const payload = claimed.payload as unknown as VoiceTtsPayload;
  try {
    const speech = await resolveVideoSpeechForGeneration({
      transcript: String(payload.transcript ?? ""),
      avatarName: String(payload.avatarName ?? "Avatar"),
      voiceAudioAssetId: String(payload.voiceAudioAssetId ?? ""),
      voiceAudioUrl: String(payload.voiceAudioUrl ?? ""),
      requestedElevenLabsVoiceId: payload.requestedElevenLabsVoiceId,
      requestedHeygenVoiceId: payload.requestedHeygenVoiceId,
      mediaId: jobId,
    });

    const result: Record<string, unknown> = {
      voiceProvider: speech.provider,
    };

    if (speech.provider === "elevenlabs_audio") {
      result.elevenLabsVoiceId = speech.elevenLabsVoiceId;
      result.audioUrl = speech.audioUrl;
    } else {
      result.voiceId = speech.voiceId;
      if (speech.fallbackFromElevenLabs) {
        result.fallbackFromElevenLabs = true;
      }
    }

    if (payload.createVideo?.imageUrl) {
      const appBaseUrl = resolveAppBaseUrl();
      const callbackUrl = appBaseUrl.startsWith("https://")
        ? `${appBaseUrl}/api/heygen/webhooks`
        : undefined;

      const created =
        speech.provider === "elevenlabs_audio"
          ? await heygenCreateVideoFromImage({
              image: { type: "url", url: payload.createVideo.imageUrl },
              audioUrl: speech.audioUrl,
              title: payload.createVideo.title,
              aspectRatio: "9:16",
              resolution: "1080p",
              callbackUrl,
            })
          : await heygenCreateVideoFromImage({
              image: { type: "url", url: payload.createVideo.imageUrl },
              voiceId: speech.voiceId,
              script: String(payload.transcript ?? ""),
              title: payload.createVideo.title,
              aspectRatio: "9:16",
              resolution: "1080p",
              callbackUrl,
            });

      result.heygenVideoId = created.videoId;
      result.generateMode = payload.createVideo.generateMode;
    }

    return await completeAsyncJob(jobId, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha no TTS/voz.";
    const failed = await failAsyncJob(jobId, message);
    if (failed.status === "failed" && failed.attempts < failed.maxAttempts) {
      await requeueAsyncJob(jobId);
    }
    throw error;
  }
}

/** Dispara worker local sem aguardar (dev / Pub/Sub off). */
export function kickLocalWorker(type: "seal_video" | "voice_tts", jobId: string) {
  const run = type === "seal_video" ? processSealJob(jobId) : processVoiceJob(jobId);
  void run.catch((error) => {
    console.error(`[async-jobs] worker local falhou job=${jobId}`, error);
  });
}
