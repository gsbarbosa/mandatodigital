import type { Metadata } from "next";

import { MarketingCriativoPage } from "@/components/marketing/marketing-criativo-page";

export const metadata: Metadata = {
  title: "Agente Criativo — Roteirização e síntese de mídia",
  description:
    "Como o Agente Criativo escala para 49 vídeos/semana com avatares, roteiros e peças faceless de alta retenção.",
};

export default function CriativoDetailRoute() {
  return <MarketingCriativoPage />;
}
