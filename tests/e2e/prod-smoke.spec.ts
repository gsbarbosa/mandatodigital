import { expect, test } from "@playwright/test";

import { gotoHome, openFeedbackDrawer } from "./helpers";

test.describe("smoke do MVP", () => {
  test("carrega a landing, entra em uma fase operacional e abre o feedback lateral", async ({
    page,
  }) => {
    await gotoHome(page);

    await expect(
      page.getByRole("heading", { name: /tropa de ia/i }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Entrar" })).toBeVisible();

    await page.getByRole("link", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/curador");
    await expect(
      page.getByRole("heading", { name: "Onboarding do parlamentar" }),
    ).toBeVisible();

    await openFeedbackDrawer(page, { path: "/curador" });
    await expect(
      page.getByRole("heading", { name: "O que funcionou e o que nao funcionou" }),
    ).toBeVisible();
  });
});
