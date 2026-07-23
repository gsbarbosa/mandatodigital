import { NextResponse, type NextRequest } from "next/server";

import { FIREBASE_SESSION_COOKIE } from "@/lib/firebase/session";
import {
  getAuthSetupMessage,
  isFirebaseAuthConfigured,
  shouldEnforceLogin,
} from "@/lib/firebase/env";

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  const isAdminRoute =
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname.startsWith("/api/admin/");
  const isMarketingRoute =
    pathname === "/ecossistema" ||
    pathname === "/conformidade" ||
    pathname === "/planos";
  const isPublicRoute =
    pathname === "/" ||
    pathname === "/login" ||
    pathname.startsWith("/auth/") ||
    pathname === "/api/heygen/webhooks" ||
    pathname === "/api/auth/session" ||
    pathname === "/api/auth/clear-session" ||
    isMarketingRoute ||
    isAdminRoute;
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

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  const hasSession = Boolean(request.cookies.get(FIREBASE_SESSION_COOKIE)?.value);

  if (!hasSession && !isPublicRoute && !pathname.startsWith("/_next")) {
    if (isApiRoute) {
      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}
