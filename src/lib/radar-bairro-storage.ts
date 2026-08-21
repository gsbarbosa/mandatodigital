/**
 * Persistência do Radar de Bairro (Firestore). Collections e formato próprios —
 * não reaproveita nada do Sentinela nem da Notícias do Dia (Rota B).
 *
 * Dois documentos por perfil:
 * - registry: as localidades cadastradas e o grupo verificado de cada uma. É o
 *   que a coleta lê; a descoberta (cara) já aconteceu antes.
 * - cache: o resultado da última coleta, que a tela lê sem disparar nada.
 */

import { COLLECTIONS, col } from "@/lib/firebase/collections";
import { hasFirebaseServiceAccount } from "@/lib/firebase/env";
import { getStorageOwnerUserId } from "@/lib/storage-context";
import { normalizeCityName } from "@/lib/radar-bairro-geo";
import {
  emptyRadarBairroResult,
  type RadarBairroLocality,
  type RadarBairroResult,
} from "@/lib/radar-bairro-types";

export type RadarBairroRegistry = {
  /** Cidade/UF que originou o cadastro — se mudar, a curadoria precisa refazer. */
  city: string;
  uf: string;
  /** "cidade" (município abaixo do corte) ou "bairro" (acima). */
  mode: "cidade" | "bairro";
  population: number | null;
  localities: RadarBairroLocality[];
  updatedAt: string | null;
};

export function emptyRegistry(city = "", uf = ""): RadarBairroRegistry {
  return { city, uf, mode: "cidade", population: null, localities: [], updatedAt: null };
}

function resolveOwnerUserId() {
  return getStorageOwnerUserId()?.trim() || "";
}

function nowIso() {
  return new Date().toISOString();
}

/** Só o que a coleta usa: localidade aprovada tem grupo pra ler. */
export function activeLocalities(registry: RadarBairroRegistry): RadarBairroLocality[] {
  return registry.localities.filter((item) => item.status === "ativo" && item.groupUrl);
}

/** Quantas localidades escolhidas pelo candidato já ocupam cota do plano. */
export function usedQuota(registry: RadarBairroRegistry): number {
  return registry.localities.filter(
    (item) => item.source === "candidato" && item.status !== "sem-grupo",
  ).length;
}

export function findLocality(
  registry: RadarBairroRegistry,
  name: string,
): RadarBairroLocality | null {
  const target = normalizeCityName(name);
  return registry.localities.find((item) => normalizeCityName(item.name) === target) ?? null;
}

function sanitizeLocality(raw: unknown): RadarBairroLocality | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const row = raw as Record<string, unknown>;
  const name = typeof row.name === "string" ? row.name.trim() : "";
  if (!name) {
    return null;
  }
  return {
    kind: row.kind === "bairro" ? "bairro" : "cidade",
    source: row.source === "candidato" ? "candidato" : "automatico",
    name,
    city: typeof row.city === "string" ? row.city : "",
    uf: typeof row.uf === "string" ? row.uf : "",
    status:
      row.status === "ativo" || row.status === "reprovado" || row.status === "sem-grupo"
        ? row.status
        : "sem-grupo",
    groupUrl: typeof row.groupUrl === "string" ? row.groupUrl : null,
    groupTitle: typeof row.groupTitle === "string" ? row.groupTitle : null,
    sampledPosts: Number(row.sampledPosts) || 0,
    sampledRelevant: Number(row.sampledRelevant) || 0,
    verifiedAt: typeof row.verifiedAt === "string" ? row.verifiedAt : null,
  };
}

export const radarBairroStorage = {
  async readRegistry(profileId: string): Promise<RadarBairroRegistry> {
    if (!hasFirebaseServiceAccount()) {
      return emptyRegistry();
    }
    const snap = await col(COLLECTIONS.radarBairroRegistry).doc(profileId).get();
    if (!snap.exists) {
      return emptyRegistry();
    }
    const data = snap.data()!;
    const currentOwner = resolveOwnerUserId();
    if (currentOwner && data.ownerUserId && String(data.ownerUserId) !== currentOwner) {
      return emptyRegistry();
    }
    return {
      city: typeof data.city === "string" ? data.city : "",
      uf: typeof data.uf === "string" ? data.uf : "",
      mode: data.mode === "bairro" ? "bairro" : "cidade",
      population: Number.isFinite(Number(data.population)) ? Number(data.population) : null,
      localities: Array.isArray(data.localities)
        ? data.localities
            .map(sanitizeLocality)
            .filter((item): item is RadarBairroLocality => Boolean(item))
        : [],
      updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : null,
    };
  },

  async writeRegistry(profileId: string, registry: RadarBairroRegistry): Promise<void> {
    if (!hasFirebaseServiceAccount()) {
      return;
    }
    await col(COLLECTIONS.radarBairroRegistry)
      .doc(profileId)
      .set({
        profileId,
        ownerUserId: resolveOwnerUserId(),
        city: registry.city,
        uf: registry.uf,
        mode: registry.mode,
        population: registry.population,
        localities: JSON.parse(JSON.stringify(registry.localities)),
        updatedAt: nowIso(),
      });
  },

  /** Insere ou substitui uma localidade (mesmo nome = atualiza a verificação). */
  async upsertLocality(
    profileId: string,
    registry: RadarBairroRegistry,
    locality: RadarBairroLocality,
  ): Promise<RadarBairroRegistry> {
    const target = normalizeCityName(locality.name);
    const others = registry.localities.filter(
      (item) => normalizeCityName(item.name) !== target,
    );
    const next: RadarBairroRegistry = {
      ...registry,
      localities: [...others, locality],
    };
    await radarBairroStorage.writeRegistry(profileId, next);
    return next;
  },

  async removeLocality(
    profileId: string,
    registry: RadarBairroRegistry,
    name: string,
  ): Promise<RadarBairroRegistry> {
    const target = normalizeCityName(name);
    const next: RadarBairroRegistry = {
      ...registry,
      localities: registry.localities.filter((item) => normalizeCityName(item.name) !== target),
    };
    await radarBairroStorage.writeRegistry(profileId, next);
    return next;
  },

  async readCache(profileId: string): Promise<RadarBairroResult | null> {
    if (!hasFirebaseServiceAccount()) {
      return null;
    }
    const snap = await col(COLLECTIONS.radarBairroCache).doc(profileId).get();
    if (!snap.exists) {
      return null;
    }
    const data = snap.data()!;
    const currentOwner = resolveOwnerUserId();
    if (currentOwner && data.ownerUserId && String(data.ownerUserId) !== currentOwner) {
      return null;
    }
    const fallback = emptyRadarBairroResult();
    return {
      signals: Array.isArray(data.signals) ? data.signals : [],
      meta: data.meta ? { ...fallback.meta, ...data.meta } : fallback.meta,
    } as RadarBairroResult;
  },

  async writeCache(profileId: string, result: RadarBairroResult): Promise<void> {
    if (!hasFirebaseServiceAccount()) {
      return;
    }
    await col(COLLECTIONS.radarBairroCache).doc(profileId).set({
      profileId,
      ownerUserId: resolveOwnerUserId(),
      signals: JSON.parse(JSON.stringify(result.signals)),
      meta: JSON.parse(JSON.stringify(result.meta)),
      updatedAt: nowIso(),
    });
  },
};
