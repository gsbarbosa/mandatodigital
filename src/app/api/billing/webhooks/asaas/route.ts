import { timingSafeEqual } from "node:crypto";

import type { DocumentReference } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { asaasGetInvoice, asaasGetPayment } from "@/lib/asaas/client";
import { handleRouteError } from "@/lib/api";
import { getPlanPricing } from "@/lib/billing/plan-pricing";
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

const PAID_STATUSES = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]);

type AsaasWebhookBody = {
  id?: string;
  event?: string;
  payment?: {
    id?: string;
    customer?: string;
    subscription?: string | null;
    status?: string;
    value?: number;
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

  const status = String(payment?.status ?? "").toUpperCase();
  if (!PAID_STATUSES.has(status)) {
    appLog("billing", "webhook_payment_not_paid", { paymentId, status, eventName });
    await markEventProcessed(eventRef, {
      eventId,
      event: eventName,
      paymentId,
      status,
    });
    return NextResponse.json({ ok: true, status });
  }

  const customerId = String(payment?.customer ?? body.payment?.customer ?? "").trim();
  if (!customerId) {
    return NextResponse.json({ ok: true, matched: false });
  }

  const registration = await findRegistrationByAsaasCustomerId(customerId);
  if (!registration) {
    appLog("billing", "webhook_customer_unmatched", { customerId, paymentId }, "warn");
    return NextResponse.json({ ok: true, matched: false });
  }

  if (registration.lastPaidPaymentId === paymentId) {
    await markEventProcessed(eventRef, {
      eventId,
      event: eventName,
      paymentId,
      ownerUserId: registration.ownerUserId,
      duplicatePayment: true,
      paidInstallments: registration.paidInstallments || 0,
    });
    return NextResponse.json({
      ok: true,
      matched: true,
      duplicatePayment: true,
      billingStatus: "active",
      paidInstallments: registration.paidInstallments || 0,
    });
  }

  const paidInstallments = Math.min(
    (registration.paidInstallments || 0) + 1,
    registration.planId ? getPlanPricing(registration.planId).installmentCount : 3,
  );

  await updateUserRegistrationBilling(registration.ownerUserId, {
    billingStatus: "active",
    paidInstallments,
    lastPaidPaymentId: paymentId,
    pendingBoletoUrl: null,
    pendingBoletoLinhaDigitavel: null,
    pendingBoletoDueDate: null,
    pendingBoletoValue: null,
    pendingPixPayload: null,
    pendingPixQrImage: null,
    pendingPixExpiration: null,
  });

  await markEventProcessed(eventRef, {
    eventId,
    event: eventName,
    paymentId,
    ownerUserId: registration.ownerUserId,
    paidInstallments,
  });

  appLog("billing", "payment_confirmed", {
    ownerUserId: registration.ownerUserId,
    paymentId,
    paidInstallments,
    planId: registration.planId,
  });

  return NextResponse.json({
    ok: true,
    matched: true,
    billingStatus: "active",
    paidInstallments,
  });
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
