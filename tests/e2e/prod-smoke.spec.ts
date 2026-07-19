import { expect, test } from "@playwright/test";

import { gotoHome } from "./helpers";

test.describe("smoke do MVP", () => {
  test("carrega a landing e abre a tela de login", async ({ page }) => {
    await gotoHome(page);

    await expect(
      page.getByRole("heading", { name: /tropa de ia/i }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Entrar" })).toBeVisible();

    await page.getByRole("link", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});
