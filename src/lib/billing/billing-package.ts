import type { BillingStatus } from "@/lib/billing/plan-pricing";

export function hasOpenBillingPackage(input: {
  billingStatus?: BillingStatus | string | null;
  asaasInstallmentId?: string | null;
  asaasSubscriptionId?: string | null;
  asaasPrimaryPaymentId?: string | null;
}): boolean {
  const status = input.billingStatus;
  if (status !== "active" && status !== "pending_payment" && status !== "past_due") {
    return false;
  }
  return Boolean(
    input.asaasInstallmentId || input.asaasSubscriptionId || input.asaasPrimaryPaymentId,
  );
}

export function hasRemainingCampaignInstallments(input: {
  billingStatus?: BillingStatus | string | null;
  paidInstallments?: number | null;
  installmentCount?: number | null;
}): boolean {
  if (input.billingStatus === "pending_payment" || input.billingStatus === "past_due") {
    return true;
  }
  if (input.billingStatus !== "active") {
    return false;
  }
  const paid = input.paidInstallments ?? 0;
  const total = input.installmentCount ?? 3;
  return paid < total;
}
