import { NextResponse } from "next/server";
import { z } from "zod";

import { adminApiRoute } from "@/lib/admin/api-route";
import { deleteRoadmapTask, updateRoadmapTask } from "@/lib/admin/roadmap-storage";
import { ROADMAP_SECTIONS, ROADMAP_STATUSES, ROADMAP_VALIDATED } from "@/lib/admin/roadmap-types";

const patchSchema = z.object({
  title: z.string().min(2).max(240).optional(),
  status: z.enum(ROADMAP_STATUSES).optional(),
  validatedByThiago: z.enum(ROADMAP_VALIDATED).optional(),
  observation: z.string().max(2000).optional(),
  section: z.enum(ROADMAP_SECTIONS).optional(),
  sortOrder: z.number().int().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  return adminApiRoute(async () => {
    const { id } = await context.params;
    const body = patchSchema.parse(await request.json());
    const task = await updateRoadmapTask(id, body);
    return { task };
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  return adminApiRoute(async () => {
    const { id } = await context.params;
    await deleteRoadmapTask(id);
    return NextResponse.json({ ok: true });
  });
}
