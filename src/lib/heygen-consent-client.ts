import { fetchHeygenApi } from "@/lib/heygen-client-override";

export type HeyGenConsentLinkPayload = {
  consentUrl?: string | null;
  consentStatus?: string | null;
  needsConsent?: boolean;
  message?: string;
};

export async function fetchHeyGenConsentLink(input: {
  groupId: string;
  consentStatus?: string | null;
}): Promise<HeyGenConsentLinkPayload> {
  const groupId = input.groupId.trim();
  if (!groupId) {
    return { needsConsent: false };
  }

  const response = await fetchHeygenApi(
    `/api/heygen/avatars/groups/${encodeURIComponent(groupId)}/consent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        consentStatus: input.consentStatus ?? null,
      }),
    },
  );

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? ((await response.json()) as HeyGenConsentLinkPayload & { message?: string })
    : ({ message: await response.text() } as HeyGenConsentLinkPayload & {
        message?: string;
      });

  if (!response.ok) {
    throw new Error(payload.message || "Não foi possível obter o link de consentimento.");
  }

  return payload;
}
