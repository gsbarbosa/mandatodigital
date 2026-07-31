import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { OnboardingProvider } from "@/components/product/onboarding-provider";
import { ProductAppProvider } from "@/components/product/provider";
import { ProductShell } from "@/components/product/shell";
import { RegistrationShell } from "@/components/product/registration-shell";
import { runWithSessionRepository } from "@/lib/auth/runner";
import { requireSessionUser } from "@/lib/auth/session";
import { isFirebaseAuthConfigured } from "@/lib/firebase/env";
import {
  isRegistrationAllowedPath,
  resolveIncompleteRegistrationPath,
} from "@/lib/registration-gate";
import { isDemoModeActiveForEmail } from "@/lib/demo-mode";
import {
  ensureUserRegistration,
  isUserRegistrationComplete,
  needsPlanSelection,
} from "@/lib/user-registration-storage";

export const dynamic = "force-dynamic";

export default async function ProductLayout({
  children,
}: {
  children: ReactNode;
}) {
  const sessionUser = isFirebaseAuthConfigured() ? await requireSessionUser() : null;
  let registrationComplete = true;

  if (sessionUser && isFirebaseAuthConfigured()) {
    const registration = await ensureUserRegistration({
      ownerUserId: sessionUser.id,
      email: sessionUser.email,
    });
    registrationComplete = isUserRegistrationComplete(registration);

    if (!registrationComplete) {
      const pathname = (await headers()).get("x-pathname") ?? "";
      if (!isRegistrationAllowedPath(pathname)) {
        redirect(
          resolveIncompleteRegistrationPath({
            needsPlanSelection: needsPlanSelection(registration),
            demoMode: isDemoModeActiveForEmail(sessionUser.email),
          }),
        );
      }
    }
  }

  const initialData = await runWithSessionRepository(
    (repository) => repository.getDashboard(),
    sessionUser,
  );

  return (
    <ProductAppProvider initialData={initialData} sessionUser={sessionUser}>
      {registrationComplete ? (
        <OnboardingProvider>
          <ProductShell>{children}</ProductShell>
        </OnboardingProvider>
      ) : (
        <RegistrationShell>{children}</RegistrationShell>
      )}
    </ProductAppProvider>
  );
}
