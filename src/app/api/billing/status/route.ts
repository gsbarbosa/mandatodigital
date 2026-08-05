import { NextResponse } from "next/server";

import {
  asaasGetPixQrCode,
  asaasListSubscriptionPayments,
  pickPrimaryBoletoPayment,
} from "@/lib/asaas/client";
import { apiRoute } from "@/lib/auth/api-route";
import { getSessionUser } from "@/lib/auth/session";
import { billingMethodFromAsaas } from "@/lib/billing/billing-method";
import { formatBrl, getPlanPricing, isBillingSmokeTestEmail } from "@/lib/billing/plan-pricing";
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
        billingMethod: null,
        planId: null,
        boleto: null,
        pix: null,
        nfs: null,
        smokeTestAvailable: isBillingSmokeTestEmail(session.email),
      });
    }

    if (
      registration.asaasSubscriptionId &&
      (registration.billingStatus === "pending_payment" ||
        registration.billingStatus === "past_due")
    ) {
      try {
        const payments = await asaasListSubscriptionPayments(registration.asaasSubscriptionId);
        const payment = pickPrimaryBoletoPayment(payments);
        if (payment) {
          const method =
            registration.billingMethod || billingMethodFromAsaas(payment.billingType) || "boleto";
          let pixPayload = registration.pendingPixPayload;
          let pixQrImage = registration.pendingPixQrImage;
          let pixExpiration = registration.pendingPixExpiration;
          if (method === "pix" && payment.id && (!pixPayload || !pixQrImage)) {
            try {
              const qr = await asaasGetPixQrCode(payment.id);
              pixPayload = qr.payload?.trim() || pixPayload;
              pixQrImage = qr.encodedImage?.trim() || pixQrImage;
              pixExpiration = qr.expirationDate?.trim() || payment.dueDate || pixExpiration;
            } catch {
              // Mantém QR local se Asaas falhar.
            }
          }
          registration = await updateUserRegistrationBilling(registration.ownerUserId, {
            billingMethod: method,
            pendingBoletoUrl:
              method === "boleto" ? payment.bankSlipUrl || payment.invoiceUrl || null : null,
            pendingBoletoLinhaDigitavel:
              method === "boleto" ? payment.identificationField || null : null,
            pendingBoletoDueDate: payment.dueDate || null,
            pendingBoletoValue: payment.value ?? null,
            pendingPixPayload: method === "pix" ? pixPayload : null,
            pendingPixQrImage: method === "pix" ? pixQrImage : null,
            pendingPixExpiration: method === "pix" ? pixExpiration : null,
          });
        }
      } catch {
        // Mantém dados locais se Asaas falhar.
      }
    }

    const planId = registration.planId || null;
    const pricing = planId ? getPlanPricing(planId) : null;
    const method = registration.billingMethod;

    return NextResponse.json({
      billingStatus: registration.billingStatus,
      billingMethod: method,
      planId,
      paidInstallments: registration.paidInstallments,
      installmentCount: pricing?.installmentCount ?? 3,
      installmentValue: pricing?.installmentValue ?? null,
      campaignTotal: pricing?.campaignTotal ?? null,
      boleto:
        method !== "pix" &&
        (registration.pendingBoletoUrl || registration.pendingBoletoLinhaDigitavel)
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
      pix:
        method === "pix" && (registration.pendingPixPayload || registration.pendingPixQrImage)
          ? {
              payload: registration.pendingPixPayload,
              qrImage: registration.pendingPixQrImage,
              expiration: registration.pendingPixExpiration,
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
      smokeTestAvailable: isBillingSmokeTestEmail(session.email || registration.email),
    });
  });
}
