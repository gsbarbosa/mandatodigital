import { NextResponse } from "next/server";

import { apiRoute } from "@/lib/auth/api-route";
import { noticiasDoDiaStorage } from "@/lib/noticias-do-dia-storage";

export async function GET() {
  return apiRoute(async (repository) => {
    const dashboard = await repository.getDashboard();

    if (!dashboard.profile?.id) {
      return NextResponse.json(
        {
          message: "Crie e salve um perfil antes de consultar as notícias do dia.",
          nacional: [],
          estadual: [],
          municipal: [],
        },
        { status: 400 },
      );
    }

    const cached = await noticiasDoDiaStorage.readCache(dashboard.profile.id);

    return NextResponse.json({
      nacional: cached?.nacional ?? [],
      estadual: cached?.estadual ?? [],
      municipal: cached?.municipal ?? [],
      meta: cached?.meta ?? null,
    });
  });
}
