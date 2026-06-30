import { Suspense } from "react";

import { ConfiguracoesLegacyRedirect } from "@/components/product/configuracoes-legacy-redirect";

export default function ConfiguracoesIndexPage() {
  return (
    <Suspense fallback={null}>
      <ConfiguracoesLegacyRedirect />
    </Suspense>
  );
}
