"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import type { ReactNode } from "react";

import { AppearanceToggle } from "@/components/appearance-toggle";

const NAV: Array<{ href: Route; label: string; exact?: boolean }> = [
  { href: "/admin" as Route, label: "Dashboard", exact: true },
  { href: "/admin/roadmap" as Route, label: "Roadmap" },
  { href: "/admin/suporte" as Route, label: "Suporte" },
  { href: "/admin/provedores" as Route, label: "Provedores" },
  { href: "/admin/usuarios" as Route, label: "Usuários" },
];

export function AdminShell({
  email,
  children,
}: {
  email: string;
  children: ReactNode;
}) {
  const pathname = usePathname();

  async function handleLogout() {
    await fetch("/api/auth/signout", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <div className="min-h-screen bg-md-bg text-md-text">
      <div className="flex min-h-screen">
        <aside className="flex w-60 shrink-0 flex-col border-r border-md-border bg-md-surface px-4 py-6">
          <div className="mb-8 px-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-400/80">
              Mandato Digital
            </p>
            <h1 className="mt-1 text-lg font-bold text-md-text">Painel de gestão</h1>
          </div>

          <nav className="flex flex-1 flex-col gap-1">
            {NAV.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-cyan-500/15 text-cyan-400"
                      : "text-md-text-soft hover:bg-md-overlay-hover hover:text-md-text"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-6 border-t border-md-border pt-4 px-2 space-y-3">
            <AppearanceToggle />
            <p className="truncate text-xs text-md-text-soft">{email}</p>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="mt-2 text-left text-sm text-md-text-soft underline-offset-2 hover:text-md-text hover:underline"
            >
              Sair
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-6 py-8 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
