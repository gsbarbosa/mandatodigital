"use client";

import Link from "next/link";
import type { Route } from "next";

import { BILLING_PAYMENT_PATH } from "@/lib/registration-gate";
import { usePaymentAccess } from "./use-payment-access";

function formatDueDate(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) {
    return value;
  }
  return `${day}/${month}/${year}`;
}

/** Banner de cobrança: bloqueio / alerta D-5 antes do vencimento. */
export function BillingPendingBanner() {
  const { blocked, dueSoon, daysUntilNextDue, nextDueDate, loaded } = usePaymentAccess();

  if (!loaded || (!blocked && !dueSoon)) {
    return null;
  }

  if (blocked) {
    return (
      <div className="border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-center text-xs text-red-900 dark:text-red-200">
        Pagamento pendente ou em atraso — o uso da plataforma está limitado.{" "}
        <Link
          href={BILLING_PAYMENT_PATH as Route}
          className="font-semibold underline-offset-2 hover:underline"
        >
          Meus pagamentos
        </Link>
      </div>
    );
  }

  const daysLabel =
    daysUntilNextDue === 0
      ? "vence hoje"
      : daysUntilNextDue === 1
        ? "vence amanhã"
        : `vence em ${daysUntilNextDue} dias`;

  return (
    <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-800 dark:text-amber-200">
      Boleto {daysLabel}
      {nextDueDate ? ` (${formatDueDate(nextDueDate)})` : ""}.{" "}
      <Link
        href={BILLING_PAYMENT_PATH as Route}
        className="font-semibold underline-offset-2 hover:underline"
      >
        Ver Meus pagamentos
      </Link>
    </div>
  );
}
