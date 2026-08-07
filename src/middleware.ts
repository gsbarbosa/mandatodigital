import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/auth/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // `geo/`, `vozdelas/` e `materialidade/` são estáticos em public/ — assets, não rotas de app.
    "/((?!_next/static|_next/image|favicon.ico|geo/|vozdelas/|materialidade/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2|html|pdf)$).*)",
  ],
};
