export type FirebaseClientConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

function getFirebaseClientConfigFromWebAppEnv(): FirebaseClientConfig | null {
  const raw = process.env.FIREBASE_WEBAPP_CONFIG?.trim();
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<FirebaseClientConfig>;
    const apiKey = parsed.apiKey?.trim();
    const authDomain = parsed.authDomain?.trim();
    const projectId = parsed.projectId?.trim();
    const appId = parsed.appId?.trim();

    if (!apiKey || !authDomain || !projectId || !appId) {
      return null;
    }

    return {
      apiKey,
      authDomain,
      projectId,
      storageBucket: parsed.storageBucket?.trim() ?? "",
      messagingSenderId: parsed.messagingSenderId?.trim() ?? "",
      appId,
    };
  } catch {
    return null;
  }
}

export function getFirebaseClientConfig(): FirebaseClientConfig | null {
  const fromWebAppConfig = getFirebaseClientConfigFromWebAppEnv();
  if (fromWebAppConfig) {
    return fromWebAppConfig;
  }

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim();
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim();
  const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim();
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim();

  if (!apiKey || !authDomain || !projectId || !appId) {
    return null;
  }

  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket: storageBucket ?? "",
    messagingSenderId: messagingSenderId ?? "",
    appId,
  };
}

export function isFirebaseClientConfigured() {
  return getFirebaseClientConfig() !== null;
}

export function hasFirebaseServiceAccount() {
  return Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim() ||
      process.env.FIREBASE_CONFIG?.trim() ||
      process.env.K_SERVICE,
  );
}

/** Bucket de mídia (treino/vídeo). Preferir env dedicada; fallback no bucket do app. */
export function getFirebaseStorageBucketName() {
  return (
    process.env.FIREBASE_TRAINING_ASSETS_BUCKET?.trim() ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() ||
    getFirebaseClientConfig()?.storageBucket?.trim() ||
    ""
  );
}

export function isFirebaseAuthConfigured() {
  return isFirebaseClientConfigured() && hasFirebaseServiceAccount();
}

export function getAuthSetupMessage(): string | null {
  if (isFirebaseAuthConfigured()) {
    return null;
  }

  if (!isFirebaseClientConfigured()) {
    return (
      "Login desativado: configure NEXT_PUBLIC_FIREBASE_API_KEY, AUTH_DOMAIN, PROJECT_ID e APP_ID."
    );
  }

  if (!hasFirebaseServiceAccount()) {
    return (
      "Login incompleto: falta FIREBASE_SERVICE_ACCOUNT_JSON no servidor (dev local). " +
      "No Firebase App Hosting o Admin SDK usa FIREBASE_CONFIG automaticamente."
    );
  }

  return null;
}

export function shouldEnforceLogin() {
  return isFirebaseAuthConfigured() || Boolean(getAuthSetupMessage());
}
