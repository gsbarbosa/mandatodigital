import { Suspense } from "react";

import { CriativoPageV2 } from "@/components/product/criativo-page-v2";

export const metadata = {
  title: "Criar conteúdo independente",
};

export default function IndependenteRoute() {
  return (
    <Suspense fallback={null}>
      <CriativoPageV2 mode="independente" />
    </Suspense>
  );
}
