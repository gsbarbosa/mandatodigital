import { Suspense } from "react";

import { CriativoPageV2 } from "@/components/product/criativo-page-v2";

export default function CriativoNovoRoute() {
  return (
    <Suspense fallback={<p className="persona-helper-text">Carregando criativo...</p>}>
      <CriativoPageV2 />
    </Suspense>
  );
}
