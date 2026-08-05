import { describe, expect, it } from "vitest";

import {
  classifyNfsStatus,
  summarizeAdminBilling,
  type AdminUserRow,
} from "./billing-dashboard";

function row(partial: Partial<AdminUserRow>): AdminUserRow {
  return {
    ownerUserId: "u1",
    email: "a@x.com",
    fullName: "Ana",
    party: "PT",
    uf: "SP",
    role: "vereadora",
    status: "complete",
    planId: "essencial",
    billingStatus: "trial",
    billingMethod: null,
    paidInstallments: 0,
    lastPaidAt: null,
    pendingBoletoValue: null,
    pendingBoletoDueDate: null,
    lastNfsStatus: null,
    lastNfsNumber: null,
    lastNfsPdfUrl: null,
    asaasSubscriptionId: null,
    billingFirstDueDate: null,
    createdAt: "2026-08-01T10:00:00.000Z",
    updatedAt: "2026-08-01T10:00:00.000Z",
    ...partial,
  };
}

describe("billing-dashboard", () => {
  it("classifica NFS", () => {
    expect(classifyNfsStatus(null)).toBe("none");
    expect(classifyNfsStatus("authorized")).toBe("authorized");
    expect(classifyNfsStatus("error")).toBe("error");
    expect(classifyNfsStatus("scheduled")).toBe("pending");
  });

  it("agrega cadastros, pagamento, plano e NFS", () => {
    const now = new Date("2026-08-04T15:00:00.000Z");
    const summary = summarizeAdminBilling(
      [
        row({
          ownerUserId: "new-paid",
          createdAt: "2026-08-03T12:00:00.000Z",
          billingStatus: "active",
          planId: "avancado",
          paidInstallments: 1,
          lastNfsStatus: "authorized",
        }),
        row({
          ownerUserId: "pending",
          createdAt: "2026-07-01T12:00:00.000Z",
          billingStatus: "pending_payment",
          planId: "essencial",
          lastNfsStatus: null,
        }),
        row({
          ownerUserId: "trial",
          status: "incomplete",
          createdAt: "2026-08-04T10:00:00.000Z",
          billingStatus: "trial",
          planId: "",
        }),
        row({
          ownerUserId: "nfs-err",
          createdAt: "2026-06-01T12:00:00.000Z",
          billingStatus: "active",
          planId: "elite",
          lastNfsStatus: "error",
        }),
      ],
      now,
    );

    expect(summary.total).toBe(4);
    expect(summary.newLast7d).toBe(2);
    expect(summary.complete).toBe(3);
    expect(summary.incomplete).toBe(1);
    expect(summary.paid).toBe(2);
    expect(summary.pendingPayment).toBe(1);
    expect(summary.trial).toBe(1);
    expect(summary.nfsAuthorized).toBe(1);
    expect(summary.nfsError).toBe(1);
    expect(summary.byPlan.avancado).toEqual({ total: 1, paid: 1 });
    expect(summary.byPlan.essencial).toEqual({ total: 1, paid: 0 });
    expect(summary.byPlan.elite).toEqual({ total: 1, paid: 1 });
    expect(summary.byPlan.none).toEqual({ total: 1, paid: 0 });
  });
});
