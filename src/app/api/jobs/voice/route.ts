import { NextResponse } from "next/server";
import { z } from "zod";

import { recordAuditEventFireAndForget } from "@/lib/audit/record";
import { apiRoute } from "@/lib/auth/api-route";
import { handleRouteError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth/session";
import { toDatabaseOwnerUserId } from "@/lib/owner-user-id";
import {
  countInFlightJobsForOwner,
  createAsyncJob,
} from "@/lib/async-jobs-storage";
import { tryPublishAsyncJobMessage } from "@/lib/async-jobs-pubsub";
import { kickLocalWorker } from "@/lib/async-jobs-workers";

export const maxDuration = 60;

const bodySchema = z.object({
  transcript: z.string().min(1),
  avatarName: z.string().min(1),
  voiceAudioAssetId: z.string().min(1),
  voiceAudioUrl: z.string().min(1),
  requestedElevenLabsVoiceId: z.string().optional(),
  requestedHeygenVoiceId: z.string().optional(),
  createVideo: z
    .object({
      generateMode: z.enum(["caricature", "photo_real"]),
      imageUrl: z.string().min(1),
      title: z.string().optional(),
      caricatureAssetId: z.string().optional(),
    })
    .optional(),
});

export async function POST(request: Request) {
  try {
    return await apiRoute(async () => {
      const body = bodySchema.parse(await request.json());
      const sessionUser = await getSessionUser();
      if (!sessionUser?.id) {
        return NextResponse.json({ message: "Nao autenticado." }, { status: 401 });
      }

      const ownerUserId = toDatabaseOwnerUserId(sessionUser.id);
      const inFlight = await countInFlightJobsForOwner({
        ownerUserId,
        types: ["voice_tts"],
      });
      if (inFlight >= 1) {
        return NextResponse.json(
          {
            message:
              "Ja existe um job de voz em andamento. Aguarde terminar antes de gerar outro.",
          },
          { status: 429 },
        );
      }

      const job = await createAsyncJob({
        ownerUserId,
        type: "voice_tts",
        idempotencyKey: body.createVideo
          ? `voice-video:${body.voiceAudioAssetId}:${body.transcript.slice(0, 40)}`
          : `voice:${body.voiceAudioAssetId}:${Date.now()}`,
        payload: body,
      });

      const published = await tryPublishAsyncJobMessage({
        type: "voice_tts",
        jobId: job.id,
      });
      if (!published) {
        kickLocalWorker("voice_tts", job.id);
      }

      recordAuditEventFireAndForget({
        request,
        ownerUserId,
        action: "voice_job",
        payload: {
          jobId: job.id,
          status: job.status,
          createVideo: Boolean(body.createVideo),
        },
      });

      return NextResponse.json(
        { jobId: job.id, status: job.status, type: job.type },
        { status: 202 },
      );
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
