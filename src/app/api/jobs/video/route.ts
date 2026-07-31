import { NextResponse } from "next/server";
import { z } from "zod";

import { apiRoute } from "@/lib/auth/api-route";
import { handleRouteError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/feature-flags";
import {
  demoVideosExhaustedMessage,
  releaseDemoVideoQuota,
  tryConsumeDemoVideoQuota,
} from "@/lib/demo-usage-storage";
import { toDatabaseOwnerUserId } from "@/lib/owner-user-id";
import {
  AsyncJobQuotaError,
  enqueueVoiceCreateVideoJob,
} from "@/lib/async-jobs-enqueue";

export const maxDuration = 60;

const bodySchema = z.object({
  transcript: z.string().min(1),
  avatarName: z.string().min(1),
  voiceAudioAssetId: z.string().min(1),
  voiceAudioUrl: z.string().min(1),
  requestedElevenLabsVoiceId: z.string().optional(),
  requestedHeygenVoiceId: z.string().optional(),
  createVideo: z.object({
    generateMode: z.enum(["caricature", "photo_real"]),
    imageUrl: z.string().min(1),
    title: z.string().optional(),
    caricatureAssetId: z.string().optional(),
  }),
});

/**
 * Orquestra voice TTS → create HeyGen (Fase 2).
 * Body exige createVideo; o worker grava heygenVideoId em result.
 */
export async function POST(request: Request) {
  try {
    return await apiRoute(async () => {
      const body = bodySchema.parse(await request.json());
      const sessionUser = await getSessionUser();
      if (!sessionUser?.id) {
        return NextResponse.json({ message: "Nao autenticado." }, { status: 401 });
      }

      const ownerUserId = toDatabaseOwnerUserId(sessionUser.id);
      let demoRelease: (() => Promise<void>) | null = null;
      if (isDemoMode()) {
        const bucket = body.createVideo.generateMode;
        const consumed = await tryConsumeDemoVideoQuota(ownerUserId, bucket);
        if (!consumed.ok) {
          return NextResponse.json(
            { message: demoVideosExhaustedMessage(), demoUsage: consumed.usage },
            { status: 429 },
          );
        }
        demoRelease = () => releaseDemoVideoQuota(ownerUserId, bucket);
      }

      try {
        const enqueued = await enqueueVoiceCreateVideoJob({
          ownerUserId,
          payload: body,
        });
        return NextResponse.json(
          { jobId: enqueued.jobId, status: enqueued.status, type: "voice_tts" },
          { status: 202 },
        );
      } catch (error) {
        if (demoRelease) {
          await demoRelease().catch(() => undefined);
        }
        if (error instanceof AsyncJobQuotaError) {
          return NextResponse.json({ message: error.message }, { status: 429 });
        }
        throw error;
      }
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
