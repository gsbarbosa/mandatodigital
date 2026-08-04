import { NextResponse } from "next/server";
import { z } from "zod";

import {
  asaasCreateBoletoSubscription,
  asaasCreateSubscriptionInvoiceSettings,
  asaasEnsureCustomer,
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
import { appLog, appLogError } from "@/lib/observability/log";
import {
  getUserRegistrationForOwner,
  isUserRegistrationComplete,
  updateUserRegistrationBilling,
} from "@/lib/user-registration-storage";

const bodySchema = z.object({
  planId: z.enum(["essencial", "avancado", "elite"]),
});

export async function POST(request: Request) {
  try {
    return await apiRoute(async () => {
      const session = await getSessionUser();
      if (!session?.id) {
        return NextResponse.json({ message: "Nao autenticado." }, { status: 401 });
      }

      const body = bodySchema.parse(await request.json().catch(() => ({})));
      const registration = await getUserRegistrationForOwner(session.id);
      if (!registration || !isUserRegistrationComplete(registration)) {
        return NextResponse.json(
          { message: "Conclua o cadastro antes de gerar o boleto." },
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

      let customerId = registration.asaasCustomerId;
      if (!customerId) {
        const customer = await asaasEnsureCustomer({
          name: registration.fullName,
          email: registration.email || session.email || "",
          cpfCnpj: registration.cpf,
          phone: registration.phone,
          externalReference: ownerUserId,
        });
        customerId = customer.id;
      }

      let subscriptionId = registration.asaasSubscriptionId;
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
        const nextDueDate = asaasDatePlusDays(pricing.smokeTest ? 1 : 3);
        const endDate = pricing.smokeTest
          ? nextDueDate
          : subscriptionEndDateFromFirstDue(nextDueDate);
        const description = pricing.smokeTest
          ? `TESTE NFS — Mandato Digital ${pricing.label} (R$ 5,00)`
          : `Mandato Digital — ${pricing.label} (parcela 1/${pricing.installmentCount})`;
        const subscription = await asaasCreateBoletoSubscription({
          customerId,
          value: pricing.installmentValue,
          nextDueDate,
          endDate,
          description,
          externalReference: pricing.smokeTest
            ? `${ownerUserId}:${body.planId}:smoke`
            : `${ownerUserId}:${body.planId}`,
        });
        subscriptionId = subscription.id;
        createdSubscription = true;

        if (isAsaasNfsEnabled()) {
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
              });
            }
          }
        }
      }

      // Asaas pode demorar um instante para materializar a 1ª cobrança.
      let payment = null as Awaited<ReturnType<typeof pickPrimaryBoletoPayment>>;
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const payments = await asaasListSubscriptionPayments(subscriptionId);
        payment = pickPrimaryBoletoPayment(payments);
        if (payment?.bankSlipUrl || payment?.identificationField || payment?.invoiceUrl) {
          break;
        }
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }

      const boletoUrl = payment?.bankSlipUrl || payment?.invoiceUrl || null;
      const linha = payment?.identificationField || null;
      const dueDate = payment?.dueDate || null;
      const value = payment?.value ?? pricing.installmentValue;

      const updated = await updateUserRegistrationBilling(ownerUserId, {
        planId: body.planId,
        billingStatus: "pending_payment",
        asaasCustomerId: customerId,
        asaasSubscriptionId: subscriptionId,
        pendingBoletoUrl: boletoUrl,
        pendingBoletoLinhaDigitavel: linha,
        pendingBoletoDueDate: dueDate,
        pendingBoletoValue: value,
      });

      return NextResponse.json({
        billingStatus: updated.billingStatus,
        planId: updated.planId,
        installmentValue: pricing.installmentValue,
        installmentCount: pricing.installmentCount,
        campaignTotal: pricing.campaignTotal,
        installmentLabel: formatBrl(pricing.installmentValue),
        campaignTotalLabel: formatBrl(pricing.campaignTotal),
        boleto: {
          paymentId: payment?.id ?? null,
          url: boletoUrl,
          linhaDigitavel: linha,
          dueDate,
          value,
          valueLabel: formatBrl(value),
        },
        asaasCustomerId: customerId,
        asaasSubscriptionId: subscriptionId,
        nfsConfigured,
        subscriptionCreated: createdSubscription,
        smokeTest: pricing.smokeTest,
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
