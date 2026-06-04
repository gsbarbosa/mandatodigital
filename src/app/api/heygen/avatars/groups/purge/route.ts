import { NextResponse } from "next/server";

import { apiRoute } from "@/lib/auth/api-route";
import { handleRouteError } from "@/lib/api";
import { purgePrivateHeyGenAvatarGroups } from "@/lib/heygen-purge-private-groups";

export async function POST(request: Request) {
  try {
    return apiRoute(async () => {
      const body = (await request.json().catch(() => ({}))) as { confirm?: boolean };
      if (!body.confirm) {
        return NextResponse.json(
          { message: 'Envie { "confirm": true } para remover todos os gêmeos privados.' },
          { status: 400 },
        );
      }

      const result = await purgePrivateHeyGenAvatarGroups();

      if (result.deleted.length === 0 && result.errors.length > 0) {
        return NextResponse.json(
          {
            message: "Nao foi possivel remover os personagens na plataforma.",
            ...result,
          },
          { status: 502 },
        );
      }

      return NextResponse.json({
        ...result,
        message:
          result.deleted.length > 0
            ? `${result.deleted.length} personagem(ns) removido(s). Envie novo vídeo e refaça o treinamento.`
            : "Nenhum personagem privado encontrado na conta.",
      });
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
