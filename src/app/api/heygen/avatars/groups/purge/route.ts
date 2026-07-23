import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api";
import { formatHeyGenPurgeFailureMessage } from "@/lib/curador-heygen-prefs";
import { heygenListAllPrivateVoices } from "@/lib/heygen";
import { heygenApiRoute } from "@/lib/heygen-api-route";
import {
  deletePrivateHeyGenAvatarGroup,
  purgePrivateHeyGenAvatarGroups,
} from "@/lib/heygen-purge-private-groups";

export async function POST(request: Request) {
  try {
    return heygenApiRoute(request, async () => {
      const body = (await request.json().catch(() => ({}))) as {
        confirm?: boolean;
        groupId?: string;
      };
      if (!body.confirm) {
        return NextResponse.json(
          {
            message:
              'Envie { "confirm": true } para remover personagens privados. Opcional: "groupId" para remover apenas um.',
          },
          { status: 400 },
        );
      }

      const scopedGroupId = String(body.groupId ?? "").trim();
      const result = scopedGroupId
        ? await deletePrivateHeyGenAvatarGroup(scopedGroupId)
        : await purgePrivateHeyGenAvatarGroups();
      let privateVoiceCount = 0;
      try {
        privateVoiceCount = (await heygenListAllPrivateVoices()).length;
      } catch {
        privateVoiceCount = -1;
      }

      if (result.deleted.length === 0 && result.errors.length > 0) {
        return NextResponse.json(
          {
            message: formatHeyGenPurgeFailureMessage(
              result.errors,
              "Nao foi possivel remover os personagens na plataforma.",
            ),
            ...result,
          },
          { status: 502 },
        );
      }

      const voiceNote =
        privateVoiceCount < 0
          ? ""
          : privateVoiceCount > 0
            ? ` Ainda há ${privateVoiceCount} clone(s) de voz na conta — remova na biblioteca de vozes do painel se precisar liberar slot (limite 10).`
            : "";

      const baseMessage =
        result.deleted.length > 0
          ? scopedGroupId
            ? "Personagem removido. Refaça o treinamento em Configurar avatar."
            : `${result.deleted.length} personagem(ns) removido(s). Refaça o treinamento em Configurar avatar.`
          : scopedGroupId
            ? "Nenhum personagem remoto encontrado para remover."
            : "Nenhum personagem privado encontrado na conta.";

      return NextResponse.json({
        ...result,
        privateVoiceCount: privateVoiceCount >= 0 ? privateVoiceCount : undefined,
        message: baseMessage + voiceNote,
      });
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
