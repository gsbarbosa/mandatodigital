import type { BillingStatus } from "@/lib/billing/plan-pricing";

export type AdminUserRow = {
  ownerUserId: string;
  email: string;
  fullName: string;
  party: string;
  uf: string;
  role: string;
  status: string;
  planId: string;
  billingStatus: BillingStatus;
  billingMethod: "boleto" | "pix" | null;
  paidInstallments: number;
  lastPaidAt: string | null;
  pendingBoletoValue: number | null;
  pendingBoletoDueDate: string | null;
  lastNfsStatus: string | null;
  lastNfsNumber: string | null;
  lastNfsPdfUrl: string | null;
  asaasSubscriptionId: string | null;
  billingFirstDueDate: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NfsBucket = "authorized" | "error" | "pending" | "none";

export type AdminPlanBucket = "essencial" | "avancado" | "elite" | "none";

export type AdminBillingSummary = {
  total: number;
  newLast7d: number;
  complete: number;
  incomplete: number;
  paid: number;
  pendingPayment: number;
  trial: number;
  pastDue: number;
  canceled: number;
  nfsAuthorized: number;
  nfsError: number;
  nfsPending: number;
  byPlan: Record<AdminPlanBucket, { total: number; paid: number }>;
};

const EMPTY_PLAN = { total: 0, paid: 0 };

export function classifyNfsStatus(status: string | null | undefined): NfsBucket {
  const raw = String(status ?? "").trim().toLowerCase();
  if (!raw) {
    return "none";
  }
  if (raw === "authorized" || raw === "autorizada") {
    return "authorized";
  }
  if (raw === "error" || raw.includes("error") || raw.includes("cancel")) {
    return "error";
  }
  return "pending";
}

export function planBucket(planId: string | null | undefined): AdminPlanBucket {
  if (planId === "essencial" || planId === "avancado" || planId === "elite") {
    return planId;
  }
  return "none";
}

export function summarizeAdminBilling(
  users: AdminUserRow[],
  now = new Date(),
): AdminBillingSummary {
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const byPlan: AdminBillingSummary["byPlan"] = {
    essencial: { ...EMPTY_PLAN },
    avancado: { ...EMPTY_PLAN },
    elite: { ...EMPTY_PLAN },
    none: { ...EMPTY_PLAN },
  };

  const summary: AdminBillingSummary = {
    total: users.length,
    newLast7d: 0,
    complete: 0,
    incomplete: 0,
    paid: 0,
    pendingPayment: 0,
    trial: 0,
    pastDue: 0,
    canceled: 0,
    nfsAuthorized: 0,
    nfsError: 0,
    nfsPending: 0,
    byPlan,
  };

  for (const user of users) {
    if ((user.createdAt || "") >= weekAgo) {
      summary.newLast7d += 1;
    }
    if (user.status === "complete") {
      summary.complete += 1;
    } else {
      summary.incomplete += 1;
    }

    if (user.billingStatus === "active") {
      summary.paid += 1;
    } else if (user.billingStatus === "pending_payment") {
      summary.pendingPayment += 1;
    } else if (user.billingStatus === "past_due") {
      summary.pastDue += 1;
    } else if (user.billingStatus === "canceled") {
      summary.canceled += 1;
    } else {
      summary.trial += 1;
    }

    const nfs = classifyNfsStatus(user.lastNfsStatus);
    if (nfs === "authorized" || user.lastNfsPdfUrl) {
      summary.nfsAuthorized += 1;
    } else if (nfs === "error") {
      summary.nfsError += 1;
    } else if (nfs === "pending") {
      summary.nfsPending += 1;
    }

    const plan = planBucket(user.planId);
    byPlan[plan].total += 1;
    if (user.billingStatus === "active") {
      byPlan[plan].paid += 1;
    }
  }

  return summary;
}

export const BILLING_STATUS_LABELS: Record<BillingStatus, string> = {
  trial: "Trial",
  pending_payment: "Aguardando pagamento",
  active: "Pago / ativo",
  past_due: "Inadimplente",
  canceled: "Cancelado",
};

export const NFS_BUCKET_LABELS: Record<NfsBucket, string> = {
  authorized: "NFS autorizada",
  error: "NFS com erro",
  pending: "NFS pendente",
  none: "Sem NFS",
};

export const PLAN_LABELS: Record<AdminPlanBucket, string> = {
  essencial: "Essencial",
  avancado: "Avançado",
  elite: "Elite",
  none: "Sem plano",
};
