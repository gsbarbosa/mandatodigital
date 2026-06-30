import { test, expect } from "@playwright/test";

import { saveAutotestProfile } from "./helpers";

const navV2Enabled = process.env.NEXT_PUBLIC_PRODUCT_NAV_V2 === "true";

test.describe("navegação v2", () => {
  test.skip(!navV2Enabled, "Requer NEXT_PUBLIC_PRODUCT_NAV_V2=true");

  test("mostra Início, Meus criativos e seções de configuração na sidebar", async ({
    page,
    request,
  }) => {
    await saveAutotestProfile(request);
    await page.goto("/inicio");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("inicio-heading")).toBeVisible();
    await expect(page.getByTestId("operation-nav-inicio")).toBeVisible();
    await expect(page.getByTestId("operation-nav-criativo")).toHaveText("Meus criativos");
    await expect(page.getByTestId("operation-nav-perfil")).toBeVisible();
    await expect(page.getByTestId("operation-nav-avatar")).toBeVisible();
    await expect(page.getByTestId("operation-nav-radar")).toBeVisible();
  });

  test("Configuração alterna seções perfil, radar e avatar pela sidebar", async ({
    page,
    request,
  }) => {
    await saveAutotestProfile(request);
    await page.goto("/configuracoes/radar");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("configuracoes-heading")).toHaveText("Radar");
    await expect(page.getByTestId("config-panel-radar")).toBeVisible();
    await expect(page.getByRole("tab", { name: "1. Temas do mandato" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "2. Temas da oposição" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Temas do mandato" })).toBeVisible();
    await page.getByRole("tab", { name: "2. Temas da oposição" }).click();
    await expect(page.getByRole("heading", { name: "Temas da oposição" })).toBeVisible();
    await page.getByTestId("operation-nav-perfil").click();
    await expect(page.getByTestId("config-panel-perfil")).toBeVisible();
    await page.getByTestId("operation-nav-avatar").click();
    await expect(page.getByTestId("config-panel-avatar")).toBeVisible();
  });
});
