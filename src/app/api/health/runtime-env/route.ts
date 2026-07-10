import { NextResponse } from "next/server";

import { isRuntimeEnvSet } from "@/lib/runtime-env";
import { isFirebaseAuthConfigured } from "@/lib/firebase/env";

/** Diagnóstico leve — não expõe valores de secrets. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    authConfigured: isFirebaseAuthConfigured(),
    supabaseUrl: isRuntimeEnvSet("SUPABASE_URL") || isRuntimeEnvSet("NEXT_PUBLIC_SUPABASE_URL"),
    supabaseServiceRole: isRuntimeEnvSet("SUPABASE_SERVICE_ROLE_KEY"),
    serverless: Boolean(process.env.K_SERVICE),
  });
}
