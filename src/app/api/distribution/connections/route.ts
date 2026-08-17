import { NextResponse } from "next/server";
import { z } from "zod";

import { apiRoute } from "@/lib/auth/api-route";
import { getSessionUser } from "@/lib/auth/session";
import {
  assertPublisherSubscription,
  resolvePublisherAccess,
} from "@/lib/distribution/access";
import { DISTRIBUTION_CHANNELS } from "@/lib/distribution/channels";
import {
  connectedChannelIds,
  newConnectionRefId,
  socialConnectionStorage,
} from "@/lib/distribution/connection-storage";
import { overlayInstagramConnection } from "@/lib/distribution/instagram-credentials";
import {
  isInstagramConfigured,
  isInstagramOAuthConfigured,
} from "@/lib/distribution/instagram-env";
import { isDistributionEnabled } from "@/lib/feature-flags";
import { toDatabaseOwnerUserId } from "@/lib/owner-user-id";

export async function GET() {
  return apiRoute(async (repository) => {
    const dashboard = await repository.getDashboard();
    const profile = dashboard.profile;
    if (!profile) {
      return NextResponse.json({ message: "Salve o perfil antes." }, { status: 400 });
    }

    // Paywall aqui responde 200 moldado (e nao 402): a tela de Contas precisa
    // renderizar o upsell com a lista de redes, nao tratar como erro.
    const access = await resolvePublisherAccess();
    if (!access.allowed) {
      return NextResponse.json({
        enabled: false,
        subscribed: false,
        tier: access.tier,
        electionDate: null,
        instagramUsername: null,
        channels: DISTRIBUTION_CHANNELS.map((channel) => ({
          id: channel.id,
          label: channel.label,
          connected: false,
          displayName: null,
        })),
        linkAvailable: false,
      });
    }

    const stored = await socialConnectionStorage.getByProfileId(profile.id);
    const connection = overlayInstagramConnection(stored, profile.id);
    const connected = new Set(connectedChannelIds(connection));

    return NextResponse.json({
      enabled: isDistributionEnabled() && isInstagramConfigured(),
      subscribed: true,
      tier: access.tier,
      electionDate: connection?.electionDate ?? stored?.electionDate ?? null,
      instagramUsername: connection?.instagramUsername
        ? `@${connection.instagramUsername.replace(/^@/, "")}`
        : null,
      channels: DISTRIBUTION_CHANNELS.map((channel) => ({
        id: channel.id,
        label: channel.label,
        connected: connected.has(channel.id),
        displayName: connection?.platforms[channel.id]?.displayName ?? null,
      })),
      linkAvailable: isDistributionEnabled() && isInstagramOAuthConfigured(),
    });
  });
}

const patchSchema = z.object({
  electionDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});

export async function PATCH(request: Request) {
  return apiRoute(async (repository) => {
    const paywall = await assertPublisherSubscription();
    if (paywall) {
      return paywall;
    }
    if (!isDistributionEnabled()) {
      return NextResponse.json(
        { message: "Publicador desligado (DISTRIBUTION_ENABLED)." },
        { status: 503 },
      );
    }

    const dashboard = await repository.getDashboard();
    const profile = dashboard.profile;
    if (!profile) {
      return NextResponse.json({ message: "Salve o perfil antes." }, { status: 400 });
    }

    const body = patchSchema.parse(await request.json());
    const session = await getSessionUser();
    const ownerUserId = toDatabaseOwnerUserId(session!.id);

    let connection = await socialConnectionStorage.getByProfileId(profile.id);
    if (!connection) {
      connection = await socialConnectionStorage.upsert({
        profileId: profile.id,
        ownerUserId,
        ayrshareRefId: newConnectionRefId(profile.id),
        electionDate: body.electionDate ?? null,
      });
    } else if (body.electionDate !== undefined) {
      connection = await socialConnectionStorage.setElectionDate(
        profile.id,
        body.electionDate,
      );
    }

    const publicConnection = overlayInstagramConnection(connection, profile.id);
    return NextResponse.json({
      electionDate: publicConnection?.electionDate ?? null,
      instagramUsername: publicConnection?.instagramUsername || null,
    });
  });
}
