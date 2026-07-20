import { NextResponse } from "next/server";
import { z } from "zod";

import { auditorStorage } from "@/lib/auditor-storage";
import { apiRoute } from "@/lib/auth/api-route";
import { handleRouteError } from "@/lib/api";
import { EXPORT_COMPLIANCE_CONSENT_VERSION } from "@/lib/creative-ai-metadata";
import {
  extractClientIp,
  extractUserAgent,
} from "@/lib/legal/request-meta";

const bodySchema = z.object({
  mediaId: z.string().min(1),
  mediaUrl: z.string().min(1).optional(),
  liabilityAccepted: z.literal(true),
  projectId: z.string().optional(),
  profileId: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    return await apiRoute(async (repository) => {
      const body = bodySchema.parse(await request.json());
      const dashboard = await repository.getDashboard();
      const profileId = body.profileId ?? dashboard.profile?.id ?? null;

      await auditorStorage.appendAuditLog({
        profileId,
        projectId: body.projectId ?? null,
        eventType: "manual_export",
        consentTextVersion: EXPORT_COMPLIANCE_CONSENT_VERSION,
        request,
        payload: {
          media_id: body.mediaId,
          media_url: body.mediaUrl ?? null,
          liability_accepted: true,
          ip: extractClientIp(request),
          userAgent: extractUserAgent(request),
        },
      });

      return NextResponse.json({ ok: true });
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
