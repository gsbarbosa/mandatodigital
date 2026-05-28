import { NextResponse } from "next/server";

import { apiRoute } from "@/lib/auth/api-route";

const baseUrl = (process.env.ARGIL_BASE_URL || "https://api.argil.ai/v1").replace(/\/$/, "");

type ArgilAvatarRow = {
  id: string;
  name?: string;
  status?: string;
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

async function listPrivateAvatars() {
  const { response, json, text } = await argilFetch("/avatars?visibility=private");
  if (!response.ok) {
    throw new Error(`Listar avatares falhou (${response.status}): ${text}`);
  }

  return Array.isArray(json) ? (json as ArgilAvatarRow[]) : [];
}

async function deleteAvatar(id: string) {
  const { response, text } = await argilFetch(`/avatars/${id}`, { method: "DELETE" });
  if (response.ok || response.status === 204) {
    return { ok: true as const };
  }

  return { ok: false as const, status: response.status, text };
}

export async function POST(request: Request) {
  return apiRoute(async (repository) => {
    const body = (await request.json().catch(() => ({}))) as { confirm?: boolean };
    if (!body.confirm) {
      return NextResponse.json(
        { message: "Envie { \"confirm\": true } para apagar avatares privados." },
        { status: 400 },
      );
    }

    const before = await listPrivateAvatars();
    const results: Array<{ id: string; name?: string; ok: boolean; status?: number }> = [];

    for (const avatar of before) {
      const result = await deleteAvatar(avatar.id);
      results.push({
        id: avatar.id,
        name: avatar.name,
        ok: result.ok,
        status: result.ok ? undefined : result.status,
      });
    }

    const after = await listPrivateAvatars();
    const deleted = results.filter((item) => item.ok).length;

    if (deleted > 0) {
      const dashboard = await repository.getDashboard();
      if (dashboard.profile?.id) {
        await repository.updateProfileArgilTraining(dashboard.profile.id, {
          argilAvatarId: "",
          argilVoiceId: "",
          avatarTrainingStatus: "NOT_TRAINED",
        });
      }
    }

    return NextResponse.json({
      before: before.length,
      after: after.length,
      deleted,
      failed: results.length - deleted,
      results,
      message:
        after.length === 0
          ? "Todos os avatares privados foram removidos."
          : "Alguns avatares nao puderam ser apagados via API. Remova o restante em app.argil.ai/avatars.",
    });
  });
}

export async function GET() {
  return apiRoute(async () => {
    const privateAvatars = await listPrivateAvatars();
    const all = await argilFetch("/avatars");
    const allCount = Array.isArray(all.json) ? all.json.length : 0;

    return NextResponse.json({
      privateCount: privateAvatars.length,
      totalListed: allCount,
      privateAvatars: privateAvatars.map((avatar) => ({
        id: avatar.id,
        name: avatar.name,
        status: avatar.status,
      })),
    });
  });
}
