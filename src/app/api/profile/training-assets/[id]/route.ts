import { NextResponse } from "next/server";

import { apiRoute } from "@/lib/auth/api-route";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return apiRoute(async (repository) => {
    const params = await context.params;
    const id = String(params.id ?? "").trim();

    if (!id) {
      return NextResponse.json({ message: "Asset id ausente." }, { status: 400 });
    }

    const asset = await repository.getTrainingAssetById(id);
    if (!asset) {
      return NextResponse.json({ message: "Arquivo de treino não encontrado." }, { status: 404 });
    }

    await repository.deleteTrainingAsset(id);

    return NextResponse.json({
      id,
      message: "Arquivo de treino removido.",
    });
  });
}
