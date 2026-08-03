import { NextResponse } from "next/server";

import { heygenApiRoute } from "@/lib/heygen-api-route";
import { handleRouteError } from "@/lib/api";
import { fetchArticlesCorpus } from "@/lib/auditor/url-extract";
import {
  buildAvatarVideoTranscript,
  type CuradorVideoContext,
} from "@/lib/avatar-video-script";
import { maxScriptWordsForPlan, maxVideoSecondsLabelForPlan } from "@/lib/plan-limits";
import type { SentinelNewsArticle } from "@/lib/sentinel-mock-suggestions";
import { getUserRegistrationForOwner } from "@/lib/user-registration-storage";
import type { PoliticianProfile } from "@/lib/types";

/** "até 90 segundos" -> "90 segundos" (copy do prompt já usa "duracao maxima de"). */
function bareDurationLabel(planId: string | null | undefined) {
  return maxVideoSecondsLabelForPlan(planId).replace(/^até\s+/i, "");
}

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
        articles?: SentinelNewsArticle[];
      };
      const topic = String(body.topic ?? "").trim();

      if (!topic) {
        return NextResponse.json(
          { message: "Informe o tema do vídeo para gerar o roteiro." },
          { status: 400 },
        );
      }

      const dashboard = await repository.getDashboard();
      const profile = mergeProfileWithCuradorContext(
        dashboard.profile,
        body.curadorContext,
      );
      const registration = await getUserRegistrationForOwner().catch(() => null);
      const maxWords = maxScriptWordsForPlan(registration?.planId || null);

      // Texto completo das matérias (não só título) para o roteiro nascer com base factual
      // real, não só inferindo do título — o mesmo fetch já usado no fact-check pós-aprovação.
      const articles = Array.isArray(body.articles) ? body.articles : [];
      const corpus = articles.length ? await fetchArticlesCorpus(articles).catch(() => "") : "";
      const curadorContext = corpus
        ? {
            ...body.curadorContext,
            sentinelBriefing: [body.curadorContext?.sentinelBriefing, `Texto completo das matérias:\n${corpus}`]
              .filter(Boolean)
              .join("\n\n"),
          }
        : body.curadorContext;

      const transcript = await buildAvatarVideoTranscript({
        topic,
        profile,
        curadorContext,
        maxWords,
        durationLabel: bareDurationLabel(registration?.planId || null),
      });

      return NextResponse.json({ transcript }, { status: 200 });
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
