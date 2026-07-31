import { Suspense } from "react";

import { DistribuidorPage } from "@/components/product/distribuidor-page";

export default function DistribuidorRoute() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-md-text-soft">
          Carregando Publicador…
        </div>
      }
    >
      <DistribuidorPage />
    </Suspense>
  );
}
