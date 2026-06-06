export type FirebaseClientConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

export function getFirebaseClientConfig(): FirebaseClientConfig | null {
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
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim());
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
      "Login incompleto: falta FIREBASE_SERVICE_ACCOUNT_JSON no servidor. " +
      "No Firebase (Project settings → Service accounts), gere a chave privada e adicione na Vercel."
    );
  }

  return null;
}

export function shouldEnforceLogin() {
  return isFirebaseAuthConfigured() || Boolean(getAuthSetupMessage());
}
