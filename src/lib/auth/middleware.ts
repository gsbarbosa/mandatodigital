import { NextResponse, type NextRequest } from "next/server";

import { FIREBASE_SESSION_COOKIE } from "@/lib/firebase/session";
import {
  getAuthSetupMessage,
  isFirebaseAuthConfigured,
  shouldEnforceLogin,
} from "@/lib/firebase/env";

function isE2eAuthBypassEnabled() {
  return process.env.E2E_DISABLE_AUTH?.trim().toLowerCase() === "true";
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (isE2eAuthBypassEnabled()) {
    return NextResponse.next({ request });
  }

  const isPublicRoute =
    pathname === "/" ||
    pathname === "/login" ||
    pathname.startsWith("/auth/") ||
    pathname === "/api/argil/webhooks" ||
    pathname === "/api/auth/session" ||
    pathname === "/api/auth/clear-session";
  const isApiRoute = pathname.startsWith("/api/");

  if (!isFirebaseAuthConfigured()) {
    if (shouldEnforceLogin() && !isPublicRoute && !pathname.startsWith("/_next") && !isApiRoute) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("next", pathname);
      if (getAuthSetupMessage()) {
        loginUrl.searchParams.set("setup", "firebase-auth");
      }
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next({ request });
  }

  const hasSession = Boolean(request.cookies.get(FIREBASE_SESSION_COOKIE)?.value);

  if (!hasSession && !isPublicRoute && !pathname.startsWith("/_next")) {
    if (isApiRoute) {
      return NextResponse.next({ request });
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next({ request });
}
