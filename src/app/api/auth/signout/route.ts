import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getFirebaseAdminAuth } from "@/lib/firebase/admin";
import { clearSessionCookie } from "@/lib/auth/session";
import { isFirebaseAuthConfigured } from "@/lib/firebase/env";
import { FIREBASE_SESSION_COOKIE } from "@/lib/firebase/session";

export async function POST() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(FIREBASE_SESSION_COOKIE)?.value;

  if (isFirebaseAuthConfigured() && sessionCookie) {
    try {
      const decoded = await getFirebaseAdminAuth().verifySessionCookie(sessionCookie);
      await getFirebaseAdminAuth().revokeRefreshTokens(decoded.sub);
    } catch {
      // Cookie invalido ou expirado — segue limpando no cliente.
    }
  }

  await clearSessionCookie();

  return NextResponse.json({ ok: true });
}
