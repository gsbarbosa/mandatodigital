"use client";

import type { ReactNode } from "react";

import { AppearanceToggle } from "@/components/appearance-toggle";
import { BrandLogo } from "@/components/brand-logo";
import { useProductApp } from "@/components/product/provider";

/** Shell mínimo para cadastro obrigatório — sem sidebar/módulos do produto. */
export function RegistrationShell({ children }: { children: ReactNode }) {
  const { sessionUser, signOut } = useProductApp();

  return (
    <div className="min-h-screen bg-md-bg text-md-text-soft">
      <header className="border-b border-md-border bg-md-bg/90">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <BrandLogo width={132} priority />
          <div className="flex items-center gap-3">
            <AppearanceToggle className="hidden sm:flex min-w-[168px]" />
            {sessionUser?.email ? (
              <span className="hidden max-w-[180px] truncate text-xs text-md-text-soft sm:inline">
                {sessionUser.email}
              </span>
            ) : null}
            <button
              type="button"
              className="rounded-lg border border-md-border px-3 py-1.5 text-sm text-md-text transition hover:bg-md-overlay-hover"
              onClick={() => void signOut()}
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
