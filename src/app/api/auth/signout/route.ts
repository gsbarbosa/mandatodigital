import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getFirebaseAdminAuth } from "@/lib/firebase/admin";
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

  cookieStore.set(FIREBASE_SESSION_COOKIE, "", {
    maxAge: 0,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  return NextResponse.json({ ok: true });
}
