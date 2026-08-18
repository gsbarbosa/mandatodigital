import { NextResponse } from "next/server";
import { z } from "zod";

import { adminApiRoute } from "@/lib/admin/api-route";
import { setAgentPaused } from "@/lib/outbound/conversations-storage";

const bodySchema = z.object({ paused: z.boolean() });

type RouteContext = { params: Promise<{ id: string }> };

/** Assumir a conversa: a IA só sugere no painel e nunca envia sozinha. */
export async function POST(request: Request, context: RouteContext) {
  return adminApiRoute(async () => {
    const { id } = await context.params;
    const { paused } = bodySchema.parse(await request.json());
    await setAgentPaused(id, paused);
    return NextResponse.json({ ok: true, paused });
  });
}
