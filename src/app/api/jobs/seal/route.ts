import { NextResponse } from "next/server";
import { z } from "zod";

import { recordAuditEventFireAndForget } from "@/lib/audit/record";
import { apiRoute } from "@/lib/auth/api-route";
import { handleRouteError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth/session";
import { isPremiumAccountMode } from "@/lib/dev-account-mode.server";
import { toDatabaseOwnerUserId } from "@/lib/owner-user-id";
import {
  countInFlightJobsForOwner,
  createAsyncJob,
} from "@/lib/async-jobs-storage";
import { tryPublishAsyncJobMessage } from "@/lib/async-jobs-pubsub";
import { kickLocalWorker } from "@/lib/async-jobs-workers";

export const maxDuration = 60;

const bodySchema = z.object({
  videoUrl: z.string().min(1),
  mediaId: z.string().min(1),
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
        types: ["seal_video"],
      });
      if (inFlight >= 1) {
        return NextResponse.json(
          {
            message:
              "Ja existe uma selagem em andamento. Aguarde terminar antes de gerar outra.",
          },
          { status: 429 },
        );
      }

      const premium = await isPremiumAccountMode(sessionUser.email);
      const job = await createAsyncJob({
        ownerUserId,
        type: "seal_video",
        idempotencyKey: `seal:${body.mediaId}`,
        payload: {
          mediaId: body.mediaId,
          videoUrl: body.videoUrl,
          guestTestWatermark: !premium,
        },
      });

      const published = await tryPublishAsyncJobMessage({
        type: "seal_video",
        jobId: job.id,
      });
      if (!published) {
        kickLocalWorker("seal_video", job.id);
      }

      recordAuditEventFireAndForget({
        request,
        ownerUserId,
        action: "seal_job",
        payload: {
          jobId: job.id,
          mediaId: body.mediaId,
          status: job.status,
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
