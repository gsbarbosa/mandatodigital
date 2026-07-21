import { adminApiRoute } from "@/lib/admin/api-route";
import { getAdminDashboardStats } from "@/lib/admin/stats";

export async function GET() {
  return adminApiRoute(async () => getAdminDashboardStats());
}
