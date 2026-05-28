/**
 * Remove avatares privados do workspace Argil (nao remove biblioteca publica).
 *
 * Uso (chave local — app.argil.ai → Developers):
 *   ARGIL_API_KEY=sua_chave node scripts/argil-delete-private-avatars.mjs --confirm
 *   ARGIL_API_KEY=sua_chave node scripts/argil-delete-private-avatars.mjs --dry-run
 *
 * Uso (producao, sem expor ARGIL_API_KEY — usa SUPABASE_SERVICE_ROLE_KEY do .env.local):
 *   node scripts/argil-delete-private-avatars.mjs --via-api --dry-run
 *   node scripts/argil-delete-private-avatars.mjs --via-api --confirm
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      continue;
    }

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env) || !String(process.env[key] ?? "").trim()) {
      process.env[key] = value;
    }
  }
}

for (const file of [".env.local", ".env"]) {
  loadEnvFile(resolve(process.cwd(), file));
}

const baseUrl = (process.env.ARGIL_BASE_URL || "https://api.argil.ai/v1").replace(/\/$/, "");
const apiKey = (process.env.ARGIL_API_KEY || "").trim();
const viaApi = process.argv.includes("--via-api");
const appBaseUrl = (
  process.env.APP_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_BASE_URL ||
  "https://mandatodigital.vercel.app"
).replace(/\/$/, "");
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const confirmed = args.has("--confirm");

if (!viaApi && !apiKey) {
  console.error(
    "Defina ARGIL_API_KEY (app.argil.ai → Developers) ou use --via-api com SUPABASE_SERVICE_ROLE_KEY no .env.local.",
  );
  process.exit(1);
}

if (!dryRun && !confirmed) {
  console.error("Use --dry-run para listar ou --confirm para apagar de verdade.");
  process.exit(1);
}

async function purgeViaProductionApi() {
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente no .env.local para --via-api.");
  }

  const path = dryRun ? "GET" : "POST";
  const url = `${appBaseUrl}/api/argil/avatars/purge-service`;
  const init =
    path === "GET"
      ? { method: "GET" }
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirm: true }),
        };

  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!response.ok) {
    throw new Error(
      `Purge via API falhou (${response.status}): ${json?.message ?? text}`,
    );
  }

  return json;
}

async function argilFetch(path, init) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      ...(init?.headers ?? {}),
    },
  });

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return { response, text, json };
}

async function listPrivateAvatars() {
  const { response, json, text } = await argilFetch("/avatars?visibility=private");
  if (!response.ok) {
    throw new Error(`Listar avatares falhou (${response.status}): ${text}`);
  }

  return Array.isArray(json) ? json : [];
}

async function deleteAvatar(id) {
  const attempts = [
    { method: "DELETE", path: `/avatars/${id}` },
    { method: "POST", path: `/avatars/${id}/delete`, body: {} },
  ];

  for (const attempt of attempts) {
    const { response, text } = await argilFetch(attempt.path, {
      method: attempt.method,
      body: attempt.body ? JSON.stringify(attempt.body) : undefined,
    });

    if (response.ok || response.status === 204) {
      return { ok: true, method: `${attempt.method} ${attempt.path}` };
    }

    if (response.status !== 404 && response.status !== 405) {
      return { ok: false, method: `${attempt.method} ${attempt.path}`, status: response.status, text };
    }
  }

  return { ok: false, method: "nenhum endpoint aceito", status: 0, text: "" };
}

async function main() {
  if (viaApi) {
    const result = await purgeViaProductionApi();
    if (dryRun) {
      console.log(`Avatares privados (producao): ${result.privateCount ?? 0}`);
      for (const avatar of result.privateAvatars ?? []) {
        console.log(`- ${avatar.id} | ${avatar.status ?? "?"} | ${avatar.name ?? "(sem nome)"}`);
      }
      return;
    }

    console.log(`Antes: ${result.before} | Apagados: ${result.deleted} | Falhas: ${result.failed} | Restantes: ${result.after}`);
    console.log(result.message ?? "");
    for (const row of result.results ?? []) {
      console.log(
        row.ok
          ? `OK apagado: ${row.id} (${row.method ?? "?"})`
          : `FALHA ${row.id}: status=${row.status ?? "?"}`,
      );
    }

    if ((result.failed ?? 0) > 0) {
      process.exitCode = 1;
    }
    return;
  }

  const before = await listPrivateAvatars();
  console.log(`Avatares privados encontrados: ${before.length}`);
  for (const avatar of before) {
    console.log(`- ${avatar.id} | ${avatar.status ?? "?"} | ${avatar.name ?? "(sem nome)"}`);
  }

  if (dryRun) {
    return;
  }

  let deleted = 0;
  let failed = 0;

  for (const avatar of before) {
    const result = await deleteAvatar(avatar.id);
    if (result.ok) {
      deleted += 1;
      console.log(`OK apagado: ${avatar.id} (${result.method})`);
    } else {
      failed += 1;
      console.log(
        `FALHA ${avatar.id}: ${result.method} status=${result.status} ${result.text.slice(0, 120)}`,
      );
    }
  }

  const after = await listPrivateAvatars();
  console.log("");
  console.log(`Apagados: ${deleted} | Falhas: ${failed} | Restantes: ${after.length}`);

  if (failed > 0) {
    console.log("");
    console.log(
      "A Argil nao expoe DELETE de avatar na documentacao. Apague os restantes em app.argil.ai/avatars (menu ... em cada card).",
    );
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
