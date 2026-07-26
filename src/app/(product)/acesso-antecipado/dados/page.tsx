import { Suspense } from "react";

import { AcessoDadosPage } from "@/components/product/acesso-antecipado/dados-page";

export const metadata = {
  title: "Dados Pessoais",
};

export default function AcessoDadosRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-md-text-soft">
          Carregando cadastro...
        </div>
      }
    >
      <AcessoDadosPage />
    </Suspense>
  );
}
