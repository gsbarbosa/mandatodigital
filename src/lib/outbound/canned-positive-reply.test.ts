import { describe, expect, it } from "vitest";

import {
  fillCannedFirstName,
  normalizeButtonLabel,
  resolveCannedPositiveReply,
} from "@/lib/outbound/canned-positive-reply";

const base = {
  kind: "button" as const,
  buttonText: "Pode mandar",
  lastTemplate: "md_intro_feito_candidatas_v3",
  leadMessageCount: 1,
  firstName: "Maria",
};

describe("resolveCannedPositiveReply", () => {
  it("preenche o primeiro nome no texto do v3", () => {
    const reply = resolveCannedPositiveReply(base);
    expect(reply).toContain("Maria, vou te mandar o link de degustação");
    expect(reply).toContain("https://mandatodigital.ia.br/vozdelas");
    expect(reply).not.toContain("[Maria]");
  });

  it("aceita o botão Sim sozinho", () => {
    expect(resolveCannedPositiveReply({ ...base, buttonText: "Sim" })).toBeTruthy();
  });

  it("aceita Sim. Seja breve (rótulo antigo)", () => {
    expect(resolveCannedPositiveReply({ ...base, buttonText: "Sim. Seja breve" })).toBeTruthy();
  });

  it("ignora texto digitado, mesmo que seja Sim", () => {
    expect(resolveCannedPositiveReply({ ...base, kind: "text", buttonText: "Sim" })).toBeNull();
  });

  it("ignora o botão negativo", () => {
    expect(resolveCannedPositiveReply({ ...base, buttonText: "Não, obrigada" })).toBeNull();
  });

  it("só vale na primeira mensagem do lead", () => {
    expect(resolveCannedPositiveReply({ ...base, leadMessageCount: 2 })).toBeNull();
  });

  it("não aplica em template sem resposta pré-moldada", () => {
    expect(resolveCannedPositiveReply({ ...base, lastTemplate: "md_intro_vaga_sigla_v1" })).toBeNull();
  });
});

describe("fillCannedFirstName", () => {
  it("cai para Oi quando o nome vem vazio", () => {
    expect(fillCannedFirstName("[Maria], segue", "")).toBe("Oi, segue");
  });
});

describe("normalizeButtonLabel", () => {
  it("ignora pontuação e caixa", () => {
    expect(normalizeButtonLabel("Sim. Seja breve")).toBe("sim seja breve");
  });
});
