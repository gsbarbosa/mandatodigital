import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Route } from "next";

import { getSessionUser } from "@/lib/auth/session";
import { getAuthSetupMessage, isFirebaseAuthConfigured } from "@/lib/firebase/env";
import { resolvePostLoginPath } from "@/lib/registration-gate";
import { isDemoModeActiveForEmail } from "@/lib/demo-mode";
import {
  ensureUserRegistration,
  isUserRegistrationComplete,
  needsPlanSelection,
} from "@/lib/user-registration-storage";

import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const setupMessage = getAuthSetupMessage();
  const params = await searchParams;

  if (isFirebaseAuthConfigured()) {
    const sessionUser = await getSessionUser();
    if (sessionUser) {
      const registration = await ensureUserRegistration({
        ownerUserId: sessionUser.id,
        email: sessionUser.email,
      });
      redirect(
        resolvePostLoginPath({
          registrationComplete: isUserRegistrationComplete(registration),
          needsPlanSelection: needsPlanSelection(registration),
          demoMode: isDemoModeActiveForEmail(sessionUser.email),
          nextPath: params.next,
        }) as Route,
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
