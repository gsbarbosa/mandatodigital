"use client";

import { useEffect, useState } from "react";

import {
  resolvePaymentAccess,
  type PaymentAccessSnapshot,
} from "@/lib/billing/payment-access";

type BillingStatusPayload = {
  billingStatus?: string;
  installments?: Array<{
    dueDate: string;
    status: string;
  }>;
};

const EMPTY: PaymentAccessSnapshot = {
  blocked: false,
  dueSoon: false,
  daysUntilNextDue: null,
  nextDueDate: null,
};

/** Estado de cobrança para banner D-5 e trava de UI. */
export function usePaymentAccess() {
  const [snapshot, setSnapshot] = useState<PaymentAccessSnapshot>(EMPTY);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/billing/status", {
          credentials: "same-origin",
        });
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as BillingStatusPayload;
        if (cancelled) {
          return;
        }
        setSnapshot(
          resolvePaymentAccess({
            billingStatus: payload.billingStatus,
            installments: payload.installments,
          }),
        );
      } catch {
        // Mantém liberado se status falhar (evita falso positivo).
      } finally {
        if (!cancelled) {
          setLoaded(true);
        }
      }
    }

    void load();
    const intervalId = window.setInterval(() => void load(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  return { ...snapshot, loaded };
}
