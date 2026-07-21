import { COLLECTIONS, col } from "@/lib/firebase/collections";
import { listAdminProviders } from "@/lib/admin/providers";
import { countRoadmapByStatus } from "@/lib/admin/roadmap-storage";

export type AdminUserRow = {
  ownerUserId: string;
  email: string;
  fullName: string;
  party: string;
  uf: string;
  status: string;
  planId: string;
  createdAt: string;
  updatedAt: string;
};

export async function listAdminUsers(limit = 100): Promise<AdminUserRow[]> {
  const snap = await col(COLLECTIONS.userRegistrations).limit(limit).get();
  const rows: AdminUserRow[] = snap.docs.map((doc) => {
    const data = doc.data();
    return {
      ownerUserId: doc.id,
      email: String(data.email ?? ""),
      fullName: String(data.fullName ?? ""),
      party: String(data.party ?? ""),
      uf: String(data.uf ?? ""),
      status: String(data.status ?? "incomplete"),
      planId: String(data.planId ?? ""),
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

  const completeUsers = users.filter((u) => u.status === "complete").length;
  const providersConfigured = providers.filter((p) => p.status === "configured").length;
  const providersMissing = providers.filter((p) => p.status === "missing").length;

  return {
    users: {
      total: users.length,
      complete: completeUsers,
      incomplete: users.length - completeUsers,
    },
    roadmap,
    providers: {
      total: providers.length,
      configured: providersConfigured,
      missing: providersMissing,
    },
  };
}
