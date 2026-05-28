/**
 * Remove avatares privados do workspace Argil (nao remove biblioteca publica).
 *
 * Uso:
 *   ARGIL_API_KEY=sua_chave node scripts/argil-delete-private-avatars.mjs --confirm
 *   ARGIL_API_KEY=sua_chave node scripts/argil-delete-private-avatars.mjs --dry-run
 */

const baseUrl = (process.env.ARGIL_BASE_URL || "https://api.argil.ai/v1").replace(/\/$/, "");
const apiKey = (process.env.ARGIL_API_KEY || "").trim();
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const confirmed = args.has("--confirm");

if (!apiKey) {
  console.error("Defina ARGIL_API_KEY (mesma da Vercel / Developers no app.argil.ai).");
  process.exit(1);
}

if (!dryRun && !confirmed) {
  console.error("Use --dry-run para listar ou --confirm para apagar de verdade.");
  process.exit(1);
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
