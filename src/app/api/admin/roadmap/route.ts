import { NextResponse } from "next/server";
import { z } from "zod";

import { adminApiRoute } from "@/lib/admin/api-route";
import { createRoadmapTask, listRoadmapTasks } from "@/lib/admin/roadmap-storage";
import { ROADMAP_SECTIONS, ROADMAP_STATUSES, ROADMAP_VALIDATED } from "@/lib/admin/roadmap-types";

const createSchema = z.object({
  title: z.string().min(2).max(240),
  status: z.enum(ROADMAP_STATUSES).optional(),
  validatedByThiago: z.enum(ROADMAP_VALIDATED).optional(),
  observation: z.string().max(2000).optional(),
  section: z.enum(ROADMAP_SECTIONS).optional(),
});

export async function GET() {
  return adminApiRoute(async () => ({ tasks: await listRoadmapTasks() }));
}

export async function POST(request: Request) {
  return adminApiRoute(async () => {
    const body = createSchema.parse(await request.json());
    const task = await createRoadmapTask(body);
    return NextResponse.json({ task }, { status: 201 });
  });
}
