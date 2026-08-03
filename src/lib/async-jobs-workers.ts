import {
  claimAsyncJob,
  completeAsyncJob,
  failAsyncJob,
  getAsyncJob,
  requeueAsyncJob,
} from "@/lib/async-jobs-storage";
import type {
  PublishPostJobPayload,
  SealVideoPayload,
  VoiceTtsPayload,
} from "@/lib/async-jobs-types";
import { isDistributionChannelId } from "@/lib/distribution/channels";
import { checkElectoralBlackout } from "@/lib/distribution/blackout";
import { socialConnectionStorage } from "@/lib/distribution/connection-storage";
import { distributionPostStorage } from "@/lib/distribution/post-storage";
import { getSocialPublisher } from "@/lib/distribution/providers/ayrshare-publisher";
import type { ChannelDeliveryState, DistributionPostStatus } from "@/lib/distribution/types";
import { appendDistributionAuditFireAndForget } from "@/lib/distribution/audit";
import { resolveVideoSpeechForGeneration } from "@/lib/voice-provider-resolve";
import { heygenCreateVideoFromImage } from "@/lib/heygen";
import { sealRemoteVideo } from "@/lib/media-tse-seal";
import { resolveAppBaseUrl } from "@/lib/training-asset-urls";

function nowIso() {
  return new Date().toISOString();
}

function derivePostStatus(
  channels: ChannelDeliveryState[],
  scheduled: boolean,
): DistributionPostStatus {
  if (channels.length === 0) {
    return "failed";
  }
  const published = channels.filter((c) => c.status === "published").length;
  const scheduledCount = channels.filter((c) => c.status === "scheduled").length;
  const failed = channels.filter((c) => c.status === "failed").length;
  if (failed === channels.length) {
    return "failed";
  }
  if (failed > 0) {
    return "partial_failure";
  }
  if (scheduled || scheduledCount === channels.length) {
    return "scheduled";
  }
  if (published === channels.length) {
    return "published";
  }
  return "publishing";
}

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
      campaignTarja: Boolean(payload.campaignTarja),
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
  const { appLog, appLogError, startTimer } = await import("@/lib/observability/log");
  const elapsed = startTimer();
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
  appLog("async-jobs", "voice_job_started", {
    jobId,
    voiceAudioAssetId: String(payload.voiceAudioAssetId ?? ""),
    hasCreateVideo: Boolean(payload.createVideo?.imageUrl),
    generateMode: payload.createVideo?.generateMode ?? null,
    transcriptChars: String(payload.transcript ?? "").length,
  });

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
      appLog("async-jobs", "voice_job_video_created", {
        jobId,
        videoId: created.videoId,
        voiceProvider: speech.provider,
        generateMode: payload.createVideo.generateMode,
      });
    }

    const completed = await completeAsyncJob(jobId, result);
    appLog("async-jobs", "voice_job_succeeded", {
      jobId,
      voiceProvider: speech.provider,
      videoId: typeof result.heygenVideoId === "string" ? result.heygenVideoId : null,
      durationMs: elapsed(),
    });
    return completed;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha no TTS/voz.";
    appLogError("async-jobs", "voice_job_failed", error, {
      jobId,
      durationMs: elapsed(),
    });
    const failed = await failAsyncJob(jobId, message);
    if (failed.status === "failed" && failed.attempts < failed.maxAttempts) {
      await requeueAsyncJob(jobId);
      appLog(
        "async-jobs",
        "voice_job_requeued",
        { jobId, attempt: failed.attempts, maxAttempts: failed.maxAttempts },
        "warn",
      );
    }
    throw error;
  }
}

export async function processPublishJob(jobId: string) {
  const claimed = await claimAsyncJob(jobId);
  if (!claimed) {
    const existing = await getAsyncJob(jobId);
    if (existing?.status === "succeeded") {
      return existing;
    }
    throw new Error(
      `Job ${jobId} indisponivel para claim (status=${existing?.status ?? "missing"}).`,
    );
  }

  if (claimed.type !== "publish_post") {
    throw new Error(`Job ${jobId} nao e publish_post.`);
  }

  const payload = claimed.payload as unknown as PublishPostJobPayload;
  const distributionPostId = String(payload.distributionPostId ?? "");

  try {
    const post = await distributionPostStorage.getById(distributionPostId);
    if (!post) {
      throw new Error("Pacote de distribuicao nao encontrado.");
    }
    if (post.ownerUserId !== claimed.ownerUserId) {
      throw new Error("Pacote de distribuicao nao pertence ao dono do job.");
    }

    const connection = await socialConnectionStorage.getByProfileId(post.profileId);
    if (!connection?.ayrshareProfileKey) {
      throw new Error("Contas sociais nao conectadas para este perfil.");
    }

    const blackout = checkElectoralBlackout();
    if (blackout.blocked) {
      await distributionPostStorage.update(post.id, {
        status: "blocked_blackout",
        lastError: blackout.reason,
      });
      throw new Error(blackout.reason);
    }

    const requested = (payload.channels ?? [])
      .map(String)
      .filter(isDistributionChannelId);

    const channels = requested.length > 0 ? requested : post.channels;
    const retryFailedOnly = Boolean(payload.retryFailedOnly);

    const toPublish = channels.filter((channel) => {
      const state = post.perChannelStatus[channel];
      if (state?.status === "published") {
        return false;
      }
      if (retryFailedOnly) {
        return state?.status === "failed";
      }
      return true;
    });

    if (toPublish.length === 0) {
      return await completeAsyncJob(jobId, {
        skipped: true,
        reason: "Nenhum canal pendente para publicar.",
      });
    }

    await distributionPostStorage.update(post.id, {
      status: "publishing",
      lastError: "",
    });

    const publisher = getSocialPublisher();
    const scheduledAt =
      payload.scheduledAt !== undefined ? payload.scheduledAt : post.scheduledAt;

    const result = await publisher.publish({
      videoUrl: post.videoUrl,
      caption: post.captionBase,
      captionsByChannel: post.captionsByChannel,
      channels: toPublish,
      scheduledAt: scheduledAt ?? null,
      profileKey: connection.ayrshareProfileKey,
      idempotencyKey: `${post.id}:${jobId}`,
    });

    const now = nowIso();
    const perChannelStatus = { ...post.perChannelStatus };
    for (const channelResult of result.channels) {
      perChannelStatus[channelResult.channel] = {
        status:
          channelResult.status === "failed"
            ? "failed"
            : channelResult.status === "scheduled"
              ? "scheduled"
              : "published",
        externalPostId: channelResult.externalPostId,
        postUrl: channelResult.postUrl,
        error: channelResult.error,
        updatedAt: now,
      };
    }

    const status = derivePostStatus(
      Object.values(perChannelStatus).filter(Boolean) as ChannelDeliveryState[],
      Boolean(scheduledAt),
    );

    const lastError =
      status === "failed" || status === "partial_failure"
        ? result.channels
            .filter((c) => c.status === "failed")
            .map((c) => `${c.channel}: ${c.error ?? "erro"}`)
            .join("; ")
        : "";

    await distributionPostStorage.update(post.id, {
      status,
      perChannelStatus,
      ayrsharePostId: result.batchId ?? post.ayrsharePostId,
      lastError,
    });

    appendDistributionAuditFireAndForget({
      ownerUserId: post.ownerUserId,
      profileId: post.profileId,
      distributionPostId: post.id,
      action: "publish_worker",
      channels: toPublish,
      payload: {
        jobId,
        status,
        batchId: result.batchId,
        provider: result.provider,
      },
    });

    if (status === "failed") {
      throw new Error(lastError || "Publicacao falhou em todos os canais.");
    }

    return await completeAsyncJob(jobId, {
      status,
      batchId: result.batchId,
      channels: result.channels,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha na publicacao.";
    const failed = await failAsyncJob(jobId, message);
    if (failed.status === "failed" && failed.attempts < failed.maxAttempts) {
      await requeueAsyncJob(jobId);
    }
    throw error;
  }
}

/** Dispara worker local sem aguardar (dev / Pub/Sub off). */
export function kickLocalWorker(
  type: "seal_video" | "voice_tts" | "publish_post",
  jobId: string,
) {
  const run =
    type === "seal_video"
      ? processSealJob(jobId)
      : type === "publish_post"
        ? processPublishJob(jobId)
        : processVoiceJob(jobId);
  void run.catch((error) => {
    console.error(`[async-jobs] worker local falhou job=${jobId}`, error);
  });
}
