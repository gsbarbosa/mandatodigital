import { NextResponse } from "next/server";
import { z } from "zod";

import { apiRoute } from "@/lib/auth/api-route";
import { handleRouteError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth/session";
import { isPremiumAccountMode } from "@/lib/dev-account-mode.server";
import {
  guestVideosExhaustedMessage,
  releaseGuestVideoQuota,
  tryConsumeGuestVideoQuota,
} from "@/lib/guest-usage-storage";
import { toDatabaseOwnerUserId } from "@/lib/owner-user-id";
import { resolveSessionAccountTier } from "@/lib/account-tier.server";
import { spokenTranscriptForAccount } from "@/lib/trial-fixed-script";
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
    caricatureVariant: z.string().optional(),
  }),
  personaArchetypes: z.array(z.string()).optional(),
  voiceTones: z.array(z.string()).optional(),
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
      let guestRelease: (() => Promise<void>) | null = null;
      const premium = await isPremiumAccountMode(sessionUser.email);
      if (!premium) {
        const bucket = body.createVideo.generateMode;
        const consumed = await tryConsumeGuestVideoQuota(ownerUserId, bucket);
        if (!consumed.ok) {
          return NextResponse.json(
            { message: guestVideosExhaustedMessage(), guestUsage: consumed.usage },
            { status: 429 },
          );
        }
        guestRelease = () => releaseGuestVideoQuota(ownerUserId, bucket);
      }

      try {
        const account = await resolveSessionAccountTier(sessionUser.email);
        const spoken = spokenTranscriptForAccount({
          guestQuotas: !premium || account.entitlements.guestQuotas,
          generateMode: body.createVideo.generateMode,
          caricatureVariant: body.createVideo.caricatureVariant,
          requestedTranscript: body.transcript,
          archetype: body.personaArchetypes?.[0],
          tone: body.voiceTones?.[0],
        });
        const enqueued = await enqueueVoiceCreateVideoJob({
          ownerUserId,
          payload: {
            transcript: spoken.transcript,
            avatarName: body.avatarName,
            voiceAudioAssetId: body.voiceAudioAssetId,
            voiceAudioUrl: body.voiceAudioUrl,
            requestedElevenLabsVoiceId: body.requestedElevenLabsVoiceId,
            requestedHeygenVoiceId: body.requestedHeygenVoiceId,
            createVideo: {
              generateMode: body.createVideo.generateMode,
              imageUrl: body.createVideo.imageUrl,
              title: body.createVideo.title,
              caricatureAssetId: body.createVideo.caricatureAssetId,
            },
          },
        });
        return NextResponse.json(
          { jobId: enqueued.jobId, status: enqueued.status, type: "voice_tts" },
          { status: 202 },
        );
      } catch (error) {
        if (guestRelease) {
          await guestRelease().catch(() => undefined);
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
