import type { EarlyAccessPlanId } from "@/lib/early-access-types";

/** Status de cobrança do pacote campanha (Asaas boleto). */
export type BillingStatus =
  | "trial"
  | "pending_payment"
  | "active"
  | "past_due"
  | "canceled";

export type PlanPricing = {
  planId: EarlyAccessPlanId;
  /** Valor de cada parcela em BRL (reais). */
  installmentValue: number;
  installmentCount: number;
  /** Total do pacote em BRL. */
  campaignTotal: number;
  label: string;
};

/** Pacote campanha: 3 boletos mensais (TSE / CNPJ da campanha). */
export const PLAN_PRICING: Record<EarlyAccessPlanId, PlanPricing> = {
  essencial: {
    planId: "essencial",
    installmentValue: 998,
    installmentCount: 3,
    campaignTotal: 2994,
    label: "Essencial",
  },
  avancado: {
    planId: "avancado",
    installmentValue: 1998,
    installmentCount: 3,
    campaignTotal: 5994,
    label: "Avançado",
  },
  elite: {
    planId: "elite",
    installmentValue: 4998,
    installmentCount: 3,
    campaignTotal: 14994,
    label: "Elite",
  },
};

export function getPlanPricing(planId: EarlyAccessPlanId): PlanPricing {
  return PLAN_PRICING[planId];
}

export function formatBrl(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function parseBillingStatus(value: unknown): BillingStatus {
  if (
    value === "trial" ||
    value === "pending_payment" ||
    value === "active" ||
    value === "past_due" ||
    value === "canceled"
  ) {
    return value;
  }
  return "trial";
}

/** Data YYYY-MM-DD em America/Sao_Paulo + N dias. */
export function asaasDatePlusDays(days: number, from = new Date()): string {
  const d = new Date(from.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** endDate da assinatura para ~3 ciclos mensais a partir de nextDueDate. */
export function subscriptionEndDateFromFirstDue(nextDueDate: string): string {
  const [y, m, day] = nextDueDate.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, day));
  d.setUTCMonth(d.getUTCMonth() + 2);
  return d.toISOString().slice(0, 10);
}
