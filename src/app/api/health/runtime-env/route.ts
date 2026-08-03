import { NextResponse } from "next/server";

import {
  isUsingDefaultAdminPassword,
  isUsingDerivedAdminSessionSecret,
} from "@/lib/admin/credentials";
import {
  isAsyncSealEnabled,
  isAsyncVoiceEnabled,
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
  return NextResponse.json({
    ok: true,
    authConfigured: isFirebaseAuthConfigured(),
    firebaseAdmin: hasFirebaseServiceAccount(),
    storageBucket: Boolean(getFirebaseStorageBucketName()),
    serviceAccountJson: isRuntimeEnvSet("FIREBASE_SERVICE_ACCOUNT_JSON"),
    serverless: isServerlessRuntime(),
    flags: {
      asyncSeal: isAsyncSealEnabled(),
      asyncVoice: isAsyncVoiceEnabled(),
      distribution: isDistributionEnabled(),
      pubsubJobs: process.env.PUBSUB_JOBS_ENABLED === "true",
    },
    readiness: {
      mode: "full_product",
      adminPasswordFromEnv: !isUsingDefaultAdminPassword(),
      adminSessionSecretFromEnv: !isUsingDerivedAdminSessionSecret(),
      asyncJobsReady: isAsyncSealEnabled() && process.env.PUBSUB_JOBS_ENABLED === "true",
    },
  });
}
