import { getFirebaseAuth } from "@/lib/firebase/client";

export function formatAuthClientError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("email-already-in-use")) {
    return "Este e-mail ja tem conta. Use Entrar com a mesma senha ou o mesmo provedor social.";
  }

  if (
    normalized.includes("account-exists-with-different-credential") ||
    normalized.includes("auth/account-exists-with-different-credential")
  ) {
    return "Este e-mail ja foi cadastrado com outro metodo de login. Use o mesmo provedor ou e-mail e senha.";
  }

  if (normalized.includes("invalid-credential") || normalized.includes("wrong-password")) {
    return "E-mail ou senha incorretos.";
  }

  if (normalized.includes("weak-password")) {
    return "Senha fraca. Use pelo menos 6 caracteres.";
  }

  if (normalized.includes("too-many-requests")) {
    return "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
  }

  if (normalized.includes("popup-closed-by-user")) {
    return "Login cancelado. Tente novamente quando quiser.";
  }

  if (normalized.includes("operation-not-allowed")) {
    return "Este provedor social ainda nao esta habilitado no Firebase (Authentication → Sign-in method).";
  }

  if (normalized.includes("redirect_uri_mismatch")) {
    return (
      "Login Google mal configurado (redirect_uri_mismatch). No Google Cloud Console " +
      "(projeto madatodigital → Credentials → Web client do Firebase), adicione em " +
      "Authorized redirect URIs: https://madatodigital.firebaseapp.com/__/auth/handler " +
      "e https://madatodigital.web.app/__/auth/handler. " +
      "No Firebase → Authentication → Settings → Authorized domains, inclua madatodigital.web.app, madatodigital.firebaseapp.com e localhost."
    );
  }

  if (normalized.includes("unauthorized-domain")) {
    return (
      "Dominio nao autorizado no Firebase. Em Authentication → Settings → Authorized domains, " +
      "adicione o host em que voce abriu o app (ex.: madatodigital.web.app ou localhost)."
    );
  }

  return message;
}

export async function persistFirebaseSession(): Promise<{
  registrationComplete: boolean;
  email: string;
}> {
  const idToken = await getFirebaseAuth().currentUser?.getIdToken(true);

  if (!idToken) {
    throw new Error("Nao foi possivel obter a sessao do Firebase.");
  }

  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });

  const payload = (await response.json().catch(() => null)) as {
    message?: string;
    registrationComplete?: boolean;
    email?: string;
  } | null;

  if (!response.ok) {
    throw new Error(payload?.message ?? "Nao foi possivel iniciar a sessao no servidor.");
  }

  return {
    registrationComplete: Boolean(payload?.registrationComplete),
    email: String(payload?.email ?? ""),
  };
}
