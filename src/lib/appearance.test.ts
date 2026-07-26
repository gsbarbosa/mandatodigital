import { describe, expect, it } from "vitest";

import {
  isAppearancePreference,
  resolveAppearance,
} from "@/lib/appearance";

describe("appearance", () => {
  it("aceita preferências válidas", () => {
    expect(isAppearancePreference("light")).toBe(true);
    expect(isAppearancePreference("dark")).toBe(true);
    expect(isAppearancePreference("system")).toBe(true);
    expect(isAppearancePreference("auto")).toBe(false);
  });

  it("resolve light e dark direto", () => {
    expect(resolveAppearance("light")).toBe("light");
    expect(resolveAppearance("dark")).toBe("dark");
  });
});
