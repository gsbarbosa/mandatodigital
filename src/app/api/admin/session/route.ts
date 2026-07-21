import { NextResponse } from "next/server";

import { adminApiRoute } from "@/lib/admin/api-route";
import { getAdminSession } from "@/lib/admin/session";

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({ authenticated: true, email: session.email });
}

export async function POST() {
  return adminApiRoute(async () => {
    const session = await getAdminSession();
    return { authenticated: true, email: session?.email ?? "" };
  });
}
