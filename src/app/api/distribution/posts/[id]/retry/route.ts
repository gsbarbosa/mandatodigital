import { NextResponse } from "next/server";

import { AsyncJobQuotaError } from "@/lib/async-jobs-enqueue";
import { apiRoute } from "@/lib/auth/api-route";
import { getSessionUser } from "@/lib/auth/session";
import { appendDistributionAuditFireAndForget } from "@/lib/distribution/audit";
import { checkElectoralBlackout } from "@/lib/distribution/blackout";
import { socialConnectionStorage } from "@/lib/distribution/connection-storage";
import { enqueuePublishPostJob } from "@/lib/distribution/enqueue-publish";
import { assertDistributionReady } from "@/lib/distribution/guard";
import { distributionPostStorage } from "@/lib/distribution/post-storage";
import { isDistributionPublishEnabled } from "@/lib/feature-flags";
import { toDatabaseOwnerUserId } from "@/lib/owner-user-id";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  return apiRoute(async () => {
    const blocked = assertDistributionReady();
    if (blocked) {
      return blocked;
    }
    if (!isDistributionPublishEnabled()) {
      return NextResponse.json(
        { message: "Publicacao desligada (DISTRIBUTION_PUBLISH_ENABLED)." },
        { status: 503 },
      );
    }

    const session = await getSessionUser();
    const ownerUserId = toDatabaseOwnerUserId(session!.id);
    const { id } = await params;
    const post = await distributionPostStorage.getById(id);
    if (!post || post.ownerUserId !== ownerUserId) {
      return NextResponse.json({ message: "Post nao encontrado." }, { status: 404 });
    }

    if (post.status !== "partial_failure" && post.status !== "failed") {
      return NextResponse.json(
        { message: "Retry so e permitido em falha parcial ou total." },
        { status: 409 },
      );
    }

    const failedChannels = post.channels.filter(
      (channel) => post.perChannelStatus[channel]?.status === "failed",
    );
    if (failedChannels.length === 0) {
      return NextResponse.json(
        { message: "Nenhum canal com falha para retentar." },
        { status: 400 },
      );
    }

    const connection = await socialConnectionStorage.getByProfileId(post.profileId);
    const blackout = checkElectoralBlackout({ electionDate: connection?.electionDate });
    if (blackout.blocked) {
      return NextResponse.json({ message: blackout.reason }, { status: 423 });
    }

    try {
      const job = await enqueuePublishPostJob({
        ownerUserId,
        distributionPostId: post.id,
        channels: failedChannels,
        scheduledAt: post.scheduledAt,
        retryFailedOnly: true,
      });

      appendDistributionAuditFireAndForget({
        ownerUserId,
        profileId: post.profileId,
        distributionPostId: post.id,
        action: "retry",
        actorUserId: ownerUserId,
        channels: failedChannels,
        payload: { jobId: job.jobId },
      });

      return NextResponse.json(
        { jobId: job.jobId, channels: failedChannels },
        { status: 202 },
      );
    } catch (error) {
      if (error instanceof AsyncJobQuotaError) {
        return NextResponse.json({ message: error.message }, { status: 429 });
      }
      throw error;
    }
  });
}
