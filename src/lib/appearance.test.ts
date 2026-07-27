import { describe, expect, it } from "vitest";

import { isAppearancePreference } from "@/lib/appearance";

describe("appearance", () => {
  it("aceita preferências válidas", () => {
    expect(isAppearancePreference("light")).toBe(true);
    expect(isAppearancePreference("dark")).toBe(true);
    expect(isAppearancePreference("system")).toBe(false);
    expect(isAppearancePreference("auto")).toBe(false);
  });
});
