import { describe, expect, it } from "vitest";

import { matchContactsByName, parseNameList } from "@/lib/outbound/match-contacts";
import { buildNamedPreview, randomDispatchIntervalMs } from "@/lib/outbound/dispatch-named";
import { fillTemplatePlaceholders, resolveTemplateCatalogEntry } from "@/lib/outbound/whatsapp-templates";
import { EMPTY_DISPATCH_META, type MarketingContact } from "@/lib/outbound/types";

function contact(overrides: Partial<MarketingContact> = {}): MarketingContact {
  return {
    id: "c1",
    name: "ALANA PASSOS",
    email: "alana@exemplo.com",
    phoneE164: "5531999990001",
    source: "instagram_enriquecido",
    uf: "MG",
    parties: ["PL"],
    roles: [],
    municipality: "",
    isCandidate2026: true,
    candidateRole: "Deputado Estadual",
    gender: "F",
    isReelection: false,
    instagramFollowers: 1200,
    relevanceScore: 20,
    relevanceTier: "padrao",
    suspended: false,
    origin: "teste",
    ...EMPTY_DISPATCH_META,
    createdAt: "2026-08-11T00:00:00.000Z",
    updatedAt: "2026-08-11T00:00:00.000Z",
    ...overrides,
  };
}

describe("parseNameList", () => {
  it("parte vírgula, e e quebra de linha", () => {
    expect(parseNameList("Alana Passos, Sarah Poncio e Talita Cadeirante")).toEqual([
      "Alana Passos",
      "Sarah Poncio",
      "Talita Cadeirante",
    ]);
  });
});

describe("matchContactsByName", () => {
  const base = [
    contact(),
    contact({ id: "c2", name: "SARAH PONCIO", uf: "RJ", phoneE164: "5521999990002" }),
    contact({ id: "c3", name: "MARIA DA SILVA", uf: "SP", phoneE164: "5511999990003" }),
    contact({ id: "c4", name: "MARIA SOUZA", uf: "BA", phoneE164: "5571999990004" }),
  ];

  it("casa nome completo ignorando caixa e acento", () => {
    const [row] = matchContactsByName(base, ["alana passos"]);
    expect(row?.status).toBe("ok");
    if (row?.status === "ok") {
      expect(row.contact.id).toBe("c1");
    }
  });

  it("desambigua Maria sozinha", () => {
    const [row] = matchContactsByName(base, ["Maria"]);
    expect(row?.status).toBe("ambiguous");
  });

  it("filtra por UF no fim do nome", () => {
    const [row] = matchContactsByName(base, ["Maria BA"]);
    expect(row?.status).toBe("ok");
    if (row?.status === "ok") {
      expect(row.contact.id).toBe("c4");
    }
  });

  it("marca ausente", () => {
    const [row] = matchContactsByName(base, ["Sikera Junior"]);
    expect(row?.status).toBe("missing");
  });
});

describe("templates + preview", () => {
  it("resolve apelido feito candidatas para o v3", () => {
    const entry = resolveTemplateCatalogEntry("feito candidatas");
    expect(entry?.name).toBe("md_intro_feito_candidatas_v3");
    expect(entry?.paramCount).toBe(2);
  });

  it("preenche nome e persona no v3", () => {
    const body = resolveTemplateCatalogEntry("feito v3")?.body ?? "";
    expect(fillTemplatePlaceholders(body, ["Maria", "Anna"])).toContain("Olá *Maria*, aqui é a *Anna*, do Mandato Digital.");
  });

  it("resolve o genérico e preenche nome + persona", () => {
    const entry = resolveTemplateCatalogEntry("generico");
    expect(entry?.name).toBe("md_intro_generico_v1");
    expect(fillTemplatePlaceholders(entry?.body ?? "", ["Maria", "Anna"])).toContain(
      "Olá Maria. Sou Anna, do Mandato Digital.",
    );
  });

  it("preenche {{1}} no corpo", () => {
    expect(fillTemplatePlaceholders("Oi {{1}}, tudo bem?", ["Alana"])).toBe("Oi Alana, tudo bem?");
  });

  it("mostra o texto renderizado e trava quem não tem WhatsApp", () => {
    const template = resolveTemplateCatalogEntry("md_intro_feito_candidatas_v1");
    expect(template).toBeTruthy();
    const preview = buildNamedPreview({
      queries: ["Alana Passos", "Fantasma", "Maria"],
      contacts: [
        contact(),
        contact({ id: "c2", name: "MARIA DA SILVA", uf: "SP" }),
        contact({ id: "c3", name: "MARIA SOUZA", uf: "BA", phoneE164: "" }),
      ],
      template: template!,
      body: "Oi {{1}}, aqui é a Anna.",
      alreadySentIds: new Set(),
      todaySent: 3,
    });

    expect(preview.ready).toHaveLength(1);
    expect(preview.ready[0]?.rendered).toBe("Oi Alana, aqui é a Anna.");
    expect(preview.rows.find((row) => row.query === "Fantasma")?.status).toBe("missing");
    expect(preview.rows.find((row) => row.query === "Maria")?.status).toBe("ambiguous");
  });

  it("não reenvia quem já recebeu o mesmo template nomeado", () => {
    const template = resolveTemplateCatalogEntry("feito")!;
    const preview = buildNamedPreview({
      queries: ["Alana Passos"],
      contacts: [contact()],
      template,
      body: "Oi {{1}}",
      alreadySentIds: new Set(["c1"]),
      todaySent: 0,
    });
    expect(preview.ready).toHaveLength(0);
    expect(preview.rows[0]?.status).toBe("already_sent");
  });

  it("não envia quem pediu opt-out", () => {
    const template = resolveTemplateCatalogEntry("feito")!;
    const preview = buildNamedPreview({
      queries: ["Alana Passos"],
      contacts: [contact({ optOut: true })],
      template,
      body: "Oi {{1}}",
      alreadySentIds: new Set(),
      todaySent: 0,
    });
    expect(preview.ready).toHaveLength(0);
    expect(preview.rows[0]?.status).toBe("opt_out");
  });

  it("sorteia intervalo anti-rajada entre 20s e 60s", () => {
    const samples = [0, 0.5, 1].map((value) => randomDispatchIntervalMs(() => value));
    expect(samples[0]).toBe(20_000);
    expect(samples[1]).toBe(40_000);
    expect(samples[2]).toBe(60_000);
  });
});
