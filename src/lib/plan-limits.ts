import { getEntitlements, parsePaidPlanId, type AccountTier } from "@/lib/account-tier";

/** Limites de duração/roteiro por plano pago (e essencial/trial como default). */

export function maxScriptWordsForTier(tier: AccountTier): number {
  return getEntitlements(tier).maxScriptWords;
}

export function maxVideoSecondsLabelForTier(tier: AccountTier): string {
  return getEntitlements(tier).maxVideoSecondsLabel;
}

/** Compat: planId sem saber se a cobrança já está active. Prefira o tier. */
export function maxScriptWordsForPlan(planId: string | null | undefined): number {
  const paid = parsePaidPlanId(planId);
  return getEntitlements(paid ?? "essencial").maxScriptWords;
}

export function maxVideoSecondsLabelForPlan(planId: string | null | undefined): string {
  const paid = parsePaidPlanId(planId);
  return getEntitlements(paid ?? "essencial").maxVideoSecondsLabel;
}
