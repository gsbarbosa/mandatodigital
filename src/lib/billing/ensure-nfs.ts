import { AsaasApiError, asaasScheduleInvoice } from "@/lib/asaas/client";
import { parsePaidPlanId } from "@/lib/account-tier";
import { isAsaasPaidStatus } from "@/lib/billing/asaas-payment-sync";
import { buildAsaasScheduleInvoiceInput } from "@/lib/billing/nfs-config";
import { asaasTodayInSaoPaulo, getPlanPricing } from "@/lib/billing/plan-pricing";
import { appLog, appLogError } from "@/lib/observability/log";
import { updateUserRegistrationBilling } from "@/lib/user-registration-storage";
import type { UserRegistration } from "@/lib/user-registration-types";

type PaidPaymentLike = {
  id: string;
  status?: string | null;
  value?: number | null;
};

function isDuplicateInvoiceError(error: AsaasApiError) {
  if (error.status === 409) {
    return true;
  }
  const blob = `${error.message} ${JSON.stringify(error.payload ?? {})}`.toLowerCase();
  return (
    blob.includes("already") ||
    blob.includes("duplic") ||
    blob.includes("já existe") ||
    blob.includes("ja existe")
  );
}

export async function ensureNfsScheduledForPaidPayments(input: {
  registration: UserRegistration;
  payments: PaidPaymentLike[];
}): Promise<UserRegistration> {
  const planId = parsePaidPlanId(input.registration.planId);
  if (!planId || input.payments.length === 0) {
    return input.registration;
  }

  const already = new Set(input.registration.scheduledNfsPaymentIds ?? []);
  let registration = input.registration;
  const today = asaasTodayInSaoPaulo();
  const planLabel = getPlanPricing(planId).label;

  for (const payment of input.payments) {
    if (!payment.id || already.has(payment.id) || !isAsaasPaidStatus(payment.status)) {
      continue;
    }
    const value = Number(payment.value);
    if (!Number.isFinite(value) || value <= 0) {
      continue;
    }

    const payload = buildAsaasScheduleInvoiceInput({
      planLabel,
      paymentId: payment.id,
      value,
      effectiveDate: today,
    });
    if (!payload) {
      return registration;
    }

    try {
      await asaasScheduleInvoice(payload);
      already.add(payment.id);
      registration = await updateUserRegistrationBilling(registration.ownerUserId, {
        scheduledNfsPaymentIds: [...already],
        lastNfsStatus: registration.lastNfsStatus || "scheduled",
      });
      appLog("billing", "nfs_scheduled", {
        ownerUserId: registration.ownerUserId,
        paymentId: payment.id,
        value,
      });
    } catch (error) {
      if (error instanceof AsaasApiError && isDuplicateInvoiceError(error)) {
        already.add(payment.id);
        registration = await updateUserRegistrationBilling(registration.ownerUserId, {
          scheduledNfsPaymentIds: [...already],
        });
        appLog(
          "billing",
          "nfs_schedule_skipped",
          { ownerUserId: registration.ownerUserId, paymentId: payment.id, status: error.status },
          "warn",
        );
        continue;
      }
      appLogError("billing", "nfs_schedule_failed", error, {
        ownerUserId: registration.ownerUserId,
        paymentId: payment.id,
      });
    }
  }

  return registration;
}
