import { NextResponse } from "next/server";
import { z } from "zod";

import { apiRoute } from "@/lib/auth/api-route";
import { getSessionUser } from "@/lib/auth/session";
import { appendDistributionAuditFireAndForget } from "@/lib/distribution/audit";
import { buildCaptionsByChannel } from "@/lib/distribution/captions";
import {
  ACTIVE_DISTRIBUTION_CHANNEL_IDS,
  isActiveDistributionChannelId,
  type DistributionChannelId,
} from "@/lib/distribution/channels";
import { assertDistributionReady } from "@/lib/distribution/guard";
import { distributionPostStorage } from "@/lib/distribution/post-storage";
import { creativeProjectStorage } from "@/lib/creative-project-storage";
import { toDatabaseOwnerUserId } from "@/lib/owner-user-id";

const createSchema = z.object({
  creativeProjectId: z.string().min(1),
  channels: z.array(z.string()).optional(),
  captionBase: z.string().optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  distributionWindow: z.string().nullable().optional(),
});

export async function GET() {
  return apiRoute(async () => {
    const session = await getSessionUser();
    if (!session?.id) {
      return NextResponse.json({ message: "Nao autenticado." }, { status: 401 });
    }
    const ownerUserId = toDatabaseOwnerUserId(session.id);
    const posts = await distributionPostStorage.listByOwner(ownerUserId);
    return NextResponse.json({ posts });
  });
}

export async function POST(request: Request) {
  return apiRoute(async (repository) => {
    const blocked = assertDistributionReady();
    if (blocked) {
      return blocked;
    }

    const dashboard = await repository.getDashboard();
    const profile = dashboard.profile;
    if (!profile) {
      return NextResponse.json({ message: "Salve o perfil antes." }, { status: 400 });
    }

    const session = await getSessionUser();
    const ownerUserId = toDatabaseOwnerUserId(session!.id);
    const body = createSchema.parse(await request.json());

    const project = await creativeProjectStorage.getById(body.creativeProjectId);
    if (!project || project.profileId !== profile.id) {
      return NextResponse.json(
        { message: "Criativo nao encontrado para este perfil." },
        { status: 404 },
      );
    }
    if (!project.videoUrl?.trim()) {
      return NextResponse.json(
        { message: "O criativo precisa de video selado antes de distribuir." },
        { status: 400 },
      );
    }

    const preferred = (profile.distributionChannels ?? [])
      .map((label) => {
        const normalized = label.toLowerCase();
        return ACTIVE_DISTRIBUTION_CHANNEL_IDS.find((id) => normalized.includes(id));
      })
      .filter(Boolean) as DistributionChannelId[];

    const requested = (body.channels ?? []).filter(isActiveDistributionChannelId);
    const channels: DistributionChannelId[] =
      requested.length > 0
        ? requested
        : preferred.length > 0
          ? preferred
          : [...ACTIVE_DISTRIBUTION_CHANNEL_IDS];

    const captionBase =
      body.captionBase?.trim() ||
      project.scriptDraft?.trim() ||
      project.topic?.trim() ||
      "";

    const post = await distributionPostStorage.create({
      ownerUserId,
      profileId: profile.id,
      creativeProjectId: project.id,
      videoUrl: project.videoUrl,
      captionBase,
      captionsByChannel: buildCaptionsByChannel(captionBase, channels),
      channels,
      scheduledAt: body.scheduledAt ?? null,
      distributionWindow: body.distributionWindow ?? null,
      status: "pending_approval",
    });

    appendDistributionAuditFireAndForget({
      ownerUserId,
      profileId: profile.id,
      distributionPostId: post.id,
      action: "draft_created",
      actorUserId: ownerUserId,
      channels,
      payload: { creativeProjectId: project.id },
    });

    return NextResponse.json({ post }, { status: 201 });
  });
}
