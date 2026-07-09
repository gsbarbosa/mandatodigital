import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getFirebaseAdminAuth } from "@/lib/firebase/admin";
import { isFirebaseAuthConfigured } from "@/lib/firebase/env";
import {
  FIREBASE_SESSION_COOKIE,
  FIREBASE_SESSION_MAX_AGE_MS,
} from "@/lib/firebase/session";

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
    const sessionCookie = await getFirebaseAdminAuth().createSessionCookie(idToken, {
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

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[auth/session] createSessionCookie failed:", error);
    return NextResponse.json({ message: "Token invalido ou expirado." }, { status: 401 });
  }
}
