import { NextResponse } from "next/server";

import { apiRoute } from "@/lib/auth/api-route";
import { resolveSessionAccountTier } from "@/lib/account-tier.server";
import { isRadarBairroEnabled } from "@/lib/feature-flags";
import { radarBairroStorage, usedQuota } from "@/lib/radar-bairro-storage";

/** Leitura pura: nunca dispara coleta nem curadoria (as duas custam dinheiro). */
export async function GET() {
  return apiRoute(async (repository) => {
    if (!isRadarBairroEnabled()) {
      return NextResponse.json({ enabled: false, signals: [], localities: [] });
    }

    const dashboard = await repository.getDashboard();
    if (!dashboard.profile?.id) {
      return NextResponse.json(
        {
          message: "Crie e salve um perfil antes de consultar o Radar de Bairro.",
          enabled: true,
          signals: [],
          localities: [],
        },
        { status: 400 },
      );
    }

    const [registry, cached, tier] = await Promise.all([
      radarBairroStorage.readRegistry(dashboard.profile.id),
      radarBairroStorage.readCache(dashboard.profile.id),
      resolveSessionAccountTier(),
    ]);

    return NextResponse.json({
      enabled: true,
      signals: cached?.signals ?? [],
      meta: cached?.meta ?? null,
      localities: registry.localities,
      registry: {
        city: registry.city,
        uf: registry.uf,
        mode: registry.mode,
        population: registry.population,
        updatedAt: registry.updatedAt,
      },
      quota: {
        used: usedQuota(registry),
        max: tier.entitlements.radarBairroLocalities,
        tier: tier.tier,
      },
    });
  });
}
