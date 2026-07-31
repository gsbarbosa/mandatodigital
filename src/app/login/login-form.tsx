"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from "firebase/auth";

import { AppearanceToggle } from "@/components/appearance-toggle";
import { BrandLogo } from "@/components/brand-logo";
import {
  normalizeAuthEmail,
  signupPasswordHint,
  validateAuthCredentials,
  validateAuthEmail,
  type AuthFieldErrors,
} from "@/lib/auth-field-validation";
import { getFirebaseAuth } from "@/lib/firebase/client";
import {
  formatAuthClientError,
  persistFirebaseSession,
} from "@/lib/firebase/session-client";
import {
  completeSocialRedirectSignIn,
  signInWithGoogle,
} from "@/lib/firebase/social-auth";
import { isDemoMode } from "@/lib/demo-mode";
import { resolvePostLoginPath } from "@/lib/registration-gate";
import { clearPlanIntent, parseEarlyAccessPlanId } from "@/lib/early-access";
import type { Route } from "next";

type FormMode = "login" | "signup" | "reset";

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
  const nextPath = searchParams.get("next") || "/monitoramento";
  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "login";

  useEffect(() => {
    // Sem ?plan= no next → não herdar intent antigo de "Reservar".
    try {
      const url = new URL(nextPath, "http://local.invalid");
      if (!parseEarlyAccessPlanId(url.searchParams.get("plan"))) {
        clearPlanIntent();
      }
    } catch {
      clearPlanIntent();
    }
  }, [nextPath]);

  const [mode, setMode] = useState<FormMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
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

        setIsFinishingAuth(true);
        const session = await persistFirebaseSession();
        router.replace(
          resolvePostLoginPath({
            registrationComplete: session.registrationComplete,
            needsPlanSelection: session.needsPlanSelection,
            demoMode: isDemoMode(),
            nextPath,
          }) as Route,
        );
        router.refresh();
      } catch (error) {
        if (!cancelled) {
          const rawMessage =
            error instanceof Error ? error.message : "Nao foi possivel autenticar.";
          setErrorMessage(formatAuthClientError(rawMessage));
          setIsFinishingAuth(false);
        }
      }
    }

    void handleRedirectResult();

    return () => {
      cancelled = true;
    };
  }, [nextPath, router]);

  function switchMode(next: FormMode) {
    setMode(next);
    setFieldErrors({});
    setErrorMessage(null);
    setStatusMessage(null);
    if (next === "reset") {
      setPassword("");
    }
  }

  async function finishAuth() {
    setIsFinishingAuth(true);

    try {
      const session = await persistFirebaseSession();
      router.replace(
        resolvePostLoginPath({
          registrationComplete: session.registrationComplete,
          needsPlanSelection: session.needsPlanSelection,
          demoMode: isDemoMode(),
          nextPath,
        }) as Route,
      );
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

    const normalizedEmail = normalizeAuthEmail(email);

    if (mode === "reset") {
      const emailError = validateAuthEmail(normalizedEmail);
      if (emailError) {
        setFieldErrors({ email: emailError });
        return;
      }
      setFieldErrors({});
      setIsSubmitting(true);
      try {
        const auth = getFirebaseAuth();
        const continueUrl =
          typeof window !== "undefined"
            ? `${window.location.origin}/login`
            : undefined;
        await sendPasswordResetEmail(
          auth,
          normalizedEmail,
          continueUrl
            ? {
                url: continueUrl,
                handleCodeInApp: false,
              }
            : undefined,
        );
        setStatusMessage(
          "Se este e-mail estiver cadastrado, enviamos um link para redefinir a senha. Confira a caixa de entrada e o spam.",
        );
      } catch (error) {
        const rawMessage =
          error instanceof Error ? error.message : "Nao foi possivel enviar o e-mail.";
        setErrorMessage(formatAuthClientError(rawMessage));
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    const errors = validateAuthCredentials({
      email: normalizedEmail,
      password,
      mode,
    });
    if (errors.email || errors.password) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setEmail(normalizedEmail);
    setIsSubmitting(true);

    try {
      const auth = getFirebaseAuth();

      if (mode === "signup") {
        await createUserWithEmailAndPassword(auth, normalizedEmail, password);
        setStatusMessage("Conta criada. Entrando...");
      } else {
        await signInWithEmailAndPassword(auth, normalizedEmail, password);
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
    setFieldErrors({});
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
  const showPassword = mode !== "reset";

  return (
    <section className={`login-card persona-card${isFinishingAuth ? " login-card-busy" : ""}`}>
      {isFinishingAuth && (
        <div className="login-card-overlay" aria-hidden="true">
          <LoginLoading message="Entrando..." />
        </div>
      )}

      <div className="login-brand">
        <BrandLogo markSize={28} fontSize={26} priority className="login-brand-logo" />
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <AppearanceToggle />
      </div>

      {mode !== "reset" ? (
        <>
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
            <p className="persona-helper-text" style={{ marginTop: "0.75rem", textAlign: "center" }}>
              Após autenticar, complete o cadastro para acessar o sistema.
            </p>
          </div>

          <p className="login-divider">
            <span>ou use e-mail</span>
          </p>

          <div className="persona-crop-aspect-row">
            <button
              type="button"
              data-testid="login-mode-login"
              className={mode === "login" ? "persona-tag active" : "persona-tag"}
              onClick={() => switchMode("login")}
            >
              Entrar
            </button>
            <button
              type="button"
              data-testid="login-mode-signup"
              className={mode === "signup" ? "persona-tag active" : "persona-tag"}
              onClick={() => switchMode("signup")}
            >
              Criar conta
            </button>
          </div>
        </>
      ) : (
        <div className="login-reset-intro">
          <h2 className="login-reset-title">Esqueci minha senha</h2>
          <p className="persona-helper-text">
            Informe o e-mail da conta. Enviaremos um link para criar uma nova senha.
          </p>
        </div>
      )}

      <form className="login-form" onSubmit={(event) => void handleSubmit(event)} noValidate>
        <label className="persona-label" htmlFor="login-email">
          E-mail
        </label>
        <input
          id="login-email"
          type="email"
          inputMode="email"
          className={`persona-input-control${fieldErrors.email ? " persona-input-invalid" : ""}`}
          autoComplete="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (fieldErrors.email) {
              setFieldErrors((prev) => ({ ...prev, email: undefined }));
            }
          }}
          onBlur={() => {
            const normalized = normalizeAuthEmail(email);
            if (normalized !== email) {
              setEmail(normalized);
            }
            const emailError = validateAuthEmail(normalized);
            setFieldErrors((prev) => ({
              ...prev,
              email: emailError || undefined,
            }));
          }}
          aria-invalid={Boolean(fieldErrors.email)}
          aria-describedby={fieldErrors.email ? "login-email-error" : undefined}
          required
        />
        {fieldErrors.email ? (
          <p id="login-email-error" className="login-field-error" role="alert">
            {fieldErrors.email}
          </p>
        ) : null}

        {showPassword ? (
          <>
            <div className="login-password-label-row">
              <label className="persona-label" htmlFor="login-password">
                Senha
              </label>
              {mode === "login" ? (
                <button
                  type="button"
                  className="login-forgot-link"
                  disabled={isBusy}
                  onClick={() => switchMode("reset")}
                >
                  Esqueci minha senha
                </button>
              ) : null}
            </div>
            <input
              id="login-password"
              type="password"
              className={`persona-input-control${fieldErrors.password ? " persona-input-invalid" : ""}`}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              minLength={mode === "signup" ? 8 : 6}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (fieldErrors.password) {
                  setFieldErrors((prev) => ({ ...prev, password: undefined }));
                }
              }}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={
                fieldErrors.password
                  ? "login-password-error"
                  : mode === "signup"
                    ? "login-password-hint"
                    : undefined
              }
              required
            />
            {fieldErrors.password ? (
              <p id="login-password-error" className="login-field-error" role="alert">
                {fieldErrors.password}
              </p>
            ) : mode === "signup" ? (
              <p id="login-password-hint" className="persona-helper-text">
                {signupPasswordHint()}
              </p>
            ) : null}
          </>
        ) : null}

        {errorMessage && (
          <p className="persona-helper-text persona-helper-highlight" role="alert">
            {errorMessage}
          </p>
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
          ) : mode === "reset" ? (
            "Enviar link de redefinição"
          ) : (
            "Entrar"
          )}
        </button>

        {mode === "reset" ? (
          <button
            type="button"
            className="login-back-link"
            disabled={isBusy}
            onClick={() => switchMode("login")}
          >
            Voltar ao login
          </button>
        ) : null}
      </form>
    </section>
  );
}
