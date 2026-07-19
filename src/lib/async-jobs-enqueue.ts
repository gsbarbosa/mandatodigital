import {
  countInFlightJobsForOwner,
  createAsyncJob,
} from "@/lib/async-jobs-storage";
import { tryPublishAsyncJobMessage } from "@/lib/async-jobs-pubsub";
import type { AsyncJobType, VoiceTtsPayload } from "@/lib/async-jobs-types";
import { kickLocalWorker } from "@/lib/async-jobs-workers";

export class AsyncJobQuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AsyncJobQuotaError";
  }
}

export async function enqueueAsyncJob(input: {
  ownerUserId: string;
  type: AsyncJobType;
  payload: Record<string, unknown>;
  idempotencyKey?: string | null;
}): Promise<{ jobId: string; status: string; type: AsyncJobType }> {
  const inFlight = await countInFlightJobsForOwner({
    ownerUserId: input.ownerUserId,
    types: [input.type],
  });
  if (inFlight >= 1) {
    throw new AsyncJobQuotaError(
      input.type === "seal_video"
        ? "Ja existe uma selagem em andamento. Aguarde terminar antes de gerar outra."
        : "Ja existe um job de voz em andamento. Aguarde terminar antes de gerar outro.",
    );
  }

  const job = await createAsyncJob({
    ownerUserId: input.ownerUserId,
    type: input.type,
    payload: input.payload,
    idempotencyKey: input.idempotencyKey,
  });

  const published = await tryPublishAsyncJobMessage({
    type: input.type,
    jobId: job.id,
  });
  if (!published) {
    kickLocalWorker(input.type, job.id);
  }

  return { jobId: job.id, status: job.status, type: job.type };
}

export async function enqueueVoiceCreateVideoJob(input: {
  ownerUserId: string;
  payload: VoiceTtsPayload;
}): Promise<{ jobId: string; status: string }> {
  const create = input.payload.createVideo;
  const idempotencyKey = create
    ? `voice-video:${input.payload.voiceAudioAssetId}:${input.payload.transcript.slice(0, 64)}`
    : `voice:${input.payload.voiceAudioAssetId}:${Date.now()}`;

  const enqueued = await enqueueAsyncJob({
    ownerUserId: input.ownerUserId,
    type: "voice_tts",
    payload: input.payload as unknown as Record<string, unknown>,
    idempotencyKey,
  });
  return { jobId: enqueued.jobId, status: enqueued.status };
}
