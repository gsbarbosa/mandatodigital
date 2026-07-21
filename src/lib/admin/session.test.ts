import { describe, expect, it } from "vitest";

import {
  createAdminSessionToken,
  passwordsMatch,
  validateAdminCredentials,
  verifyAdminSessionToken,
} from "@/lib/admin/session";
import { getAdminEmail, getAdminPassword } from "@/lib/admin/credentials";

describe("admin session", () => {
  it("assina e valida token", () => {
    const token = createAdminSessionToken(getAdminEmail());
    const session = verifyAdminSessionToken(token);
    expect(session?.email).toBe(getAdminEmail());
  });

  it("rejeita token adulterado", () => {
    const token = createAdminSessionToken(getAdminEmail());
    const [payload] = token.split(".");
    expect(verifyAdminSessionToken(`${payload}.aaaa`)).toBeNull();
  });

  it("valida credenciais default", () => {
    expect(validateAdminCredentials(getAdminEmail(), getAdminPassword())).toBe(true);
    expect(validateAdminCredentials("outro@x.com", getAdminPassword())).toBe(false);
    expect(passwordsMatch("abc", "abc")).toBe(true);
    expect(passwordsMatch("abc", "abd")).toBe(false);
  });
});
