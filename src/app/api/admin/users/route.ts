import { adminApiRoute } from "@/lib/admin/api-route";
import { listAdminUsers } from "@/lib/admin/stats";

export async function GET() {
  return adminApiRoute(async () => ({ users: await listAdminUsers(200) }));
}
