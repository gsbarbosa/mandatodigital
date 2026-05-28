const baseUrl = (process.env.ARGIL_BASE_URL || "https://api.argil.ai/v1").replace(/\/$/, "");

export type ArgilAvatarRow = {
  id: string;
  name?: string;
  status?: string;
};

export type ArgilAvatarPurgeResult = {
  before: number;
  after: number;
  deleted: number;
  failed: number;
  results: Array<{ id: string; name?: string; ok: boolean; status?: number; method?: string }>;
  message: string;
};

async function argilFetch(path: string, init?: RequestInit) {
  const apiKey = process.env.ARGIL_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("ARGIL_API_KEY nao configurada no servidor.");
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      ...(init?.headers ?? {}),
    },
  });

  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return { response, text, json };
}

export async function listPrivateArgilAvatars() {
  const { response, json, text } = await argilFetch("/avatars?visibility=private");
  if (!response.ok) {
    throw new Error(`Listar avatares falhou (${response.status}): ${text}`);
  }

  return Array.isArray(json) ? (json as ArgilAvatarRow[]) : [];
}

async function deleteArgilAvatar(id: string) {
  const attempts = [
    { method: "DELETE" as const, path: `/avatars/${id}` },
    { method: "POST" as const, path: `/avatars/${id}/delete`, body: {} },
  ];

  for (const attempt of attempts) {
    const { response, text } = await argilFetch(attempt.path, {
      method: attempt.method,
      body: attempt.body ? JSON.stringify(attempt.body) : undefined,
    });

    if (response.ok || response.status === 204) {
      return { ok: true as const, method: `${attempt.method} ${attempt.path}` };
    }

    if (response.status !== 404 && response.status !== 405) {
      return {
        ok: false as const,
        method: `${attempt.method} ${attempt.path}`,
        status: response.status,
        text,
      };
    }
  }

  return { ok: false as const, method: "nenhum endpoint aceito", status: 0, text: "" };
}

export async function purgePrivateArgilAvatars(): Promise<ArgilAvatarPurgeResult> {
  const before = await listPrivateArgilAvatars();
  const results: ArgilAvatarPurgeResult["results"] = [];

  for (const avatar of before) {
    const result = await deleteArgilAvatar(avatar.id);
    results.push({
      id: avatar.id,
      name: avatar.name,
      ok: result.ok,
      status: result.ok ? undefined : result.status,
      method: result.method,
    });
  }

  const after = await listPrivateArgilAvatars();
  const deleted = results.filter((item) => item.ok).length;

  return {
    before: before.length,
    after: after.length,
    deleted,
    failed: results.length - deleted,
    results,
    message:
      after.length === 0
        ? "Todos os avatares privados foram removidos."
        : "Alguns avatares nao puderam ser apagados via API. Remova o restante em app.argil.ai/avatars.",
  };
}
