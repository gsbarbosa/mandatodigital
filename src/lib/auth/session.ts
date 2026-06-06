import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getFirebaseAdminAuth } from "@/lib/firebase/admin";
import { isFirebaseAuthConfigured } from "@/lib/firebase/env";
import { FIREBASE_SESSION_COOKIE } from "@/lib/firebase/session";

export type SessionUser = {
  id: string;
  email: string;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  if (!isFirebaseAuthConfigured()) {
    return null;
  }

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(FIREBASE_SESSION_COOKIE)?.value;

  if (!sessionCookie) {
    return null;
  }

  try {
    const decoded = await getFirebaseAdminAuth().verifySessionCookie(sessionCookie, true);

    return {
      id: decoded.uid,
      email: decoded.email ?? "",
    };
  } catch {
    return null;
  }
}

export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}
