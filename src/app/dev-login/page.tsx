import { notFound } from "next/navigation";

import { DevLoginClient } from "./dev-login-client";

/** Login sem senha para testes locais no navegador — nunca disponivel em producao. */
export default function DevLoginPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <DevLoginClient />;
}
