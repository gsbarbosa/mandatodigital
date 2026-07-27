"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { AppearanceToggle } from "@/components/appearance-toggle";
import { BrandLogo } from "@/components/brand-logo";
import { APP_HOME_PATH } from "@/lib/app-home";
import {
  MARKETING_CTA_HREF,
  MARKETING_CTA_LABEL,
  MARKETING_NAV,
} from "@/lib/marketing/shared";

export function MarketingHeader({ isAuthenticated = false }: { isAuthenticated?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-md-border bg-md-bg/90 backdrop-blur-md">
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
                className={`rounded-lg px-3 py-2 text-sm font-medium no-underline transition ${
                  active
                    ? "bg-emerald-500/15 text-[var(--sentinela-text)]"
                    : "text-md-text-soft hover:bg-md-overlay-hover hover:text-md-text"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <AppearanceToggle className="min-w-[168px]" />
          {isAuthenticated ? (
            <Link href={APP_HOME_PATH} className="primary-button !px-4 !py-2 !text-sm">
              Ir ao sistema
            </Link>
          ) : (
            <>
              <Link
                href={"/login" as Route}
                className="rounded-lg px-3 py-2 text-sm font-medium text-md-text-muted no-underline transition hover:text-md-text"
              >
                Entrar
              </Link>
              <Link
                href={MARKETING_CTA_HREF}
                className="primary-button !px-4 !py-2 !text-sm no-underline"
              >
                {MARKETING_CTA_LABEL}
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-lg border border-md-border px-3 py-2 text-sm text-md-text md:hidden"
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
          className="border-t border-md-border bg-md-bg px-4 py-4 md:hidden"
        >
          <AppearanceToggle className="mb-3 w-full" />
          <nav className="flex flex-col gap-1" aria-label="Mobile">
            {MARKETING_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-md-text no-underline hover:bg-md-overlay-hover"
              >
                {item.label}
              </Link>
            ))}
            {isAuthenticated ? (
              <Link
                href={APP_HOME_PATH}
                onClick={() => setOpen(false)}
                className="primary-button mt-2 justify-center !text-sm no-underline"
              >
                Ir ao sistema
              </Link>
            ) : (
              <>
                <Link
                  href={"/login" as Route}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-md-text-muted no-underline"
                >
                  Entrar
                </Link>
                <Link
                  href={MARKETING_CTA_HREF}
                  onClick={() => setOpen(false)}
                  className="primary-button mt-2 justify-center !text-sm no-underline"
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
