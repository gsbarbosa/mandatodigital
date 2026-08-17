import { NextResponse } from "next/server";
import { z } from "zod";

import { apiRoute } from "@/lib/auth/api-route";
import { assertPublisherSubscription } from "@/lib/distribution/access";
import { getSessionUser } from "@/lib/auth/session";
import { appendDistributionAuditFireAndForget } from "@/lib/distribution/audit";
import { assertDistributionReady } from "@/lib/distribution/guard";
import { distributionPostStorage } from "@/lib/distribution/post-storage";
import { toDatabaseOwnerUserId } from "@/lib/owner-user-id";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  reason: z.string().trim().max(2000).default(""),
});

export async function POST(request: Request, { params }: Params) {
  return apiRoute(async () => {
    const paywall = await assertPublisherSubscription();
    if (paywall) {
      return paywall;
    }
    const blocked = assertDistributionReady();
    if (blocked) {
      return blocked;
    }

    const session = await getSessionUser();
    const ownerUserId = toDatabaseOwnerUserId(session!.id);
    const { id } = await params;
    const post = await distributionPostStorage.getById(id);
    if (!post || post.ownerUserId !== ownerUserId) {
      return NextResponse.json({ message: "Post nao encontrado." }, { status: 404 });
    }

    if (post.status !== "pending_approval" && post.status !== "draft") {
      return NextResponse.json(
        { message: `Status atual (${post.status}) nao permite rejeicao.` },
        { status: 409 },
      );
    }

    const body = bodySchema.parse(await request.json().catch(() => ({})));
    const updated = await distributionPostStorage.update(post.id, {
      status: "rejected",
      rejectReason: body.reason,
    });

    appendDistributionAuditFireAndForget({
      ownerUserId,
      profileId: post.profileId,
      distributionPostId: post.id,
      action: "rejected",
      actorUserId: ownerUserId,
      channels: post.channels,
      payload: { reason: body.reason },
    });

    return NextResponse.json({ post: updated });
  });
}
