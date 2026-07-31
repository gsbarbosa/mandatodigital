import { NextResponse } from "next/server";
import { z } from "zod";

import { apiRoute } from "@/lib/auth/api-route";
import { getSessionUser } from "@/lib/auth/session";
import {
  ayrshareCreateProfile,
  ayrshareGenerateJwt,
} from "@/lib/distribution/ayrshare-client";
import {
  channelIdsToAyrsharePlatforms,
  DISTRIBUTION_CHANNEL_IDS,
} from "@/lib/distribution/channels";
import {
  newConnectionRefId,
  socialConnectionStorage,
} from "@/lib/distribution/connection-storage";
import { assertDistributionReady } from "@/lib/distribution/guard";
import { toDatabaseOwnerUserId } from "@/lib/owner-user-id";
import { resolveAppBaseUrl } from "@/lib/training-asset-urls";

const linkSchema = z.object({
  channels: z.array(z.string()).optional(),
});

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
    const body = linkSchema.parse(await request.json().catch(() => ({})));

    let connection = await socialConnectionStorage.getByProfileId(profile.id);
    if (!connection?.ayrshareProfileKey) {
      const refId = connection?.ayrshareRefId || newConnectionRefId(profile.id);
      const created = await ayrshareCreateProfile({
        title: profile.fullName || `Mandato ${profile.id.slice(0, 8)}`,
        refId,
      });
      if (!created.profileKey) {
        return NextResponse.json(
          { message: "Ayrshare nao retornou profileKey." },
          { status: 502 },
        );
      }
      connection = await socialConnectionStorage.upsert({
        profileId: profile.id,
        ownerUserId,
        ayrshareProfileKey: created.profileKey,
        ayrshareRefId: created.refId || refId,
        electionDate: connection?.electionDate ?? null,
      });
    }

    const allowed =
      body.channels && body.channels.length > 0
        ? channelIdsToAyrsharePlatforms(
            body.channels.filter((id): id is (typeof DISTRIBUTION_CHANNEL_IDS)[number] =>
              (DISTRIBUTION_CHANNEL_IDS as readonly string[]).includes(id),
            ),
          )
        : channelIdsToAyrsharePlatforms([...DISTRIBUTION_CHANNEL_IDS]);

    const redirectUrl = `${resolveAppBaseUrl()}/distribuidor?connected=1`;
    const jwt = await ayrshareGenerateJwt({
      profileKey: connection.ayrshareProfileKey,
      redirectUrl,
      allowedSocial: allowed,
    });

    if (!jwt.url) {
      return NextResponse.json(
        { message: "Ayrshare nao retornou URL de conexao." },
        { status: 502 },
      );
    }

    return NextResponse.json({ url: jwt.url, expiresIn: jwt.expiresIn ?? null });
  });
}
