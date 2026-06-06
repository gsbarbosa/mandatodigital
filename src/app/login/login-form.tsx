"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";

import { getFirebaseAuth } from "@/lib/firebase/client";
import {
  formatAuthClientError,
  persistFirebaseSession,
} from "@/lib/firebase/session-client";
import {
  completeSocialRedirectSignIn,
  signInWithGoogle,
} from "@/lib/firebase/social-auth";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="login-social-icon">
      <path
        fill="#EA4335"
        d="M12 10.2v3.6h5.1c-.2 1.2-1.5 3.6-5.1 3.6-3.1 0-5.6-2.5-5.6-5.6S8.9 6.2 12 6.2c1.8 0 3 .8 3.7 1.5l2.5-2.4C16.5 3.9 14.4 3 12 3 7 3 3 7 3 12s4 9 9 9c5.2 0 8.6-3.7 8.6-8.9 0-.6-.1-1-.2-1.4H12z"
      />
    </svg>
  );
}

function LoginLoading({ message }: { message: string }) {
  return (
    <div className="login-loading" role="status" aria-live="polite">
      <span className="persona-spinner login-loading-spinner" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/curador";

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isCheckingRedirect, setIsCheckingRedirect] = useState(true);
  const [isFinishingAuth, setIsFinishingAuth] = useState(false);

  useEffect(() => {
    if (searchParams.get("setup") === "firebase-auth") {
      setErrorMessage(
        "Login ainda nao esta completo no servidor. Configure FIREBASE_SERVICE_ACCOUNT_JSON no ambiente.",
      );
    }
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    async function handleRedirectResult() {
      try {
        const auth = getFirebaseAuth();
        const result = await completeSocialRedirectSignIn(auth);
        if (!result?.user || cancelled) {
          return;
        }

        setIsCheckingRedirect(false);
        setIsFinishingAuth(true);
        await persistFirebaseSession();
        router.replace(nextPath as "/curador");
        router.refresh();
      } catch (error) {
        if (!cancelled) {
          const rawMessage =
            error instanceof Error ? error.message : "Nao foi possivel autenticar.";
          setErrorMessage(formatAuthClientError(rawMessage));
          setIsFinishingAuth(false);
        }
      } finally {
        if (!cancelled) {
          setIsCheckingRedirect(false);
        }
      }
    }

    void handleRedirectResult();

    return () => {
      cancelled = true;
    };
  }, [nextPath, router]);

  async function finishAuth() {
    setIsFinishingAuth(true);

    try {
      await persistFirebaseSession();
      router.replace(nextPath as "/curador");
      router.refresh();
    } catch (error) {
      setIsFinishingAuth(false);
      throw error;
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);
    setIsSubmitting(true);

    try {
      const auth = getFirebaseAuth();

      if (mode === "signup") {
        await createUserWithEmailAndPassword(auth, email, password);
        setStatusMessage("Conta criada. Entrando...");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }

      await finishAuth();
    } catch (error) {
      const rawMessage =
        error instanceof Error ? error.message : "Nao foi possivel autenticar.";
      setErrorMessage(formatAuthClientError(rawMessage));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    setErrorMessage(null);
    setStatusMessage(null);
    setIsGoogleLoading(true);

    try {
      const auth = getFirebaseAuth();
      const result = await signInWithGoogle(auth);

      if (!result) {
        return;
      }

      await finishAuth();
    } catch (error) {
      const rawMessage =
        error instanceof Error ? error.message : "Nao foi possivel autenticar.";
      setErrorMessage(formatAuthClientError(rawMessage));
    } finally {
      setIsGoogleLoading(false);
    }
  }

  const isBusy = isSubmitting || isGoogleLoading || isFinishingAuth;

  if (isCheckingRedirect) {
    return (
      <section className="login-card persona-card">
        <LoginLoading message="Verificando sessao..." />
      </section>
    );
  }

  return (
    <section className={`login-card persona-card${isFinishingAuth ? " login-card-busy" : ""}`}>
      {isFinishingAuth && (
        <div className="login-card-overlay" aria-hidden="true">
          <LoginLoading message="Entrando..." />
        </div>
      )}

      <h1>Mandato Digital</h1>

      <div className="login-social-group">
        <button
          type="button"
          className="login-social-btn"
          disabled={isBusy}
          onClick={() => void handleGoogleSignIn()}
        >
          {isGoogleLoading ? (
            <span className="persona-loading-row">
              <span className="persona-spinner" aria-hidden="true" />
              Conectando...
            </span>
          ) : (
            <>
              <GoogleIcon />
              Continuar com Google
            </>
          )}
        </button>
      </div>

      <p className="login-divider">
        <span>ou use e-mail</span>
      </p>

      <div className="persona-crop-aspect-row">
        <button
          type="button"
          className={mode === "login" ? "persona-tag active" : "persona-tag"}
          onClick={() => setMode("login")}
        >
          Entrar
        </button>
        <button
          type="button"
          className={mode === "signup" ? "persona-tag active" : "persona-tag"}
          onClick={() => setMode("signup")}
        >
          Criar conta
        </button>
      </div>

      <form className="login-form" onSubmit={(event) => void handleSubmit(event)}>
        <label className="persona-label" htmlFor="login-email">
          E-mail
        </label>
        <input
          id="login-email"
          type="email"
          className="persona-input-control"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        <label className="persona-label" htmlFor="login-password">
          Senha
        </label>
        <input
          id="login-password"
          type="password"
          className="persona-input-control"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          minLength={6}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />

        {errorMessage && (
          <p className="persona-helper-text persona-helper-highlight">{errorMessage}</p>
        )}
        {statusMessage && <p className="persona-helper-text">{statusMessage}</p>}

        <button type="submit" className="persona-btn persona-btn-large" disabled={isBusy}>
          {isSubmitting ? (
            <span className="persona-loading-row">
              <span className="persona-spinner" aria-hidden="true" />
              Aguarde...
            </span>
          ) : mode === "signup" ? (
            "Criar conta"
          ) : (
            "Entrar"
          )}
        </button>
      </form>
    </section>
  );
}
