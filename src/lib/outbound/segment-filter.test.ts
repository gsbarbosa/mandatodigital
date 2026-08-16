import { describe, expect, it } from "vitest";

import { applySegment, coerceSegmentFilter, matchesSegment } from "@/lib/outbound/segment-filter";
import { EMPTY_SEGMENT_FILTER, type MarketingContact } from "@/lib/outbound/types";

function contact(overrides: Partial<MarketingContact> = {}): MarketingContact {
  return {
    id: "c1",
    name: "MARIA DA SILVA",
    email: "maria@exemplo.com",
    phoneE164: "5511988887777",
    source: "diretorio_partidario",
    uf: "SP",
    parties: ["PT"],
    roles: ["PRESIDENTE"],
    municipality: "SÃO PAULO / SP",
    isCandidate2026: false,
    candidateRole: "",
    suspended: false,
    origin: "teste",
    createdAt: "2026-08-11T00:00:00.000Z",
    updatedAt: "2026-08-11T00:00:00.000Z",
    ...overrides,
  };
}

describe("matchesSegment", () => {
  it("aceita tudo com filtro vazio", () => {
    expect(matchesSegment(contact(), EMPTY_SEGMENT_FILTER)).toBe(true);
  });

  it("filtra por UF", () => {
    const filter = { ...EMPTY_SEGMENT_FILTER, ufs: ["MG"] };
    expect(matchesSegment(contact({ uf: "SP" }), filter)).toBe(false);
    expect(matchesSegment(contact({ uf: "MG" }), filter)).toBe(true);
  });

  it("casa partido quando o contato tem qualquer um dos selecionados", () => {
    const filter = { ...EMPTY_SEGMENT_FILTER, parties: ["MDB", "PT"] };
    expect(matchesSegment(contact({ parties: ["PT"] }), filter)).toBe(true);
    expect(matchesSegment(contact({ parties: ["NOVO"] }), filter)).toBe(false);
  });

  it("exclui suspensos por padrão e inclui quando desligado", () => {
    const suspended = contact({ suspended: true });
    expect(matchesSegment(suspended, EMPTY_SEGMENT_FILTER)).toBe(false);
    expect(
      matchesSegment(suspended, { ...EMPTY_SEGMENT_FILTER, excludeSuspended: false }),
    ).toBe(true);
  });

  it("canal whatsapp descarta contato sem telefone móvel", () => {
    const filter = { ...EMPTY_SEGMENT_FILTER, channel: "whatsapp" as const };
    expect(matchesSegment(contact({ phoneE164: "" }), filter)).toBe(false);
    expect(matchesSegment(contact(), filter)).toBe(true);
  });

  it("canal email descarta contato sem e-mail", () => {
    const filter = { ...EMPTY_SEGMENT_FILTER, channel: "email" as const };
    expect(matchesSegment(contact({ email: "" }), filter)).toBe(false);
  });

  it("busca livre ignora acento e caixa", () => {
    const filter = { ...EMPTY_SEGMENT_FILTER, search: "sao paulo" };
    expect(matchesSegment(contact(), filter)).toBe(true);
  });

  it("combina filtros de forma conjuntiva", () => {
    const filter = {
      ...EMPTY_SEGMENT_FILTER,
      ufs: ["SP"],
      parties: ["PT"],
      onlyCandidates2026: true,
    };
    expect(matchesSegment(contact(), filter)).toBe(false);
    expect(matchesSegment(contact({ isCandidate2026: true }), filter)).toBe(true);
  });
});

describe("applySegment", () => {
  it("retorna só os contatos que casam", () => {
    const contacts = [contact({ id: "a", uf: "SP" }), contact({ id: "b", uf: "RJ" })];
    const result = applySegment(contacts, { ...EMPTY_SEGMENT_FILTER, ufs: ["RJ"] });
    expect(result.map((item) => item.id)).toEqual(["b"]);
  });
});

describe("coerceSegmentFilter", () => {
  it("preenche defaults a partir de entrada vazia", () => {
    expect(coerceSegmentFilter({})).toEqual(EMPTY_SEGMENT_FILTER);
  });

  it("descarta source inválida e normaliza UF", () => {
    const filter = coerceSegmentFilter({
      sources: ["diretorio_partidario", "inexistente"],
      ufs: ["sp", " mg "],
    });
    expect(filter.sources).toEqual(["diretorio_partidario"]);
    expect(filter.ufs).toEqual(["SP", "MG"]);
  });

  it("ignora canal inválido", () => {
    expect(coerceSegmentFilter({ channel: "pombo-correio" }).channel).toBeNull();
  });

  it("mantém excludeSuspended=false explícito", () => {
    expect(coerceSegmentFilter({ excludeSuspended: false }).excludeSuspended).toBe(false);
  });
});
