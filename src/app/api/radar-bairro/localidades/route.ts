import { NextResponse } from "next/server";

import { apiRoute } from "@/lib/auth/api-route";
import { resolveSessionAccountTier } from "@/lib/account-tier.server";
import { isRadarBairroEnabled } from "@/lib/feature-flags";
import { hasFirebaseServiceAccount } from "@/lib/firebase/env";
import { curateLocality } from "@/lib/radar-bairro-discovery";
import { findLocality, radarBairroStorage, usedQuota } from "@/lib/radar-bairro-storage";
import { getStorageOwnerUserId } from "@/lib/storage-context";
import {
  checkDistributedRateLimit,
  RADAR_BAIRRO_FAILED_LOOKUP_MAX,
  RADAR_BAIRRO_FAILED_LOOKUP_WINDOW_MS,
  radarBairroLookupRateLimitKey,
} from "@/lib/rate-limit-firestore";

/** Curadoria é busca externa + amostragem paga: mais lenta que o refresh diário. */
export const maxDuration = 120;

/**
 * Cadastra um bairro escolhido pelo candidato.
 *
 * Regra de cobrança: bairro que NÃO tem grupo não consome cota do plano (o
 * candidato não deve pagar por bairro que o Facebook não tem), mas conta como
 * tentativa — e as tentativas são limitadas, porque cada uma gasta busca real.
 */
export async function POST(request: Request) {
  return apiRoute(async (repository) => {
    if (!isRadarBairroEnabled()) {
      return NextResponse.json({ message: "Radar de Bairro indisponível." }, { status: 404 });
    }

    const dashboard = await repository.getDashboard();
    const profile = dashboard.profile;
    if (!profile?.id) {
      return NextResponse.json(
        { message: "Crie e salve um perfil antes de adicionar bairros." },
        { status: 400 },
      );
    }

    const body = (await request.json().catch(() => null)) as { name?: unknown } | null;
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ message: "Informe o nome do bairro." }, { status: 400 });
    }

    const [registry, tier] = await Promise.all([
      radarBairroStorage.readRegistry(profile.id),
      resolveSessionAccountTier(),
    ]);

    if (findLocality(registry, name)) {
      return NextResponse.json({ message: "Esse bairro já está na lista." }, { status: 409 });
    }

    const max = tier.entitlements.radarBairroLocalities;
    if (usedQuota(registry) >= max) {
      return NextResponse.json(
        {
          message: max
            ? `Seu plano permite ${max} bairros. Remova um antes de adicionar outro.`
            : "Escolher bairros faz parte dos planos pagos.",
          quotaExceeded: true,
        },
        { status: 403 },
      );
    }

    const ownerUserId = getStorageOwnerUserId()?.trim() || "anonymous";
    const lookupKey = radarBairroLookupRateLimitKey(ownerUserId);
    // Consulta sem consumir: quem consome é só a tentativa que falhar.
    const attempts = hasFirebaseServiceAccount()
      ? await checkDistributedRateLimit({
          key: lookupKey,
          max: RADAR_BAIRRO_FAILED_LOOKUP_MAX,
          windowMs: RADAR_BAIRRO_FAILED_LOOKUP_WINDOW_MS,
          consume: false,
        })
      : { allowed: true as const, remaining: RADAR_BAIRRO_FAILED_LOOKUP_MAX, resetAt: 0 };

    if (!attempts.allowed) {
      return NextResponse.json(
        {
          message: `Você atingiu o limite de ${RADAR_BAIRRO_FAILED_LOOKUP_MAX} buscas sem resultado. Tente de novo no próximo ciclo.`,
          rateLimited: true,
        },
        { status: 429 },
      );
    }

    const city = registry.city || profile.city || "";
    const uf = registry.uf || profile.state || "";
    const locality = await curateLocality({
      name,
      city,
      uf,
      kind: "bairro",
      source: "candidato",
    });

    // Só cobra tentativa quando não achou grupo utilizável.
    if (locality.status !== "ativo" && hasFirebaseServiceAccount()) {
      await checkDistributedRateLimit({
        key: lookupKey,
        max: RADAR_BAIRRO_FAILED_LOOKUP_MAX,
        windowMs: RADAR_BAIRRO_FAILED_LOOKUP_WINDOW_MS,
        consume: true,
      });
    }

    const nextRegistry = await radarBairroStorage.upsertLocality(profile.id, registry, locality);

    return NextResponse.json({
      locality,
      localities: nextRegistry.localities,
      quota: { used: usedQuota(nextRegistry), max },
      attemptsRemaining:
        locality.status === "ativo" ? attempts.remaining : Math.max(0, attempts.remaining - 1),
    });
  });
}

export async function DELETE(request: Request) {
  return apiRoute(async (repository) => {
    if (!isRadarBairroEnabled()) {
      return NextResponse.json({ message: "Radar de Bairro indisponível." }, { status: 404 });
    }

    const dashboard = await repository.getDashboard();
    if (!dashboard.profile?.id) {
      return NextResponse.json({ message: "Perfil não encontrado." }, { status: 400 });
    }

    const body = (await request.json().catch(() => null)) as { name?: unknown } | null;
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ message: "Informe o bairro a remover." }, { status: 400 });
    }

    const registry = await radarBairroStorage.readRegistry(dashboard.profile.id);
    const next = await radarBairroStorage.removeLocality(dashboard.profile.id, registry, name);

    return NextResponse.json({ localities: next.localities, quota: { used: usedQuota(next) } });
  });
}
