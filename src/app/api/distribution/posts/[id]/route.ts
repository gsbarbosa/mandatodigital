import { NextResponse } from "next/server";
import { z } from "zod";

import { apiRoute } from "@/lib/auth/api-route";
import { getSessionUser } from "@/lib/auth/session";
import { assertPublisherSubscription } from "@/lib/distribution/access";
import { adaptCaptionsByChannel } from "@/lib/distribution/caption-adapter";
import {
  isActiveDistributionChannelId,
  type DistributionChannelId,
} from "@/lib/distribution/channels";
import { assertDistributionReady } from "@/lib/distribution/guard";
import { distributionPostStorage } from "@/lib/distribution/post-storage";
import { toDatabaseOwnerUserId } from "@/lib/owner-user-id";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  captionBase: z.string().optional(),
  captionsByChannel: z.record(z.string(), z.string()).optional(),
  channels: z.array(z.string()).optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  distributionWindow: z.string().nullable().optional(),
});

async function loadOwnedPost(id: string, ownerUserId: string) {
  const post = await distributionPostStorage.getById(id);
  if (!post || post.ownerUserId !== ownerUserId) {
    return null;
  }
  return post;
}

export async function GET(_request: Request, { params }: Params) {
  return apiRoute(async () => {
    const paywall = await assertPublisherSubscription();
    if (paywall) {
      return paywall;
    }
    const session = await getSessionUser();
    const ownerUserId = toDatabaseOwnerUserId(session!.id);
    const { id } = await params;
    const post = await loadOwnedPost(id, ownerUserId);
    if (!post) {
      return NextResponse.json({ message: "Post nao encontrado." }, { status: 404 });
    }
    return NextResponse.json({ post });
  });
}

export async function PATCH(request: Request, { params }: Params) {
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
    const existing = await loadOwnedPost(id, ownerUserId);
    if (!existing) {
      return NextResponse.json({ message: "Post nao encontrado." }, { status: 404 });
    }

    if (
      existing.status !== "draft" &&
      existing.status !== "pending_approval" &&
      existing.status !== "rejected"
    ) {
      return NextResponse.json(
        { message: "So e possivel editar rascunhos ou posts rejeitados." },
        { status: 409 },
      );
    }

    const body = patchSchema.parse(await request.json());
    const channels = (
      body.channels
        ? body.channels.filter(isActiveDistributionChannelId)
        : existing.channels
    ) as DistributionChannelId[];
    if (channels.length === 0) {
      return NextResponse.json(
        { message: "Selecione o Instagram para este recorte do Publicador." },
        { status: 400 },
      );
    }

    const captionBase = body.captionBase?.trim() ?? existing.captionBase;
    const overrides = {
      ...existing.captionsByChannel,
      ...(body.captionsByChannel as Partial<Record<DistributionChannelId, string>> | undefined),
    };

    const adapted = await adaptCaptionsByChannel({ captionBase, channels, overrides });

    const post = await distributionPostStorage.update(id, {
      captionBase,
      channels,
      captionsByChannel: adapted.captionsByChannel,
      scheduledAt: body.scheduledAt === undefined ? existing.scheduledAt : body.scheduledAt,
      distributionWindow:
        body.distributionWindow === undefined
          ? existing.distributionWindow
          : body.distributionWindow,
      status: "pending_approval",
    });

    return NextResponse.json({ post });
  });
}
