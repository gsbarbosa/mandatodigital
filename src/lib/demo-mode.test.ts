import { afterEach, describe, expect, it, vi } from "vitest";

import {
  isDemoModeActiveForEmail,
  isDemoModeExemptEmail,
} from "./demo-mode";

describe("demo-mode exempt", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reconhece isenção dos sócios (case-insensitive)", () => {
    expect(isDemoModeExemptEmail("tribeiro81@gmail.com")).toBe(true);
    expect(isDemoModeExemptEmail("TRIBEIRO81@GMAIL.COM")).toBe(true);
    expect(isDemoModeExemptEmail("gsbarbosa180@gmail.com")).toBe(true);
    expect(isDemoModeExemptEmail("plateia@example.com")).toBe(false);
    expect(isDemoModeExemptEmail(null)).toBe(false);
  });

  it("isDemoModeActiveForEmail respeita flag global e isenção", () => {
    vi.stubEnv("DEMO_MODE", "true");
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    expect(isDemoModeActiveForEmail("plateia@example.com")).toBe(true);
    expect(isDemoModeActiveForEmail("tribeiro81@gmail.com")).toBe(false);
    expect(isDemoModeActiveForEmail("gsbarbosa180@gmail.com")).toBe(false);

    vi.stubEnv("DEMO_MODE", "false");
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "false");
    expect(isDemoModeActiveForEmail("plateia@example.com")).toBe(false);
    expect(isDemoModeActiveForEmail("tribeiro81@gmail.com")).toBe(false);
  });
});
