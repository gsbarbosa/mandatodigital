import { describe, expect, it } from "vitest";

import {
  decideBillingFromAsaasPayments,
  decideBillingFromSinglePaidPayment,
  parseCheckoutExternalReference,
  type BillingSyncSnapshot,
} from "./asaas-payment-sync";

const base: BillingSyncSnapshot = {
  billingStatus: "pending_payment",
  planId: "essencial",
  paidInstallments: 0,
  lastPaidPaymentId: null,
  lastPaidAt: null,
  billingMethod: "pix",
  asaasSubscriptionId: "sub_1",
};

describe("asaas-payment-sync", () => {
  it("parseia externalReference do checkout", () => {
    expect(parseCheckoutExternalReference("uid123:avancado:pix")).toEqual({
      ownerUserId: "uid123",
      planId: "avancado",
      method: "pix",
      smoke: false,
    });
    expect(parseCheckoutExternalReference("uid123:elite:smoke:boleto")).toMatchObject({
      planId: "elite",
      method: "boleto",
      smoke: true,
    });
  });

  it("ativa e grava o plano pago a partir da lista Asaas", () => {
    const decided = decideBillingFromAsaasPayments({
      current: { ...base, planId: "essencial" },
      payments: [
        {
          id: "pay_1",
          status: "RECEIVED",
          dueDate: "2026-08-05",
          externalReference: "uid123:avancado:pix",
          subscription: "sub_1",
          billingType: "PIX",
        },
      ],
      nowIso: "2026-08-05T15:00:00.000Z",
    });
    expect(decided.next).toMatchObject({
      billingStatus: "active",
      planId: "avancado",
      paidInstallments: 1,
      lastPaidPaymentId: "pay_1",
      lastPaidAt: "2026-08-05T15:00:00.000Z",
    });
    expect(decided.clearPendingInstruments).toBe(true);
    expect(decided.changed).toBe(true);
  });

  it("nao limpa instrumentos se ainda ha parcela em aberto", () => {
    const decided = decideBillingFromAsaasPayments({
      current: {
        ...base,
        billingStatus: "active",
        paidInstallments: 1,
        lastPaidPaymentId: "pay_1",
      },
      payments: [
        {
          id: "pay_1",
          status: "RECEIVED",
          dueDate: "2026-08-05",
          externalReference: "uid123:essencial:pix",
          billingType: "PIX",
        },
        {
          id: "pay_2",
          status: "PENDING",
          dueDate: "2026-09-05",
          externalReference: "uid123:essencial:pix",
          billingType: "PIX",
        },
        {
          id: "pay_3",
          status: "PENDING",
          dueDate: "2026-10-05",
          externalReference: "uid123:essencial:pix",
          billingType: "PIX",
        },
      ],
      nowIso: "2026-08-05T15:00:00.000Z",
    });
    expect(decided.next.billingStatus).toBe("active");
    expect(decided.next.paidInstallments).toBe(1);
    expect(decided.clearPendingInstruments).toBe(false);
  });

  it("marca past_due sem pagamento e inadimplente se atrasar parcela depois de pagar", () => {
    const unpaid = decideBillingFromAsaasPayments({
      current: base,
      payments: [
        {
          id: "pay_1",
          status: "OVERDUE",
          dueDate: "2026-08-01",
          externalReference: "uid123:essencial:boleto",
          subscription: "sub_1",
          billingType: "BOLETO",
        },
      ],
      nowIso: "2026-08-05T15:00:00.000Z",
    });
    expect(unpaid.next.billingStatus).toBe("past_due");
    expect(unpaid.next.paidInstallments).toBe(0);

    const late = decideBillingFromAsaasPayments({
      current: {
        ...base,
        billingStatus: "active",
        paidInstallments: 1,
        lastPaidPaymentId: "pay_1",
        lastPaidAt: "2026-08-01T12:00:00.000Z",
      },
      payments: [
        {
          id: "pay_1",
          status: "CONFIRMED",
          dueDate: "2026-08-01",
          externalReference: "uid123:elite:boleto",
          subscription: "sub_1",
          billingType: "BOLETO",
        },
        {
          id: "pay_2",
          status: "OVERDUE",
          dueDate: "2026-09-01",
          externalReference: "uid123:elite:boleto",
          subscription: "sub_1",
          billingType: "BOLETO",
        },
      ],
      nowIso: "2026-09-05T15:00:00.000Z",
    });
    expect(late.next.billingStatus).toBe("past_due");
    expect(late.next.planId).toBe("elite");
    expect(late.next.paidInstallments).toBe(1);
  });

  it("webhook de um pagamento novo incrementa parcela sem duplicar o mesmo id", () => {
    const first = decideBillingFromSinglePaidPayment({
      current: base,
      payment: {
        id: "pay_1",
        status: "CONFIRMED",
        dueDate: "2026-08-05",
        externalReference: "uid123:elite:pix",
        subscription: "sub_9",
        billingType: "PIX",
      },
      nowIso: "2026-08-05T15:00:00.000Z",
    });
    expect(first.duplicatePayment).toBe(false);
    expect(first.next).toMatchObject({
      billingStatus: "active",
      planId: "elite",
      paidInstallments: 1,
      lastPaidPaymentId: "pay_1",
    });
    expect(first.clearPendingInstruments).toBe(false);

    const dup = decideBillingFromSinglePaidPayment({
      current: first.next,
      payment: {
        id: "pay_1",
        status: "RECEIVED",
        dueDate: "2026-08-05",
        externalReference: "uid123:elite:pix",
        subscription: "sub_9",
        billingType: "PIX",
      },
      nowIso: "2026-08-05T15:01:00.000Z",
    });
    expect(dup.duplicatePayment).toBe(true);
    expect(dup.next.paidInstallments).toBe(1);
  });

  it("nao reativa inadimplente no webhook duplicado CONFIRMED+RECEIVED", () => {
    const dup = decideBillingFromSinglePaidPayment({
      current: {
        ...base,
        billingStatus: "past_due",
        planId: "elite",
        paidInstallments: 1,
        lastPaidPaymentId: "pay_1",
        lastPaidAt: "2026-08-05T15:00:00.000Z",
      },
      payment: {
        id: "pay_1",
        status: "RECEIVED",
        dueDate: "2026-08-05",
        externalReference: "uid123:elite:pix",
        billingType: "PIX",
      },
      nowIso: "2026-08-06T15:00:00.000Z",
    });
    expect(dup.duplicatePayment).toBe(true);
    expect(dup.next.billingStatus).toBe("past_due");
    expect(dup.changed).toBe(false);
  });
});
