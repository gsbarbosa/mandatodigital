import { NextResponse } from "next/server";

import { heygenApiRoute } from "@/lib/heygen-api-route";
import { handleRouteError } from "@/lib/api";
import {
  buildAvatarVideoTranscript,
  type CuradorVideoContext,
} from "@/lib/avatar-video-script";
import { assertMandatorySetup } from "@/lib/product-setup-checklist";
import type { PoliticianProfile } from "@/lib/types";

function mergeProfileWithCuradorContext(
  profile: PoliticianProfile | null,
  context?: Partial<CuradorVideoContext>,
): PoliticianProfile | null {
  if (!profile || !context) {
    return profile;
  }

  return {
    ...profile,
    spectrum: context.spectrum?.trim() || profile.spectrum,
    glossaryTerms: context.glossaryTerms?.length
      ? context.glossaryTerms
      : profile.glossaryTerms,
    personaArchetypes: context.personaArchetypes?.length
      ? context.personaArchetypes
      : profile.personaArchetypes,
    voiceTones: context.voiceTones?.length ? context.voiceTones : profile.voiceTones,
    avatarType: context.avatarType?.trim() || profile.avatarType,
  };
}

export async function POST(request: Request) {
  try {
    return heygenApiRoute(request, async (repository) => {
      const body = (await request.json().catch(() => ({}))) as {
        topic?: string;
        curadorContext?: Partial<CuradorVideoContext>;
      };
      const topic = String(body.topic ?? "").trim();

      if (!topic) {
        return NextResponse.json(
          { message: "Informe o tema do vídeo para gerar o roteiro." },
          { status: 400 },
        );
      }

      const dashboard = await repository.getDashboard();
      const setup = assertMandatorySetup(dashboard.profile);
      if (!setup.ok) {
        return NextResponse.json({ message: setup.message }, { status: 403 });
      }

      const profile = mergeProfileWithCuradorContext(
        dashboard.profile,
        body.curadorContext,
      );
      const transcript = await buildAvatarVideoTranscript({
        topic,
        profile,
        curadorContext: body.curadorContext,
      });

      return NextResponse.json({ transcript }, { status: 200 });
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
