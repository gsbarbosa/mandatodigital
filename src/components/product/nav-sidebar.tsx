"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useEarlyAccess } from "@/lib/early-access";

type NavChild = {
  label: string;
  href: string;
  showActionDot?: boolean;
};

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
      { label: "Federal", href: "/monitoramento#federal" },
      { label: "Estadual", href: "/monitoramento#estadual" },
      { label: "Municipal", href: "/monitoramento#municipal" },
      { label: "Adversários", href: "/monitoramento#adversarios" },
      { label: "Redefinir temas", href: "/monitoramento/temas" },
    ],
  },
  {
    label: "Avatares",
    href: "/avatares/foto-real",
    children: [
      { label: "Foto Real", href: "/avatares/foto-real" },
      { label: "Caricato", href: "/avatares/caricato" },
      { label: "3D", href: "/avatares/3d" },
    ],
  },
];

const NAV_SINGLES: NavChild[] = [
  { label: "Meus criativos", href: "/criativo" },
  { label: "Gerar pauta independente", href: "/independente" },
  { label: "Compliance TSE", href: "/compliance" },
];

function navHrefPath(href: string) {
  const hashIndex = href.indexOf("#");
  return hashIndex === -1 ? href : href.slice(0, hashIndex);
}

function isChildActive(pathname: string, href: string) {
  const path = navHrefPath(href);
  if (href.includes("#")) {
    // Anchor links inside the monitoring feed: only "Redefinir temas" gets its own route.
    return false;
  }
  return pathname === path || pathname.startsWith(`${path}/`);
}

function childClassName(active: boolean) {
  return active
    ? "block pl-3 py-1.5 text-sm text-cyan-400 no-underline"
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
  const [earlyAccess] = useEarlyAccess();
  const cnpjPending = !earlyAccess.cnpj;

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
      <div className="p-6 border-b border-slate-800/50">
        <Link
          href="/monitoramento"
          className="flex items-center gap-2 no-underline"
          onClick={() => onLogoSecretClick?.()}
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold shadow-[0_0_15px_rgba(6,182,212,0.4)]">
            M
          </div>
          <span className="text-lg font-bold text-white tracking-tight">MandatoDigital</span>
        </Link>
      </div>

      <nav className="flex-1 p-4 space-y-5">
        {NAV_BLOCKS.map((block) => (
          <div key={block.label}>
            <Link
              href={block.href as Route}
              className="block py-2 text-sm text-slate-200 hover:text-white transition-colors no-underline"
            >
              {block.label}
            </Link>
            <ul className="pl-4 mt-1 space-y-1 border-l-2 border-slate-800/80 ml-2">
              {(block.children ?? []).map((child) => (
                <li key={child.href + child.label}>
                  <Link
                    href={child.href as Route}
                    className={childClassName(isChildActive(pathname, child.href))}
                  >
                    {child.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div className="space-y-1 pt-2">
          {NAV_SINGLES.map((item) => (
            <Link
              key={item.href}
              href={item.href as Route}
              className={
                isChildActive(pathname, item.href)
                  ? "block py-2 text-sm text-cyan-400 transition-colors no-underline"
                  : "block py-2 text-sm text-slate-200 hover:text-white transition-colors no-underline"
              }
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div>
          <Link
            href="/acesso-antecipado/dados"
            className="block py-2 text-sm text-slate-200 hover:text-white transition-colors no-underline"
          >
            Acesso antecipado
          </Link>
          <ul className="pl-4 mt-1 space-y-1 border-l-2 border-slate-800/80 ml-2">
            {earlyAccessChildren.map((child) => (
              <li key={child.href}>
                <Link
                  href={child.href as Route}
                  className={`flex items-center gap-2 ${childClassName(isChildActive(pathname, child.href))}`}
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
            ))}
          </ul>
        </div>
      </nav>

      {sessionEmail ? (
        <div className="p-4 border-t border-slate-800/50 flex items-center justify-between gap-2">
          <span className="text-xs text-slate-500 truncate" title={sessionEmail}>
            {sessionEmail}
          </span>
          <button
            type="button"
            onClick={onSignOut}
            className="text-xs text-slate-400 hover:text-white border border-slate-700 rounded-lg px-2.5 py-1 transition-colors shrink-0"
          >
            Sair
          </button>
        </div>
      ) : null}
    </aside>
  );
}
