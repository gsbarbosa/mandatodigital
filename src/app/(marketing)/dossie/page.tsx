import type { Metadata } from "next";

import { MarketingDossiePage } from "@/components/marketing/marketing-dossie-page";

export const metadata: Metadata = {
  title: "Dossiê de Transparência e Conformidade Eleitoral",
  description:
    "Certificação técnica, jurídica e operacional da plataforma Mandato Digital perante a Justiça Eleitoral, LGPD e Sistema de Prestação de Contas Eleitorais (SPCE).",
};

export default function DossieRoute() {
  return <MarketingDossiePage />;
}
