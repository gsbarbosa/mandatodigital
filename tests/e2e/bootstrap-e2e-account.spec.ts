/**
 * Cria conta E2E + completa cadastro + grava playwright/.auth/user.json.
 *
 * Fluxo (cadastro completo obrigatório após login):
 * 1) Cria usuário no Firebase Auth via Admin SDK
 * 2) Obtém idToken via Identity Toolkit e grava cookie de sessão
 * 3) Completa cadastro via POST /api/user/registration
 * 4) Abre /monitoramento e salva storageState + cookie premium
 *
 * Uso: npm run test:e2e:bootstrap
 */
import fs from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

import {
  DEV_ACCOUNT_MODE_COOKIE,
  E2E_ACCOUNT_EMAIL_DOMAIN,
} from "../../src/lib/dev-account-mode";

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

function readFirebaseServiceAccount() {
  const fromEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (fromEnv) {
    try {
      return JSON.parse(fromEnv);
    } catch {
      // continua
    }
  }
  const line = fs
    .readFileSync(path.join(process.cwd(), ".env.local"), "utf8")
    .split("\n")
    .find((row) => row.startsWith("FIREBASE_SERVICE_ACCOUNT_JSON="));
  if (!line) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON ausente");
  }
  let value = line.slice("FIREBASE_SERVICE_ACCOUNT_JSON=".length);
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = JSON.parse(value);
  }
  return typeof value === "string" ? JSON.parse(value) : value;
}

function calcCpfDigit(base: string, factor: number) {
  let sum = 0;
  for (let i = 0; i < base.length; i += 1) {
    sum += Number(base[i]) * (factor - i);
  }
  const mod = (sum * 10) % 11;
  return mod === 10 ? 0 : mod;
}

/** CPF válido e único o bastante para não colidir no Firestore em runs locais. */
function buildValidCpf() {
  const seed = String(Date.now()).padStart(9, "0").slice(-9);
  // Evita sequência repetida (111... / 000...).
  const base = seed === "000000000" || /^(\d)\1{8}$/.test(seed) ? "529982247" : seed;
  const d1 = calcCpfDigit(base, 10);
  const d2 = calcCpfDigit(`${base}${d1}`, 11);
  return `${base}${d1}${d2}`;
}

function buildCredentials() {
  const stamp = Date.now().toString(36);
  return {
    email: `e2e.${stamp}@${E2E_ACCOUNT_EMAIL_DOMAIN}`,
    password: `E2eTest!${stamp.slice(-6)}aA1`,
    cpf: buildValidCpf(),
  };
}

async function createFirebaseUser(email: string, password: string) {
  loadEnvLocal();
  if (!getApps().length) {
    initializeApp({ credential: cert(readFirebaseServiceAccount()) });
  }
  const auth = getAuth();
  try {
    await auth.createUser({ email, password, emailVerified: true });
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "";
    if (code !== "auth/email-already-exists") {
      throw error;
    }
  }
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

test("bootstrap conta E2E e salva storageState", async ({ page, context }) => {
  test.setTimeout(180_000);
  fs.mkdirSync(authDir, { recursive: true });

  const credentials = buildCredentials();
  await createFirebaseUser(credentials.email, credentials.password);
  const idToken = await fetchIdToken(credentials.email, credentials.password);

  const sessionResponse = await page.request.post("/api/auth/session", {
    data: { idToken },
  });
  expect(sessionResponse.status(), await sessionResponse.text()).toBe(200);

  const registrationResponse = await page.request.post("/api/user/registration", {
    data: {
      fullName: "E2E Sentinela Autotest",
      party: "NOVO",
      cpf: credentials.cpf,
      uf: "MG",
      role: "Deputado Estadual",
      address: "Rua Autotest 100, Centro, Belo Horizonte - MG, 30130-000",
      phone: "(31) 99999-0001",
      email: credentials.email,
      teamEmail: "",
      teamPhone: "",
      planId: "avancado",
    },
  });
  expect(
    [200, 201],
    await registrationResponse.text(),
  ).toContain(registrationResponse.status());

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

  if (page.url().includes("/acesso-antecipado") || page.url().includes("/login")) {
    throw new Error(`Cadastro/sessao nao liberou o produto — URL: ${page.url()}`);
  }

  await expect(page.getByTestId("monitoramento-page")).toBeVisible({ timeout: 60_000 });

  await context.storageState({ path: authFile });
  fs.writeFileSync(
    credsFile,
    JSON.stringify(
      {
        email: credentials.email,
        password: credentials.password,
        cpf: credentials.cpf,
      },
      null,
      2,
    ),
  );

  console.log(`E2E account pronta: ${credentials.email}`);
  expect(fs.existsSync(authFile)).toBeTruthy();
});
