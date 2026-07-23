import type { Metadata } from "next";

import { MarketingPricingPage } from "@/components/marketing/marketing-pricing-page";

export const metadata: Metadata = {
  title: "Planos e Preços — Reserva VIP",
  description:
    "Essencial, Avançado e Elite: monitoramento, avatares com voz do candidato e compliance TSE. Vagas limitadas por lote com 50% off.",
};

export default function PlanosRoute() {
  return <MarketingPricingPage />;
}
