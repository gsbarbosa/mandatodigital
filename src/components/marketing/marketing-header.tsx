"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { BrandLogo } from "@/components/brand-logo";
import {
  MARKETING_CTA_HREF,
  MARKETING_CTA_LABEL,
  MARKETING_NAV,
} from "@/lib/marketing/shared";

const APP_HOME_HREF = "/monitoramento" as Route;

export function MarketingHeader({ isAuthenticated = false }: { isAuthenticated?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#020617]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href={"/" as Route}
          className="min-w-0 shrink-0"
          aria-label="Mandato Digital — início"
        >
          <BrandLogo width={148} priority />
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Principal">
          {MARKETING_NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-emerald-500/15 text-emerald-200"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-100"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {isAuthenticated ? (
            <Link href={APP_HOME_HREF} className="primary-button !px-4 !py-2 !text-sm">
              Ir ao sistema
            </Link>
          ) : (
            <>
              <Link
                href={"/login" as Route}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition hover:text-white"
              >
                Entrar
              </Link>
              <Link href={MARKETING_CTA_HREF} className="primary-button !px-4 !py-2 !text-sm">
                {MARKETING_CTA_LABEL}
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 md:hidden"
          aria-expanded={open}
          aria-controls="marketing-mobile-nav"
          onClick={() => setOpen((v) => !v)}
        >
          Menu
        </button>
      </div>

      {open ? (
        <div
          id="marketing-mobile-nav"
          className="border-t border-slate-800 bg-[#020617] px-4 py-4 md:hidden"
        >
          <nav className="flex flex-col gap-1" aria-label="Mobile">
            {MARKETING_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-800/60"
              >
                {item.label}
              </Link>
            ))}
            {isAuthenticated ? (
              <Link
                href={APP_HOME_HREF}
                onClick={() => setOpen(false)}
                className="primary-button mt-2 justify-center !text-sm"
              >
                Ir ao sistema
              </Link>
            ) : (
              <>
                <Link
                  href={"/login" as Route}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300"
                >
                  Entrar
                </Link>
                <Link
                  href={MARKETING_CTA_HREF}
                  onClick={() => setOpen(false)}
                  className="primary-button mt-2 justify-center !text-sm"
                >
                  {MARKETING_CTA_LABEL}
                </Link>
              </>
            )}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
