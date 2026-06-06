import { NextResponse } from "next/server";

import { clearSessionCookie } from "@/lib/auth/session";

export async function GET(request: Request) {
  await clearSessionCookie();

  const requestUrl = new URL(request.url);
  const nextPath = requestUrl.searchParams.get("next")?.trim() || "/login";
  const redirectUrl = new URL(nextPath, requestUrl.origin);

  return NextResponse.redirect(redirectUrl);
}
