import { describe, expect, it } from "vitest";

import { buildSystemPrompt, LANDING_PAGES } from "@/lib/outbound/conversation-agent";

describe("buildSystemPrompt", () => {
  it("manda tirar o lead do WhatsApp e lista os landings", () => {
    const prompt = buildSystemPrompt("");
    expect(prompt).toContain("tirar a pessoa do WhatsApp");
    expect(prompt).toContain(LANDING_PAGES.vozdelas);
    expect(prompt).toContain(LANDING_PAGES.materialidade);
    expect(prompt).toContain(LANDING_PAGES.degustacao);
  });

  it("não presume candidatura em presidente de diretório", () => {
    const prompt = buildSystemPrompt("", {
      name: "João",
      uf: "MG",
      parties: ["PL"],
      roles: ["PRESIDENTE"],
      candidateRole: "",
      gender: "M",
      isReelection: false,
      isPartyPresident: true,
    });
    expect(prompt).toContain("presidente de diretório partidário");
    expect(prompt).toContain("não diga \"sua pré-candidatura\"");
  });
});
