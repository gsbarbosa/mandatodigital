import { NextResponse } from "next/server";

import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { isSupabaseAuthConfigured } from "@/lib/supabase/env";

export async function requireApiUser(): Promise<SessionUser | NextResponse> {
  if (!isSupabaseAuthConfigured()) {
    return NextResponse.json(
      {
        message:
          "Login nao configurado. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      },
      { status: 501 },
    );
  }

  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ message: "Faca login para continuar." }, { status: 401 });
  }

  return user;
}

export function isApiUser(
  value: SessionUser | NextResponse,
): value is SessionUser {
  return !(value instanceof NextResponse);
}
