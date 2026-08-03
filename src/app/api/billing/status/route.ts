import { NextResponse } from "next/server";

import {
  asaasListSubscriptionPayments,
  pickPrimaryBoletoPayment,
} from "@/lib/asaas/client";
import { apiRoute } from "@/lib/auth/api-route";
import { getSessionUser } from "@/lib/auth/session";
import { formatBrl, getPlanPricing } from "@/lib/billing/plan-pricing";
import {
  getUserRegistrationForOwner,
  updateUserRegistrationBilling,
} from "@/lib/user-registration-storage";

export async function GET() {
  return apiRoute(async () => {
    const session = await getSessionUser();
    if (!session?.id) {
      return NextResponse.json({ message: "Nao autenticado." }, { status: 401 });
    }

    let registration = await getUserRegistrationForOwner(session.id);
    if (!registration) {
      return NextResponse.json({
        billingStatus: "trial",
        planId: null,
        boleto: null,
        nfs: null,
      });
    }

    // Atualiza boleto pendente se ainda houver assinatura.
    if (
      registration.asaasSubscriptionId &&
      (registration.billingStatus === "pending_payment" ||
        registration.billingStatus === "past_due")
    ) {
      try {
        const payments = await asaasListSubscriptionPayments(
          registration.asaasSubscriptionId,
        );
        const payment = pickPrimaryBoletoPayment(payments);
        if (payment) {
          registration = await updateUserRegistrationBilling(registration.ownerUserId, {
            pendingBoletoUrl: payment.bankSlipUrl || payment.invoiceUrl || null,
            pendingBoletoLinhaDigitavel: payment.identificationField || null,
            pendingBoletoDueDate: payment.dueDate || null,
            pendingBoletoValue: payment.value ?? null,
          });
        }
      } catch {
        // Mantém dados locais se Asaas falhar.
      }
    }

    const planId = registration.planId || null;
    const pricing = planId ? getPlanPricing(planId) : null;

    return NextResponse.json({
      billingStatus: registration.billingStatus,
      planId,
      paidInstallments: registration.paidInstallments,
      installmentCount: pricing?.installmentCount ?? 3,
      installmentValue: pricing?.installmentValue ?? null,
      campaignTotal: pricing?.campaignTotal ?? null,
      boleto:
        registration.pendingBoletoUrl || registration.pendingBoletoLinhaDigitavel
          ? {
              url: registration.pendingBoletoUrl,
              linhaDigitavel: registration.pendingBoletoLinhaDigitavel,
              dueDate: registration.pendingBoletoDueDate,
              value: registration.pendingBoletoValue,
              valueLabel:
                registration.pendingBoletoValue != null
                  ? formatBrl(registration.pendingBoletoValue)
                  : null,
            }
          : null,
      nfs: {
        status: registration.lastNfsStatus,
        number: registration.lastNfsNumber,
        pdfUrl: registration.lastNfsPdfUrl,
        xmlUrl: registration.lastNfsXmlUrl,
      },
    });
  });
}
