import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { MarketingHomePage } from "@/components/marketing/marketing-home-page";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { getSessionUser } from "@/lib/auth/session";
import { isFirebaseAuthConfigured } from "@/lib/firebase/env";
import {
  FREE_TRIAL_DEFAULT_PLAN_ID,
  resolveIncompleteRegistrationPath,
} from "@/lib/registration-gate";
import {
  assignUserRegistrationPlan,
  ensureUserRegistration,
  isUserRegistrationComplete,
  needsPlanSelection,
} from "@/lib/user-registration-storage";

export const metadata: Metadata = {
  title: {
    absolute: "Mandato Digital — IA para Comunicação Política e Eleitoral",
  },
  description:
    "Ecossistema de agentes de IA para monitorar, produzir, auditar e publicar a comunicação da sua campanha — com identidade preservada e compliance TSE.",
};

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // `/` é sempre o site institucional (logado ou não).
  // Entrada do produto: `/app` → monitoramento.
  if (isFirebaseAuthConfigured()) {
    const sessionUser = await getSessionUser();
    if (sessionUser) {
      let registration = await ensureUserRegistration({
        ownerUserId: sessionUser.id,
        email: sessionUser.email,
      });
      if (needsPlanSelection(registration)) {
        const assigned = await assignUserRegistrationPlan(FREE_TRIAL_DEFAULT_PLAN_ID);
        registration = assigned.registration;
      }
      if (!isUserRegistrationComplete(registration)) {
        redirect(
          resolveIncompleteRegistrationPath({
            needsPlanSelection: needsPlanSelection(registration),
          }),
        );
      }
    }
  }

  return (
    <MarketingShell>
      <MarketingHomePage />
    </MarketingShell>
  );
}
