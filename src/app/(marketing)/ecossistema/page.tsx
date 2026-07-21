import type { Metadata } from "next";

import { MarketingEcosystemPage } from "@/components/marketing/marketing-ecosystem-page";

export const metadata: Metadata = {
  title: "Ecossistema de Agentes de IA",
  description:
    "Conheça o Sentinela, Curador, Criativo, Auditor e Distribuidor — agentes de IA em sinergia para comunicação política e eleitoral.",
};

export default function EcossistemaRoute() {
  return <MarketingEcosystemPage />;
}
