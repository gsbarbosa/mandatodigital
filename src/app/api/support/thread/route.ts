import { NextResponse } from "next/server";

import { apiRoute } from "@/lib/auth/api-route";
import { loadUserSupportThread } from "@/lib/support/service";

export async function GET() {
  return apiRoute(async () => {
    const thread = await loadUserSupportThread();
    return NextResponse.json({ thread });
  });
}
