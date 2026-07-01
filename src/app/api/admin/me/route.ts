import { NextResponse } from "next/server";

import { isApiUser, requireApiUser } from "@/lib/auth/api";
import { isPlatformAdminEmail } from "@/lib/platform-admin";

export async function GET() {
  const userOrResponse = await requireApiUser();
  if (!isApiUser(userOrResponse)) {
    return userOrResponse;
  }

  return NextResponse.json({
    isAdmin: isPlatformAdminEmail(userOrResponse.email),
    email: userOrResponse.email,
  });
}
