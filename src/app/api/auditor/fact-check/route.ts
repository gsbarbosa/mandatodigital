import { NextResponse } from "next/server";
import { z } from "zod";

import { auditorStorage } from "@/lib/auditor-storage";
import { runFactCheck } from "@/lib/auditor/fact-check";
import { apiRoute } from "@/lib/auth/api-route";
import { isAuditorFactCheckEnabled } from "@/lib/feature-flags";
import { buildSentinelBriefingForCriativo } from "@/lib/sentinel-mock-suggestions";
import { getSentinelSuggestionById } from "@/lib/sentinel-suggestions";

const bodySchema = z.object({
  script: z.string().min(1),
  suggestionId: z.string().optional(),
  topic: z.string().optional(),
  useFreePrompt: z.boolean().optional(),
  extraSources: z.array(z.string().url()).max(4).optional(),
});

export async function POST(request: Request) {
  if (!isAuditorFactCheckEnabled()) {
    return NextResponse.json(
      { message: "Fact-check desligado (AUDITOR_FACTCHECK_ENABLED)." },
      { status: 403 },
    );
  }

  try {
    return apiRoute(async (repository) => {
      const dashboard = await repository.getDashboard();
      const profile = dashboard.profile;

      if (!profile) {
        return NextResponse.json({ message: "Perfil nao encontrado." }, { status: 400 });
      }

      const body = bodySchema.parse(await request.json());

      if (body.useFreePrompt) {
        await auditorStorage.appendAuditLog({
          profileId: profile.id,
          eventType: "fact_check_bypass_free_prompt",
          request,
          payload: { topic: body.topic ?? "" },
        });

        return NextResponse.json({
          result: {
            verdict: "skipped",
            confidence: 0,
            summary: "Prompt livre: fact-check nao aplicado nesta versao.",
            claims: [],
            sources: [],
            checkedAt: new Date().toISOString(),
          },
        });
      }

      let suggestion = null;
      if (body.suggestionId) {
        suggestion = await getSentinelSuggestionById(profile, body.suggestionId);
      }

      const extraSources = body.extraSources ?? [];
      // Fontes coladas pelo usuario entram primeiro para nao serem cortadas pelo
      // limite de 4 artigos do fetchArticlesCorpus quando a sugestao ja tem varias.
      const articles = [
        ...extraSources.map((url) => ({ title: "Fonte informada pelo usuario", url })),
        ...(suggestion?.evidence.articles ?? []),
      ];

      const result = await runFactCheck({
        script: body.script,
        topic: body.topic ?? suggestion?.topic,
        articles,
        sentinelBriefing: suggestion ? buildSentinelBriefingForCriativo(suggestion) : undefined,
      });

      if (suggestion && profile.id) {
        await auditorStorage.saveFactCheck(profile.id, suggestion.id, result);
      }

      await auditorStorage.appendAuditLog({
        profileId: profile.id,
        eventType: "script_fact_check",
        request,
        payload: {
          suggestionId: body.suggestionId ?? null,
          verdict: result.verdict,
          confidence: result.confidence,
          extraSourceCount: extraSources.length,
        },
      });

      return NextResponse.json({ result });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao validar fatos.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
