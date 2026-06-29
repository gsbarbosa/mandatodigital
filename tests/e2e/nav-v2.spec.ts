import { test, expect } from "@playwright/test";

import { saveAutotestProfile } from "./helpers";

const navV2Enabled = process.env.NEXT_PUBLIC_PRODUCT_NAV_V2 === "true";

test.describe("navegação v2", () => {
  test.skip(!navV2Enabled, "Requer NEXT_PUBLIC_PRODUCT_NAV_V2=true");

  test("mostra Início, Meus criativos e Configurações na nav operação-first", async ({
    page,
    request,
  }) => {
    await saveAutotestProfile(request);
    await page.goto("/inicio");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("inicio-heading")).toBeVisible();
    await expect(page.getByTestId("operation-nav-inicio")).toBeVisible();
    await expect(page.getByTestId("operation-nav-criativo")).toHaveText("Meus criativos");
    await expect(page.getByTestId("operation-nav-configuracoes")).toBeVisible();
  });

  test("Configurações alterna abas perfil e radar", async ({ page, request }) => {
    await saveAutotestProfile(request);
    await page.goto("/configuracoes?tab=radar");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("configuracoes-heading")).toBeVisible();
    await expect(page.getByTestId("config-panel-radar")).toBeVisible();
    await page.getByTestId("config-tab-perfil").click();
    await expect(page.getByTestId("config-panel-perfil")).toBeVisible();
  });
});
