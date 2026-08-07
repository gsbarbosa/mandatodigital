import { NextResponse } from "next/server";

import {
  asaasGetPayment,
  asaasGetPixQrCode,
  listAsaasPackagePayments,
  pickNextOpenPayment,
} from "@/lib/asaas/client";
import { apiRoute } from "@/lib/auth/api-route";
import { getSessionUser } from "@/lib/auth/session";
import {
  applySubscriptionPaymentsSync,
  buildBillingInstallmentViews,
} from "@/lib/billing/asaas-payment-sync";
import { hasRemainingCampaignInstallments } from "@/lib/billing/billing-package";
import { billingMethodFromAsaas } from "@/lib/billing/billing-method";
import { ensureNfsScheduledForPaidPayments } from "@/lib/billing/ensure-nfs";
import {
  formatBrl,
  isBillingSmokeTestEmail,
  resolveCheckoutPricing,
} from "@/lib/billing/plan-pricing";
import { resolvePaymentAccess } from "@/lib/billing/payment-access";
import {
  getUserRegistrationForOwner,
  updateUserRegistrationBilling,
} from "@/lib/user-registration-storage";

function isPendingPixExpired(expiration: string | null | undefined, now = new Date()) {
  const raw = String(expiration ?? "").trim();
  if (!raw) {
    return false;
  }
  const timestamp = Date.parse(raw);
  if (Number.isFinite(timestamp)) {
    return timestamp <= now.getTime();
  }
  return false;
}

export async function GET() {
  return apiRoute(async () => {
    const session = await getSessionUser();
    if (!session?.id) {
      return NextResponse.json({ message: "Nao autenticado." }, { status: 401 });
    }

    let asaasPayments: Awaited<ReturnType<typeof listAsaasPackagePayments>> = [];
    let registration = await getUserRegistrationForOwner(session.id);
    if (!registration) {
      return NextResponse.json({
        billingStatus: "trial",
        billingMethod: null,
        planId: null,
        paidInstallments: 0,
        lastPaidAt: null,
        billingFirstDueDate: null,
        installments: [],
        boleto: null,
        pix: null,
        nfs: null,
        access: resolvePaymentAccess({ billingStatus: "trial", installments: [] }),
        hasRemainingInstallments: false,
        smokeTestAvailable: isBillingSmokeTestEmail(session.email),
      });
    }

    if (
      (registration.asaasInstallmentId ||
        registration.asaasSubscriptionId ||
        registration.asaasPrimaryPaymentId) &&
      registration.billingStatus !== "canceled"
    ) {
      try {
        let payments = await listAsaasPackagePayments({
          installmentId: registration.asaasInstallmentId,
          subscriptionId: registration.asaasSubscriptionId,
        });
        if (!payments.length && registration.asaasPrimaryPaymentId) {
          payments = [await asaasGetPayment(registration.asaasPrimaryPaymentId)];
        }
        asaasPayments = payments;
        const synced = await applySubscriptionPaymentsSync({
          registration,
          payments,
        });
        registration = synced.registration;
        registration = await ensureNfsScheduledForPaidPayments({
          registration,
          payments,
        });

        const nextPayable = pickNextOpenPayment(payments);
        if (nextPayable) {
          const method =
            registration.billingMethod || billingMethodFromAsaas(nextPayable.billingType) || "boleto";
          const pixExpired = isPendingPixExpired(registration.pendingPixExpiration);
          const sameInstrument =
            registration.asaasPrimaryPaymentId === nextPayable.id &&
            ((method === "pix" &&
              !pixExpired &&
              Boolean(registration.pendingPixPayload || registration.pendingPixQrImage)) ||
              (method === "boleto" &&
                Boolean(registration.pendingBoletoUrl || registration.pendingBoletoLinhaDigitavel)));
          let pixPayload = sameInstrument ? registration.pendingPixPayload : null;
          let pixQrImage = sameInstrument ? registration.pendingPixQrImage : null;
          let pixExpiration = sameInstrument ? registration.pendingPixExpiration : null;
          if (method === "pix" && nextPayable.id && (!pixPayload || !pixQrImage || pixExpired)) {
            try {
              const qr = await asaasGetPixQrCode(nextPayable.id);
              pixPayload = qr.payload?.trim() || pixPayload;
              pixQrImage = qr.encodedImage?.trim() || pixQrImage;
              pixExpiration = qr.expirationDate?.trim() || nextPayable.dueDate || pixExpiration;
            } catch {
              // Mantém QR local se Asaas falhar.
            }
          }
          registration = await updateUserRegistrationBilling(registration.ownerUserId, {
            billingMethod: method,
            asaasPrimaryPaymentId: nextPayable.id,
            pendingBoletoUrl:
              method === "boleto" ? nextPayable.bankSlipUrl || nextPayable.invoiceUrl || null : null,
            pendingBoletoLinhaDigitavel:
              method === "boleto" ? nextPayable.identificationField || null : null,
            pendingBoletoDueDate: nextPayable.dueDate || null,
            pendingBoletoValue: nextPayable.value ?? null,
            pendingPixPayload: method === "pix" ? pixPayload : null,
            pendingPixQrImage: method === "pix" ? pixQrImage : null,
            pendingPixExpiration: method === "pix" ? pixExpiration : null,
          });
        } else if (
          registration.pendingBoletoUrl ||
          registration.pendingBoletoLinhaDigitavel ||
          registration.pendingPixPayload ||
          registration.pendingPixQrImage
        ) {
          registration = await updateUserRegistrationBilling(registration.ownerUserId, {
            pendingBoletoUrl: null,
            pendingBoletoLinhaDigitavel: null,
            pendingBoletoDueDate: null,
            pendingBoletoValue: null,
            pendingPixPayload: null,
            pendingPixQrImage: null,
            pendingPixExpiration: null,
          });
        }
      } catch {
        // Mantém dados locais se Asaas falhar.
      }
    }

    const planId = registration.planId || null;
    const pricing = planId
      ? resolveCheckoutPricing(planId, session.email || registration.email)
      : null;
    const method = registration.billingMethod;
    const installmentCount = pricing?.installmentCount ?? 3;
    const installments = buildBillingInstallmentViews({
      firstDueDate: registration.billingFirstDueDate,
      installmentCount,
      payments: asaasPayments,
    });
    const access = resolvePaymentAccess({
      billingStatus: registration.billingStatus,
      installments,
    });

    return NextResponse.json({
      billingStatus: registration.billingStatus,
      billingMethod: method,
      planId,
      paidInstallments: registration.paidInstallments,
      lastPaidAt: registration.lastPaidAt,
      billingFirstDueDate: registration.billingFirstDueDate,
      installments,
      installmentCount,
      installmentValue: pricing?.installmentValue ?? null,
      campaignTotal: pricing?.campaignTotal ?? null,
      access,
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
      hasRemainingInstallments: hasRemainingCampaignInstallments({
        billingStatus: registration.billingStatus,
        paidInstallments: registration.paidInstallments,
        installmentCount,
      }),
      smokeTestAvailable: isBillingSmokeTestEmail(session.email || registration.email),
    });
  });
}
