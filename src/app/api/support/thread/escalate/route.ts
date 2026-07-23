import { NextResponse } from "next/server";

import { apiRoute } from "@/lib/auth/api-route";
import { escalateCurrentUserThread } from "@/lib/support/service";

export async function POST() {
  return apiRoute(async () => {
    const thread = await escalateCurrentUserThread();
    return NextResponse.json({ thread });
  });
}
