import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  adminSessionCookieOptions,
  createAdminSessionToken,
  validateAdminCredentials,
} from "@/lib/admin/session";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin/credentials";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    if (!validateAdminCredentials(body.email, body.password)) {
      return NextResponse.json({ message: "Credenciais inválidas." }, { status: 401 });
    }

    const token = createAdminSessionToken(body.email);
    const cookieStore = await cookies();
    cookieStore.set(ADMIN_SESSION_COOKIE, token, adminSessionCookieOptions());

    return NextResponse.json({ ok: true, email: body.email.trim().toLowerCase() });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Informe e-mail e senha." }, { status: 400 });
    }
    console.error("[admin/login]", error);
    return NextResponse.json({ message: "Falha no login." }, { status: 500 });
  }
}
