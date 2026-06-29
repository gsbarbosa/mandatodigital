import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api";
import { heygenApiRoute } from "@/lib/heygen-api-route";
import { resolveHeyGenAvatarConsentLink } from "@/lib/heygen-consent-resolve";
import { resolveAppBaseUrl } from "@/lib/training-asset-urls";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    return heygenApiRoute(request, async () => {
      const params = await context.params;
      const groupId = String(params.id ?? "").trim();
      if (!groupId) {
        return NextResponse.json({ message: "group_id ausente." }, { status: 400 });
      }

      const body = (await request.json().catch(() => ({}))) as {
        consentStatus?: string | null;
      };

      const appBaseUrl = resolveAppBaseUrl(request);
      const resolved = await resolveHeyGenAvatarConsentLink({
        groupId,
        consentStatus: body.consentStatus ?? null,
        rerouteUrl: appBaseUrl.startsWith("https://")
          ? `${appBaseUrl}/curador`
          : undefined,
      });

      return NextResponse.json({
        consentUrl: resolved.consentUrl,
        consentStatus: resolved.consentStatus,
        needsConsent: resolved.needsConsent,
        message: resolved.needsConsent
          ? resolved.consentUrl
            ? "Finalize o consentimento no link abaixo."
            : "Consentimento pendente na plataforma. Use Refazer gêmeo digital se o link não aparecer."
          : "Consentimento já concluído para este gêmeo.",
      });
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
