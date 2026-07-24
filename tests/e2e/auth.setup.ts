import fs from "node:fs";
import path from "node:path";

import { expect, test as setup } from "@playwright/test";

/**
 * Gera playwright/.auth/user.json para os specs autenticados.
 *
 * Credenciais (uma delas):
 * - E2E_EMAIL + E2E_PASSWORD (login e-mail/senha)
 * - Ou rode uma vez: npx playwright codegen --save-storage=playwright/.auth/user.json http://localhost:3000/login
 */
const authFile = path.join(process.cwd(), "playwright/.auth/user.json");

setup("autenticar e salvar storageState", async ({ page }) => {
  fs.mkdirSync(path.dirname(authFile), { recursive: true });

  const email = process.env.E2E_EMAIL?.trim();
  const password = process.env.E2E_PASSWORD?.trim();

  if (!email || !password) {
    setup.skip(
      true,
      "Defina E2E_EMAIL e E2E_PASSWORD no ambiente (ou gere playwright/.auth/user.json via codegen).",
    );
    return;
  }

  await page.goto("/login");
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill(password);
  await page.getByRole("button", { name: /^Entrar$/ }).click();

  // Cadastro completo → produto; incompleto → dados pessoais.
  await page.waitForURL(
    (url) =>
      !url.pathname.startsWith("/login") &&
      (url.pathname.startsWith("/monitoramento") ||
        url.pathname.startsWith("/acesso-antecipado") ||
        url.pathname.startsWith("/curador") ||
        url.pathname.startsWith("/criativo") ||
        url.pathname === "/"),
    { timeout: 60_000 },
  );

  await page.context().storageState({ path: authFile });
  expect(fs.existsSync(authFile)).toBeTruthy();
});
