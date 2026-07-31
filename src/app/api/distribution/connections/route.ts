import { NextResponse } from "next/server";
import { z } from "zod";

import { apiRoute } from "@/lib/auth/api-route";
import { getSessionUser } from "@/lib/auth/session";
import {
  ayrshareGetUser,
  isAyrshareConfigured,
} from "@/lib/distribution/ayrshare-client";
import {
  ayrsharePlatformToChannelId,
  DISTRIBUTION_CHANNEL_IDS,
  DISTRIBUTION_CHANNELS,
} from "@/lib/distribution/channels";
import {
  connectedChannelIds,
  newConnectionRefId,
  socialConnectionStorage,
} from "@/lib/distribution/connection-storage";
import { isDistributionEnabled } from "@/lib/feature-flags";
import { toDatabaseOwnerUserId } from "@/lib/owner-user-id";

function buildPlatformSnapshot(activeSocialAccounts: string[] | undefined) {
  const now = new Date().toISOString();
  const active = new Set(
    (activeSocialAccounts ?? [])
      .map((item) => ayrsharePlatformToChannelId(item))
      .filter(Boolean),
  );
  const platforms: Record<
    string,
    { connected: boolean; displayName: string | null; connectedAt: string | null }
  > = {};
  for (const id of DISTRIBUTION_CHANNEL_IDS) {
    const connected = active.has(id);
    platforms[id] = {
      connected,
      displayName: null,
      connectedAt: connected ? now : null,
    };
  }
  return platforms;
}

export async function GET() {
  return apiRoute(async (repository) => {
    const dashboard = await repository.getDashboard();
    const profile = dashboard.profile;
    if (!profile) {
      return NextResponse.json({ message: "Salve o perfil antes." }, { status: 400 });
    }

    let connection = await socialConnectionStorage.getByProfileId(profile.id);

    if (
      isDistributionEnabled() &&
      connection?.ayrshareProfileKey &&
      isAyrshareConfigured()
    ) {
      try {
        const user = await ayrshareGetUser(connection.ayrshareProfileKey);
        const platforms = buildPlatformSnapshot(user.activeSocialAccounts);
        connection = await socialConnectionStorage.updatePlatforms(profile.id, platforms);
      } catch (error) {
        console.warn("[distribution] sync user falhou", error);
      }
    }

    const connected = new Set(connectedChannelIds(connection));
    return NextResponse.json({
      enabled: isDistributionEnabled() && isAyrshareConfigured(),
      electionDate: connection?.electionDate ?? null,
      ayrshareProfileKey: connection?.ayrshareProfileKey
        ? `${connection.ayrshareProfileKey.slice(0, 6)}…`
        : null,
      channels: DISTRIBUTION_CHANNELS.map((c) => ({
        id: c.id,
        label: c.label,
        connected: connected.has(c.id),
        displayName: connection?.platforms[c.id]?.displayName ?? null,
      })),
      linkAvailable: isDistributionEnabled() && isAyrshareConfigured(),
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
        ayrshareProfileKey: "",
        ayrshareRefId: newConnectionRefId(profile.id),
        electionDate: body.electionDate ?? null,
      });
    } else if (body.electionDate !== undefined) {
      connection = await socialConnectionStorage.setElectionDate(
        profile.id,
        body.electionDate,
      );
    }

    return NextResponse.json({ connection });
  });
}
