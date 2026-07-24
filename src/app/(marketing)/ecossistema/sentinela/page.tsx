import type { Metadata } from "next";

import { MarketingSentinelaPage } from "@/components/marketing/marketing-sentinela-page";

export const metadata: Metadata = {
  title: "Agente Sentinela — Monitoramento e pautas quentes",
  description:
    "Como o Agente Sentinela reduz o tempo de reação a 7 minutos, captura share of voice e mapeia pautas quentes antes da saturação.",
};

export default function SentinelaDetailRoute() {
  return <MarketingSentinelaPage />;
}
