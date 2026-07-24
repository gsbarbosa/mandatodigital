import type { Metadata } from "next";

import { MarketingCuradorPage } from "@/components/marketing/marketing-curador-page";

export const metadata: Metadata = {
  title: "Agente Curador — Identidade e persona política",
  description:
    "Como o Agente Curador preserva a voz do mandato, reduz comentários de ‘não é ele’ e eleva o engajamento com persona calibrada.",
};

export default function CuradorDetailRoute() {
  return <MarketingCuradorPage />;
}
