"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useState } from "react";

import { BILLING_PAYMENT_PATH } from "@/lib/registration-gate";

/** Aviso discreto quando há cobrança aguardando pagamento. */
export function BillingPendingBanner() {
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/billing/status", { credentials: "same-origin" });
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as { billingStatus?: string };
        if (!cancelled) {
          setPending(
            payload.billingStatus === "pending_payment" ||
              payload.billingStatus === "past_due",
          );
        }
      } catch {
        // ignore
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!pending) {
    return null;
  }

  return (
    <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-800 dark:text-amber-200">
      Cobrança aguardando pagamento.{" "}
      <Link href={BILLING_PAYMENT_PATH as Route} className="font-semibold underline-offset-2 hover:underline">
        Ver cobrança
      </Link>
    </div>
  );
}
