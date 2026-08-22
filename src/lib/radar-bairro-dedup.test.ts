import { afterEach, describe, expect, it, vi } from "vitest";

import { findCandidateDuplicatePairs, jaccardSimilarity } from "@/lib/radar-bairro-dedup";
import type { RadarBairroPost } from "@/lib/radar-bairro-types";

const ENV_KEYS = ["RADAR_BAIRRO_LLM_ENABLED"] as const;
const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  vi.resetModules();
  vi.clearAllMocks();
});

/**
 * Os 3 pares abaixo são recortes de posts REAIS coletados no X (validação da
 * feature, região Castelo/Betânia em BH) — não casos inventados.
 */
function post(over: Partial<RadarBairroPost>): RadarBairroPost {
  return {
    id: "x",
    url: "https://x.com/1",
    text: "",
    publishedAt: "2026-08-17T20:00:00.000Z",
    authorName: "a",
    likes: 0,
    comments: 0,
    groupTitle: "",
    localityName: "Betânia",
    ...over,
  };
}

const acidente1 = post({
  id: "a1",
  authorName: "otempo",
  text: "Ônibus perdeu o freio e causou acidente deixando cerca de 20 pessoas feridas, na tarde desta sexta-feira (29 de novembro), no Anel Rodoviário de Belo Horizonte. A batida aconteceu por volta das 17h e na altura de um viaduto na região conhecida como descida do Betânia.",
});
const acidente2 = post({
  id: "a2",
  authorName: "TumultoBR",
  text: "ATENÇÃO, MOTORISTAS! O trânsito no Anel Rodoviário, no bairro Betânia, em Belo Horizonte, está travado na noite desta sexta-feira (29). O acidente envolvendo um ônibus de viagem, com cerca de 20 vítimas, interdita totalmente a pista do meio, sentido Vitória.",
});

/**
 * O par mais parecido que existe SEM ser duplicata: 2 crimes diferentes (furto
 * de bicicleta x esfaqueamento em assalto), mesmo veículo de notícia, mesmo
 * bairro — o vocabulário compartilhado é só o estilo do repórter (jaccard
 * 0,182), quase idêntico ao par de duplicata real (0,200). É por isso que o
 * limiar de candidato é só um pré-filtro, não a decisão final.
 */
const crime1 = post({
  id: "c1",
  authorName: "otempo",
  text: "Imagens de câmeras de segurança registraram o furto de uma bicicleta em um prédio localizado na rua Castelo de Sintra, no bairro Castelo, região da Pampulha, em Belo Horizonte. Um homem, vestido com blusa, calça e capuz, arrombou o portão e levou o veículo, avaliado em R$ 1 mil.",
});
const crime2 = post({
  id: "c2",
  authorName: "otempo",
  text: "Um motociclista foi esfaqueado após reagir a um assalto na noite de segunda-feira (9 de junho), na rua Castelo de Almada, no bairro Castelo, região da Pampulha, em Belo Horizonte. Imagens de câmeras de segurança flagraram a ação do suspeito.",
});

const clima1 = post({
  id: "cl1",
  authorName: "Br381_urgente",
  text: "Anel rodoviário de Belo Horizonte apresenta nesse momento vários trechos com alagamento. Atenção. Foto: Bairro Betânia",
});
const clima2 = post({
  id: "cl2",
  authorName: "Rede98Oficial",
  text: "GRANIZO EM BH. Um temporal atingiu Belo Horizonte no fim da tarde desta segunda-feira (27). Em algumas regiões da capital, além das fortes chuvas, moradores relataram também queda de granizo. É o caso da região Oeste.",
});

describe("jaccardSimilarity / findCandidateDuplicatePairs (peneira barata)", () => {
  it("pega os dois pares parecidos como candidato, descarta o par claramente diferente", () => {
    const batch = [acidente1, acidente2, crime1, crime2, clima1, clima2];
    const pairs = findCandidateDuplicatePairs(batch);
    const ids = pairs.map(([i, j]) => [batch[i]!.id, batch[j]!.id].sort().join("+"));

    // Duplicata real (mesmo acidente, fontes diferentes) — deve virar candidato.
    expect(ids).toContain("a1+a2");
    // O par mais parecido que existe SEM ser duplicata (2 crimes diferentes,
    // mesmo veículo de notícia) também vira candidato — jaccard 0,182 contra
    // 0,200 do par real, perto demais pra descartar só com a peneira barata.
    expect(ids).toContain("c1+c2");
    // Claramente sem relação (temporais diferentes) — nem chega a candidato.
    expect(ids).not.toContain("cl1+cl2");
  });

  it("jaccard = 0 quando não há palavra significativa em comum", () => {
    expect(jaccardSimilarity(new Set(["chuva"]), new Set(["furto"]))).toBe(0);
  });

  it("não considera par fora da janela de 72h como candidato, mesmo com texto idêntico", () => {
    const longeNoTempo = post({ id: "b", text: acidente1.text, publishedAt: "2026-09-01T00:00:00.000Z" });
    const pairs = findCandidateDuplicatePairs([acidente1, longeNoTempo]);
    expect(pairs).toEqual([]);
  });
});

describe("deduplicatePosts (com IA desligada — caminho seguro por default)", () => {
  it("sem IA disponível, não funde nada — post duplicado visível é preferível a perder post real", async () => {
    delete process.env.RADAR_BAIRRO_LLM_ENABLED;
    vi.resetModules();
    const { deduplicatePosts } = await import("@/lib/radar-bairro-dedup");

    const result = await deduplicatePosts([acidente1, acidente2, crime1, crime2]);

    expect(result).toHaveLength(4);
  });
});

describe("deduplicatePosts (com IA mockada)", () => {
  it("funde o par confirmado como mesmo evento, mantém o de maior engajamento", async () => {
    process.env.RADAR_BAIRRO_LLM_ENABLED = "true";
    vi.resetModules();
    vi.doMock("@/lib/llm", () => ({
      requestStructuredJson: vi.fn(async (_system: string, user: string) => ({
        // confirma mesmo_evento só pro par que É duplicata de verdade
        rawText: JSON.stringify({ mesmo_evento: user.includes("Ônibus perdeu o freio") }),
        provider: "test",
        model: "test",
        latencyMs: 1,
        tokenUsage: null,
      })),
      parseJsonResponse: (text: string) => JSON.parse(text),
    }));
    const { deduplicatePosts } = await import("@/lib/radar-bairro-dedup");

    const comMaisEngajamento = { ...acidente2, likes: 50, comments: 10 };
    const result = await deduplicatePosts([acidente1, comMaisEngajamento]);

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(comMaisEngajamento.id);
  });

  it("não funde os 2 crimes diferentes mesmo sendo candidato — a IA rejeita", async () => {
    process.env.RADAR_BAIRRO_LLM_ENABLED = "true";
    vi.resetModules();
    vi.doMock("@/lib/llm", () => ({
      requestStructuredJson: vi.fn(async () => ({
        rawText: JSON.stringify({ mesmo_evento: false }),
        provider: "test",
        model: "test",
        latencyMs: 1,
        tokenUsage: null,
      })),
      parseJsonResponse: (text: string) => JSON.parse(text),
    }));
    const { deduplicatePosts } = await import("@/lib/radar-bairro-dedup");

    const result = await deduplicatePosts([crime1, crime2]);

    expect(result).toHaveLength(2);
  });
});
