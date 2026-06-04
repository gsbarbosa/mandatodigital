import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api";
import { heygenListAllPrivateVoices } from "@/lib/heygen";
import { heygenApiRoute } from "@/lib/heygen-api-route";
import { purgePrivateHeyGenAvatarGroups } from "@/lib/heygen-purge-private-groups";

export async function POST(request: Request) {
  try {
    return heygenApiRoute(request, async () => {
      const body = (await request.json().catch(() => ({}))) as { confirm?: boolean };
      if (!body.confirm) {
        return NextResponse.json(
          {
            message:
              'Envie { "confirm": true } para remover todos os personagens privados (gêmeo digital e avatares na conta).',
          },
          { status: 400 },
        );
      }

      const result = await purgePrivateHeyGenAvatarGroups();
      let privateVoiceCount = 0;
      try {
        privateVoiceCount = (await heygenListAllPrivateVoices()).length;
      } catch {
        privateVoiceCount = -1;
      }

      if (result.deleted.length === 0 && result.errors.length > 0) {
        return NextResponse.json(
          {
            message: "Nao foi possivel remover os personagens na plataforma.",
            ...result,
          },
          { status: 502 },
        );
      }

      const voiceNote =
        privateVoiceCount < 0
          ? ""
          : privateVoiceCount > 0
            ? ` Ainda ha ${privateVoiceCount} clone(s) de voz na conta — apague na Voice Library do painel HeyGen se precisar liberar slot (limite 10).`
            : "";

      return NextResponse.json({
        ...result,
        privateVoiceCount: privateVoiceCount >= 0 ? privateVoiceCount : undefined,
        message:
          (result.deleted.length > 0
            ? `${result.deleted.length} personagem(ns) removido(s). Refaça o treinamento no Curador.`
            : "Nenhum personagem privado encontrado na conta.") + voiceNote,
      });
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
