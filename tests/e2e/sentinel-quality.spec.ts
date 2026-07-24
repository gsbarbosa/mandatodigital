import fs from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

import {
  assertFeedQualityFromApi,
  assertSuggestionThemesWithinRadar,
  configureSentinelThemes,
  E2E_ESTADUAL_THEMES,
  E2E_FEDERAL_THEMES,
  fetchProfile,
  fetchSentinelSuggestions,
  goToMonitoramentoFromPrompt,
  gotoMonitoramento,
  refreshSentinelPautas,
  saveRadar,
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
 * Fluxo completo (temas → salvar → refresh): SENTINEL_E2E_REFRESH=1
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

  test("seleciona temas e salva radar (sem refresh caro)", async ({ page, request }) => {
    test.setTimeout(180_000);

    const radar = await configureSentinelThemes(page, {
      federal: E2E_FEDERAL_THEMES.slice(0, 3),
      estadual: E2E_ESTADUAL_THEMES.slice(0, 3),
      state: "MG",
    });

    const saveResult = await saveRadar(page);
    expect(saveResult.profile?.sentinelThemesFederal?.sort()).toEqual(
      [...radar.federal].sort(),
    );
    expect(saveResult.profile?.sentinelThemesEstadual?.sort()).toEqual(
      [...radar.estadual].sort(),
    );

    const profileAfter = await fetchProfile(request);
    expect(profileAfter.profile?.sentinelThemesFederal?.sort()).toEqual(
      [...radar.federal].sort(),
    );
    expect(profileAfter.profile?.sentinelThemesEstadual?.sort()).toEqual(
      [...radar.estadual].sort(),
    );
    expect(profileAfter.profile?.state).toBe("MG");
  });

  test("seleciona temas, salva radar e valida feed do Sentinela", async ({
    page,
    request,
  }) => {
    test.skip(
      process.env.SENTINEL_E2E_REFRESH !== "1" && process.env.SENTINEL_E2E_REFRESH !== "true",
      "Defina SENTINEL_E2E_REFRESH=1 para o fluxo completo (~2–3 min, gasta LLM/crédito).",
    );

    test.setTimeout(420_000);

    const radar = await configureSentinelThemes(page, {
      federal: E2E_FEDERAL_THEMES,
      estadual: E2E_ESTADUAL_THEMES,
      state: "MG",
    });

    const saveResult = await saveRadar(page);
    expect(saveResult.sentinelRefreshSkipped).not.toBe(true);

    const savedFederal = saveResult.profile?.sentinelThemesFederal ?? [];
    const savedEstadual = saveResult.profile?.sentinelThemesEstadual ?? [];
    expect(savedFederal.sort()).toEqual([...radar.federal].sort());
    expect(savedEstadual.sort()).toEqual([...radar.estadual].sort());
    expect(saveResult.profile?.state).toBe("MG");

    const profileAfter = await fetchProfile(request);
    expect(profileAfter.profile?.sentinelThemesFederal?.sort()).toEqual(
      [...radar.federal].sort(),
    );
    expect(profileAfter.profile?.sentinelThemesEstadual?.sort()).toEqual(
      [...radar.estadual].sort(),
    );

    await goToMonitoramentoFromPrompt(page);

    const payload = await refreshSentinelPautas(page);
    expect(payload.skipped).not.toBe(true);
    expect(payload.suggestions.length).toBeGreaterThan(0);

    const report = assertFeedQualityFromApi(payload, {
      expectQualityRank: true,
      minCards: 3,
    });
    expect(report.stats.jobListings).toBe(0);
    expect(report.stats.rankLlmCalls).toBeGreaterThan(0);

    const radarThemes = [...radar.federal, ...radar.estadual];
    assertSuggestionThemesWithinRadar(payload.suggestions, radarThemes);

    await expect(page.getByTestId("monitor-signal-card").first()).toBeVisible({
      timeout: 30_000,
    });
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
