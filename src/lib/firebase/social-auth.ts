import {
  GoogleAuthProvider,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  type Auth,
  type UserCredential,
} from "firebase/auth";

function getGoogleProvider() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
}

function isPopupIssue(code: string) {
  return code === "auth/popup-blocked" || code === "auth/cancelled-popup-request";
}

export async function signInWithGoogle(auth: Auth): Promise<UserCredential | null> {
  const provider = getGoogleProvider();

  try {
    return await signInWithPopup(auth, provider);
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "";

    if (code === "auth/popup-closed-by-user") {
      return null;
    }

    if (isPopupIssue(code)) {
      await signInWithRedirect(auth, provider);
      return null;
    }

    throw error;
  }
}

export async function completeSocialRedirectSignIn(auth: Auth) {
  return getRedirectResult(auth);
}
