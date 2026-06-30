import { expect, test } from "@playwright/test";

import {
  assertSentinelSuggestionsMatchRadar,
  refreshSentinelSignals,
  saveSentinelRadarProfile,
} from "./sentinel-helpers";

const fixturesEnabled = process.env.SENTINEL_RSS_FIXTURES === "true";
const navV2Enabled = process.env.NEXT_PUBLIC_PRODUCT_NAV_V2 === "true";

test.describe("Sentinela — radar e sinais", () => {
  test.skip(!fixturesEnabled, "Requer SENTINEL_RSS_FIXTURES=true no servidor de teste");

  test("API: só Vacinação → sinais só com Vacinação", async ({ request }) => {
    await saveSentinelRadarProfile(request, {
      sentinelThemes: ["Vacinação"],
      oppositionThemes: [],
    });

    const payload = await refreshSentinelSignals(request);

    assertSentinelSuggestionsMatchRadar(payload.suggestions, ["Vacinação"]);
    expect(payload.meta?.articlesMatchedRadar ?? 0).toBeGreaterThan(0);
    expect(payload.meta?.themeViolationsFiltered ?? 0).toBe(0);
  });

  test("API: Vacinação + Segurança Pública → temas permitidos nos sinais", async ({ request }) => {
    await saveSentinelRadarProfile(request, {
      sentinelThemes: ["Vacinação", "Segurança Pública"],
      oppositionThemes: [],
    });

    const payload = await refreshSentinelSignals(request);

    assertSentinelSuggestionsMatchRadar(payload.suggestions, [
      "Vacinação",
      "Segurança Pública",
    ]);
  });

  test("API: oposição Combate à Corrupção → sinais só desse tema", async ({ request }) => {
    await saveSentinelRadarProfile(request, {
      sentinelThemes: [],
      oppositionThemes: ["Combate à Corrupção"],
    });

    const payload = await refreshSentinelSignals(request);

    assertSentinelSuggestionsMatchRadar(payload.suggestions, ["Combate à Corrupção"]);
  });

  test("API: Homeschooling (sem fixture) → nenhum sinal", async ({ request }) => {
    await saveSentinelRadarProfile(request, {
      sentinelThemes: ["Homeschooling"],
      oppositionThemes: [],
    });

    const payload = await refreshSentinelSignals(request);

    expect(payload.suggestions).toEqual([]);
    expect(payload.meta?.emptyReason).toBeTruthy();
  });
});

test.describe("Sentinela — UI Início", () => {
  test.skip(!fixturesEnabled, "Requer SENTINEL_RSS_FIXTURES=true no servidor de teste");
  test.skip(!navV2Enabled, "Requer NEXT_PUBLIC_PRODUCT_NAV_V2=true");

  test("Início exibe badges de tema após atualizar sinais", async ({ page, request }) => {
    await saveSentinelRadarProfile(request, {
      sentinelThemes: ["Vacinação"],
      oppositionThemes: [],
    });

    await page.goto("/inicio");
    await expect(page.getByTestId("inicio-heading")).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("networkidle");

    await page.getByTestId("inicio-refresh-signals").click();
    await expect(page.getByTestId("sentinel-matched-theme").first()).toBeVisible({
      timeout: 60_000,
    });

    const badges = page.getByTestId("sentinel-matched-theme");
    const count = await badges.count();
    expect(count).toBeGreaterThan(0);

    for (let index = 0; index < count; index += 1) {
      await expect(badges.nth(index)).toHaveAttribute("data-theme", "Vacinação");
    }
  });
});
