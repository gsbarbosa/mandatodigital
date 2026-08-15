import { describe, expect, it } from "vitest";

import {
  accountTierFromDevMode,
  isDevAccountModeEmail,
  isForcePremiumAccountEmail,
  isPaidDevAccountMode,
  parseDevAccountMode,
} from "./dev-account-mode";

describe("dev-account-mode", () => {
  it("reconhece allowlist e dominio E2E", () => {
    expect(isDevAccountModeEmail("gsbarbosa180@gmail.com")).toBe(true);
    expect(isDevAccountModeEmail("TRIBEIRO81@gmail.com")).toBe(true);
    expect(isDevAccountModeEmail("e2e.abc@example.com")).toBe(true);
    expect(isDevAccountModeEmail("outro@example.com")).toBe(false);
    expect(isDevAccountModeEmail("outro@gmail.com")).toBe(false);
  });

  it("força acesso interno só para sócios da allowlist", () => {
    expect(isForcePremiumAccountEmail("gsbarbosa180@gmail.com")).toBe(true);
    expect(isForcePremiumAccountEmail("tribeiro81@gmail.com")).toBe(true);
    expect(isForcePremiumAccountEmail("e2e.abc@example.com")).toBe(false);
    expect(isForcePremiumAccountEmail("outro@gmail.com")).toBe(false);
  });

  it("parseia trial + 3 planos (premium legado vira elite)", () => {
    expect(parseDevAccountMode("guest")).toBe("guest");
    expect(parseDevAccountMode("essencial")).toBe("essencial");
    expect(parseDevAccountMode("avancado")).toBe("avancado");
    expect(parseDevAccountMode("elite")).toBe("elite");
    expect(parseDevAccountMode("premium")).toBe("elite");
    expect(parseDevAccountMode(undefined)).toBe("guest");
    expect(parseDevAccountMode("xyz")).toBe("guest");
    expect(isPaidDevAccountMode("guest")).toBe(false);
    expect(isPaidDevAccountMode("essencial")).toBe(true);
    expect(accountTierFromDevMode("guest")).toBe("trial");
    expect(accountTierFromDevMode("avancado")).toBe("avancado");
  });
});
