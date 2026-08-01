import { describe, expect, it } from "vitest";

import {
  isDevAccountModeEmail,
  isForcePremiumAccountEmail,
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

  it("força premium só para sócios da allowlist", () => {
    expect(isForcePremiumAccountEmail("gsbarbosa180@gmail.com")).toBe(true);
    expect(isForcePremiumAccountEmail("tribeiro81@gmail.com")).toBe(true);
    expect(isForcePremiumAccountEmail("e2e.abc@example.com")).toBe(false);
    expect(isForcePremiumAccountEmail("outro@gmail.com")).toBe(false);
  });

  it("parseia modo com default guest", () => {
    expect(parseDevAccountMode("premium")).toBe("premium");
    expect(parseDevAccountMode("guest")).toBe("guest");
    expect(parseDevAccountMode(undefined)).toBe("guest");
    expect(parseDevAccountMode("xyz")).toBe("guest");
  });
});
