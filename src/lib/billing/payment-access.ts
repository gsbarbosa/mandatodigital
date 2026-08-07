import { BILLING_PAYMENT_PATH } from "@/lib/registration-gate";

/** Rotas liberadas com plataforma travada por inadimplência / pagamento pendente. */
export const PAYMENT_LOCK_ALLOWED_PATHS = [
  BILLING_PAYMENT_PATH,
  "/acesso-antecipado/cnpj",
] as const;

export const DUE_SOON_ALERT_DAYS = 5;

export type PaymentInstallmentLike = {
  dueDate: string;
  status: "paid" | "pending" | "overdue" | "scheduled" | string;
};

export type PaymentAccessSnapshot = {
  /** Bloqueia uso da plataforma (exceto Meus pagamentos / CNPJ). */
  blocked: boolean;
  /** Alerta ≤ 5 dias do próximo boleto em aberto. */
  dueSoon: boolean;
  daysUntilNextDue: number | null;
  nextDueDate: string | null;
};

export function isBillingAccessBlocked(
  billingStatus: string | null | undefined,
): boolean {
  return billingStatus === "past_due" || billingStatus === "pending_payment";
}

export function isPaymentLockAllowedPath(pathname: string): boolean {
  const path = pathname.split("?")[0]?.split("#")[0] || pathname;
  return PAYMENT_LOCK_ALLOWED_PATHS.some(
    (allowed) => path === allowed || path.startsWith(`${allowed}/`),
  );
}

/** Dias civis até a data YYYY-MM-DD (negativo = já venceu). */
export function daysUntilDueDate(
  dueDate: string,
  now: Date = new Date(),
): number | null {
  const raw = String(dueDate ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return null;
  }
  const [y, m, d] = raw.split("-").map(Number);
  const due = new Date(y, m - 1, d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

export function resolveNextOpenDueDate(
  installments: PaymentInstallmentLike[] | null | undefined,
): string | null {
  if (!installments?.length) {
    return null;
  }
  const open = installments
    .filter((row) => row.status !== "paid")
    .map((row) => String(row.dueDate ?? "").trim().slice(0, 10))
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
    .sort();
  return open[0] ?? null;
}

export function isDueSoonAlert(
  daysUntil: number | null,
  windowDays: number = DUE_SOON_ALERT_DAYS,
): boolean {
  return daysUntil != null && daysUntil >= 0 && daysUntil <= windowDays;
}

export function resolvePaymentAccess(input: {
  billingStatus?: string | null;
  installments?: PaymentInstallmentLike[] | null;
  now?: Date;
}): PaymentAccessSnapshot {
  const blocked = isBillingAccessBlocked(input.billingStatus);
  const nextDueDate = resolveNextOpenDueDate(input.installments);
  const daysUntilNextDue = nextDueDate
    ? daysUntilDueDate(nextDueDate, input.now)
    : null;
  const dueSoon =
    Boolean(nextDueDate) &&
    isDueSoonAlert(daysUntilNextDue) &&
    (blocked || input.billingStatus === "active");

  return {
    blocked,
    dueSoon,
    daysUntilNextDue,
    nextDueDate,
  };
}
