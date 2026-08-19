import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/auth/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Landings estáticas em public/ — assets, não rotas de app.
    "/((?!_next/static|_next/image|favicon.ico|geo/|vozdelas/|materialidade/|chapas-femininas/|na-pratica/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2|html|pdf)$).*)",
  ],
};
