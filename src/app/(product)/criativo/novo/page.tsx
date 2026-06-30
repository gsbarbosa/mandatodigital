import { Suspense } from "react";

import { AppLoadingStatus } from "@/components/product/app-loading";
import { CriativoPageV2 } from "@/components/product/criativo-page-v2";

export default function CriativoNovoRoute() {
  return (
    <Suspense
      fallback={
        <AppLoadingStatus message="Carregando editor de criativo..." className="persona-top-gap" />
      }
    >
      <CriativoPageV2 />
    </Suspense>
  );
}
