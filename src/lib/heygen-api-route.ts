import type { NextResponse } from "next/server";

import { apiRoute } from "@/lib/auth/api-route";
import { runWithHeyGenApiKey } from "@/lib/heygen";
import { readHeyGenOverrideFromRequest } from "@/lib/heygen-api-key";
import type { Repository } from "@/lib/storage";

export function heygenApiRoute(
  request: Request,
  handler: (repository: Repository) => Promise<NextResponse>,
) {
  const overrideKey = readHeyGenOverrideFromRequest(request);
  if (overrideKey) {
    return runWithHeyGenApiKey(overrideKey, () => apiRoute(handler));
  }
  return apiRoute(handler);
}
