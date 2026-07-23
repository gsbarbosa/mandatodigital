import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Route } from "next";

import { APP_HOME_PATH } from "@/lib/app-home";
import { getSessionUser } from "@/lib/auth/session";
import { getAuthSetupMessage, isFirebaseAuthConfigured } from "@/lib/firebase/env";
import { REGISTRATION_REQUIRED_PATH } from "@/lib/registration-gate";
import {
  ensureUserRegistration,
  isUserRegistrationComplete,
} from "@/lib/user-registration-storage";

import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const setupMessage = getAuthSetupMessage();

  if (isFirebaseAuthConfigured()) {
    const sessionUser = await getSessionUser();
    if (sessionUser) {
      const registration = await ensureUserRegistration({
        ownerUserId: sessionUser.id,
        email: sessionUser.email,
      });
      redirect(
        (isUserRegistrationComplete(registration)
          ? APP_HOME_PATH
          : REGISTRATION_REQUIRED_PATH) as Route,
      );
    }
  }

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
