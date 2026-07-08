import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LandingPage } from "@/components/landing/landing-page";
import { getSessionUser } from "@/lib/auth/session";
import { isFirebaseAuthConfigured } from "@/lib/firebase/env";

export const metadata: Metadata = {
  title: "Mandato Digital — A Tropa de IA do Seu Mandato",
  description:
    "Do fato ao feed em 15 minutos. Ecossistema de 5 agentes de IA para monitorar, produzir, auditar e publicar comunicação política sem perder a sua voz.",
};

export const dynamic = "force-dynamic";

export default async function HomePage() {
  if (isFirebaseAuthConfigured()) {
    const sessionUser = await getSessionUser();
    if (sessionUser) {
      redirect("/monitoramento");
    }
  }

  return (
    <>
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
      />
      <LandingPage />
    </>
  );
}
