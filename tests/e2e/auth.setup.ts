import fs from "node:fs";
import path from "node:path";

import { expect, test as setup } from "@playwright/test";

import { DEV_ACCOUNT_MODE_COOKIE } from "../../src/lib/dev-account-mode";

/**
 * Gera playwright/.auth/user.json para os specs autenticados.
 *
 * Credenciais (nessa ordem):
 * - E2E_EMAIL + E2E_PASSWORD
 * - playwright/.auth/e2e-credentials.json (gerado pelo bootstrap)
 * - Ou rode: npx playwright test --project=bootstrap-e2e
 *
 * Cadastro completo é obrigatório: se a conta cair em /acesso-antecipado/dados,
 * rode o bootstrap de novo.
 */
const authDir = path.join(process.cwd(), "playwright/.auth");
const authFile = path.join(authDir, "user.json");
const credsFile = path.join(authDir, "e2e-credentials.json");

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    return;
  }
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    if (!line || line.startsWith("#") || !line.includes("=")) {
      continue;
    }
    const i = line.indexOf("=");
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1).replace(/\\n/g, "\n").replace(/\\"/g, '"');
    }
    if (!(key in process.env) || !String(process.env[key] ?? "").trim()) {
      process.env[key] = value;
    }
  }
}

function readBootstrapCredentials() {
  if (!fs.existsSync(credsFile)) {
    return null;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(credsFile, "utf8")) as {
      email?: string;
      password?: string;
    };
    if (parsed.email && parsed.password) {
      return { email: parsed.email, password: parsed.password };
    }
  } catch {
    return null;
  }
  return null;
}

async function fetchIdToken(email: string, password: string) {
  loadEnvLocal();
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("NEXT_PUBLIC_FIREBASE_API_KEY ausente");
  }
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const payload = (await response.json()) as {
    idToken?: string;
    error?: { message?: string };
  };
  if (!response.ok || !payload.idToken) {
    throw new Error(
      `Falha no signIn Identity Toolkit: ${payload.error?.message || response.status}`,
    );
  }
  return payload.idToken;
}

setup("autenticar e salvar storageState", async ({ page, context }) => {
  fs.mkdirSync(authDir, { recursive: true });

  const boot = readBootstrapCredentials();
  const email = process.env.E2E_EMAIL?.trim() || boot?.email;
  const password = process.env.E2E_PASSWORD?.trim() || boot?.password;

  if (!email || !password) {
    setup.skip(
      true,
      "Sem credenciais. Rode: npx playwright test --project=bootstrap-e2e  (ou defina E2E_EMAIL/E2E_PASSWORD).",
    );
    return;
  }

  const idToken = await fetchIdToken(email, password);
  const sessionResponse = await page.request.post("/api/auth/session", {
    data: { idToken },
  });
  expect(sessionResponse.status(), await sessionResponse.text()).toBe(200);

  // Contas e2e.*@example.com estão na allowlist — força premium p/ rank LLM.
  await page.request.put("/api/dev/account-mode", { data: { mode: "premium" } });

  await context.addCookies([
    {
      name: DEV_ACCOUNT_MODE_COOKIE,
      value: "premium",
      url: process.env.APP_BASE_URL || "http://127.0.0.1:3000",
    },
  ]);

  await page.goto("/monitoramento");
  await page.waitForLoadState("domcontentloaded");

  if (page.url().includes("/acesso-antecipado/dados")) {
    throw new Error(
      "Cadastro incompleto — rode o bootstrap E2E (npx playwright test --project=bootstrap-e2e).",
    );
  }

  await page.context().storageState({ path: authFile });
  expect(fs.existsSync(authFile)).toBeTruthy();
});
