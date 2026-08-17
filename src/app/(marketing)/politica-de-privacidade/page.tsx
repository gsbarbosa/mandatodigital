import type { Metadata } from "next";

import { MarketingPrivacyPage } from "@/components/marketing/marketing-privacy-page";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description:
    "Como o Mandato Digital coleta, usa, compartilha e protege dados pessoais, nos termos da LGPD (Lei 13.709/2018).",
  alternates: { canonical: "/politica-de-privacidade" },
};

export default function PoliticaDePrivacidadeRoute() {
  return <MarketingPrivacyPage />;
}
