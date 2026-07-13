import { describe, expect, it } from "vitest";

import {
  isDevAccountModeEmail,
  parseDevAccountMode,
} from "./dev-account-mode";

describe("dev-account-mode", () => {
  it("reconhece apenas os emails da allowlist", () => {
    expect(isDevAccountModeEmail("gsbarbosa180@gmail.com")).toBe(true);
    expect(isDevAccountModeEmail("TRIBEIRO81@gmail.com")).toBe(true);
    expect(isDevAccountModeEmail("outro@gmail.com")).toBe(false);
  });

  it("parseia modo com default guest", () => {
    expect(parseDevAccountMode("premium")).toBe("premium");
    expect(parseDevAccountMode("guest")).toBe("guest");
    expect(parseDevAccountMode(undefined)).toBe("guest");
    expect(parseDevAccountMode("xyz")).toBe("guest");
  });
});
