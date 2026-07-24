import fs from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

import {
  assertFeedQualityFromApi,
  fetchSentinelSuggestions,
  gotoMonitoramento,
  refreshSentinelPautas,
} from "./sentinel-helpers";

const authFile = path.join(process.cwd(), "playwright/.auth/user.json");

test.beforeAll(() => {
  if (!fs.existsSync(authFile)) {
    test.skip(
      true,
      "Sem playwright/.auth/user.json — rode: npm run test:e2e:auth (com E2E_EMAIL/E2E_PASSWORD).",
    );
  }
});

/**
 * Validações autenticadas do Sentinela.
 * Refresh completo (caro): SENTINEL_E2E_REFRESH=1
 */
test.describe("Sentinela — qualidade", () => {
  test("abre monitoramento autenticado e API devolve sugestões", async ({
    page,
    request,
  }) => {
    await gotoMonitoramento(page);
    await expect(page.getByRole("heading", { name: /Monitoramento de Pautas/i })).toBeVisible();

    const payload = await fetchSentinelSuggestions(request);
    expect(Array.isArray(payload.suggestions)).toBe(true);

    if (payload.suggestions.length > 0) {
      assertFeedQualityFromApi(payload, { expectQualityRank: false });
    }
  });

  test("refresh manual aplica quality gates", async ({ page }) => {
    test.skip(
      process.env.SENTINEL_E2E_REFRESH !== "1" && process.env.SENTINEL_E2E_REFRESH !== "true",
      "Defina SENTINEL_E2E_REFRESH=1 para rodar coleta+rank (~2min, gasta LLM).",
    );

    test.setTimeout(360_000);
    await gotoMonitoramento(page);

    const payload = await refreshSentinelPautas(page);
    expect(payload.skipped).not.toBe(true);
    expect(payload.suggestions.length).toBeGreaterThan(0);

    const report = assertFeedQualityFromApi(payload, { expectQualityRank: true });
    expect(report.stats.rankLlmCalls).toBeGreaterThan(0);

    await expect(page.getByTestId("monitor-signal-card").first()).toBeVisible({
      timeout: 30_000,
    });
  });
});
