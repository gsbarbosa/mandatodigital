import { describe, expect, it } from "vitest";

import { analyzeProductFeedback } from "@/lib/product-feedback-analyzer";

describe("analyzeProductFeedback", () => {
  it("classifica pedido fora do escopo atual", async () => {
    const result = await analyzeProductFeedback({
      screen: "dashboard",
      workedWell: "o onboarding funcionou",
      issueObserved:
        "seria bom puxar automaticamente pautas de sites e redes via Apify",
    });

    expect(result.classification).toBe("fora_do_escopo_atual");
    expect(result.criticality).toBe("baixa");
    expect(result.implementationPrompt.length).toBeGreaterThan(12);
  });

  it("classifica bug quando o relato indica falha do fluxo existente", async () => {
    const result = await analyzeProductFeedback({
      screen: "onboarding",
      workedWell: "",
      issueObserved: "o botao de salvar nao funciona e os dados nao salvam",
    });

    expect(result.classification).toBe("bug");
    expect(result.criticality).toBe("alta");
    expect(result.implementationPrompt).toContain("corrija");
  });
});
