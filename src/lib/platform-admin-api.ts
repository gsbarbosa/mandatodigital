import { NextResponse } from "next/server";

import { isApiUser, requireApiUser } from "@/lib/auth/api";
import { isPlatformAdminEmail } from "@/lib/platform-admin";

export async function requirePlatformAdminApiUser() {
  const userOrResponse = await requireApiUser();
  if (!isApiUser(userOrResponse)) {
    return userOrResponse;
  }

  if (!isPlatformAdminEmail(userOrResponse.email)) {
    return NextResponse.json(
      { message: "Acesso restrito a administradores da plataforma." },
      { status: 403 },
    );
  }

  return userOrResponse;
}
