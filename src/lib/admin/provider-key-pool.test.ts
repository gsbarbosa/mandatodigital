import { describe, expect, it } from "vitest";

import {
  isProviderFailoverError,
  isProviderInvalidKeyError,
  isProviderQuotaError,
  ProviderHttpError,
} from "./provider-key-pool";

describe("provider-key-pool", () => {
  it("classifica cota Apify como failover", () => {
    const error = new ProviderHttpError({
      providerId: "apify",
      status: 403,
      message: "Monthly usage hard limit exceeded",
    });
    expect(isProviderFailoverError("apify", error)).toBe(true);
    expect(isProviderQuotaError(error)).toBe(true);
    expect(isProviderInvalidKeyError(error)).toBe(false);
  });

  it("classifica insufficient credit HeyGen", () => {
    const error = new ProviderHttpError({
      providerId: "heygen",
      status: 402,
      message: "insufficient credit in wallet",
    });
    expect(isProviderFailoverError("heygen", error)).toBe(true);
    expect(isProviderQuotaError(error)).toBe(true);
  });

  it("classifica insufficient_quota OpenAI", () => {
    const error = new ProviderHttpError({
      providerId: "openai",
      status: 429,
      message: "You exceeded your current quota",
      body: '{"error":{"code":"insufficient_quota"}}',
    });
    expect(isProviderFailoverError("openai", error)).toBe(true);
    expect(isProviderQuotaError(error)).toBe(true);
  });

  it("classifica key inválida", () => {
    const error = new ProviderHttpError({
      providerId: "openai",
      status: 401,
      message: "Incorrect API key provided",
    });
    expect(isProviderInvalidKeyError(error)).toBe(true);
    expect(isProviderFailoverError("openai", error)).toBe(true);
    expect(isProviderQuotaError(error)).toBe(false);
  });
});
