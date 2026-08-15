import { NextResponse } from "next/server";

import { apiRoute } from "@/lib/auth/api-route";
import { getSentinelSuggestionById } from "@/lib/sentinel-suggestions";
import { NOTICIAS_DO_DIA_ID_PREFIX, findNoticiaDoDiaById } from "@/lib/noticias-do-dia";
import { noticiasDoDiaStorage } from "@/lib/noticias-do-dia-storage";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  return apiRoute(async (repository) => {
    const { id } = await context.params;
    const dashboard = await repository.getDashboard();

    if (!dashboard.profile) {
      return NextResponse.json(
        { message: "Crie e salve um perfil antes de consultar o radar do Sentinela." },
        { status: 400 },
      );
    }

    // Ids de Notícias do Dia vivem num cache separado (mecanismo de busca isolado do
    // Sentinela) — o botão "Pautar" desses cards reaproveita esta mesma rota de lookup.
    if (id.startsWith(NOTICIAS_DO_DIA_ID_PREFIX)) {
      const cached = dashboard.profile.id
        ? await noticiasDoDiaStorage.readCache(dashboard.profile.id)
        : null;
      const suggestion = cached ? findNoticiaDoDiaById(cached, id) : null;
      if (!suggestion) {
        return NextResponse.json({ message: "Notícia do dia não encontrada." }, { status: 404 });
      }
      return NextResponse.json({ suggestion });
    }

    const suggestion = await getSentinelSuggestionById(dashboard.profile, id);
    if (!suggestion) {
      return NextResponse.json({ message: "Sugestao do Sentinela nao encontrada." }, { status: 404 });
    }

    return NextResponse.json({ suggestion });
  });
}
