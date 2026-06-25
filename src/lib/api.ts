import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { sanitizeProviderFacingMessage } from "@/lib/curador-heygen-prefs";

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
    error instanceof Error
      ? error.message
      : error &&
          typeof error === "object" &&
          "message" in error &&
          typeof error.message === "string"
        ? error.message
        : "Erro interno inesperado.";

  return NextResponse.json(
    { message: sanitizeProviderFacingMessage(message) },
    { status: 500 },
  );
}
