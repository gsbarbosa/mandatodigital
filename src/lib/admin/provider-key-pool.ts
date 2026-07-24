import type { PoolProviderId } from "@/lib/admin/provider-catalog";
import {
  listProviderKeyCandidates,
  markProviderKeyCooldown,
  markProviderKeyInvalid,
  type ResolvedProviderKey,
} from "@/lib/admin/provider-secrets";

export class ProviderHttpError extends Error {
  status: number;
  body: string;
  providerId: PoolProviderId;

  constructor(input: {
    providerId: PoolProviderId;
    status: number;
    message: string;
    body?: string;
  }) {
    super(input.message);
    this.name = "ProviderHttpError";
    this.providerId = input.providerId;
    this.status = input.status;
    this.body = input.body || "";
  }
}

function textOf(error: unknown): string {
  if (error instanceof ProviderHttpError) {
    return `${error.message} ${error.body}`.toLowerCase();
  }
  if (error instanceof Error) {
    return error.message.toLowerCase();
  }
  return String(error ?? "").toLowerCase();
}

function statusOf(error: unknown): number | null {
  if (error instanceof ProviderHttpError) {
    return error.status;
  }
  if (error && typeof error === "object" && "status" in error) {
    const status = Number((error as { status?: number }).status);
    return Number.isFinite(status) ? status : null;
  }
  return null;
}

/** Erros em que vale tentar a próxima key do pool. */
export function isProviderFailoverError(providerId: PoolProviderId, error: unknown): boolean {
  const status = statusOf(error);
  const text = textOf(error);

  if (status === 401 || text.includes("incorrect api key") || text.includes("invalid api key") || text.includes("invalid x-api-key")) {
    return true; // tenta próxima; a atual será marcada inválida
  }

  if (providerId === "apify") {
    return (
      status === 402 ||
      status === 403 ||
      text.includes("usage hard limit") ||
      text.includes("monthly usage") ||
      text.includes("quota") ||
      text.includes("limit exceeded")
    );
  }

  if (providerId === "heygen") {
    return (
      status === 402 ||
      text.includes("insufficient credit") ||
      text.includes("insufficient_quota") ||
      text.includes("movio_payment") ||
      text.includes("payment") ||
      text.includes("no credit")
    );
  }

  if (providerId === "elevenlabs") {
    return (
      status === 401 ||
      status === 402 ||
      status === 429 ||
      text.includes("quota") ||
      text.includes("credit") ||
      text.includes("character") ||
      text.includes("limit") ||
      text.includes("payment")
    );
  }

  // openai
  return (
    status === 401 ||
    status === 402 ||
    status === 429 ||
    text.includes("insufficient_quota") ||
    text.includes("rate_limit") ||
    text.includes("billing") ||
    text.includes("exceeded") ||
    text.includes("quota")
  );
}

export function isProviderInvalidKeyError(error: unknown): boolean {
  const status = statusOf(error);
  const text = textOf(error);
  return (
    status === 401 ||
    text.includes("incorrect api key") ||
    text.includes("invalid api key") ||
    text.includes("invalid_api_key") ||
    text.includes("authentication") ||
    text.includes("unauthorized")
  );
}

export function isProviderQuotaError(error: unknown): boolean {
  if (isProviderInvalidKeyError(error)) {
    return false;
  }
  const status = statusOf(error);
  const text = textOf(error);
  return (
    status === 402 ||
    status === 403 ||
    status === 429 ||
    text.includes("quota") ||
    text.includes("credit") ||
    text.includes("limit exceeded") ||
    text.includes("usage hard limit") ||
    text.includes("insufficient")
  );
}

/**
 * Executa `fn` com cada key do pool até sucesso.
 * Em cota → cooldown 15min. Em key inválida → disable.
 */
export async function runWithProviderKeyPool<T>(
  providerId: PoolProviderId,
  fn: (token: string, meta: ResolvedProviderKey & { attempt: number }) => Promise<T>,
  options?: {
    shouldFailover?: (error: unknown) => boolean;
  },
): Promise<T> {
  const candidates = await listProviderKeyCandidates(providerId);
  if (!candidates.length) {
    throw new Error(`Nenhuma API key configurada para ${providerId}.`);
  }

  const shouldFailover = options?.shouldFailover ?? ((error: unknown) =>
    isProviderFailoverError(providerId, error));

  let lastError: unknown;

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index]!;
    try {
      return await fn(candidate.token, { ...candidate, attempt: index + 1 });
    } catch (error) {
      lastError = error;
      const canFailover =
        index < candidates.length - 1 && shouldFailover(error);

      if (isProviderInvalidKeyError(error) && candidate.source === "override") {
        await markProviderKeyInvalid({
          providerId,
          keyId: candidate.keyId,
          reason: "invalid",
        });
      } else if (isProviderQuotaError(error) && candidate.source === "override") {
        await markProviderKeyCooldown({
          providerId,
          keyId: candidate.keyId,
          reason: "quota",
        });
      }

      if (!canFailover) {
        throw error;
      }

      console.warn(
        `[provider-key-pool] ${providerId} key ${candidate.hint} falhou (tentativa ${index + 1}/${candidates.length}); tentando próxima.`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Todas as API keys de ${providerId} falharam.`);
}
