import { describe, expect, it } from "vitest";

import {
  isPartyPresidentRole,
  scoreRelevance,
  VIP_FOLLOWERS,
} from "@/lib/outbound/relevance";

describe("isPartyPresidentRole", () => {
  it("aceita presidente e rejeita vice e tesoureiro", () => {
    expect(isPartyPresidentRole(["PRESIDENTE"])).toBe(true);
    expect(isPartyPresidentRole(["PRESIDENTE ESTADUAL"])).toBe(true);
    expect(isPartyPresidentRole(["1º COORDENAÇÃO GERAL/PORTA VOZ/PRESIDENTE"])).toBe(true);
    expect(isPartyPresidentRole(["VICE-PRESIDENTE"])).toBe(false);
    expect(isPartyPresidentRole(["TESOUREIRO", "SECRETÁRIO"])).toBe(false);
  });
});

describe("scoreRelevance", () => {
  it("marca VIP o federal em reeleição", () => {
    const result = scoreRelevance({
      office: "federal",
      isReelection: true,
      isPartyPresident: false,
      gender: "M",
      parties: ["PL"],
      instagramFollowers: 0,
    });
    expect(result.tier).toBe("vip");
    expect(result.reasons).toContain("reeleição");
  });

  it("marca VIP o presidente de partido grande", () => {
    const result = scoreRelevance({
      office: null,
      isReelection: false,
      isPartyPresident: true,
      gender: "",
      parties: ["PT"],
      instagramFollowers: 0,
    });
    expect(result.tier).toBe("vip");
  });

  it("não marca VIP a candidata sem mandato e sem audiência — cota não é atalho", () => {
    const result = scoreRelevance({
      office: "estadual",
      isReelection: false,
      isPartyPresident: false,
      gender: "F",
      parties: ["MDB"],
      instagramFollowers: 3_000,
    });
    expect(result.tier).not.toBe("vip");
  });

  it("sobe para alta a candidata com base digital real", () => {
    const result = scoreRelevance({
      office: "estadual",
      isReelection: false,
      isPartyPresident: false,
      gender: "F",
      parties: ["PSB"],
      instagramFollowers: 80_000,
    });
    expect(result.tier).toBe("alta");
  });

  it("marca VIP celebridade digital acima do corte", () => {
    const result = scoreRelevance({
      office: "federal",
      isReelection: false,
      isPartyPresident: false,
      gender: "M",
      parties: ["REPUBLICANOS"],
      instagramFollowers: VIP_FOLLOWERS,
    });
    expect(result.tier).toBe("vip");
  });

  it("reeleição estadual cai em alta, não VIP", () => {
    const result = scoreRelevance({
      office: "estadual",
      isReelection: true,
      isPartyPresident: false,
      gender: "M",
      parties: ["PSD"],
      instagramFollowers: 12_000,
    });
    expect(result.tier).toBe("alta");
  });
});
