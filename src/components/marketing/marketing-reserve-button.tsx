"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import type { EarlyAccessPlanId } from "@/lib/early-access-types";

type MarketingReserveButtonProps = {
  planId: EarlyAccessPlanId;
  className?: string;
  children: ReactNode;
};

/** Grava o plano escolhido e manda para login → cadastro. */
export function MarketingReserveButton({
  planId,
  className,
  children,
}: MarketingReserveButtonProps) {
  const router = useRouter();

  function handleClick() {
    window.sessionStorage.setItem("mandato-early-access-plan-intent", planId);
    router.push("/login?next=/acesso-antecipado/dados" as Route);
  }

  return (
    <button type="button" className={className} onClick={handleClick}>
      {children}
    </button>
  );
}
