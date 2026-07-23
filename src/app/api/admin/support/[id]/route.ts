import { NextResponse } from "next/server";
import { z } from "zod";

import { adminApiRoute } from "@/lib/admin/api-route";
import { adminReplyToSupportThread } from "@/lib/support/service";
import { getSupportThreadWithMessages } from "@/lib/support/storage";

const replySchema = z.object({
  body: z.string().trim().min(1).max(4000),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  return adminApiRoute(async () => {
    const { id } = await context.params;
    const thread = await getSupportThreadWithMessages(id);
    if (!thread) {
      return NextResponse.json(
        { message: "Atendimento não encontrado." },
        { status: 404 },
      );
    }
    return { thread };
  });
}

export async function POST(request: Request, context: RouteContext) {
  return adminApiRoute(async () => {
    const { id } = await context.params;
    const payload = replySchema.parse(await request.json());
    const thread = await adminReplyToSupportThread({
      threadId: id,
      body: payload.body,
    });
    return { thread };
  });
}
