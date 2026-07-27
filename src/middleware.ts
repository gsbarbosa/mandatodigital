import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/auth/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // `geo/` são as bases estáticas de UF/municípios em public/ — assets, não rotas.
    "/((?!_next/static|_next/image|favicon.ico|geo/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
