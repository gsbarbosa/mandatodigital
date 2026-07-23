import type { Metadata } from "next";

import { MarketingAuditorPage } from "@/components/marketing/marketing-auditor-page";

export const metadata: Metadata = {
  title: "Agente Auditor — Verificação e integridade",
  description:
    "Como o Agente Auditor checa fontes em 14 segundos, bloqueia riscos reputacionais e documenta conformidade antes da publicação.",
};

export default function AuditorDetailRoute() {
  return <MarketingAuditorPage />;
}
