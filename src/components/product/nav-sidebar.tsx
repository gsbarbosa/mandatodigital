"use client";

import type { Route } from "next";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { BrandLogo } from "@/components/brand-logo";
import { APP_VERSION } from "@/lib/app-version";
import { isDevAccountModeEmail } from "@/lib/dev-account-mode";
import { useEarlyAccess } from "@/lib/early-access";
import { useOnboarding } from "./onboarding-provider";

type NavChild = {
  label: string;
  href: string;
  showActionDot?: boolean;
  /** Configuração do bloco pai (ex.: temas do monitoramento). */
  variant?: "settings";
};

function SettingsGearIcon({ className }: { className?: string }) {
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
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/** Marcador pulsante do passo atual do onboarding guiado. */
function OnbHighlightDot() {
  return (
    <span
      aria-hidden="true"
      className="mr-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400 align-middle shadow-[0_0_6px_rgba(34,211,238,0.9)] animate-pulse"
    />
  );
}

type NavBlock = {
  label: string;
  href: string;
  children?: NavChild[];
};

const NAV_BLOCKS: NavBlock[] = [
  {
    label: "Monitoramento de Pautas",
    href: "/monitoramento",
    children: [
      { label: "Nacional", href: "/monitoramento#federal" },
      { label: "Estadual", href: "/monitoramento#estadual" },
      { label: "Municipal", href: "/monitoramento#municipal" },
      { label: "Adversários", href: "/monitoramento#adversarios" },
      { label: "Selecionar temas", href: "/monitoramento/temas", variant: "settings" },
    ],
  },
  {
    label: "Avatares",
    href: "/avatares/foto-real",
    children: [
      { label: "Gêmeo Digital", href: "/avatares/foto-real" },
      { label: "Caricato", href: "/avatares/caricato" },
      { label: "Mascote 3D", href: "/avatares/3d" },
      { label: "Configurar avatar", href: "/avatares/foto-real/treinar", variant: "settings" },
    ],
  },
];

const NAV_SINGLES: NavChild[] = [
  { label: "Meus criativos", href: "/criativo" },
  { label: "Gerar pauta independente", href: "/independente" },
  { label: "Compliance TSE", href: "/compliance" },
  { label: "Auditoria", href: "/auditoria" },
];

function navHrefPath(href: string) {
  const hashIndex = href.indexOf("#");
  return hashIndex === -1 ? href : href.slice(0, hashIndex);
}

function navHrefHash(href: string) {
  const hashIndex = href.indexOf("#");
  return hashIndex === -1 ? "" : href.slice(hashIndex);
}

function isBlockActive(pathname: string, blockHref: string) {
  if (blockHref.startsWith("/monitoramento")) {
    return pathname === "/monitoramento" || pathname.startsWith("/monitoramento/");
  }
  if (blockHref.startsWith("/avatares")) {
    return pathname.startsWith("/avatares");
  }
  return pathname === blockHref || pathname.startsWith(`${blockHref}/`);
}

function isChildActive(
  pathname: string,
  href: string,
  activeHash: string,
  pendingMonitorHash: string | null,
) {
  const path = navHrefPath(href);
  const hrefHash = navHrefHash(href);

  if (hrefHash) {
    if (pathname === path) {
      return activeHash === hrefHash;
    }
    return pendingMonitorHash === hrefHash;
  }

  if (pendingMonitorHash && path.startsWith("/monitoramento")) {
    return false;
  }

  if (pathname === path) {
    return true;
  }

  // Hub do avatar não fica ativo em /treinar (item de configuração separado).
  if (pathname.startsWith(`${path}/treinar`)) {
    return false;
  }

  return pathname.startsWith(`${path}/`);
}

function navParentClassName(active: boolean) {
  return active
    ? "block py-2 text-sm text-cyan-400 font-medium transition-colors no-underline"
    : "block py-2 text-sm text-slate-200 hover:text-white transition-colors no-underline";
}

function childClassName(active: boolean) {
  return active
    ? "block pl-3 py-1.5 text-sm text-cyan-400 font-medium no-underline"
    : "block pl-3 py-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors no-underline";
}

export function NavSidebar({
  sessionEmail,
  onSignOut,
  onLogoSecretClick,
}: {
  sessionEmail: string | null;
  onSignOut: () => void;
  onLogoSecretClick?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { sidebarTarget, restartOnboarding, mounted } = useOnboarding();
  const [activeHash, setActiveHash] = useState("");
  const [pendingMonitorHash, setPendingMonitorHash] = useState<string | null>(null);

  const syncActiveHash = useCallback(() => {
    setActiveHash(window.location.hash);
  }, []);

  const navigateToMonitorSection = useCallback(
    (href: string) => {
      const path = navHrefPath(href);
      const hrefHash = navHrefHash(href);
      if (!hrefHash) {
        return;
      }

      setActiveHash(hrefHash);

      if (pathname === path) {
        setPendingMonitorHash(null);
        window.history.replaceState(window.history.state, "", `${path}${hrefHash}`);
        document.getElementById(hrefHash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      setPendingMonitorHash(hrefHash);
      router.push(`${path}${hrefHash}` as Route);
    },
    [pathname, router],
  );

  useEffect(() => {
    syncActiveHash();
    if (pathname === "/monitoramento") {
      setPendingMonitorHash(null);
    }

    const rafId = window.requestAnimationFrame(syncActiveHash);
    const timeoutId = window.setTimeout(syncActiveHash, 0);

    window.addEventListener("hashchange", syncActiveHash);
    window.addEventListener("popstate", syncActiveHash);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
      window.removeEventListener("hashchange", syncActiveHash);
      window.removeEventListener("popstate", syncActiveHash);
    };
  }, [pathname, syncActiveHash]);

  const [earlyAccess] = useEarlyAccess();
  const [emailMenuOpen, setEmailMenuOpen] = useState(false);
  const cnpjPending = !earlyAccess.cnpj;
  const canToggleAccountMode = isDevAccountModeEmail(sessionEmail);

  const earlyAccessChildren: NavChild[] = [
    { label: "Dados Pessoais", href: "/acesso-antecipado/dados" },
    { label: "Planos e Preços", href: "/acesso-antecipado/planos" },
    {
      label: "Informar CNPJ até 16/Ago",
      href: "/acesso-antecipado/cnpj",
      showActionDot: cnpjPending,
    },
  ];

  return (
    <aside className="w-64 bg-[#0B0F19] border-r border-slate-800 flex flex-col h-full overflow-y-auto shrink-0 relative z-10 shadow-[4px_0_24px_rgba(0,0,0,0.5)]">
      <div className="border-b border-slate-800/50 px-4 py-5">
        <Link
          href="/monitoramento"
          className="flex w-full items-center no-underline"
          aria-label="Mandato Digital — monitoramento"
          title="Ir ao monitoramento"
          onClick={() => onLogoSecretClick?.()}
        >
          <BrandLogo fluid priority />
        </Link>
        <p
          className="mt-2 text-center text-[10px] font-normal tracking-wide text-slate-600 select-none"
          aria-label={`Versão ${APP_VERSION}`}
        >
          v{APP_VERSION}
        </p>
      </div>

      <nav className="flex-1 p-4 space-y-5">
        {NAV_BLOCKS.map((block) => {
          const blockActive = isBlockActive(pathname, block.href);
          const blockHl =
            sidebarTarget === "monitoramento" && block.href.startsWith("/monitoramento");
          const temasConfigHl = sidebarTarget === "temas-config";

          return (
          <div key={block.label}>
            <Link
              href={block.href as Route}
              className={`${navParentClassName(blockActive)}${blockHl ? " !text-cyan-300" : ""}`}
              data-onboarding-anchor={
                block.href.startsWith("/monitoramento") ? "monitoramento" : undefined
              }
            >
              {blockHl ? <OnbHighlightDot /> : null}
              {block.label}
            </Link>
            <ul className="pl-4 mt-1 space-y-1 border-l-2 border-slate-800/80 ml-2">
              {(block.children ?? []).map((child) => {
                const childActive = isChildActive(pathname, child.href, activeHash, pendingMonitorHash);
                const childHl =
                  (temasConfigHl && child.href === "/monitoramento/temas") ||
                  (sidebarTarget === "avatar-config" &&
                    child.href === "/avatares/foto-real/treinar");

                return (
                <li
                  key={child.href + child.label}
                  className={child.variant === "settings" ? "mt-2 pt-2 border-t border-slate-800/60" : undefined}
                >
                  {child.href.includes("#") ? (
                    <a
                      href={child.href}
                      className={`flex items-center gap-1.5 ${childClassName(childActive)}`}
                      onClick={(event) => {
                        event.preventDefault();
                        navigateToMonitorSection(child.href);
                      }}
                    >
                      {child.label}
                    </a>
                  ) : (
                  <Link
                    href={child.href as Route}
                    className={`flex items-center gap-1.5 ${childClassName(childActive)}${childHl ? " !text-cyan-300" : ""}`}
                    data-onboarding-anchor={
                      child.href === "/monitoramento/temas"
                        ? "temas-config"
                        : child.href === "/avatares/foto-real/treinar"
                          ? "avatar-config"
                          : undefined
                    }
                  >
                    {childHl ? <OnbHighlightDot /> : null}
                    {child.variant === "settings" ? (
                      <SettingsGearIcon
                        className={`w-3.5 h-3.5 shrink-0 ${
                          childActive || childHl ? "text-cyan-400" : "text-slate-500"
                        }`}
                      />
                    ) : null}
                    {child.label}
                  </Link>
                  )}
                </li>
              );
              })}
            </ul>
          </div>
        );
        })}

        <div className="space-y-1 pt-2">
          {NAV_SINGLES.map((item) => {
            const itemActive = isChildActive(pathname, item.href, activeHash, pendingMonitorHash);
            const singleHl =
              sidebarTarget === "criativo" &&
              (item.href === "/criativo" || item.href.startsWith("/criativo"));

            return (
            <Link
              key={item.href}
              href={item.href as Route}
              className={`${navParentClassName(itemActive || Boolean(singleHl))}${singleHl ? " !text-cyan-300" : ""}`}
              data-onboarding-anchor={item.href === "/criativo" ? "criativo" : undefined}
            >
              {singleHl ? <OnbHighlightDot /> : null}
              {item.label}
            </Link>
          );
          })}
        </div>

        <div>
          <Link
            href="/acesso-antecipado/dados"
            className={navParentClassName(pathname.startsWith("/acesso-antecipado"))}
          >
            Acesso antecipado
          </Link>
          <ul className="pl-4 mt-1 space-y-1 border-l-2 border-slate-800/80 ml-2">
            {earlyAccessChildren.map((child) => {
              const childActive = isChildActive(pathname, child.href, activeHash, pendingMonitorHash);

              return (
              <li key={child.href}>
                <Link
                  href={child.href as Route}
                  className={`flex items-center gap-2 ${childClassName(childActive)}`}
                >
                  {child.label}
                  {child.showActionDot ? (
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)] animate-pulse"
                      title="Ação Requerida"
                    />
                  ) : null}
                </Link>
              </li>
            );
            })}
          </ul>
        </div>
      </nav>

      <div className="px-4 pb-3 border-t border-slate-800/50 pt-3">
        <Link
          href={"/" as Route}
          className="block text-[11px] font-medium text-slate-500 hover:text-slate-300 transition-colors no-underline"
        >
          Site institucional
        </Link>
      </div>

      {sessionEmail ? (
        <div className="p-4 border-t border-slate-800/50 space-y-2">
          {mounted && !pathname.startsWith("/acesso-antecipado") ? (
            <button
              type="button"
              onClick={() => restartOnboarding()}
              className="w-full text-left text-[11px] font-medium text-cyan-400/90 hover:text-cyan-300 border border-slate-700/80 hover:border-cyan-500/40 rounded-lg px-2.5 py-2 transition-colors"
            >
              Começar onboarding do zero
            </button>
          ) : null}
          <div className="flex items-center justify-between gap-2">
            {canToggleAccountMode ? (
              <button
                type="button"
                onClick={() => setEmailMenuOpen((open) => !open)}
                className="text-xs text-slate-500 truncate text-left hover:text-slate-400 transition-colors"
                title={sessionEmail}
              >
                {sessionEmail}
              </button>
            ) : (
              <span className="text-xs text-slate-500 truncate" title={sessionEmail}>
                {sessionEmail}
              </span>
            )}
            <button
              type="button"
              onClick={onSignOut}
              className="text-xs text-slate-400 hover:text-white border border-slate-700 rounded-lg px-2.5 py-1 transition-colors shrink-0"
            >
              Sair
            </button>
          </div>
          {canToggleAccountMode && emailMenuOpen ? (
            <Link
              href={"/dev/modo-conta" as Route}
              className="block text-[10px] tracking-wide text-slate-600 hover:text-slate-400 transition-colors no-underline"
              onClick={() => setEmailMenuOpen(false)}
            >
              Alternar modo da conta
            </Link>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}
