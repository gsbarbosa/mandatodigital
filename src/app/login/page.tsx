import { Suspense } from "react";

import { getAuthSetupMessage } from "@/lib/firebase/env";

import { LoginForm } from "./login-form";

export default function LoginPage() {
  const setupMessage = getAuthSetupMessage();

  return (
    <main className="login-page">
      {setupMessage && (
        <p className="persona-helper-text persona-helper-highlight login-setup-banner">
          {setupMessage}
        </p>
      )}
      <Suspense
        fallback={
          <section className="login-card persona-card">
            <div className="login-loading" role="status" aria-live="polite">
              <span className="persona-spinner login-loading-spinner" aria-hidden="true" />
              <p>Carregando...</p>
            </div>
          </section>
        }
      >
        <LoginForm />
      </Suspense>
    </main>
  );
}
