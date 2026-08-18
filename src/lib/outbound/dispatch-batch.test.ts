import { describe, expect, it } from "vitest";

import { diversifyByUf, pickDispatchBatch, seedFromString } from "@/lib/outbound/dispatch-batch";

describe("pickDispatchBatch", () => {
  it("é determinístico para o mesmo seed", () => {
    const pool = ["SP", "RJ", "MG", "BA", "PR", "RS"].map((uf, index) => ({ id: String(index), uf }));
    const first = pickDispatchBatch(pool, 4, "campanha-a:0");
    const second = pickDispatchBatch(pool, 4, "campanha-a:0");
    expect(first).toEqual(second);
  });

  it("muda o recorte quando o seed avança (próximo clique)", () => {
    const pool = Array.from({ length: 20 }, (_, index) => ({
      id: String(index),
      uf: ["SP", "RJ", "MG", "BA"][index % 4] as string,
    }));
    const first = pickDispatchBatch(pool, 5, "campanha-a:0").map((item) => item.id);
    const second = pickDispatchBatch(pool, 5, "campanha-a:5").map((item) => item.id);
    expect(first).not.toEqual(second);
  });
});

describe("diversifyByUf", () => {
  it("não empilha o mesmo estado no lote quando há opção", () => {
    const pool = [
      { id: "1", uf: "SP" },
      { id: "2", uf: "SP" },
      { id: "3", uf: "SP" },
      { id: "4", uf: "RJ" },
      { id: "5", uf: "MG" },
    ];
    const lote = diversifyByUf(pool, 3);
    const ufs = lote.map((item) => item.uf);
    expect(new Set(ufs).size).toBe(3);
  });
});

describe("seedFromString", () => {
  it("é estável", () => {
    expect(seedFromString("abc")).toBe(seedFromString("abc"));
    expect(seedFromString("abc")).not.toBe(seedFromString("abd"));
  });
});
