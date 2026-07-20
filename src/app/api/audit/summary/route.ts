import { NextResponse } from "next/server";

import { buildAuditSummary } from "@/lib/audit/query";
import { apiRoute } from "@/lib/auth/api-route";
import { getStorageOwnerUserId } from "@/lib/storage-context";

function defaultFromIso() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 30);
  return date.toISOString();
}

export async function GET(request: Request) {
  return apiRoute(async (repository) => {
    const ownerUserId = getStorageOwnerUserId()?.trim();
    if (!ownerUserId) {
      return NextResponse.json({ message: "Nao autenticado." }, { status: 401 });
    }

    const url = new URL(request.url);
    const from = url.searchParams.get("from")?.trim() || defaultFromIso();
    const to = url.searchParams.get("to")?.trim() || new Date().toISOString();

    const dashboard = await repository.getDashboard();
    const summary = await buildAuditSummary({
      ownerUserId,
      profileId: dashboard.profile?.id ?? null,
      from,
      to,
    });

    return NextResponse.json({ summary });
  });
}
