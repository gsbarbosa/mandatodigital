import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/auth/middleware";

const CANONICAL_WWW_HOST = "www.mandatodigital.ia.br";
const CANONICAL_APEX_HOST = "mandatodigital.ia.br";

function requestHostname(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwarded || request.headers.get("host") || request.nextUrl.host;
  return host.split(":")[0]?.toLowerCase() ?? "";
}

export async function middleware(request: NextRequest) {
  if (requestHostname(request) === CANONICAL_WWW_HOST) {
    const dest = new URL(
      `https://${CANONICAL_APEX_HOST}${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    return NextResponse.redirect(dest, 308);
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    // Landings estáticas em public/ — assets, não rotas de app.
    "/((?!_next/static|_next/image|favicon.ico|geo/|vozdelas/|materialidade/|chapas-femininas/|na-pratica/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2|html|pdf)$).*)",
  ],
};
