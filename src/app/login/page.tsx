import { Suspense } from "react";

import { getAuthSetupMessage } from "@/lib/supabase/env";

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
      <Suspense fallback={<p className="persona-helper-text">Carregando...</p>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
