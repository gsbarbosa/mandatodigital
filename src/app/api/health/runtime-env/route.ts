import { NextResponse } from "next/server";

import {
  isUsingDefaultAdminPassword,
  isUsingDerivedAdminSessionSecret,
} from "@/lib/admin/credentials";
import {
  isAsyncSealEnabled,
  isAsyncVoiceEnabled,
  isDemoMode,
  isDistributionEnabled,
} from "@/lib/feature-flags";
import { isRuntimeEnvSet } from "@/lib/runtime-env";
import {
  getFirebaseStorageBucketName,
  hasFirebaseServiceAccount,
  isFirebaseAuthConfigured,
} from "@/lib/firebase/env";
import { isServerlessRuntime } from "@/lib/server-runtime";

/** Diagnóstico leve — não expõe valores de secrets. */
export async function GET() {
  const demoMode = isDemoMode();
  return NextResponse.json({
    ok: true,
    authConfigured: isFirebaseAuthConfigured(),
    firebaseAdmin: hasFirebaseServiceAccount(),
    storageBucket: Boolean(getFirebaseStorageBucketName()),
    serviceAccountJson: isRuntimeEnvSet("FIREBASE_SERVICE_ACCOUNT_JSON"),
    serverless: isServerlessRuntime(),
    flags: {
      demoMode,
      asyncSeal: isAsyncSealEnabled(),
      asyncVoice: isAsyncVoiceEnabled(),
      distribution: isDistributionEnabled(),
      pubsubJobs: process.env.PUBSUB_JOBS_ENABLED === "true",
    },
    readiness: {
      /** Em DEMO, carga por usuário é limitada (temas/vídeos/créditos). */
      mode: demoMode ? "demo_degustacao" : "full_product",
      adminPasswordFromEnv: !isUsingDefaultAdminPassword(),
      adminSessionSecretFromEnv: !isUsingDerivedAdminSessionSecret(),
      /** Filas async ainda off — seal/voz sync no mesmo pool (ok sob DEMO). */
      asyncJobsReady: isAsyncSealEnabled() && process.env.PUBSUB_JOBS_ENABLED === "true",
    },
  });
}
