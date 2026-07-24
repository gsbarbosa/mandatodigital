import { expect, type APIRequestContext, type Page } from "@playwright/test";

import { evaluateSentinelFeedQuality } from "../../src/lib/sentinel-quality-assertions";
import type { MockSentinelSuggestion } from "../../src/lib/sentinel-mock-suggestions";
import type { SentinelSuggestionsMeta } from "../../src/lib/sentinel-types";

export async function gotoMonitoramento(page: Page) {
  await page.goto("/monitoramento");
  await page.waitForLoadState("domcontentloaded");

  if (page.url().includes("/login")) {
    throw new Error("Sessão inválida — rode npm run test:e2e:auth com E2E_EMAIL/E2E_PASSWORD.");
  }

  if (page.url().includes("/acesso-antecipado/dados")) {
    throw new Error(
      "Cadastro incompleto — complete /acesso-antecipado/dados na conta E2E antes dos testes do Sentinela.",
    );
  }

  await expect(page.getByTestId("monitoramento-page")).toBeVisible({ timeout: 30_000 });
}

export async function fetchSentinelSuggestions(request: APIRequestContext) {
  const response = await request.get("/api/sentinel/suggestions");
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()) as {
    suggestions: MockSentinelSuggestion[];
    meta: SentinelSuggestionsMeta | null;
  };
}

export async function refreshSentinelPautas(page: Page) {
  const refreshResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/sentinel/refresh") &&
      response.request().method() === "POST",
    { timeout: 300_000 },
  );

  await page.getByTestId("refresh-pautas-button").click();
  const response = await refreshResponse;
  expect(response.status(), await response.text()).toBe(200);

  const payload = (await response.json()) as {
    suggestions: MockSentinelSuggestion[];
    meta: SentinelSuggestionsMeta | null;
    skipped?: boolean;
  };

  return payload;
}

export function assertFeedQualityFromApi(payload: {
  suggestions: MockSentinelSuggestion[];
  meta: SentinelSuggestionsMeta | null;
}, options?: { expectQualityRank?: boolean }) {
  const report = evaluateSentinelFeedQuality(
    { suggestions: payload.suggestions, meta: payload.meta },
    {
      expectQualityRank: options?.expectQualityRank,
      minCards: 1,
    },
  );

  expect(
    report.ok,
    `Falhas de qualidade:\n- ${report.failures.join("\n- ")}\nstats=${JSON.stringify(report.stats)}`,
  ).toBe(true);

  return report;
}
