import { formatHeyGenPurgeFailureMessage } from "@/lib/curador-heygen-prefs";
import type { TwinLookDisplayMeta } from "@/lib/heygen-twin-display";

export type RemoteAvatarGroupDeleteResult = {
  deleted: string[];
  errors: Array<{ groupId: string; message: string }>;
  message: string;
};

export function resolveActiveTwinGroupId(input: {
  heygenAvatarGroupId?: string;
  selectedTwinLook?: TwinLookDisplayMeta | null;
  linkedTwinLook?: TwinLookDisplayMeta | null;
}) {
  return (
    input.heygenAvatarGroupId?.trim() ||
    String(input.selectedTwinLook?.group_id ?? "").trim() ||
    String(input.linkedTwinLook?.group_id ?? "").trim()
  );
}

async function parseResponsePayload<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) {
    return {} as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return { message: text } as T;
  }
}

export async function performRemoteTwinGroupDelete(
  fetchApi: (input: string, init?: RequestInit) => Promise<Response>,
  groupId: string,
): Promise<RemoteAvatarGroupDeleteResult> {
  const normalizedGroupId = groupId.trim();
  if (!normalizedGroupId) {
    throw new Error("Não foi possível identificar o personagem remoto para remover.");
  }

  const response = await fetchApi(
    `/api/heygen/avatars/groups/${encodeURIComponent(normalizedGroupId)}`,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: true }),
    },
  );

  const payload = await parseResponsePayload<{
    message?: string;
    deletedGroupId?: string;
  }>(response);

  if (!response.ok) {
    throw new Error(
      formatHeyGenPurgeFailureMessage(
        [{ groupId: normalizedGroupId, message: payload.message?.trim() || "" }],
        payload.message || "Não foi possível remover o personagem na plataforma.",
      ),
    );
  }

  const deletedGroupId = payload.deletedGroupId?.trim() || normalizedGroupId;

  return {
    deleted: [deletedGroupId],
    errors: [],
    message:
      payload.message?.trim() ||
      'Personagem removido. Clique em "Gerar Gêmeo Digital" para treinar o novo Gêmeo.',
  };
}
