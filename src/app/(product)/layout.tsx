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
  FREE_TRIAL_DEFAULT_PLAN_ID,
} from "@/lib/registration-gate";
import { hasAnyMonitoringRadarConfigured } from "@/lib/sentinel-profile-themes";
import {
  assignUserRegistrationPlan,
  ensureUserRegistration,
  isUserRegistrationComplete,
  needsPlanSelection,
} from "@/lib/user-registration-storage";

export const dynamic = "force-dynamic";

/** Tela padrão de monitoramento — só faz sentido depois de haver ao menos um radar configurado. */
const MONITORAMENTO_PATH = "/monitoramento";
const MONITORAMENTO_TEMAS_PATH = "/monitoramento/temas";

export default async function ProductLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = (await headers()).get("x-pathname") ?? "";
  const sessionUser = isFirebaseAuthConfigured() ? await requireSessionUser() : null;
  let registrationComplete = true;

  if (sessionUser && isFirebaseAuthConfigured()) {
    let registration = await ensureUserRegistration({
      ownerUserId: sessionUser.id,
      email: sessionUser.email,
    });

    // Legado: dados ok sem plano → libera free trial (essencial) sem gate de planos.
    if (needsPlanSelection(registration)) {
      const assigned = await assignUserRegistrationPlan(FREE_TRIAL_DEFAULT_PLAN_ID);
      registration = assigned.registration;
    }

    registrationComplete = isUserRegistrationComplete(registration);

    if (!registrationComplete) {
      if (!isRegistrationAllowedPath(pathname)) {
        redirect(
          resolveIncompleteRegistrationPath({
            needsPlanSelection: needsPlanSelection(registration),
          }),
        );
      }
    }
  }

  const initialData = await runWithSessionRepository(
    (repository) => repository.getDashboard(),
    sessionUser,
  );

  if (
    registrationComplete &&
    pathname === MONITORAMENTO_PATH &&
    (!initialData.profile || !hasAnyMonitoringRadarConfigured(initialData.profile))
  ) {
    redirect(MONITORAMENTO_TEMAS_PATH);
  }

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
