import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { recordAuditEventFireAndForget } from "@/lib/audit/record";
import { getFirebaseAdminAuth } from "@/lib/firebase/admin";
import { isFirebaseAuthConfigured } from "@/lib/firebase/env";
import {
  FIREBASE_SESSION_COOKIE,
  FIREBASE_SESSION_MAX_AGE_MS,
} from "@/lib/firebase/session";
import { toDatabaseOwnerUserId } from "@/lib/owner-user-id";
import {
  ensureUserRegistration,
  isUserRegistrationComplete,
} from "@/lib/user-registration-storage";

export async function POST(request: Request) {
  if (!isFirebaseAuthConfigured()) {
    return NextResponse.json({ message: "Login nao configurado." }, { status: 501 });
  }

  let idToken = "";

  try {
    const body = (await request.json()) as { idToken?: string };
    idToken = body.idToken?.trim() ?? "";
  } catch {
    return NextResponse.json({ message: "Corpo invalido." }, { status: 400 });
  }

  if (!idToken) {
    return NextResponse.json({ message: "idToken obrigatorio." }, { status: 400 });
  }

  try {
    const auth = getFirebaseAdminAuth();
    const decoded = await auth.verifyIdToken(idToken);
    const sessionCookie = await auth.createSessionCookie(idToken, {
      expiresIn: FIREBASE_SESSION_MAX_AGE_MS,
    });

    const cookieStore = await cookies();
    cookieStore.set(FIREBASE_SESSION_COOKIE, sessionCookie, {
      maxAge: FIREBASE_SESSION_MAX_AGE_MS / 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    let registrationComplete = false;
    try {
      const registration = await ensureUserRegistration({
        ownerUserId: decoded.uid,
        email: decoded.email ?? "",
      });
      registrationComplete = isUserRegistrationComplete(registration);
    } catch (bootstrapError) {
      console.error("[auth/session] ensureUserRegistration failed:", bootstrapError);
    }

    recordAuditEventFireAndForget({
      request,
      ownerUserId: toDatabaseOwnerUserId(decoded.uid),
      action: "session_login",
      payload: {
        email: decoded.email ?? "",
        registrationComplete,
      },
    });

    return NextResponse.json({
      ok: true,
      email: decoded.email ?? "",
      registrationComplete,
    });
  } catch (error) {
    console.error("[auth/session] createSessionCookie failed:", error);
    return NextResponse.json({ message: "Token invalido ou expirado." }, { status: 401 });
  }
}
