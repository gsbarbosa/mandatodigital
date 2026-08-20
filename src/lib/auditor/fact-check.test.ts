import { describe, expect, it, afterEach, vi } from "vitest";

import { runFactCheck } from "@/lib/auditor/fact-check";
import { isFactCheckHeuristicFallback } from "@/lib/auditor/types";
import { requestStructuredJson } from "@/lib/llm";
import { checkRateLimit, resetRateLimitBuckets } from "@/lib/rate-limit";

vi.mock("@/lib/llm", () => ({
  requestStructuredJson: vi.fn(),
  parseJsonResponse: (text: string) => {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return null;
    }
  },
}));

describe("rate-limit", () => {
  afterEach(() => {
    resetRateLimitBuckets();
  });

  it("bloqueia apos atingir o limite na janela", () => {
    const now = 1_000_000;
    const first = checkRateLimit({ key: "user-1", max: 2, windowMs: 60_000, now });
    const second = checkRateLimit({ key: "user-1", max: 2, windowMs: 60_000, now: now + 1 });
    const third = checkRateLimit({ key: "user-1", max: 2, windowMs: 60_000, now: now + 2 });

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
  });
});

describe("auditor/fact-check", () => {
  afterEach(() => {
    vi.mocked(requestStructuredJson).mockReset();
  });

  it("retorna skipped quando roteiro vazio", async () => {
    const result = await runFactCheck({ script: "   " });
    expect(result.verdict).toBe("skipped");
  });

  it("propaga verdict, attributesToThirdParty e contradictionDetail por claim", async () => {
    vi.mocked(requestStructuredJson).mockResolvedValueOnce({
      rawText: JSON.stringify({
        verdict: "disputed",
        confidence: 60,
        summary: "Ha trecho sem fonte e uma contradicao com a materia.",
        claims: [
          {
            text: "A prefeitura investiu R$5 milhoes na obra.",
            verdict: "contradicted",
            contradictionDetail: "A materia diz que o investimento foi de R$3 milhoes.",
            sourceUrl: "https://example.com/a",
          },
          {
            text: "O vereador Fulano disse que vai renunciar.",
            verdict: "unsupported",
            attributesToThirdParty: true,
          },
          {
            text: "A cidade tem 200 mil habitantes.",
            verdict: "supported",
            sourceUrl: "https://example.com/a",
          },
        ],
        sources: ["https://example.com/a"],
      }),
      provider: "openai",
      model: "gpt-4.1-mini",
      latencyMs: 120,
      tokenUsage: null,
    });

    const result = await runFactCheck({ script: "roteiro de teste sem materias anexadas" });

    expect(result.verdict).toBe("disputed");
    expect(result.claims).toEqual([
      expect.objectContaining({
        verdict: "contradicted",
        contradictionDetail: "A materia diz que o investimento foi de R$3 milhoes.",
      }),
      expect.objectContaining({ verdict: "unsupported", attributesToThirdParty: true }),
      expect.objectContaining({ verdict: "supported" }),
    ]);
  });

  it("nao deixa verified passar quando um claim e unsupported", async () => {
    vi.mocked(requestStructuredJson).mockResolvedValueOnce({
      rawText: JSON.stringify({
        verdict: "verified",
        confidence: 90,
        summary: "Roteiro alinhado, com um trecho extra.",
        claims: [
          {
            text: "O Lula morreu de infarto.",
            verdict: "unsupported",
          },
        ],
        sources: [],
      }),
      provider: "openai",
      model: "gpt-4.1-mini",
      latencyMs: 80,
      tokenUsage: null,
    });

    const result = await runFactCheck({ script: "O Lula morreu de infarto." });
    expect(result.verdict).toBe("inconclusive");
  });

  it("aceita verdict top-level fora do enum (unsupported → inconclusive)", async () => {
    vi.mocked(requestStructuredJson).mockResolvedValueOnce({
      rawText: JSON.stringify({
        verdict: "unsupported",
        confidence: "alta",
        summary: "Nada a checar alem de opiniao.",
        claims: [],
        sources: [],
      }),
      provider: "openai",
      model: "gpt-4.1-mini",
      latencyMs: 90,
      tokenUsage: null,
    });

    const result = await runFactCheck({ script: "Chega de impunidade. Compartilhe." });
    expect(result.verdict).toBe("inconclusive");
    expect(result.confidence).toBe(85);
    expect(result.provider).toBe("openai");
  });

  it("reexecuta a LLM quando o JSON da primeira resposta e invalido", async () => {
    vi.mocked(requestStructuredJson)
      .mockResolvedValueOnce({
        rawText: "{",
        provider: "openai",
        model: "gpt-4.1-mini",
        latencyMs: 40,
        tokenUsage: null,
      })
      .mockResolvedValueOnce({
        rawText: JSON.stringify({
          verdict: "verified",
          confidence: 70,
          summary: "So opiniao e proposta do candidato.",
          claims: [],
          sources: [],
        }),
        provider: "openai",
        model: "gpt-4.1-mini",
        latencyMs: 110,
        tokenUsage: null,
      });

    const result = await runFactCheck({
      script: "Vamos construir um superpresidio no Norte. Chega de impunidade.",
    });

    expect(requestStructuredJson).toHaveBeenCalledTimes(2);
    expect(result.verdict).toBe("verified");
    expect(result.provider).toBe("openai");
  });

  it("identifica fallback heuristico local", () => {
    expect(
      isFactCheckHeuristicFallback({
        verdict: "inconclusive",
        confidence: 0,
        summary: "Nao foi possivel validar automaticamente. Revise manualmente antes de publicar.",
        claims: [],
        sources: [],
        checkedAt: new Date().toISOString(),
        provider: null,
        model: null,
      }),
    ).toBe(true);

    expect(
      isFactCheckHeuristicFallback({
        verdict: "inconclusive",
        confidence: 42,
        summary: "Fontes insuficientes.",
        claims: [],
        sources: [],
        checkedAt: new Date().toISOString(),
        provider: "openai",
        model: "gpt-4.1-mini",
      }),
    ).toBe(false);
  });
});
