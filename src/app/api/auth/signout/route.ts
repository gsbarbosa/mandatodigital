import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { recordAuditEventFireAndForget } from "@/lib/audit/record";
import { getFirebaseAdminAuth } from "@/lib/firebase/admin";
import { clearSessionCookie } from "@/lib/auth/session";
import { isFirebaseAuthConfigured } from "@/lib/firebase/env";
import { FIREBASE_SESSION_COOKIE } from "@/lib/firebase/session";
import { toDatabaseOwnerUserId } from "@/lib/owner-user-id";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(FIREBASE_SESSION_COOKIE)?.value;
  let ownerUserId = "";

  if (isFirebaseAuthConfigured() && sessionCookie) {
    try {
      const decoded = await getFirebaseAdminAuth().verifySessionCookie(sessionCookie);
      ownerUserId = toDatabaseOwnerUserId(decoded.sub);
      await getFirebaseAdminAuth().revokeRefreshTokens(decoded.sub);
    } catch {
      // Cookie invalido ou expirado — segue limpando no cliente.
    }
  }

  if (ownerUserId) {
    recordAuditEventFireAndForget({
      request,
      ownerUserId,
      action: "session_logout",
      payload: {},
    });
  }

  await clearSessionCookie();

  return NextResponse.json({ ok: true });
}
