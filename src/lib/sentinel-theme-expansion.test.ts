import { describe, expect, it } from "vitest";

import { flattenExpansionSearchTerms } from "@/lib/sentinel-theme-expansion";

describe("sentinel-theme-expansion", () => {
  it("limita e deduplica termos de busca da expansao", () => {
    const terms = flattenExpansionSearchTerms([
      {
        sourceTheme: "Saude",
        expandedTerms: ["UBS", "SUS", "UBS", "vacina"],
        generatedAt: "2026-06-24T00:00:00.000Z",
      },
      {
        sourceTheme: "Educacao",
        expandedTerms: Array.from({ length: 25 }, (_, index) => `termo-${index}`),
        generatedAt: "2026-06-24T00:00:00.000Z",
      },
    ]);

    expect(terms).toContain("UBS");
    expect(terms.filter((term) => term === "UBS")).toHaveLength(1);
    expect(terms.length).toBeLessThanOrEqual(20);
  });
});
