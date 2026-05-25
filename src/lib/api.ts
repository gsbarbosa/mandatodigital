import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function handleRouteError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        message: "Falha de validacao.",
        issues: error.flatten(),
      },
      { status: 400 },
    );
  }

  const message =
    error instanceof Error ? error.message : "Erro interno inesperado.";

  return NextResponse.json({ message }, { status: 500 });
}
