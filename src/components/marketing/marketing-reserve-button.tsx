"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import type { EarlyAccessPlanId } from "@/lib/early-access-types";
import { writePlanIntent } from "@/lib/early-access";
import { REGISTRATION_REQUIRED_PATH } from "@/lib/registration-gate";

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
    writePlanIntent(planId);
    const next = `${REGISTRATION_REQUIRED_PATH}?plan=${planId}`;
    router.push(`/login?next=${encodeURIComponent(next)}` as Route);
  }

  return (
    <button type="button" className={className} onClick={handleClick}>
      {children}
    </button>
  );
}
