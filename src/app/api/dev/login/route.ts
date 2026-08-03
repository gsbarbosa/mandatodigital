import { NextResponse } from "next/server";

import { getFirebaseAdminAuth } from "@/lib/firebase/admin";
import { isFirebaseAuthConfigured } from "@/lib/firebase/env";

/**
 * Login sem senha, só para ambiente local (Claude testando no navegador).
 * Usa custom token do Admin SDK — nenhuma credencial em texto plano existe nesse fluxo.
 */
export const DEV_LOGIN_TEST_EMAIL = "dev-tester@mandatodigital.local";

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ message: "Not found." }, { status: 404 });
  }

  if (!isFirebaseAuthConfigured()) {
    return NextResponse.json({ message: "Firebase Auth nao configurado." }, { status: 501 });
  }

  try {
    const auth = getFirebaseAdminAuth();

    const user = await auth.getUserByEmail(DEV_LOGIN_TEST_EMAIL).catch(async (error) => {
      if (error?.code === "auth/user-not-found") {
        return auth.createUser({
          email: DEV_LOGIN_TEST_EMAIL,
          emailVerified: true,
        });
      }
      throw error;
    });

    const customToken = await auth.createCustomToken(user.uid);

    return NextResponse.json({ customToken, email: DEV_LOGIN_TEST_EMAIL });
  } catch (error) {
    console.error("[dev/login] failed:", error);
    return NextResponse.json({ message: "Nao foi possivel gerar o token de teste." }, { status: 500 });
  }
}
