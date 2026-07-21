import { adminApiRoute } from "@/lib/admin/api-route";
import { listAdminProviders } from "@/lib/admin/providers";

export async function GET() {
  return adminApiRoute(async () => ({ providers: listAdminProviders() }));
}
