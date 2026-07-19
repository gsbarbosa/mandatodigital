import { NextResponse } from "next/server";

/** Compliance PDFs vivem no Firebase Storage (signed URLs). Rota local removida. */
export async function GET() {
  return NextResponse.json(
    { message: "Arquivos de compliance usam Firebase Storage (URL assinada)." },
    { status: 410 },
  );
}
