/** Limites de duração/roteiro por plano pago (e essencial como default). */

/** ~words for target duration (≈ 2.3 words/sec spoken BR). */
export function maxScriptWordsForPlan(planId: string | null | undefined): number {
  switch (planId) {
    case "elite":
      return 420; // ~3 min
    case "avancado":
      return 210; // ~90 s
    case "essencial":
    default:
      return 140; // ~1 min
  }
}

export function maxVideoSecondsLabelForPlan(planId: string | null | undefined): string {
  switch (planId) {
    case "elite":
      return "até 3 minutos";
    case "avancado":
      return "até 90 segundos";
    default:
      return "até 1 minuto";
  }
}
