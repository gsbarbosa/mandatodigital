import { NextResponse } from "next/server";

import { isRuntimeEnvSet } from "@/lib/runtime-env";
import {
  getFirebaseStorageBucketName,
  hasFirebaseServiceAccount,
  isFirebaseAuthConfigured,
} from "@/lib/firebase/env";

/** Diagnóstico leve — não expõe valores de secrets. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    authConfigured: isFirebaseAuthConfigured(),
    firebaseAdmin: hasFirebaseServiceAccount(),
    storageBucket: Boolean(getFirebaseStorageBucketName()),
    serviceAccountJson: isRuntimeEnvSet("FIREBASE_SERVICE_ACCOUNT_JSON"),
    serverless: Boolean(process.env.K_SERVICE),
  });
}
