import { NextResponse } from "next/server";

import { listAuditLogsForOwner } from "@/lib/audit/query";
import { apiRoute } from "@/lib/auth/api-route";
import { getStorageOwnerUserId } from "@/lib/storage-context";

export async function GET(request: Request) {
  return apiRoute(async () => {
    const ownerUserId = getStorageOwnerUserId()?.trim();
    if (!ownerUserId) {
      return NextResponse.json({ message: "Nao autenticado." }, { status: 401 });
    }

    const url = new URL(request.url);
    const limitRaw = Number(url.searchParams.get("limit") ?? "50");
    const limit = Number.isFinite(limitRaw) ? limitRaw : 50;
    const action = url.searchParams.get("action");
    const cursor = url.searchParams.get("cursor");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    const result = await listAuditLogsForOwner({
      ownerUserId,
      limit,
      action,
      cursor,
      from,
      to,
    });

    return NextResponse.json(result);
  });
}
