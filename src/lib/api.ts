import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  formatProviderLimitHint,
  sanitizeProviderFacingMessage,
} from "@/lib/curador-heygen-prefs";

export function formatApiErrorMessage(error: unknown) {
  const raw =
    error instanceof Error
      ? error.message
      : error &&
          typeof error === "object" &&
          "message" in error &&
          typeof error.message === "string"
        ? error.message
        : "Erro interno inesperado.";

  const sanitized = sanitizeProviderFacingMessage(raw) || raw;
  const hint = formatProviderLimitHint(raw) ?? formatProviderLimitHint(sanitized);
  if (hint && !sanitized.toLowerCase().includes("limite de clones de voz")) {
    // Evita duplicar quando a mensagem já veio amigável.
    if (sanitized.toLowerCase().includes("voice clone limit") || sanitized === raw) {
      return hint;
    }
    return `${sanitized} ${hint}`.trim();
  }
  return sanitized;
}

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

  return NextResponse.json({ message: formatApiErrorMessage(error) }, { status: 500 });
}
