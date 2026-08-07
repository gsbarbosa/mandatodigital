import type { AsaasPayment } from "@/lib/asaas/client";
import { parsePaidPlanId } from "@/lib/account-tier";
import {
  billingMethodFromAsaas,
  type BillingMethod,
} from "@/lib/billing/billing-method";
import {
  buildInstallmentSchedule,
  getPlanPricing,
  type BillingStatus,
} from "@/lib/billing/plan-pricing";
import type { EarlyAccessPlanId } from "@/lib/early-access-types";
import {
  updateUserRegistrationBilling,
  type UserBillingUpdate,
} from "@/lib/user-registration-storage";
import type { UserRegistration } from "@/lib/user-registration-types";

export const ASAAS_PAID_STATUSES = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]);

export function isAsaasPaidStatus(status: string | null | undefined) {
  return ASAAS_PAID_STATUSES.has(String(status ?? "").trim().toUpperCase());
}

export function isAsaasOverdueStatus(status: string | null | undefined) {
  return String(status ?? "").trim().toUpperCase() === "OVERDUE";
}

export type CheckoutExternalRef = {
  ownerUserId: string | null;
  planId: EarlyAccessPlanId | null;
  method: BillingMethod | null;
  smoke: boolean;
};

/** `ownerUserId:planId:method` ou `ownerUserId:planId:smoke:method`. */
export function parseCheckoutExternalReference(
  value: string | null | undefined,
): CheckoutExternalRef {
  const parts = String(value ?? "")
    .trim()
    .split(":")
    .filter(Boolean);
  if (parts.length < 3) {
    return { ownerUserId: null, planId: null, method: null, smoke: false };
  }
  const ownerUserId = parts[0] || null;
  const planId = parsePaidPlanId(parts[1]);
  const smoke = parts[2] === "smoke";
  const methodRaw = smoke ? parts[3] : parts[2];
  const method = methodRaw === "pix" || methodRaw === "boleto" ? methodRaw : null;
  return { ownerUserId, planId, method, smoke };
}

export type BillingSyncSnapshot = {
  billingStatus: BillingStatus;
  planId: EarlyAccessPlanId | "";
  paidInstallments: number;
  lastPaidPaymentId: string | null;
  lastPaidAt: string | null;
  billingMethod: BillingMethod | null;
  asaasSubscriptionId: string | null;
};

export type AsaasPaymentLike = Pick<
  AsaasPayment,
  "id" | "status" | "dueDate" | "externalReference" | "subscription" | "billingType"
> & {
  value?: number | null;
};

function snapshotFromRegistration(registration: UserRegistration): BillingSyncSnapshot {
  return {
    billingStatus: registration.billingStatus,
    planId: registration.planId,
    paidInstallments: registration.paidInstallments || 0,
    lastPaidPaymentId: registration.lastPaidPaymentId,
    lastPaidAt: registration.lastPaidAt,
    billingMethod: registration.billingMethod,
    asaasSubscriptionId: registration.asaasSubscriptionId,
  };
}

function resolvePlanId(
  payments: AsaasPaymentLike[],
  fallback: string | null | undefined,
): EarlyAccessPlanId | "" {
  for (const payment of payments) {
    const parsed = parseCheckoutExternalReference(payment.externalReference).planId;
    if (parsed) {
      return parsed;
    }
  }
  return parsePaidPlanId(fallback) ?? "";
}

function installmentCap(planId: EarlyAccessPlanId | "") {
  return planId ? getPlanPricing(planId).installmentCount : 3;
}

export function decideBillingFromAsaasPayments(input: {
  current: BillingSyncSnapshot;
  payments: AsaasPaymentLike[];
  nowIso: string;
}): { next: BillingSyncSnapshot; clearPendingInstruments: boolean; changed: boolean } {
  if (input.current.billingStatus === "canceled") {
    return { next: input.current, clearPendingInstruments: false, changed: false };
  }

  const payments = [...input.payments].sort((a, b) =>
    String(a.dueDate ?? "").localeCompare(String(b.dueDate ?? "")),
  );
  const paid = payments.filter((payment) => isAsaasPaidStatus(payment.status));
  const overdue = payments.filter((payment) => isAsaasOverdueStatus(payment.status));
  const planId = resolvePlanId(paid.length ? paid : payments, input.current.planId) || input.current.planId;
  const cap = installmentCap(planId);
  const latestPaid = paid[paid.length - 1] ?? null;
  const lastPaidPaymentId = latestPaid?.id ?? input.current.lastPaidPaymentId;
  const lastPaidAt =
    latestPaid && latestPaid.id !== input.current.lastPaidPaymentId
      ? input.nowIso
      : input.current.lastPaidAt;
  const methodFromPayment =
    billingMethodFromAsaas(latestPaid?.billingType) ||
    parseCheckoutExternalReference(
      latestPaid?.externalReference ?? payments[0]?.externalReference,
    ).method ||
    input.current.billingMethod;
  const subscriptionId =
    String(latestPaid?.subscription ?? "").trim() ||
    String(payments.find((payment) => payment.subscription)?.subscription ?? "").trim() ||
    input.current.asaasSubscriptionId;

  let billingStatus = input.current.billingStatus;
  if (paid.length > 0 && overdue.length > 0) {
    // Pacote 3x: qualquer parcela em atraso (inclui a última) = inadimplente.
    billingStatus = "past_due";
  } else if (paid.length > 0) {
    billingStatus = "active";
  } else if (overdue.length > 0) {
    billingStatus = "past_due";
  } else if (input.current.billingStatus === "trial" && payments.length > 0) {
    billingStatus = "pending_payment";
  }

  const next: BillingSyncSnapshot = {
    billingStatus,
    planId,
    paidInstallments: Math.min(Math.max(input.current.paidInstallments, paid.length), cap),
    lastPaidPaymentId,
    lastPaidAt,
    billingMethod: methodFromPayment,
    asaasSubscriptionId: subscriptionId,
  };

  const changed =
    next.billingStatus !== input.current.billingStatus ||
    next.planId !== input.current.planId ||
    next.paidInstallments !== input.current.paidInstallments ||
    next.lastPaidPaymentId !== input.current.lastPaidPaymentId ||
    next.lastPaidAt !== input.current.lastPaidAt ||
    next.billingMethod !== input.current.billingMethod ||
    next.asaasSubscriptionId !== input.current.asaasSubscriptionId;

  const stillOpen = payments.some((payment) => {
    const status = String(payment.status ?? "").trim().toUpperCase();
    return status === "PENDING" || status === "OVERDUE";
  });

  return {
    next,
    clearPendingInstruments: next.billingStatus === "active" && !stillOpen,
    changed,
  };
}

export function decideBillingFromSinglePaidPayment(input: {
  current: BillingSyncSnapshot;
  payment: AsaasPaymentLike;
  nowIso: string;
}): {
  next: BillingSyncSnapshot;
  duplicatePayment: boolean;
  clearPendingInstruments: boolean;
  changed: boolean;
} {
  if (input.current.billingStatus === "canceled" || !isAsaasPaidStatus(input.payment.status)) {
    return {
      next: input.current,
      duplicatePayment: false,
      clearPendingInstruments: false,
      changed: false,
    };
  }

  const duplicatePayment = input.current.lastPaidPaymentId === input.payment.id;
  const parsed = parseCheckoutExternalReference(input.payment.externalReference);
  const planId = parsed.planId || parsePaidPlanId(input.current.planId) || input.current.planId;
  const cap = installmentCap(planId);
  const paidInstallments = duplicatePayment
    ? Math.min(Math.max(input.current.paidInstallments, 1), cap)
    : Math.min((input.current.paidInstallments || 0) + 1, cap);

  const next: BillingSyncSnapshot = {
    billingStatus:
      duplicatePayment && input.current.billingStatus === "past_due" ? "past_due" : "active",
    planId,
    paidInstallments,
    lastPaidPaymentId: input.payment.id,
    lastPaidAt: duplicatePayment ? input.current.lastPaidAt || input.nowIso : input.nowIso,
    billingMethod:
      billingMethodFromAsaas(input.payment.billingType) ||
      parsed.method ||
      input.current.billingMethod,
    asaasSubscriptionId:
      String(input.payment.subscription ?? "").trim() || input.current.asaasSubscriptionId,
  };

  const changed =
    !duplicatePayment ||
    next.billingStatus !== input.current.billingStatus ||
    next.planId !== input.current.planId ||
    next.paidInstallments !== input.current.paidInstallments ||
    next.lastPaidAt !== input.current.lastPaidAt ||
    next.billingMethod !== input.current.billingMethod ||
    next.asaasSubscriptionId !== input.current.asaasSubscriptionId;

  return {
    next,
    duplicatePayment,
    clearPendingInstruments: next.paidInstallments >= cap,
    changed,
  };
}

function toBillingPatch(
  next: BillingSyncSnapshot,
  clearPendingInstruments: boolean,
): UserBillingUpdate {
  const patch: UserBillingUpdate = {
    billingStatus: next.billingStatus,
    billingMethod: next.billingMethod,
    asaasSubscriptionId: next.asaasSubscriptionId,
    paidInstallments: next.paidInstallments,
    lastPaidPaymentId: next.lastPaidPaymentId,
    lastPaidAt: next.lastPaidAt,
  };
  if (next.planId) {
    patch.planId = next.planId;
  }
  if (clearPendingInstruments) {
    patch.pendingBoletoUrl = null;
    patch.pendingBoletoLinhaDigitavel = null;
    patch.pendingBoletoDueDate = null;
    patch.pendingBoletoValue = null;
    patch.pendingPixPayload = null;
    patch.pendingPixQrImage = null;
    patch.pendingPixExpiration = null;
  }
  return patch;
}

export async function applySubscriptionPaymentsSync(input: {
  registration: UserRegistration;
  payments: AsaasPaymentLike[];
  nowIso?: string;
}): Promise<{ registration: UserRegistration; changed: boolean }> {
  const decided = decideBillingFromAsaasPayments({
    current: snapshotFromRegistration(input.registration),
    payments: input.payments,
    nowIso: input.nowIso ?? new Date().toISOString(),
  });
  if (!decided.changed && !decided.clearPendingInstruments) {
    return { registration: input.registration, changed: false };
  }
  if (!decided.changed && decided.clearPendingInstruments) {
    const alreadyClear =
      !input.registration.pendingBoletoUrl &&
      !input.registration.pendingBoletoLinhaDigitavel &&
      !input.registration.pendingPixPayload &&
      !input.registration.pendingPixQrImage;
    if (alreadyClear) {
      return { registration: input.registration, changed: false };
    }
  }
  const registration = await updateUserRegistrationBilling(
    input.registration.ownerUserId,
    toBillingPatch(decided.next, decided.clearPendingInstruments),
  );
  return { registration, changed: true };
}

export async function applySinglePaidPayment(input: {
  registration: UserRegistration;
  payment: AsaasPaymentLike;
  nowIso?: string;
}): Promise<{
  registration: UserRegistration;
  duplicatePayment: boolean;
  changed: boolean;
}> {
  const decided = decideBillingFromSinglePaidPayment({
    current: snapshotFromRegistration(input.registration),
    payment: input.payment,
    nowIso: input.nowIso ?? new Date().toISOString(),
  });
  if (!decided.changed) {
    return {
      registration: input.registration,
      duplicatePayment: decided.duplicatePayment,
      changed: false,
    };
  }
  const registration = await updateUserRegistrationBilling(
    input.registration.ownerUserId,
    toBillingPatch(decided.next, decided.clearPendingInstruments),
  );
  return {
    registration,
    duplicatePayment: decided.duplicatePayment,
    changed: true,
  };
}

export async function applyOverdueBillingStatus(
  registration: UserRegistration,
): Promise<{ registration: UserRegistration; changed: boolean }> {
  if (registration.billingStatus === "canceled" || registration.billingStatus === "past_due") {
    return { registration, changed: false };
  }
  const updated = await updateUserRegistrationBilling(registration.ownerUserId, {
    billingStatus: "past_due",
  });
  return { registration: updated, changed: true };
}

export type BillingInstallmentView = {
  number: number;
  dueDate: string;
  status: "paid" | "pending" | "overdue" | "scheduled";
  paymentId: string | null;
  value: number | null;
};

export function buildBillingInstallmentViews(input: {
  firstDueDate?: string | null;
  installmentCount: number;
  payments: Array<{
    id: string;
    status: string;
    dueDate?: string;
    value?: number;
  }>;
}): BillingInstallmentView[] {
  const sortedPayments = [...input.payments].sort((a, b) =>
    String(a.dueDate ?? "").localeCompare(String(b.dueDate ?? "")),
  );
  const firstDueDate = input.firstDueDate || sortedPayments[0]?.dueDate || null;
  if (!firstDueDate) {
    return [];
  }
  return buildInstallmentSchedule(firstDueDate, input.installmentCount).map((slot, index) => {
    const payment = sortedPayments[index] ?? null;
    let status: BillingInstallmentView["status"] = "scheduled";
    if (payment) {
      if (isAsaasPaidStatus(payment.status)) {
        status = "paid";
      } else if (isAsaasOverdueStatus(payment.status)) {
        status = "overdue";
      } else {
        status = "pending";
      }
    }
    return {
      number: slot.number,
      dueDate: payment?.dueDate || slot.dueDate,
      status,
      paymentId: payment?.id ?? null,
      value: payment?.value ?? null,
    };
  });
}
