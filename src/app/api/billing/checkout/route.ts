import { NextResponse } from "next/server";
import { z } from "zod";

import {
  asaasCreatePayment,
  asaasCreateSubscriptionInvoiceSettings,
  asaasEnsureCustomer,
  asaasGetPayment,
  asaasGetPixQrCode,
  listAsaasPackagePayments,
  pickPrimaryBoletoPayment,
  AsaasApiError,
  type AsaasPayment,
} from "@/lib/asaas/client";
import { apiRoute } from "@/lib/auth/api-route";
import { handleRouteError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth/session";
import { hasOpenBillingPackage } from "@/lib/billing/billing-package";
import { buildAsaasNfsInvoiceSettings, isAsaasNfsEnabled } from "@/lib/billing/nfs-config";
import {
  asaasDatePlusDays,
  buildInstallmentSchedule,
  formatBrl,
  resolveCheckoutPricing,
} from "@/lib/billing/plan-pricing";
import { resolveAsaasBillingCustomer } from "@/lib/billing/resolve-asaas-customer";
import {
  ContractAcceptanceError,
  needsContractAcceptanceForCheckout,
  processContractAcceptance,
} from "@/lib/legal/accept-contract";
import { getLatestContractAcceptanceForOwner } from "@/lib/legal/contract-storage";
import { appLog, appLogError } from "@/lib/observability/log";
import {
  getUserRegistrationForOwner,
  isUserRegistrationComplete,
  updateUserRegistrationBilling,
} from "@/lib/user-registration-storage";

const bodySchema = z.object({
  planId: z.enum(["essencial", "avancado", "elite"]),
  method: z.enum(["pix", "boleto"]).default("pix"),
  cnpj: z.string().min(14).optional(),
  accepted: z.literal(true).optional(),
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

      const sessionEmail = session.email || registration.email || "";
      const pricing = resolveCheckoutPricing(body.planId, sessionEmail);
      const ownerUserId = registration.ownerUserId;
      const existingContract = await getLatestContractAcceptanceForOwner(ownerUserId);
      const mustAcceptContract = needsContractAcceptanceForCheckout(
        existingContract,
        body.planId,
      );

      if (mustAcceptContract) {
        if (!body.cnpj || body.accepted !== true) {
          return NextResponse.json(
            {
              message:
                "Aceite o contrato e informe o CNPJ da campanha antes de gerar a cobrança.",
            },
            { status: 400 },
          );
        }
        if (!registration.address?.trim()) {
          return NextResponse.json(
            {
              message:
                "Endereço da campanha ausente. Complete em Dados Pessoais antes do checkout.",
            },
            { status: 400 },
          );
        }
        const email = registration.email?.trim() || sessionEmail;
        if (!email) {
          return NextResponse.json({ message: "E-mail do cadastro ausente." }, { status: 400 });
        }

        try {
          await processContractAcceptance({
            request,
            ownerUserId,
            body: {
              cnpj: body.cnpj,
              accepted: true,
              campaignName: registration.fullName,
              campaignAddress: registration.address,
              financialResponsible: registration.fullName,
              email,
              planId: body.planId,
              party: registration.party || undefined,
            },
          });
        } catch (error) {
          if (error instanceof ContractAcceptanceError) {
            return NextResponse.json({ message: error.message }, { status: error.status });
          }
          throw error;
        }
      }

      const openPackage = hasOpenBillingPackage(registration);

      if (openPackage && registration.billingStatus === "active") {
        return NextResponse.json(
          {
            message: "Pacote ja ativo. Use a tela de pagamento para as parcelas restantes.",
            billingStatus: registration.billingStatus,
            planId: registration.planId,
          },
          { status: 409 },
        );
      }

      if (openPackage && !pricing.smokeTest) {
        return NextResponse.json(
          {
            message:
              "Ja existe um pacote pendente ou inadimplente. Conclua o pagamento das parcelas em aberto.",
            billingStatus: registration.billingStatus,
            planId: registration.planId,
          },
          { status: 409 },
        );
      }

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

      let installmentId = registration.asaasInstallmentId;
      const legacySubscriptionId = installmentId ? null : registration.asaasSubscriptionId;
      if (
        installmentId &&
        ((registration.billingMethod && registration.billingMethod !== method) ||
          (registration.planId && registration.planId !== body.planId))
      ) {
        appLog("billing", "checkout_replacing_installment", {
          ownerUserId,
          previousInstallmentId: installmentId,
          previousMethod: registration.billingMethod,
          previousPlanId: registration.planId,
          method,
          planId: body.planId,
        });
        installmentId = null;
      }

      if (installmentId && pricing.smokeTest) {
        try {
          const existingPayments = await listAsaasPackagePayments({ installmentId });
          const primary = pickPrimaryBoletoPayment(existingPayments);
          const existingValue = primary?.value ?? null;
          if (existingValue != null && Math.abs(existingValue - pricing.installmentValue) > 0.009) {
            installmentId = null;
          }
        } catch {
          installmentId = null;
        }
      }

      let createdPackage = false;
      let createdPayment: AsaasPayment | null = null;
      let nfsConfigured = false;
      const nextDueDate = asaasDatePlusDays(method === "pix" ? 0 : pricing.smokeTest ? 1 : 3);
      if (!installmentId && !legacySubscriptionId) {
        const description = pricing.smokeTest
          ? `TESTE NFS — Mandato Digital ${pricing.label} (R$ 5,00)`
          : `Mandato Digital — ${pricing.label} (pacote campanha ${pricing.installmentCount}x)`;
        const created = await asaasCreatePayment({
          customerId,
          billingType: method === "pix" ? "PIX" : "BOLETO",
          dueDate: nextDueDate,
          description,
          externalReference: pricing.smokeTest
            ? `${ownerUserId}:${body.planId}:smoke:${method}`
            : `${ownerUserId}:${body.planId}:${method}`,
          ...(pricing.installmentCount >= 2
            ? {
                installmentCount: pricing.installmentCount,
                installmentValue: pricing.installmentValue,
              }
            : { value: pricing.installmentValue }),
        });
        createdPayment = created;
        installmentId = created.installment?.trim() || null;
        createdPackage = true;
        if (!installmentId && pricing.installmentCount >= 2 && created.id) {
          for (let attempt = 0; attempt < 4 && !installmentId; attempt += 1) {
            await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
            try {
              createdPayment = await asaasGetPayment(created.id);
              installmentId = createdPayment.installment?.trim() || null;
            } catch {
              // tenta de novo
            }
          }
        }
        if (!installmentId && pricing.installmentCount >= 2) {
          appLog(
            "billing",
            "installment_id_missing_after_create",
            { ownerUserId, paymentId: created.id, method },
            "error",
          );
        }
      }

      if (legacySubscriptionId && isAsaasNfsEnabled()) {
        const nfsSettings = buildAsaasNfsInvoiceSettings({
          planLabel: pricing.smokeTest ? `${pricing.label} (teste)` : pricing.label,
        });
        if (nfsSettings) {
          try {
            await asaasCreateSubscriptionInvoiceSettings(legacySubscriptionId, nfsSettings);
            nfsConfigured = true;
          } catch (error) {
            appLogError("billing", "nfs_invoice_settings_failed", error, {
              ownerUserId,
              subscriptionId: legacySubscriptionId,
            });
          }
        }
      }

      let payment = null as Awaited<ReturnType<typeof pickPrimaryBoletoPayment>>;
      let pixPayload: string | null = null;
      let pixQrImage: string | null = null;
      let pixExpiration: string | null = null;

      for (let attempt = 0; attempt < 5; attempt += 1) {
        let payments = await listAsaasPackagePayments({
          installmentId,
          subscriptionId: installmentId ? null : legacySubscriptionId,
        });
        if (!payments.length && createdPayment?.id) {
          try {
            createdPayment = await asaasGetPayment(createdPayment.id);
          } catch {
            // usa o payload da criação
          }
          payments = createdPayment ? [createdPayment] : [];
        }
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
      const billingFirstDueDate =
        dueDate ||
        (!createdPackage ? registration.billingFirstDueDate : null) ||
        nextDueDate;

      const updated = await updateUserRegistrationBilling(ownerUserId, {
        planId: body.planId,
        billingStatus: "pending_payment",
        billingMethod: method,
        asaasCustomerId: customerId,
        asaasInstallmentId: installmentId,
        asaasPrimaryPaymentId: payment?.id || createdPayment?.id || registration.asaasPrimaryPaymentId,
        asaasSubscriptionId: installmentId ? null : legacySubscriptionId,
        billingFirstDueDate,
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
        billingFirstDueDate,
        installments: buildInstallmentSchedule(billingFirstDueDate, pricing.installmentCount),
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
        asaasInstallmentId: installmentId,
        nfsConfigured,
        packageCreated: createdPackage,
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
