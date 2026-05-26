import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api";
import { getRepository } from "@/lib/storage";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const report = await getRepository().getEvaluationReport(id);

    if (!report) {
      return NextResponse.json(
        { message: "Run de avaliacao nao encontrado." },
        { status: 404 },
      );
    }

    return NextResponse.json({ report });
  } catch (error) {
    return handleRouteError(error);
  }
}
