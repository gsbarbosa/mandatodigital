import type { Metadata } from "next";

import { MarketingDistribuidorPage } from "@/components/marketing/marketing-distribuidor-page";

export const metadata: Metadata = {
  title: "Agente Distribuidor — Multicanalidade coordenada",
  description:
    "Como o Agente Distribuidor sincroniza 7 redes com atraso médio de 17s e dispara conteúdo nativo em janelas de alcance.",
};

export default function DistribuidorDetailRoute() {
  return <MarketingDistribuidorPage />;
}
