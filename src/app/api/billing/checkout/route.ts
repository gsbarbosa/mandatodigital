import { NextResponse } from "next/server";
import { z } from "zod";

import {
  asaasCreateSubscription,
  asaasCreateSubscriptionInvoiceSettings,
  asaasEnsureCustomer,
  asaasGetPixQrCode,
  asaasListSubscriptionPayments,
  pickPrimaryBoletoPayment,
  AsaasApiError,
} from "@/lib/asaas/client";
import { apiRoute } from "@/lib/auth/api-route";
import { handleRouteError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth/session";
import { buildAsaasNfsInvoiceSettings, isAsaasNfsEnabled } from "@/lib/billing/nfs-config";
import {
  asaasDatePlusDays,
  formatBrl,
  resolveCheckoutPricing,
  subscriptionEndDateFromFirstDue,
} from "@/lib/billing/plan-pricing";
import { resolveAsaasBillingCustomer } from "@/lib/billing/resolve-asaas-customer";
import { appLog, appLogError } from "@/lib/observability/log";
import {
  getUserRegistrationForOwner,
  isUserRegistrationComplete,
  updateUserRegistrationBilling,
} from "@/lib/user-registration-storage";

const bodySchema = z.object({
  planId: z.enum(["essencial", "avancado", "elite"]),
  method: z.enum(["pix", "boleto"]).default("pix"),
});

export async function POST(request: Request) {
  try {
    return await apiRoute(async () => {
      const session = await getSessionUser();
      if (!session?.id) {
        return NextResponse.json({ message: "Nao autenticado." }, { status: 401 });
      }

      const body = bodySchema.parse(await request.json().catch(() => ({})));
      const method = body.method;
      const registration = await getUserRegistrationForOwner(session.id);
      if (!registration || !isUserRegistrationComplete(registration)) {
        return NextResponse.json(
          { message: "Conclua o cadastro antes de gerar a cobranca." },
          { status: 400 },
        );
      }

      if (registration.billingStatus === "active") {
        return NextResponse.json(
          {
            message: "Assinatura ja ativa.",
            billingStatus: registration.billingStatus,
            planId: registration.planId,
          },
          { status: 409 },
        );
      }

      const sessionEmail = session.email || registration.email || "";
      const pricing = resolveCheckoutPricing(body.planId, sessionEmail);
      const ownerUserId = registration.ownerUserId;

      const resolved = await resolveAsaasBillingCustomer({
        registration,
        sessionEmail: session.email,
      });
      if (!resolved.ok) {
        return NextResponse.json({ message: resolved.message }, { status: 400 });
      }

      const customer = await asaasEnsureCustomer({
        ...resolved.customer,
        existingCustomerId: registration.asaasCustomerId,
      });
      const customerId = customer.id;

      appLog("billing", "asaas_customer_synced", {
        ownerUserId,
        customerId,
        documentKind: resolved.customer.documentKind,
        addressSource: resolved.customer.addressSource,
        postalCode: resolved.customer.postalCode,
        method,
      });

      let subscriptionId = registration.asaasSubscriptionId;
      if (subscriptionId && registration.billingMethod && registration.billingMethod !== method) {
        appLog("billing", "checkout_replacing_subscription_method", {
          ownerUserId,
          previousSubscriptionId: subscriptionId,
          previousMethod: registration.billingMethod,
          method,
        });
        subscriptionId = null;
      }
      // Smoke R$5: se já houver assinatura de valor cheio, cria outra de teste.
      if (subscriptionId && pricing.smokeTest) {
        try {
          const existingPayments = await asaasListSubscriptionPayments(subscriptionId);
          const primary = pickPrimaryBoletoPayment(existingPayments);
          const existingValue = primary?.value ?? null;
          if (existingValue != null && Math.abs(existingValue - pricing.installmentValue) > 0.009) {
            appLog("billing", "smoke_test_replacing_subscription", {
              ownerUserId,
              previousSubscriptionId: subscriptionId,
              previousValue: existingValue,
            });
            subscriptionId = null;
          }
        } catch {
          subscriptionId = null;
        }
      }

      let createdSubscription = false;
      let nfsConfigured = false;
      if (!subscriptionId) {
        const nextDueDate = asaasDatePlusDays(method === "pix" ? 0 : pricing.smokeTest ? 1 : 3);
        const endDate = pricing.smokeTest
          ? nextDueDate
          : subscriptionEndDateFromFirstDue(nextDueDate);
        const description = pricing.smokeTest
          ? `TESTE NFS — Mandato Digital ${pricing.label} (R$ 5,00)`
          : `Mandato Digital — ${pricing.label} (parcela 1/${pricing.installmentCount})`;
        const subscription = await asaasCreateSubscription({
          customerId,
          billingType: method === "pix" ? "PIX" : "BOLETO",
          value: pricing.installmentValue,
          nextDueDate,
          endDate,
          description,
          externalReference: pricing.smokeTest
            ? `${ownerUserId}:${body.planId}:smoke:${method}`
            : `${ownerUserId}:${body.planId}:${method}`,
        });
        subscriptionId = subscription.id;
        createdSubscription = true;
      }

      if (subscriptionId && isAsaasNfsEnabled()) {
        const nfsSettings = buildAsaasNfsInvoiceSettings({
          planLabel: pricing.smokeTest ? `${pricing.label} (teste)` : pricing.label,
        });
        if (!nfsSettings) {
          appLog(
            "billing",
            "nfs_settings_skipped_incomplete_config",
            { ownerUserId, subscriptionId },
            "warn",
          );
        } else {
          try {
            await asaasCreateSubscriptionInvoiceSettings(subscriptionId, nfsSettings);
            nfsConfigured = true;
          } catch (error) {
            appLogError("billing", "nfs_invoice_settings_failed", error, {
              ownerUserId,
              subscriptionId,
              createdSubscription,
            });
          }
        }
      }

      let payment = null as Awaited<ReturnType<typeof pickPrimaryBoletoPayment>>;
      let pixPayload: string | null = null;
      let pixQrImage: string | null = null;
      let pixExpiration: string | null = null;

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const payments = await asaasListSubscriptionPayments(subscriptionId);
        payment = pickPrimaryBoletoPayment(payments);
        if (method === "pix" && payment?.id) {
          try {
            const qr = await asaasGetPixQrCode(payment.id);
            pixPayload = qr.payload?.trim() || null;
            pixQrImage = qr.encodedImage?.trim() || null;
            pixExpiration = qr.expirationDate?.trim() || payment.dueDate || null;
          } catch (error) {
            appLogError("billing", "pix_qr_fetch_failed", error, {
              ownerUserId,
              paymentId: payment.id,
              attempt,
            });
          }
          if (pixPayload || pixQrImage) {
            break;
          }
        } else if (payment?.bankSlipUrl || payment?.identificationField || payment?.invoiceUrl) {
          break;
        }
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }

      const boletoUrl = method === "boleto" ? payment?.bankSlipUrl || payment?.invoiceUrl || null : null;
      const linha = method === "boleto" ? payment?.identificationField || null : null;
      const dueDate = payment?.dueDate || null;
      const value = payment?.value ?? pricing.installmentValue;

      const updated = await updateUserRegistrationBilling(ownerUserId, {
        planId: body.planId,
        billingStatus: "pending_payment",
        billingMethod: method,
        asaasCustomerId: customerId,
        asaasSubscriptionId: subscriptionId,
        pendingBoletoUrl: boletoUrl,
        pendingBoletoLinhaDigitavel: linha,
        pendingBoletoDueDate: dueDate,
        pendingBoletoValue: value,
        pendingPixPayload: method === "pix" ? pixPayload : null,
        pendingPixQrImage: method === "pix" ? pixQrImage : null,
        pendingPixExpiration: method === "pix" ? pixExpiration : null,
      });

      return NextResponse.json({
        billingStatus: updated.billingStatus,
        billingMethod: method,
        planId: updated.planId,
        installmentValue: pricing.installmentValue,
        installmentCount: pricing.installmentCount,
        campaignTotal: pricing.campaignTotal,
        installmentLabel: formatBrl(pricing.installmentValue),
        campaignTotalLabel: formatBrl(pricing.campaignTotal),
        boleto:
          method === "boleto"
            ? {
                paymentId: payment?.id ?? null,
                url: boletoUrl,
                linhaDigitavel: linha,
                dueDate,
                value,
                valueLabel: formatBrl(value),
              }
            : null,
        pix:
          method === "pix"
            ? {
                paymentId: payment?.id ?? null,
                payload: pixPayload,
                qrImage: pixQrImage,
                expiration: pixExpiration,
                dueDate,
                value,
                valueLabel: formatBrl(value),
              }
            : null,
        asaasCustomerId: customerId,
        asaasSubscriptionId: subscriptionId,
        nfsConfigured,
        subscriptionCreated: createdSubscription,
        smokeTest: pricing.smokeTest,
        customerDocumentKind: resolved.customer.documentKind,
        customerAddressSource: resolved.customer.addressSource,
      });
    });
  } catch (error) {
    if (error instanceof AsaasApiError) {
      return NextResponse.json(
        { message: `Falha Asaas: ${error.message}` },
        { status: error.status >= 400 && error.status < 600 ? error.status : 502 },
      );
    }
    return handleRouteError(error);
  }
}
