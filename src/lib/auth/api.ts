import { NextResponse } from "next/server";

import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { isFirebaseAuthConfigured } from "@/lib/firebase/env";

export async function requireApiUser(): Promise<SessionUser | NextResponse> {
  if (!isFirebaseAuthConfigured()) {
    return NextResponse.json(
      {
        message:
          "Login não configurado. Defina variáveis NEXT_PUBLIC_FIREBASE_* e FIREBASE_SERVICE_ACCOUNT_JSON.",
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
