import { describe, expect, it } from "vitest";

import { filterGeoExpansionTerms } from "./sentinel-theme-expansion";
import type { PoliticianProfile } from "./types";

const profile = {
  city: "Belo Horizonte",
  state: "MG",
} as PoliticianProfile;

describe("filterGeoExpansionTerms", () => {
  it("remove cidade e UF dos termos expandidos", () => {
    expect(
      filterGeoExpansionTerms(
        ["Belo Horizonte", "MG", "venda de estatais", "belo horizonte"],
        profile,
      ),
    ).toEqual(["venda de estatais"]);
  });
});
