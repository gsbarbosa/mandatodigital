import { afterEach, describe, expect, it } from "vitest";

import {
  decryptPlatformCredential,
  encryptPlatformCredential,
} from "@/lib/platform-credential-crypto";

const ORIGINAL_KEY = process.env.CREDENTIALS_ENCRYPTION_KEY;

afterEach(() => {
  if (ORIGINAL_KEY === undefined) {
    delete process.env.CREDENTIALS_ENCRYPTION_KEY;
  } else {
    process.env.CREDENTIALS_ENCRYPTION_KEY = ORIGINAL_KEY;
  }
});

describe("platform-credential-crypto", () => {
  it("criptografa e descriptografa credencial", () => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = "test-key-for-roundtrip";

    const encrypted = encryptPlatformCredential("sk-test-12345678");
    const decrypted = decryptPlatformCredential(encrypted);

    expect(decrypted).toBe("sk-test-12345678");
    expect(encrypted.ciphertext).not.toContain("sk-test");
  });
});
