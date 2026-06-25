import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api";
import { heygenListAllPrivateVoices } from "@/lib/heygen";
import { heygenApiRoute } from "@/lib/heygen-api-route";

/** Lista clones de voz privados na conta (somente leitura; exclusao e pelo painel HeyGen). */
export async function GET(request: Request) {
  try {
    return heygenApiRoute(request, async () => {
      const voices = await heygenListAllPrivateVoices();

      return NextResponse.json({
        voices: voices.map((voice) => ({
          voiceId: String(voice.voice_id ?? "").trim(),
          name: String(voice.name ?? "").trim(),
          language: String(voice.language ?? "").trim(),
          gender: String(voice.gender ?? "").trim(),
        })),
        total: voices.length,
        message:
          voices.length >= 10
            ? "Limite de 10 clones atingido ou próximo. Remova vozes não usadas na biblioteca de vozes do painel."
            : undefined,
      });
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
