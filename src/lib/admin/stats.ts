import { COLLECTIONS, col } from "@/lib/firebase/collections";
import { listAdminProviders } from "@/lib/admin/providers";
import { countRoadmapByStatus } from "@/lib/admin/roadmap-storage";
import { parseBillingMethod } from "@/lib/billing/billing-method";
import { parseBillingStatus } from "@/lib/billing/plan-pricing";
import {
  summarizeAdminBilling,
  type AdminUserRow,
} from "@/lib/admin/billing-dashboard";

export type { AdminUserRow } from "@/lib/admin/billing-dashboard";

export async function listAdminUsers(limit = 100): Promise<AdminUserRow[]> {
  const snap = await col(COLLECTIONS.userRegistrations).limit(limit).get();
  const rows: AdminUserRow[] = snap.docs.map((doc) => {
    const data = doc.data();
    const paid = Number(data.paidInstallments ?? 0);
    return {
      ownerUserId: doc.id,
      email: String(data.email ?? ""),
      fullName: String(data.fullName ?? ""),
      party: String(data.party ?? ""),
      uf: String(data.uf ?? ""),
      role: String(data.role ?? ""),
      status: String(data.status ?? "incomplete"),
      planId: String(data.planId ?? ""),
      billingStatus: parseBillingStatus(data.billingStatus),
      billingMethod: parseBillingMethod(data.billingMethod),
      paidInstallments: Number.isFinite(paid) && paid > 0 ? Math.floor(paid) : 0,
      pendingBoletoValue:
        data.pendingBoletoValue == null || data.pendingBoletoValue === ""
          ? null
          : Number(data.pendingBoletoValue),
      pendingBoletoDueDate: data.pendingBoletoDueDate
        ? String(data.pendingBoletoDueDate)
        : null,
      lastNfsStatus: data.lastNfsStatus ? String(data.lastNfsStatus) : null,
      lastNfsNumber: data.lastNfsNumber ? String(data.lastNfsNumber) : null,
      lastNfsPdfUrl: data.lastNfsPdfUrl ? String(data.lastNfsPdfUrl) : null,
      asaasSubscriptionId: data.asaasSubscriptionId
        ? String(data.asaasSubscriptionId)
        : null,
      createdAt: String(data.createdAt ?? ""),
      updatedAt: String(data.updatedAt ?? ""),
    };
  });

  rows.sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt));
  return rows;
}

export async function getAdminDashboardStats() {
  const [users, roadmap, providers] = await Promise.all([
    listAdminUsers(500),
    countRoadmapByStatus(),
    Promise.resolve(listAdminProviders()),
  ]);

  const billing = summarizeAdminBilling(users);
  const providersConfigured = providers.filter((p) => p.status === "configured").length;
  const providersMissing = providers.filter((p) => p.status === "missing").length;

  return {
    users: {
      total: billing.total,
      complete: billing.complete,
      incomplete: billing.incomplete,
      newLast7d: billing.newLast7d,
    },
    billing,
    recentUsers: users.slice(0, 12),
    roadmap,
    providers: {
      total: providers.length,
      configured: providersConfigured,
      missing: providersMissing,
    },
  };
}
