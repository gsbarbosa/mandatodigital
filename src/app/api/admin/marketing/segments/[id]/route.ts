import { NextResponse } from "next/server";
import { z } from "zod";

import { adminApiRoute } from "@/lib/admin/api-route";
import { segmentFilterSchema } from "@/lib/outbound/schemas";
import { coerceSegmentFilter } from "@/lib/outbound/segment-filter";
import { deleteMarketingSegment, updateMarketingSegment } from "@/lib/outbound/segments-storage";

const patchSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(500).optional(),
  filter: segmentFilterSchema.optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  return adminApiRoute(async () => {
    const { id } = await context.params;
    const body = patchSchema.parse(await request.json());
    const segment = await updateMarketingSegment(id, {
      name: body.name,
      description: body.description,
      filter: body.filter ? coerceSegmentFilter(body.filter) : undefined,
    });
    return { segment };
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  return adminApiRoute(async () => {
    const { id } = await context.params;
    await deleteMarketingSegment(id);
    return NextResponse.json({ ok: true });
  });
}
