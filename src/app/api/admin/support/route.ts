import { adminApiRoute } from "@/lib/admin/api-route";
import { listAdminSupportThreads } from "@/lib/support/storage";

export async function GET() {
  return adminApiRoute(async () => ({
    threads: await listAdminSupportThreads(100),
  }));
}
