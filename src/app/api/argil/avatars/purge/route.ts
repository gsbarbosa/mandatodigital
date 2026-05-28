import { NextResponse } from "next/server";

import { purgePrivateArgilAvatars, listPrivateArgilAvatars } from "@/lib/argil-avatar-purge";
import { apiRoute } from "@/lib/auth/api-route";

export async function POST(request: Request) {
  return apiRoute(async (repository) => {
    const body = (await request.json().catch(() => ({}))) as { confirm?: boolean };
    if (!body.confirm) {
      return NextResponse.json(
        { message: 'Envie { "confirm": true } para apagar avatares privados.' },
        { status: 400 },
      );
    }

    const result = await purgePrivateArgilAvatars();

    if (result.deleted > 0) {
      const dashboard = await repository.getDashboard();
      if (dashboard.profile?.id) {
        await repository.updateProfileArgilTraining(dashboard.profile.id, {
          argilAvatarId: "",
          argilVoiceId: "",
          avatarTrainingStatus: "NOT_TRAINED",
        });
      }
    }

    return NextResponse.json(result);
  });
}

export async function GET() {
  return apiRoute(async () => {
    const privateAvatars = await listPrivateArgilAvatars();

    return NextResponse.json({
      privateCount: privateAvatars.length,
      privateAvatars: privateAvatars.map((avatar) => ({
        id: avatar.id,
        name: avatar.name,
        status: avatar.status,
      })),
    });
  });
}
