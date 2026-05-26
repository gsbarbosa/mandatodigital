import { expect, test } from "@playwright/test";

import { gotoHome, openFeedbackDrawer } from "./helpers";

test.describe("smoke do MVP", () => {
  test("carrega os blocos principais e abre o feedback lateral", async ({
    page,
  }) => {
    await gotoHome(page);

    await expect(
      page.getByRole("heading", { name: "Onboarding do parlamentar" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Nova pauta" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Historico reutilizavel" }),
    ).toBeVisible();

    await openFeedbackDrawer(page);
    await expect(
      page.getByRole("heading", { name: "O que funcionou e o que nao funcionou" }),
    ).toBeVisible();
  });
});
