import { NextResponse } from "next/server";

import { AsyncJobQuotaError } from "@/lib/async-jobs-enqueue";
import { apiRoute } from "@/lib/auth/api-route";
import { getSessionUser } from "@/lib/auth/session";
import { creativeProjectStorage } from "@/lib/creative-project-storage";
import { assertPublisherSubscription } from "@/lib/distribution/access";
import { appendDistributionAuditFireAndForget } from "@/lib/distribution/audit";
import { checkElectoralBlackout } from "@/lib/distribution/blackout";
import {
  connectedChannelIds,
  socialConnectionStorage,
} from "@/lib/distribution/connection-storage";
import { overlayInstagramConnection } from "@/lib/distribution/instagram-credentials";
import { enqueuePublishPostJob } from "@/lib/distribution/enqueue-publish";
import { assertDistributionReady } from "@/lib/distribution/guard";
import { distributionPostStorage } from "@/lib/distribution/post-storage";
import {
  isAuditorFactCheckEnabled,
  isDistributionPublishEnabled,
} from "@/lib/feature-flags";
import { toDatabaseOwnerUserId } from "@/lib/owner-user-id";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  return apiRoute(async () => {
    const paywall = await assertPublisherSubscription();
    if (paywall) {
      return paywall;
    }
    const blocked = assertDistributionReady();
    if (blocked) {
      return blocked;
    }
    if (!isDistributionPublishEnabled()) {
      return NextResponse.json(
        {
          message:
            "Publicacao desligada. Defina DISTRIBUTION_PUBLISH_ENABLED=true apos smoke.",
        },
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

    if (
      post.status !== "pending_approval" &&
      post.status !== "draft" &&
      post.status !== "rejected" &&
      post.status !== "partial_failure"
    ) {
      return NextResponse.json(
        { message: `Status atual (${post.status}) nao permite aprovacao.` },
        { status: 409 },
      );
    }

    if (!post.videoUrl?.trim()) {
      return NextResponse.json({ message: "Video ausente no pacote." }, { status: 400 });
    }

    const stored = await socialConnectionStorage.getByProfileId(post.profileId);
    const connection = overlayInstagramConnection(stored, post.profileId);
    const connected = new Set(connectedChannelIds(connection));
    const publishChannels = post.channels.filter((channel) => connected.has(channel));
    if (publishChannels.length === 0) {
      return NextResponse.json(
        {
          message:
            "Nenhum canal selecionado esta conectado. Conecte as redes em Contas antes do Go.",
        },
        { status: 400 },
      );
    }

    const blackout = checkElectoralBlackout({
      at: post.scheduledAt ? new Date(post.scheduledAt) : new Date(),
      electionDate: stored?.electionDate,
    });
    if (blackout.blocked) {
      await distributionPostStorage.update(post.id, {
        status: "blocked_blackout",
        lastError: blackout.reason,
      });
      return NextResponse.json({ message: blackout.reason, blackout }, { status: 423 });
    }

    if (isAuditorFactCheckEnabled() && post.creativeProjectId) {
      const project = await creativeProjectStorage.getById(post.creativeProjectId);
      const verdict = project?.metadata?.factCheckVerdict;
      if (typeof verdict === "string" && verdict.toLowerCase() === "rejected") {
        return NextResponse.json(
          {
            message:
              "Fact-check do Validador rejeitou este criativo. Revise o roteiro antes de publicar.",
          },
          { status: 422 },
        );
      }
    }

    const now = new Date().toISOString();
    await distributionPostStorage.update(post.id, {
      status: "approved",
      approvedBy: ownerUserId,
      approvedAt: now,
      channels: publishChannels,
      lastError: "",
    });

    try {
      const job = await enqueuePublishPostJob({
        ownerUserId,
        distributionPostId: post.id,
        channels: publishChannels,
        scheduledAt: post.scheduledAt,
      });

      appendDistributionAuditFireAndForget({
        ownerUserId,
        profileId: post.profileId,
        distributionPostId: post.id,
        action: "approved",
        actorUserId: ownerUserId,
        channels: publishChannels,
        payload: { jobId: job.jobId },
      });

      return NextResponse.json(
        {
          postId: post.id,
          jobId: job.jobId,
          status: "approved",
          channels: publishChannels,
        },
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
