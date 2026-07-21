import type { Metadata } from "next";

import { MarketingCompliancePage } from "@/components/marketing/marketing-compliance-page";

export const metadata: Metadata = {
  title: "Compliance e Segurança Jurídica",
  description:
    "Conformidade eleitoral, transparência, LGPD, auditoria e prestação de contas para campanhas com tranquilidade perante o TSE.",
};

export default function ConformidadeRoute() {
  return <MarketingCompliancePage />;
}
