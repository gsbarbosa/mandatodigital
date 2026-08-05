import type { EarlyAccessPlanId } from "@/lib/early-access-types";

/** Status de cobrança do pacote campanha (valor único em 3x). */
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

/** Conta interna: boleto de R$ 5,00 (mínimo Asaas boleto) para smoke de pagamento + NFS-e. */
export const BILLING_SMOKE_TEST_EMAILS = ["gsbarbosa180@gmail.com"] as const;
export const BILLING_SMOKE_TEST_VALUE = 5;

export function isBillingSmokeTestEmail(email: string | null | undefined): boolean {
  const normalized = String(email ?? "")
    .trim()
    .toLowerCase();
  return (BILLING_SMOKE_TEST_EMAILS as readonly string[]).includes(normalized);
}

export type CheckoutPricing = PlanPricing & { smokeTest: boolean };

/** Pricing efetivo do checkout — smoke override só por e-mail allowlist no server. */
export function resolveCheckoutPricing(
  planId: EarlyAccessPlanId,
  email: string | null | undefined,
): CheckoutPricing {
  const base = getPlanPricing(planId);
  if (!isBillingSmokeTestEmail(email)) {
    return { ...base, smokeTest: false };
  }
  return {
    ...base,
    installmentValue: BILLING_SMOKE_TEST_VALUE,
    installmentCount: 1,
    campaignTotal: BILLING_SMOKE_TEST_VALUE,
    smokeTest: true,
  };
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

export function asaasTodayInSaoPaulo(from = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(from);
}

/** Data YYYY-MM-DD em America/Sao_Paulo + N dias. */
export function asaasDatePlusDays(days: number, from = new Date()): string {
  const [year, month, day] = asaasTodayInSaoPaulo(from).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

/** Soma meses civis sem pular para o mês seguinte em dias 29–31. */
export function addCalendarMonths(ymd: string, months: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const totalMonths = month - 1 + months;
  const nextYear = year + Math.floor(totalMonths / 12);
  const monthIndex = ((totalMonths % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(nextYear, monthIndex + 1, 0)).getUTCDate();
  const clampedDay = Math.min(day, lastDay);
  return `${nextYear}-${String(monthIndex + 1).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
}

export type PlannedInstallment = {
  number: number;
  dueDate: string;
};

/** Agenda relativa: 1ª = firstDue, 2ª = +1 mês, 3ª = +2 meses. */
export function buildInstallmentSchedule(
  firstDueDate: string,
  count = 3,
): PlannedInstallment[] {
  const safeCount = Math.max(1, count);
  return Array.from({ length: safeCount }, (_, index) => ({
    number: index + 1,
    dueDate: addCalendarMonths(firstDueDate, index),
  }));
}

/** Último vencimento do pacote 3x (1ª + 2 meses). */
export function subscriptionEndDateFromFirstDue(nextDueDate: string): string {
  return addCalendarMonths(nextDueDate, 2);
}
