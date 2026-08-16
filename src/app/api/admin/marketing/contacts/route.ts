import { NextResponse } from "next/server";

import { adminApiRoute } from "@/lib/admin/api-route";
import { listMarketingContacts, summarizeContacts } from "@/lib/outbound/contacts-storage";
import { applySegment, coerceSegmentFilter } from "@/lib/outbound/segment-filter";

/** Teto de linhas devolvidas ao painel — as contagens continuam sobre a base toda. */
const PREVIEW_LIMIT = 200;

export async function GET(request: Request) {
  return adminApiRoute(async () => {
    const url = new URL(request.url);
    const raw = url.searchParams.get("filter");

    const contacts = await listMarketingContacts();
    const stats = summarizeContacts(contacts);

    let filtered = contacts;
    if (raw) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return NextResponse.json({ message: "Filtro inválido (JSON)." }, { status: 400 });
      }
      filtered = applySegment(contacts, coerceSegmentFilter(parsed));
    }

    return {
      stats,
      matched: filtered.length,
      contacts: filtered.slice(0, PREVIEW_LIMIT),
      truncated: filtered.length > PREVIEW_LIMIT,
    };
  });
}
