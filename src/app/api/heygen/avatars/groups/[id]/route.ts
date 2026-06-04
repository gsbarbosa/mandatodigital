import { NextResponse } from "next/server";

import { apiRoute } from "@/lib/auth/api-route";
import { handleRouteError } from "@/lib/api";
import {
  formatHeyGenError,
  heygenDeleteAvatarGroup,
  heygenGetAvatarGroup,
} from "@/lib/heygen";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    return apiRoute(async () => {
      const params = await context.params;
      const id = String(params.id ?? "").trim();
      if (!id) {
        return NextResponse.json({ message: "group_id ausente." }, { status: 400 });
      }

      const response = await heygenGetAvatarGroup(id);
      return NextResponse.json({
        group: response.data?.avatar_group ?? null,
        raw: response,
      });
    });
  } catch (error) {
    return handleRouteError(new Error(formatHeyGenError(error)));
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    return apiRoute(async () => {
      const body = (await request.json().catch(() => ({}))) as { confirm?: boolean };
      if (!body.confirm) {
        return NextResponse.json(
          { message: 'Envie { "confirm": true } para remover o personagem.' },
          { status: 400 },
        );
      }

      const params = await context.params;
      const id = String(params.id ?? "").trim();
      if (!id) {
        return NextResponse.json({ message: "group_id ausente." }, { status: 400 });
      }

      const response = await heygenDeleteAvatarGroup(id);
      return NextResponse.json({
        deletedGroupId: response.data?.id?.trim() || id,
        message:
          "Personagem removido. Voce pode enviar novo video de treino e refazer o consentimento.",
      });
    });
  } catch (error) {
    return handleRouteError(new Error(formatHeyGenError(error)));
  }
}

