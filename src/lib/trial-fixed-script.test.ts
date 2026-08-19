import { describe, expect, it } from "vitest";

import {
  spokenTranscriptForAccount,
  trialAvatarScriptKindFromProduction,
  trialFixedAvatarScript,
} from "./trial-fixed-script";

describe("trialFixedAvatarScript", () => {
  it("usa o miolo fixo e troca o rótulo do avatar", () => {
    const gemeo = trialFixedAvatarScript("gemeo");
    const caricato = trialFixedAvatarScript("caricato");
    expect(gemeo).toContain("gêmeo digital");
    expect(gemeo).toContain("versão de teste");
    expect(caricato).toContain("caricato");
    expect(gemeo.startsWith("Olá.")).toBe(true);
  });

  it("aplica tom e arquétipo só como flavor", () => {
    const spoken = trialFixedAvatarScript("gemeo", {
      tone: "Popular",
      archetype: "O Gestor/CEO (Eficiencia)",
    });
    expect(spoken.startsWith("E aí, tudo certo?")).toBe(true);
    expect(spoken).toContain("Eficiência é isso");
  });
});

describe("spokenTranscriptForAccount", () => {
  it("ignora o roteiro do cliente no trial", () => {
    const result = spokenTranscriptForAccount({
      guestQuotas: true,
      generateMode: "photo_real",
      requestedTranscript: "Texto do Curador que não pode ir ao HeyGen.",
    });
    expect(result.usedTrialFixedScript).toBe(true);
    expect(result.transcript).not.toContain("Curador");
    expect(result.transcript).toContain("gêmeo digital");
  });

  it("mantém o roteiro pedido em conta paga", () => {
    const result = spokenTranscriptForAccount({
      guestQuotas: false,
      generateMode: "photo_real",
      requestedTranscript: "Roteiro aprovado da campanha.",
    });
    expect(result.usedTrialFixedScript).toBe(false);
    expect(result.transcript).toBe("Roteiro aprovado da campanha.");
  });

  it("mapeia mascote 3D no generateMode caricature", () => {
    expect(
      trialAvatarScriptKindFromProduction({
        generateMode: "caricature",
        caricatureVariant: "mascot_3d",
      }),
    ).toBe("mascote3d");
  });
});
