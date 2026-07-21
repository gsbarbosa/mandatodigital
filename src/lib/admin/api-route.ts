import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AdminAuthError, requireAdminSession } from "@/lib/admin/session";

export async function adminApiRoute<T>(
  handler: () => Promise<T | NextResponse>,
): Promise<NextResponse> {
  try {
    await requireAdminSession();
    const result = await handler();
    if (result instanceof NextResponse) {
      return result;
    }
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ message: error.message }, { status: 401 });
    }
    if (error instanceof ZodError) {
      return NextResponse.json({ message: "Dados inválidos.", issues: error.issues }, { status: 400 });
    }
    console.error("[adminApiRoute]", error);
    const message = error instanceof Error ? error.message : "Erro interno.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
