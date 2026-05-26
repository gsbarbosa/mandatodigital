import { expect, test } from "@playwright/test";

import { gotoHome, openFeedbackDrawer } from "./helpers";

test.describe("smoke do MVP", () => {
  test("carrega a landing, entra em uma fase operacional e abre o feedback lateral", async ({
    page,
  }) => {
    await gotoHome(page);

    await expect(
      page.getByRole("heading", { name: "Fluxo do sistema por etapas" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Curador" }).first(),
    ).toBeVisible();

    await page.getByRole("link", { name: "Curador" }).first().click();
    await expect(
      page.getByRole("heading", { name: "Onboarding do parlamentar" }),
    ).toBeVisible();

    await openFeedbackDrawer(page, { path: "/curador" });
    await expect(
      page.getByRole("heading", { name: "O que funcionou e o que nao funcionou" }),
    ).toBeVisible();
  });
});
