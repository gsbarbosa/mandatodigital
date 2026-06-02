"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { getAuthCallbackUrl } from "@/lib/auth/redirect-url";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

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

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);
    setIsSubmitting(true);

    try {
      const supabase = createSupabaseBrowserClient();

      if (mode === "signup") {
        const emailRedirectTo = getAuthCallbackUrl(window.location.origin);
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: emailRedirectTo
            ? {
                emailRedirectTo: `${emailRedirectTo}?next=${encodeURIComponent(nextPath)}`,
              }
            : undefined,
        });

        if (error) {
          throw error;
        }

        setStatusMessage(
          "Conta criada. Se o projeto exigir confirmacao por e-mail, confira sua caixa de entrada.",
        );
        setMode("login");
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        throw error;
      }

      router.replace(nextPath as "/curador");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Nao foi possivel autenticar.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="login-card persona-card">
      <h1>Mandato Digital</h1>

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

        <button type="submit" className="persona-btn persona-btn-large" disabled={isSubmitting}>
          {isSubmitting ? "Aguarde..." : mode === "signup" ? "Criar conta" : "Entrar"}
        </button>
      </form>
    </section>
  );
}
