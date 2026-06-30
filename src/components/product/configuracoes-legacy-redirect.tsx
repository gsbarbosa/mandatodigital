"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { configSectionHref, parseConfigTab } from "@/lib/config-setup-status";

/** Redireciona /configuracoes e ?tab= legado para rotas limpas. */
export function ConfiguracoesLegacyRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const tab = parseConfigTab(searchParams.get("tab"));
    router.replace(configSectionHref(tab) as import("next").Route);
  }, [router, searchParams]);

  return null;
}
