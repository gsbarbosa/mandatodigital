import { NextResponse } from "next/server";

import { apiRoute } from "@/lib/auth/api-route";
import { hasFirebaseServiceAccount } from "@/lib/firebase/env";
import { fetchNoticiasDoDia } from "@/lib/noticias-do-dia";
import { noticiasDoDiaStorage } from "@/lib/noticias-do-dia-storage";
import { getStorageOwnerUserId } from "@/lib/storage-context";
import {
  checkDistributedRateLimit,
  NOTICIAS_DO_DIA_REFRESH_MAX_PER_DAY,
  NOTICIAS_DO_DIA_REFRESH_WINDOW_MS,
  noticiasDoDiaRateLimitKey,
} from "@/lib/rate-limit-firestore";

export const maxDuration = 60;

export async function POST() {
  return apiRoute(async (repository) => {
    const dashboard = await repository.getDashboard();

    if (!dashboard.profile?.id) {
      return NextResponse.json(
        { message: "Crie e salve um perfil antes de atualizar as notícias do dia." },
        { status: 400 },
      );
    }

    const ownerUserId = getStorageOwnerUserId()?.trim() || "anonymous";
    const rateKey = noticiasDoDiaRateLimitKey(ownerUserId);
    // Sem Firestore configurado (dev local sem credenciais) não há onde guardar a
    // contagem — deixa passar em vez de derrubar a rota.
    const limit = hasFirebaseServiceAccount()
      ? await checkDistributedRateLimit({
          key: rateKey,
          max: NOTICIAS_DO_DIA_REFRESH_MAX_PER_DAY,
          windowMs: NOTICIAS_DO_DIA_REFRESH_WINDOW_MS,
          consume: true,
        })
      : { allowed: true as const, remaining: NOTICIAS_DO_DIA_REFRESH_MAX_PER_DAY, resetAt: 0 };
    if (!limit.allowed) {
      return NextResponse.json(
        {
          message: `Limite diário de atualizações de Notícias do Dia atingido (${NOTICIAS_DO_DIA_REFRESH_MAX_PER_DAY}/dia). Tente novamente mais tarde.`,
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

    const result = await fetchNoticiasDoDia(dashboard.profile);
    await noticiasDoDiaStorage.writeCache(dashboard.profile.id, result);

    return NextResponse.json(result);
  });
}
