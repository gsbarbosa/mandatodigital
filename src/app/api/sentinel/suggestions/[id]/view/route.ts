import { NextResponse } from "next/server";

import { recordAuditEventFireAndForget } from "@/lib/audit/record";
import { apiRoute } from "@/lib/auth/api-route";
import { getSentinelSuggestionById } from "@/lib/sentinel-suggestions";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  return apiRoute(async (repository) => {
    const { id } = await context.params;
    const dashboard = await repository.getDashboard();

    if (!dashboard.profile) {
      return NextResponse.json(
        { message: "Crie e salve um perfil antes de consultar o radar do Sentinela." },
        { status: 400 },
      );
    }

    const suggestion = await getSentinelSuggestionById(dashboard.profile, id);
    if (!suggestion) {
      return NextResponse.json({ message: "Sugestao do Sentinela nao encontrada." }, { status: 404 });
    }

    recordAuditEventFireAndForget({
      request,
      action: "monitoring_signal_view",
      profileId: dashboard.profile.id ?? null,
      payload: { suggestionId: id, themeLabel: suggestion.themeLabel },
    });

    return NextResponse.json({ ok: true });
  });
}
