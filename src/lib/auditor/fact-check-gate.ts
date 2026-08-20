import type { FactCheckResult } from "@/lib/auditor/types";
import { isFactCheckHeuristicFallback } from "@/lib/auditor/types";

export type FactCheckApprovalDecision = { ok: true } | { ok: false; message: string };

const UNPROVEN_MESSAGE =
  "Há afirmações que não puderam ser comprovadas nas fontes. Corrija o roteiro ou adicione uma fonte antes de aprovar.";

/** Eleva verified → disputed/inconclusive quando algum claim não tem suporte. */
export function normalizeFactCheckVerdict<T extends Pick<FactCheckResult, "verdict" | "claims">>(
  result: T,
): T {
  const hasContradicted = result.claims.some((claim) => claim.verdict === "contradicted");
  const hasUnsupported = result.claims.some((claim) => claim.verdict === "unsupported");
  if (result.verdict !== "verified") {
    return result;
  }
  if (hasContradicted) {
    return { ...result, verdict: "disputed" };
  }
  if (hasUnsupported) {
    return { ...result, verdict: "inconclusive" };
  }
  return result;
}

/**
 * Gate de aprovação do roteiro. Fail-closed para contradição, fato checável
 * sem fonte e fallback da LLM. Opinião/proposta de campanha (inconclusive
 * sem claims unproven) não bloqueia — o validador não tem o que checar.
 * Prompt livre (skipped) não passa por aqui.
 */
export function evaluateFactCheckForApproval(result: FactCheckResult): FactCheckApprovalDecision {
  if (isFactCheckHeuristicFallback(result)) {
    return {
      ok: false,
      message:
        "Não foi possível validar automaticamente. Tente novamente ou adicione uma fonte antes de aprovar.",
    };
  }

  if (result.verdict === "skipped") {
    return {
      ok: false,
      message: "A validação factual não foi aplicada. Não é possível aprovar o roteiro.",
    };
  }

  const unproven = result.claims.filter(
    (claim) => claim.verdict === "unsupported" || claim.verdict === "contradicted",
  );

  if (result.verdict === "disputed" || unproven.length > 0) {
    return {
      ok: false,
      message: result.summary.trim() || UNPROVEN_MESSAGE,
    };
  }

  return { ok: true };
}
