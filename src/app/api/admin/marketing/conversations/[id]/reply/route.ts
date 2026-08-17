import { NextResponse } from "next/server";

import { adminApiRoute } from "@/lib/admin/api-route";
import { sendOperatorReply, OperatorReplyError } from "@/lib/outbound/operator-reply";
import { conversationReplySchema } from "@/lib/outbound/schemas";

type RouteContext = { params: Promise<{ id: string }> };

/** Operador escreve no painel e a Cloud API entrega o texto na conversa. */
export async function POST(request: Request, context: RouteContext) {
  return adminApiRoute(async () => {
    const { id } = await context.params;
    const { text } = conversationReplySchema.parse(await request.json());

    try {
      const result = await sendOperatorReply(id, text);
      return NextResponse.json({ ok: true, ...result });
    } catch (error) {
      if (error instanceof OperatorReplyError) {
        const notFound = error.message === "Conversa não encontrada.";
        return NextResponse.json({ message: error.message }, { status: notFound ? 404 : 400 });
      }
      throw error;
    }
  });
}
