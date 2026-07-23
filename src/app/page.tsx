import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { MarketingHomePage } from "@/components/marketing/marketing-home-page";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { getSessionUser } from "@/lib/auth/session";
import { isFirebaseAuthConfigured } from "@/lib/firebase/env";
import { REGISTRATION_REQUIRED_PATH } from "@/lib/registration-gate";
import {
  ensureUserRegistration,
  isUserRegistrationComplete,
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
  // Cadastro incompleto ainda precisa ir ao fluxo de dados; quem já está logado
  // pode navegar o site institucional sem perder a sessão / sem “sumir” o marketing.
  if (isFirebaseAuthConfigured()) {
    const sessionUser = await getSessionUser();
    if (sessionUser) {
      const registration = await ensureUserRegistration({
        ownerUserId: sessionUser.id,
        email: sessionUser.email,
      });
      if (!isUserRegistrationComplete(registration)) {
        redirect(REGISTRATION_REQUIRED_PATH);
      }
    }
  }

  return (
    <MarketingShell>
      <MarketingHomePage />
    </MarketingShell>
  );
}
