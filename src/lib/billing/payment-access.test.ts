import { describe, expect, it } from "vitest";

import {
  daysUntilDueDate,
  isBillingAccessBlocked,
  isDueSoonAlert,
  isPaymentLockAllowedPath,
  resolveNextOpenDueDate,
  resolvePaymentAccess,
} from "./payment-access";

describe("payment-access", () => {
  it("bloqueia past_due e pending_payment", () => {
    expect(isBillingAccessBlocked("past_due")).toBe(true);
    expect(isBillingAccessBlocked("pending_payment")).toBe(true);
    expect(isBillingAccessBlocked("active")).toBe(false);
    expect(isBillingAccessBlocked("trial")).toBe(false);
  });

  it("libera só Meus pagamentos e CNPJ", () => {
    expect(isPaymentLockAllowedPath("/acesso-antecipado/pagamento")).toBe(true);
    expect(isPaymentLockAllowedPath("/acesso-antecipado/cnpj")).toBe(true);
    expect(isPaymentLockAllowedPath("/acesso-antecipado/planos")).toBe(false);
    expect(isPaymentLockAllowedPath("/monitoramento")).toBe(false);
  });

  it("calcula dias até vencimento em calendário local", () => {
    const now = new Date(2026, 7, 7); // 7 ago 2026
    expect(daysUntilDueDate("2026-08-07", now)).toBe(0);
    expect(daysUntilDueDate("2026-08-12", now)).toBe(5);
    expect(daysUntilDueDate("2026-08-06", now)).toBe(-1);
  });

  it("alerta D-5 só na janela [0, 5]", () => {
    expect(isDueSoonAlert(0)).toBe(true);
    expect(isDueSoonAlert(5)).toBe(true);
    expect(isDueSoonAlert(6)).toBe(false);
    expect(isDueSoonAlert(-1)).toBe(false);
    expect(isDueSoonAlert(null)).toBe(false);
  });

  it("escolhe a próxima parcela em aberto", () => {
    expect(
      resolveNextOpenDueDate([
        { dueDate: "2026-08-01", status: "paid" },
        { dueDate: "2026-09-01", status: "pending" },
        { dueDate: "2026-10-01", status: "scheduled" },
      ]),
    ).toBe("2026-09-01");
  });

  it("monta snapshot de acesso", () => {
    const now = new Date(2026, 7, 7);
    expect(
      resolvePaymentAccess({
        billingStatus: "active",
        installments: [
          { dueDate: "2026-08-01", status: "paid" },
          { dueDate: "2026-08-12", status: "pending" },
        ],
        now,
      }),
    ).toEqual({
      blocked: false,
      dueSoon: true,
      daysUntilNextDue: 5,
      nextDueDate: "2026-08-12",
    });

    expect(
      resolvePaymentAccess({
        billingStatus: "past_due",
        installments: [{ dueDate: "2026-08-01", status: "overdue" }],
        now,
      }).blocked,
    ).toBe(true);
  });
});
