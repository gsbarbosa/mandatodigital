/** Runtime helpers — Firebase Admin é obrigatório em todos os ambientes. */

export function isServerlessRuntime() {
  return Boolean(
    process.env.K_SERVICE ||
      process.env.FIREBASE_CONFIG ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.LAMBDA_TASK_ROOT,
  );
}

export function assertFirebaseAdminReady() {
  const hasAdc = Boolean(process.env.FIREBASE_CONFIG || process.env.K_SERVICE);
  const hasJson = Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim());
  if (!hasAdc && !hasJson) {
    throw new Error(
      "Firebase Admin obrigatorio: configure FIREBASE_SERVICE_ACCOUNT_JSON (dev) " +
        "ou rode no App Hosting (ADC via FIREBASE_CONFIG).",
    );
  }
}
