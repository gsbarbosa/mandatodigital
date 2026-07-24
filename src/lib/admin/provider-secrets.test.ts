import { describe, expect, it } from "vitest";

import {
  decryptProviderSecret,
  encryptProviderSecret,
  getEnvTokenForProvider,
  isEditableProviderId,
  isPoolProviderId,
} from "./provider-secrets";

describe("admin provider secrets", () => {
  it("criptografa e descriptografa a API key", () => {
    const plain = "apify_api_test_token_1234567890";
    const encrypted = encryptProviderSecret(plain);
    expect(encrypted).not.toContain(plain);
    expect(decryptProviderSecret(encrypted)).toBe(plain);
  });

  it("reconhece provedores editáveis e pool", () => {
    expect(isEditableProviderId("openai")).toBe(true);
    expect(isEditableProviderId("heygen")).toBe(true);
    expect(isEditableProviderId("firebase")).toBe(false);
    expect(isPoolProviderId("apify")).toBe(true);
    expect(isPoolProviderId("openai")).toBe(true);
    expect(isPoolProviderId("resend")).toBe(false);
  });

  it("lê token Apify de aliases de env", () => {
    const prev = process.env.APIFY_API_TOKEN;
    process.env.APIFY_API_TOKEN = "token-from-alias-abcdefgh";
    delete process.env.APIFY_TOKEN;
    expect(getEnvTokenForProvider("apify")).toBe("token-from-alias-abcdefgh");
    if (prev === undefined) {
      delete process.env.APIFY_API_TOKEN;
    } else {
      process.env.APIFY_API_TOKEN = prev;
    }
  });
});
