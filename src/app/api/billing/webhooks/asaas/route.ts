import { timingSafeEqual } from "node:crypto";

import type { DocumentReference } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { asaasGetInvoice, asaasGetPayment } from "@/lib/asaas/client";
import { handleRouteError } from "@/lib/api";
import {
  applyOverdueBillingStatus,
  applySinglePaidPayment,
  isAsaasOverdueStatus,
  isAsaasPaidStatus,
} from "@/lib/billing/asaas-payment-sync";
import { ensureNfsScheduledForPaidPayments } from "@/lib/billing/ensure-nfs";
import { COLLECTIONS, col } from "@/lib/firebase/collections";
import { appLog, appLogError } from "@/lib/observability/log";
import {
  findRegistrationByAsaasCustomerId,
  updateUserRegistrationBilling,
} from "@/lib/user-registration-storage";

export const maxDuration = 60;

function verifyAsaasAccessToken(headerValue: string | null) {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN?.trim();
  if (!expected) {
    // Fail-open só em dev local sem token configurado.
    return process.env.NODE_ENV !== "production";
  }
  if (!headerValue?.trim()) {
    return false;
  }
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(headerValue.trim(), "utf8");
    if (a.length !== b.length) {
      return false;
    }
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

type AsaasWebhookBody = {
  id?: string;
  event?: string;
  payment?: {
    id?: string;
    customer?: string;
    subscription?: string | null;
    status?: string;
    value?: number;
    dueDate?: string;
    billingType?: string;
    externalReference?: string | null;
  };
  invoice?: {
    id?: string;
    customer?: string;
    payment?: string | null;
    status?: string;
    number?: string | null;
    pdfUrl?: string | null;
    xmlUrl?: string | null;
    statusDescription?: string | null;
  };
};

async function markEventProcessed(
  eventRef: DocumentReference,
  data: Record<string, unknown>,
) {
  await eventRef.set(
    {
      ...data,
      processed: true,
      receivedAt: new Date().toISOString(),
    },
    { merge: true },
  );
}

async function handleInvoiceEvent(
  eventRef: DocumentReference,
  eventId: string,
  eventName: string,
  body: AsaasWebhookBody,
) {
  const invoiceId = String(body.invoice?.id ?? "").trim();
  if (!invoiceId) {
    await markEventProcessed(eventRef, {
      eventId,
      event: eventName,
      ignored: true,
      reason: "missing_invoice_id",
    });
    return NextResponse.json({ ok: true, ignored: true });
  }

  let invoice = body.invoice;
  try {
    invoice = await asaasGetInvoice(invoiceId);
  } catch (error) {
    appLogError("billing", "asaas_invoice_fetch_failed", error, { invoiceId });
  }

  const customerId = String(invoice?.customer ?? body.invoice?.customer ?? "").trim();
  if (!customerId) {
    await markEventProcessed(eventRef, {
      eventId,
      event: eventName,
      invoiceId,
      matched: false,
    });
    return NextResponse.json({ ok: true, matched: false });
  }

  const registration = await findRegistrationByAsaasCustomerId(customerId);
  if (!registration) {
    appLog("billing", "webhook_invoice_customer_unmatched", { customerId, invoiceId }, "warn");
    await markEventProcessed(eventRef, {
      eventId,
      event: eventName,
      invoiceId,
      matched: false,
    });
    return NextResponse.json({ ok: true, matched: false });
  }

  const status = String(invoice?.status ?? body.invoice?.status ?? "").toUpperCase();
  const isError =
    eventName.includes("ERROR") ||
    eventName.includes("CANCELLED") ||
    eventName.includes("CANCELED") ||
    status === "ERROR" ||
    status === "CANCELED" ||
    status === "CANCELLED";

  if (isError) {
    await updateUserRegistrationBilling(registration.ownerUserId, {
      lastNfsStatus: "error",
    });
    await markEventProcessed(eventRef, {
      eventId,
      event: eventName,
      invoiceId,
      ownerUserId: registration.ownerUserId,
      status: status || "error",
    });
    appLog(
      "billing",
      "nfs_invoice_error",
      {
        ownerUserId: registration.ownerUserId,
        invoiceId,
        eventName,
        status,
        statusDescription: invoice?.statusDescription ?? null,
      },
      "warn",
    );
    return NextResponse.json({ ok: true, matched: true, nfsStatus: "error" });
  }

  const authorized =
    eventName.includes("AUTHORIZED") || status === "AUTHORIZED" || Boolean(invoice?.pdfUrl);

  if (authorized) {
    await updateUserRegistrationBilling(registration.ownerUserId, {
      lastNfsPdfUrl: invoice?.pdfUrl || body.invoice?.pdfUrl || null,
      lastNfsXmlUrl: invoice?.xmlUrl || body.invoice?.xmlUrl || null,
      lastNfsNumber: invoice?.number || body.invoice?.number || null,
      lastNfsStatus: "authorized",
    });
  } else {
    await updateUserRegistrationBilling(registration.ownerUserId, {
      lastNfsStatus: status.toLowerCase() || "scheduled",
    });
  }

  await markEventProcessed(eventRef, {
    eventId,
    event: eventName,
    invoiceId,
    ownerUserId: registration.ownerUserId,
    status: status || null,
  });

  appLog("billing", "nfs_invoice_event", {
    ownerUserId: registration.ownerUserId,
    invoiceId,
    eventName,
    status,
  });

  return NextResponse.json({
    ok: true,
    matched: true,
    nfsStatus: authorized ? "authorized" : status.toLowerCase() || "ok",
  });
}

async function handlePaymentEvent(
  eventRef: DocumentReference,
  eventId: string,
  eventName: string,
  body: AsaasWebhookBody,
) {
  const paymentId = String(body.payment?.id ?? "").trim();
  if (!paymentId) {
    await markEventProcessed(eventRef, {
      eventId,
      event: eventName,
      ignored: true,
      reason: "missing_payment_id",
    });
    return NextResponse.json({ ok: true, ignored: true });
  }

  let payment = body.payment;
  try {
    payment = await asaasGetPayment(paymentId);
  } catch (error) {
    appLogError("billing", "asaas_payment_fetch_failed", error, { paymentId });
  }

  const status = String(payment?.status ?? body.payment?.status ?? "").toUpperCase();
  const customerId = String(payment?.customer ?? body.payment?.customer ?? "").trim();
  if (!customerId) {
    return NextResponse.json({ ok: true, matched: false });
  }

  const registration = await findRegistrationByAsaasCustomerId(customerId);
  if (!registration) {
    appLog("billing", "webhook_customer_unmatched", { customerId, paymentId }, "warn");
    return NextResponse.json({ ok: true, matched: false });
  }

  const paymentRecord = {
    id: paymentId,
    status,
    dueDate: String(payment?.dueDate ?? ""),
    externalReference: payment?.externalReference ?? body.payment?.externalReference ?? null,
    subscription: payment?.subscription ?? body.payment?.subscription ?? null,
    billingType: payment?.billingType ?? body.payment?.billingType,
    value: payment?.value ?? body.payment?.value ?? null,
  };

  if (isAsaasPaidStatus(status)) {
    const applied = await applySinglePaidPayment({
      registration,
      payment: paymentRecord,
    });
    await ensureNfsScheduledForPaidPayments({
      registration: applied.registration,
      payments: [paymentRecord],
    });
    await markEventProcessed(eventRef, {
      eventId,
      event: eventName,
      paymentId,
      ownerUserId: registration.ownerUserId,
      duplicatePayment: applied.duplicatePayment,
      paidInstallments: applied.registration.paidInstallments || 0,
      planId: applied.registration.planId,
    });
    appLog("billing", "payment_confirmed", {
      ownerUserId: registration.ownerUserId,
      paymentId,
      paidInstallments: applied.registration.paidInstallments,
      planId: applied.registration.planId,
      duplicatePayment: applied.duplicatePayment,
    });
    return NextResponse.json({
      ok: true,
      matched: true,
      duplicatePayment: applied.duplicatePayment,
      billingStatus: applied.registration.billingStatus,
      paidInstallments: applied.registration.paidInstallments,
      planId: applied.registration.planId,
    });
  }

  if (isAsaasOverdueStatus(status) || eventName.includes("OVERDUE")) {
    const applied = await applyOverdueBillingStatus(registration);
    await markEventProcessed(eventRef, {
      eventId,
      event: eventName,
      paymentId,
      ownerUserId: registration.ownerUserId,
      status,
      billingStatus: applied.registration.billingStatus,
    });
    appLog("billing", "payment_overdue", {
      ownerUserId: registration.ownerUserId,
      paymentId,
      billingStatus: applied.registration.billingStatus,
    });
    return NextResponse.json({
      ok: true,
      matched: true,
      billingStatus: applied.registration.billingStatus,
      paidInstallments: applied.registration.paidInstallments,
    });
  }

  appLog("billing", "webhook_payment_not_paid", { paymentId, status, eventName });
  await markEventProcessed(eventRef, {
    eventId,
    event: eventName,
    paymentId,
    status,
  });
  return NextResponse.json({ ok: true, status });
}

export async function POST(request: Request) {
  try {
    const token =
      request.headers.get("asaas-access-token") ||
      request.headers.get("Asaas-Access-Token");

    if (!verifyAsaasAccessToken(token)) {
      return NextResponse.json({ message: "Token invalido." }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as AsaasWebhookBody;

    const eventId = String(body.id ?? "").trim() || `evt_${Date.now()}`;
    const eventName = String(body.event ?? "").toUpperCase();

    const eventRef = col(COLLECTIONS.billingWebhookEvents).doc(eventId);
    const existingEvent = await eventRef.get();
    if (existingEvent.exists && existingEvent.data()?.processed === true) {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    if (eventName.includes("INVOICE")) {
      return handleInvoiceEvent(eventRef, eventId, eventName, body);
    }

    const isPaymentEvent =
      eventName.includes("PAYMENT") ||
      eventName === "PAYMENT_RECEIVED" ||
      eventName === "PAYMENT_CONFIRMED" ||
      eventName === "PAYMENT_OVERDUE" ||
      eventName === "PAYMENT_RECEIVED_IN_CASH";

    if (isPaymentEvent) {
      return handlePaymentEvent(eventRef, eventId, eventName, body);
    }

    await markEventProcessed(eventRef, {
      eventId,
      event: eventName,
      ignored: true,
    });
    return NextResponse.json({ ok: true, ignored: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
