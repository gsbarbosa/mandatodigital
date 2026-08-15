/**
 * Rate limit distribuído via Firestore (multi-instância App Hosting).
 * Complementa o Map in-memory em rate-limit.ts (só útil em processo único / testes).
 */

import { getFirestore } from "@/lib/firebase/admin";
import { COLLECTIONS, col } from "@/lib/firebase/collections";

export type DistributedRateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterMs?: number;
};

type RateLimitDoc = {
  count?: number;
  resetAt?: number;
};

/** Doc id estável: rateLimits/{sanitizedKey} — usamos guestCredits sibling via collection dedicada no mesmo doc path pattern. */
function rateLimitRef(key: string) {
  // Reusa guestCredits com prefixo para evitar collection nova + regras; id nunca colide com owner UUID.
  const safe = key.replace(/[^a-zA-Z0-9:_-]+/g, "_").slice(0, 700);
  return col(COLLECTIONS.guestCredits).doc(`rl:${safe}`);
}

/**
 * Consome (ou só consulta) cota na janela. Transação Firestore.
 */
export async function checkDistributedRateLimit(input: {
  key: string;
  max: number;
  windowMs: number;
  now?: number;
  consume?: boolean;
}): Promise<DistributedRateLimitResult> {
  const now = input.now ?? Date.now();
  const consume = input.consume !== false;
  const key = input.key.trim();
  if (!key) {
    return { allowed: true, remaining: input.max, resetAt: now + input.windowMs };
  }

  const db = getFirestore();
  const ref = rateLimitRef(key);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() as RateLimitDoc | undefined;
    const resetAt = Number(data?.resetAt ?? 0);
    const count = Math.max(0, Math.floor(Number(data?.count ?? 0)));

    if (!resetAt || resetAt <= now) {
      if (!consume) {
        return { allowed: true, remaining: input.max, resetAt: now + input.windowMs };
      }
      const nextReset = now + input.windowMs;
      tx.set(
        ref,
        { count: 1, resetAt: nextReset, updatedAt: new Date(now).toISOString() },
        { merge: true },
      );
      return { allowed: true, remaining: input.max - 1, resetAt: nextReset };
    }

    if (count >= input.max) {
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfterMs: resetAt - now,
      };
    }

    if (!consume) {
      return { allowed: true, remaining: input.max - count, resetAt };
    }

    const nextCount = count + 1;
    tx.set(
      ref,
      { count: nextCount, resetAt, updatedAt: new Date(now).toISOString() },
      { merge: true },
    );
    return { allowed: true, remaining: input.max - nextCount, resetAt };
  });
}

export async function releaseDistributedRateLimit(input: {
  key: string;
  now?: number;
}): Promise<void> {
  const now = input.now ?? Date.now();
  const key = input.key.trim();
  if (!key) {
    return;
  }

  const db = getFirestore();
  const ref = rateLimitRef(key);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() as RateLimitDoc | undefined;
    const resetAt = Number(data?.resetAt ?? 0);
    const count = Math.max(0, Math.floor(Number(data?.count ?? 0)));
    if (!resetAt || resetAt <= now || count <= 0) {
      return;
    }
    tx.set(
      ref,
      {
        count: count - 1,
        resetAt,
        updatedAt: new Date(now).toISOString(),
      },
      { merge: true },
    );
  });
}

/** Plataforma: teto de refreshes Sentinela / usuário / dia (docs). */
export const SENTINEL_PLATFORM_REFRESH_MAX_PER_DAY = 30;
export const SENTINEL_PLATFORM_REFRESH_WINDOW_MS = 24 * 60 * 60 * 1000;

export function sentinelPlatformRateLimitKey(ownerUserId: string) {
  return `sentinel-refresh:${ownerUserId.trim() || "anonymous"}`;
}

/**
 * Prefill do cadastro pela base TSE: teto por usuário/dia. Um cadastro real
 * gasta poucas consultas; varrer os 15.866 CPFs da base levaria ~317 dias.
 * Estourar o teto só desliga o prefill — a validação de CPF duplicado segue.
 */
export const TSE_PREFILL_LOOKUP_MAX_PER_DAY = 50;
export const TSE_PREFILL_LOOKUP_WINDOW_MS = 24 * 60 * 60 * 1000;

export function tsePrefillRateLimitKey(ownerUserId: string) {
  return `tse-prefill:${ownerUserId.trim() || "anonymous"}`;
}

/**
 * Notícias do Dia: teto de refreshes / usuário / dia. Orçamento próprio,
 * separado do SENTINEL_PLATFORM_REFRESH_MAX_PER_DAY — os dois mecanismos de
 * busca são independentes e não competem pela mesma cota.
 */
export const NOTICIAS_DO_DIA_REFRESH_MAX_PER_DAY = 10;
export const NOTICIAS_DO_DIA_REFRESH_WINDOW_MS = 24 * 60 * 60 * 1000;

export function noticiasDoDiaRateLimitKey(ownerUserId: string) {
  return `noticias-do-dia-refresh:${ownerUserId.trim() || "anonymous"}`;
}
