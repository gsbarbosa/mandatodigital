"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";

import { BILLING_PAYMENT_PATH } from "@/lib/registration-gate";
import { isPaymentLockAllowedPath } from "@/lib/billing/payment-access";
import { usePaymentAccess } from "./use-payment-access";

/**
 * Overlay que esmaece a área principal e bloqueia ações quando
 * billingStatus é past_due ou pending_payment — exceto em Meus pagamentos / CNPJ.
 */
export function PaymentAccessLock() {
  const pathname = usePathname();
  const { blocked, loaded } = usePaymentAccess();

  if (!loaded || !blocked || isPaymentLockAllowedPath(pathname)) {
    return null;
  }

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-md-app-bg/75 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-lock-title"
    >
      <div className="mx-4 max-w-md rounded-2xl border border-amber-500/40 bg-md-surface px-6 py-5 shadow-lg">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-200">
          <LockIcon className="h-5 w-5" />
        </div>
        <h2 id="payment-lock-title" className="text-base font-semibold text-md-text">
          Acesso temporariamente limitado
        </h2>
        <p className="mt-2 text-sm text-md-text-soft">
          Há cobrança pendente ou em atraso. Regularize em{" "}
          <strong className="font-medium text-md-text">Meus pagamentos</strong> para
          voltar a usar a plataforma. O menu CNPJ permanece disponível.
        </p>
        <Link
          href={BILLING_PAYMENT_PATH as Route}
          className="mt-4 inline-flex items-center justify-center rounded-xl border border-amber-600/50 bg-amber-500/15 px-4 py-2.5 text-sm font-semibold text-amber-900 no-underline transition hover:bg-amber-500/25 dark:text-amber-100"
        >
          Ir para Meus pagamentos
        </Link>
      </div>
    </div>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
