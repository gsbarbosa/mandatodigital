import { NextResponse } from "next/server";
import { z } from "zod";

import { adminApiRoute } from "@/lib/admin/api-route";
import { listMarketingContacts } from "@/lib/outbound/contacts-storage";
import { applySegment, coerceSegmentFilter } from "@/lib/outbound/segment-filter";
import { segmentFilterSchema } from "@/lib/outbound/schemas";
import { createMarketingSegment, listMarketingSegments } from "@/lib/outbound/segments-storage";

const createSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(500).optional(),
  filter: segmentFilterSchema,
});

export async function GET() {
  return adminApiRoute(async () => {
    const [segments, contacts] = await Promise.all([
      listMarketingSegments(),
      listMarketingContacts(),
    ]);

    // Contagem resolvida na hora: o segmento é filtro, não lista congelada.
    const withCounts = segments.map((segment) => ({
      ...segment,
      matched: applySegment(contacts, segment.filter).length,
    }));

    return { segments: withCounts };
  });
}

export async function POST(request: Request) {
  return adminApiRoute(async () => {
    const body = createSchema.parse(await request.json());
    const segment = await createMarketingSegment({
      name: body.name,
      description: body.description,
      filter: coerceSegmentFilter(body.filter),
    });
    return NextResponse.json({ segment }, { status: 201 });
  });
}
