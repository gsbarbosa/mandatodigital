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
}) {
  const now = input.now ?? Date.now();
  const bucket = buckets.get(input.key);

  if (!bucket || bucket.resetAt <= now) {
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
