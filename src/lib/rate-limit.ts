type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function checkRateLimit(input: {
  key: string;
  max: number;
  windowMs: number;
  now?: number;
  /** Quando false, só consulta sem consumir a cota. Default: true. */
  consume?: boolean;
}) {
  const now = input.now ?? Date.now();
  const consume = input.consume !== false;
  const bucket = buckets.get(input.key);

  if (!bucket || bucket.resetAt <= now) {
    if (!consume) {
      return { allowed: true, remaining: input.max, resetAt: now + input.windowMs };
    }
    buckets.set(input.key, { count: 1, resetAt: now + input.windowMs });
    return { allowed: true, remaining: input.max - 1, resetAt: now + input.windowMs };
  }

  if (bucket.count >= input.max) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: bucket.resetAt,
      retryAfterMs: bucket.resetAt - now,
    };
  }

  if (!consume) {
    return {
      allowed: true,
      remaining: input.max - bucket.count,
      resetAt: bucket.resetAt,
    };
  }

  bucket.count += 1;
  buckets.set(input.key, bucket);

  return {
    allowed: true,
    remaining: input.max - bucket.count,
    resetAt: bucket.resetAt,
  };
}

export function resetRateLimitBuckets() {
  buckets.clear();
}

/** Remove 1 consumo da janela atual (ex.: rollback quando o request falhou). */
export function releaseRateLimit(input: { key: string; now?: number }) {
  const now = input.now ?? Date.now();
  const bucket = buckets.get(input.key);
  if (!bucket || bucket.resetAt <= now) {
    return;
  }
  bucket.count = Math.max(0, bucket.count - 1);
  buckets.set(input.key, bucket);
}
