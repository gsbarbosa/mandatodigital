import { NextResponse } from "next/server";

import { apiRoute } from "@/lib/auth/api-route";
import { isRadarBairroEnabled } from "@/lib/feature-flags";
import { hasFirebaseServiceAccount } from "@/lib/firebase/env";
import { collectRadarBairro } from "@/lib/radar-bairro";
import { activeLocalities, radarBairroStorage } from "@/lib/radar-bairro-storage";
import { getStorageOwnerUserId } from "@/lib/storage-context";
import {
  checkDistributedRateLimit,
  RADAR_BAIRRO_REFRESH_MAX_PER_MONTH,
  RADAR_BAIRRO_REFRESH_WINDOW_MS,
  radarBairroRefreshRateLimitKey,
} from "@/lib/rate-limit-firestore";

export const maxDuration = 60;

/**
 * Consome 1 crédito MENSAL de atualização. Não existe coleta automática em
 * segundo plano — é sempre o candidato que pede, o que mantém o custo por conta
 * previsível independente de quantas localidades ela tem cadastradas.
 */
export async function POST() {
  return apiRoute(async (repository) => {
    if (!isRadarBairroEnabled()) {
      return NextResponse.json({ message: "Radar de Bairro indisponível." }, { status: 404 });
    }

    const dashboard = await repository.getDashboard();
    if (!dashboard.profile?.id) {
      return NextResponse.json(
        { message: "Crie e salve um perfil antes de atualizar o Radar de Bairro." },
        { status: 400 },
      );
    }

    const registry = await radarBairroStorage.readRegistry(dashboard.profile.id);
    if (!activeLocalities(registry).length) {
      // Sem localidade cadastrada não há o que coletar — devolve sem gastar crédito.
      return NextResponse.json(
        {
          message:
            "Nenhum bairro monitorado ainda. Rode a busca da sua cidade ou adicione um bairro.",
          signals: [],
          needsCuration: true,
        },
        { status: 409 },
      );
    }

    const ownerUserId = getStorageOwnerUserId()?.trim() || "anonymous";
    const limit = hasFirebaseServiceAccount()
      ? await checkDistributedRateLimit({
          key: radarBairroRefreshRateLimitKey(ownerUserId),
          max: RADAR_BAIRRO_REFRESH_MAX_PER_MONTH,
          windowMs: RADAR_BAIRRO_REFRESH_WINDOW_MS,
          consume: true,
        })
      : { allowed: true as const, remaining: RADAR_BAIRRO_REFRESH_MAX_PER_MONTH, resetAt: 0 };

    if (!limit.allowed) {
      return NextResponse.json(
        {
          message: `Créditos de atualização do mês esgotados (${RADAR_BAIRRO_REFRESH_MAX_PER_MONTH}/mês).`,
          rateLimited: true,
        },
        {
          status: 429,
          headers: limit.retryAfterMs
            ? { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) }
            : undefined,
        },
      );
    }

    const result = await collectRadarBairro(registry);
    await radarBairroStorage.writeCache(dashboard.profile.id, result);

    return NextResponse.json({ ...result, creditsRemaining: limit.remaining });
  });
}
