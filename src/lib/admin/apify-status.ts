import { fetchApifyAccountStatus } from "@/lib/admin/provider-status";
import { resolveProviderApiKey } from "@/lib/admin/provider-secrets";
import { getEnvTokenForProvider } from "@/lib/admin/provider-secrets";

export type { ApifyAccountStatus } from "@/lib/admin/provider-status";
export { fetchApifyAccountStatus };

export async function resolveApifyTokenWithSource() {
  return resolveProviderApiKey("apify");
}

export function getApifyEnvToken() {
  return getEnvTokenForProvider("apify");
}
