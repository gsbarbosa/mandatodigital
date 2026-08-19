"use client";

import type { Route } from "next";
import type { ComponentType, ReactNode } from "react";
import { useCallback, useEffect, useId, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { AppearanceToggle } from "@/components/appearance-toggle";
import { BrandLogo } from "@/components/brand-logo";
import { APP_VERSION } from "@/lib/app-version";
import { isDevAccountModeEmail } from "@/lib/dev-account-mode";
import { isPaymentLockAllowedPath } from "@/lib/billing/payment-access";
import { BILLING_PAYMENT_PATH } from "@/lib/registration-gate";
import { useEarlyAccess } from "@/lib/early-access";
import { useGuestCreditsGate } from "@/components/product/use-guest-credits-gate";
import { usePaymentAccess } from "./use-payment-access";
import { useOnboarding } from "./onboarding-provider";
import {
  AcessoAntecipadoIcon,
  AdversariosIcon,
  AuditoriaIcon,
  AvatarNavIcon,
  CaricatoIcon,
  ChevronDownIcon,
  CnpjIcon,
  ComplianceIcon,
  CriativoIcon,
  DadosPessoaisIcon,
  DistribuidorIcon,
  GemeoDigitalIcon,
  InterestIcon,
  Mascote3DIcon,
  MonitoramentoIcon,
  MunicipalIcon,
  NationalIcon,
  NoticiasDoDiaIcon,
  PagamentosIcon,
  PautaIndependenteIcon,
  PlanosPrecosIcon,
  StateIcon,
} from "./nav-icons";

type NavChild = {
  label: string;
  href: string;
  showActionDot?: boolean;
  /** Configuração do bloco pai (ex.: temas do monitoramento). */
  variant?: "settings";
  /** Ícone do item — opcional; itens "settings" caem no ícone de engrenagem se omitido. */
  icon?: NavIcon;
  /** Abre um respiro antes deste item — separa grupos de itens que não são a mesma coisa (ex.: Notícias do dia não é uma esfera do radar). */
  groupBreakBefore?: boolean;
  /** Respiro + traço fino acima — para itens que são ação/configuração, não destino (ex.: Configurar), fechando a lista. */
  dividerBefore?: boolean;
};

type NavIcon = ComponentType<{ className?: string }>;

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

function MenuIcon({ className }: { className?: string }) {
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
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
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
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function NavLockIcon({ className }: { className?: string }) {
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

/** Marcador pulsante do passo atual do onboarding guiado. */
function OnbHighlightDot() {
  return (
    <span
      aria-hidden="true"
      className="mr-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--curador)] align-middle shadow-[0_0_6px_color-mix(in_srgb,var(--curador)_55%,transparent)] animate-pulse"
    />
  );
}

type NavBlock = {
  label: string;
  href: string;
  icon: NavIcon;
  children?: NavChild[];
};

const NAV_BLOCKS: NavBlock[] = [
  {
    label: "Monitoramento",
    href: "/monitoramento",
    icon: MonitoramentoIcon,
    children: [
      { label: "Nacional", href: "/monitoramento#federal", icon: NationalIcon },
      { label: "Estadual", href: "/monitoramento#estadual", icon: StateIcon },
      { label: "Municipal", href: "/monitoramento#municipal", icon: MunicipalIcon },
      { label: "Interesse", href: "/monitoramento#interesse", icon: InterestIcon },
      { label: "Adversários", href: "/monitoramento#adversarios", icon: AdversariosIcon },
      {
        label: "Notícias do dia",
        href: "/monitoramento/noticias-do-dia",
        icon: NoticiasDoDiaIcon,
        groupBreakBefore: true,
      },
      { label: "Configurar", href: "/monitoramento/temas", variant: "settings", dividerBefore: true },
    ],
  },
  {
    label: "Avatares",
    href: "/avatares/foto-real",
    icon: AvatarNavIcon,
    children: [
      { label: "Gêmeo Digital", href: "/avatares/foto-real", icon: GemeoDigitalIcon },
      { label: "Caricato", href: "/avatares/caricato", icon: CaricatoIcon },
      { label: "Mascote 3D", href: "/avatares/3d", icon: Mascote3DIcon },
      {
        label: "Configurar avatar",
        href: "/avatares/foto-real/treinar",
        variant: "settings",
        dividerBefore: true,
      },
    ],
  },
];

/** Produção (acima do divisor) + compliance (abaixo). Publicador vem após pauta avulsa. */
const NAV_SINGLES_PRIMARY: Array<NavChild & { icon: NavIcon }> = [
  { label: "Meus criativos", href: "/criativo", icon: CriativoIcon },
  { label: "Gerar pauta avulsa", href: "/independente", icon: PautaIndependenteIcon },
  { label: "Publicador", href: "/distribuidor", icon: DistribuidorIcon },
];

const NAV_SINGLES_SECONDARY: Array<NavChild & { icon: NavIcon }> = [
  { label: "Compliance TSE", href: "/compliance", icon: ComplianceIcon },
  { label: "Blindagem Documental", href: "/auditoria", icon: AuditoriaIcon },
];

const EARLY_ACCESS_LABEL = "Acesso antecipado";

/** Sem `flex`/`hidden` aqui — o display é controlado pelo estado mobile/desktop. */
const ASIDE_SURFACE =
  "no-scrollbar w-64 bg-md-app-bg border-r border-md-border flex-col h-full overflow-y-auto shrink-0 relative z-10 shadow-[4px_0_24px_rgba(15,23,42,0.12)]";

function navHrefPath(href: string) {
  const hashIndex = href.indexOf("#");
  return hashIndex === -1 ? href : href.slice(0, hashIndex);
}

function navHrefHash(href: string) {
  const hashIndex = href.indexOf("#");
  return hashIndex === -1 ? "" : href.slice(hashIndex);
}

function activeBlockLabel(pathname: string): string | null {
  for (const block of NAV_BLOCKS) {
    if (isBlockActive(pathname, block.href)) {
      return block.label;
    }
  }
  if (pathname.startsWith("/acesso-antecipado")) {
    return EARLY_ACCESS_LABEL;
  }
  return null;
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

function rowClassName(active: boolean) {
  return `group flex h-11 items-center gap-3 rounded-lg px-2.5 no-underline transition-colors ${
    active ? "bg-[var(--curador-soft)]" : "hover:bg-md-overlay-subtle"
  }`;
}

function rowIconClassName(active: boolean) {
  return `h-5 w-5 shrink-0 ${active ? "text-[var(--curador-text)]" : "text-md-text-soft"}`;
}

function rowLabelClassName(active: boolean) {
  return `truncate text-sm ${active ? "text-[var(--curador-text)]" : "text-md-text"}`;
}

type ChildRow = {
  key: string;
  label: string;
  href: string;
  active: boolean;
  highlighted?: boolean;
  isHashLink?: boolean;
  onHashClick?: (event: React.MouseEvent) => void;
  onboardingAnchor?: string;
  icon?: NavIcon;
  actionDot?: boolean;
  locked?: boolean;
  /** Ver NavChild.groupBreakBefore. */
  groupBreakBefore?: boolean;
  /** Ver NavChild.dividerBefore. */
  dividerBefore?: boolean;
};

function childCardClassName(active: boolean, locked?: boolean) {
  if (locked) {
    return "flex min-w-0 flex-1 cursor-not-allowed items-center gap-2 rounded-md px-2.5 py-[7px] text-[12.5px] text-md-text-soft/55 no-underline opacity-60";
  }
  return `flex min-w-0 flex-1 items-center gap-2 rounded-md px-2.5 py-[7px] text-[12.5px] no-underline transition-colors ${
    active
      ? "bg-[var(--curador-soft)] text-[var(--curador-text)] font-medium"
      : "text-md-text-soft hover:bg-md-overlay-subtle hover:text-md-text"
  }`;
}

/** Submenu — um cartão por item, na mesma linguagem visual dos blocos principais. */
function ChildList({ rows }: { rows: ChildRow[] }) {
  return (
    <ul className="mt-2 mb-1 space-y-1.5">
      {rows.map((row) => {
        const active = row.active;
        const locked = Boolean(row.locked);
        const content = (
          <>
            {row.highlighted ? <OnbHighlightDot /> : null}
            {row.icon ? (
              <row.icon
                className={`h-4 w-4 shrink-0 ${active && !locked ? "text-[var(--curador-text)]" : "text-md-text-soft"}`}
              />
            ) : null}
            <span className="truncate">{row.label}</span>
            {locked ? (
              <NavLockIcon className="ml-auto h-3.5 w-3.5 shrink-0 text-md-text-soft" />
            ) : row.actionDot ? (
              <span
                className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)] animate-pulse"
                title="Ação Requerida"
              />
            ) : null}
          </>
        );

        const liClassName = row.dividerBefore
          ? "flex mt-3 border-t border-md-border pt-3"
          : row.groupBreakBefore
            ? "flex mt-3"
            : "flex";

        return (
          <li key={row.key} className={liClassName}>
            {locked ? (
              <span className={childCardClassName(active, true)} title="Disponível após regularizar o pagamento">
                {content}
              </span>
            ) : row.isHashLink ? (
              <a href={row.href} onClick={row.onHashClick} className={childCardClassName(active)}>
                {content}
              </a>
            ) : (
              <Link
                href={row.href as Route}
                data-onboarding-anchor={row.onboardingAnchor}
                className={childCardClassName(active)}
              >
                {content}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function NavSidebarPanel({
  sessionEmail,
  onSignOut,
  onLogoSecretClick,
  onOpenSupport,
  onNavigate,
  headerExtra,
}: {
  sessionEmail: string | null;
  onSignOut: () => void;
  onLogoSecretClick?: () => void;
  onOpenSupport: () => void;
  onNavigate?: () => void;
  headerExtra?: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { sidebarTarget, restartOnboarding, mounted } = useOnboarding();
  const [activeHash, setActiveHash] = useState("");
  const [pendingMonitorHash, setPendingMonitorHash] = useState<string | null>(null);
  // No máximo um bloco expandido por vez — expandir um recolhe o outro.
  const [expandedBlock, setExpandedBlock] = useState<string | null>(() => activeBlockLabel(pathname));

  const toggleBlock = useCallback((label: string) => {
    setExpandedBlock((current) => (current === label ? null : label));
  }, []);

  const [earlyAccess] = useEarlyAccess();
  const [emailMenuOpen, setEmailMenuOpen] = useState(false);
  const cnpjPending = !earlyAccess.cnpj;
  const { exhausted: guestCreditsExhausted } = useGuestCreditsGate();
  const { blocked: paymentBlocked, dueSoon } = usePaymentAccess();
  const canToggleAccountMode = isDevAccountModeEmail(sessionEmail);

  // Navegar para outra seção recolhe o que estiver aberto (e expande a nova, se aplicável).
  // Com trava de pagamento, mantém Acesso antecipado aberto (Meus pagamentos / CNPJ).
  useEffect(() => {
    if (paymentBlocked) {
      setExpandedBlock(EARLY_ACCESS_LABEL);
      return;
    }
    setExpandedBlock(activeBlockLabel(pathname));
  }, [pathname, paymentBlocked]);

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
      onNavigate?.();

      if (pathname === path) {
        setPendingMonitorHash(null);
        window.history.replaceState(window.history.state, "", `${path}${hrefHash}`);
        document.getElementById(hrefHash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      setPendingMonitorHash(hrefHash);
      router.push(`${path}${hrefHash}` as Route);
    },
    [onNavigate, pathname, router],
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

  // Garante que o bloco certo esteja expandido quando o onboarding guiado
  // precisa apontar para um item aninhado (ex.: Configurar temas).
  useEffect(() => {
    if (sidebarTarget === "monitoramento" || sidebarTarget === "temas-config") {
      setExpandedBlock("Monitoramento");
    } else if (sidebarTarget === "avatar-config") {
      setExpandedBlock("Avatares");
    }
  }, [sidebarTarget]);

  const earlyAccessChildren: NavChild[] = [
    { label: "Dados Pessoais", href: "/acesso-antecipado/dados", icon: DadosPessoaisIcon },
    { label: "Planos e Preços", href: "/acesso-antecipado/planos", icon: PlanosPrecosIcon },
    {
      label: "Meus pagamentos",
      href: BILLING_PAYMENT_PATH,
      icon: PagamentosIcon,
      showActionDot: paymentBlocked || dueSoon,
    },
    {
      label: "Informar CNPJ até 16/Ago",
      href: "/acesso-antecipado/cnpj",
      icon: CnpjIcon,
      showActionDot: cnpjPending,
    },
  ];

  const earlyAccessActive = pathname.startsWith("/acesso-antecipado");
  const earlyAccessExpanded = expandedBlock === EARLY_ACCESS_LABEL;

  function handleLinkNavigate() {
    onNavigate?.();
  }

  function isNavHrefLocked(href: string) {
    return paymentBlocked && !isPaymentLockAllowedPath(navHrefPath(href));
  }

  function renderSingle(item: NavChild & { icon: NavIcon }) {
    const itemActive = isChildActive(pathname, item.href, activeHash, pendingMonitorHash);
    const singleHl =
      sidebarTarget === "criativo" &&
      (item.href === "/criativo" || item.href.startsWith("/criativo"));
    const Icon = item.icon;
    const active = itemActive;
    const locked = isNavHrefLocked(item.href);

    if (locked) {
      return (
        <span
          key={item.href}
          className={`${rowClassName(false)} cursor-not-allowed opacity-55`}
          title="Disponível após regularizar o pagamento"
          aria-disabled="true"
        >
          <Icon className={rowIconClassName(false)} />
          <span className={rowLabelClassName(false)}>{item.label}</span>
          <NavLockIcon className="ml-auto h-4 w-4 shrink-0 text-md-text-soft" />
        </span>
      );
    }

    return (
      <Link
        key={item.href}
        href={item.href as Route}
        className={rowClassName(active)}
        data-onboarding-anchor={item.href === "/criativo" ? "criativo" : undefined}
        onClick={handleLinkNavigate}
      >
        <Icon className={rowIconClassName(active)} />
        <span className={rowLabelClassName(active)}>
          {singleHl ? <OnbHighlightDot /> : null}
          {item.label}
        </span>
      </Link>
    );
  }

  return (
    <>
      <div className="border-b border-md-border-soft px-4 py-5">
        <div className="relative">
          {headerExtra}
          <Link
            href="/monitoramento"
            className="flex w-full flex-col items-center gap-1.5 no-underline"
            aria-label="Mandato Digital — monitoramento"
            title="Ir ao monitoramento"
            onClick={() => {
              onLogoSecretClick?.();
              handleLinkNavigate();
            }}
          >
            <BrandLogo priority />
            <span
              className="text-[10px] font-normal tracking-wide text-md-text-soft select-none leading-none"
              aria-label={`Versão ${APP_VERSION}`}
            >
              v{APP_VERSION}
            </span>
          </Link>
        </div>
      </div>

      <nav
        className="flex-1 p-3 space-y-1.5"
        onClick={(event) => {
          if (!onNavigate) return;
          const target = event.target as HTMLElement | null;
          if (target?.closest?.("a[href]")) {
            onNavigate();
          }
        }}
      >
        {NAV_BLOCKS.map((block) => {
          const blockActive = isBlockActive(pathname, block.href);
          const blockHl =
            sidebarTarget === "monitoramento" && block.href.startsWith("/monitoramento");
          const temasConfigHl = sidebarTarget === "temas-config";
          const expanded = expandedBlock === block.label;
          const Icon = block.icon;
          const blockLocked = isNavHrefLocked(block.href);

          return (
            <div key={block.label} className="rounded-xl">
              <div className={`${rowClassName(blockActive && !blockLocked)}${blockLocked ? " opacity-55" : ""}`}>
                {blockLocked ? (
                  <span
                    className="flex min-w-0 flex-1 cursor-not-allowed items-center gap-3"
                    title="Disponível após regularizar o pagamento"
                    aria-disabled="true"
                  >
                    <Icon className={rowIconClassName(false)} />
                    <span className={rowLabelClassName(false)}>{block.label}</span>
                    <NavLockIcon className="ml-auto h-4 w-4 shrink-0 text-md-text-soft" />
                  </span>
                ) : (
                  <Link
                    href={block.href as Route}
                    className="flex min-w-0 flex-1 items-center gap-3 no-underline"
                    data-onboarding-anchor={
                      block.href.startsWith("/monitoramento") ? "monitoramento" : undefined
                    }
                    onClick={handleLinkNavigate}
                  >
                    <Icon className={rowIconClassName(blockActive)} />
                    <span className={rowLabelClassName(blockActive)}>
                      {blockHl ? <OnbHighlightDot /> : null}
                      {block.label}
                    </span>
                  </Link>
                )}
                {block.children?.length ? (
                  <button
                    type="button"
                    onClick={() => toggleBlock(block.label)}
                    aria-expanded={expanded}
                    aria-label={expanded ? `Recolher ${block.label}` : `Expandir ${block.label}`}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-md-surface-inset text-md-text-soft transition hover:text-md-text"
                  >
                    <ChevronDownIcon
                      className={`h-3.5 w-3.5 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
                    />
                  </button>
                ) : null}
              </div>

              <div
                className={`grid transition-[grid-template-rows] duration-200 ease-out ${
                  expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                }`}
              >
                <div className="overflow-hidden">
                  <ChildList
                    rows={(block.children ?? []).map((child) => {
                      const childActive = isChildActive(
                        pathname,
                        child.href,
                        activeHash,
                        pendingMonitorHash,
                      );
                      const childHl =
                        (temasConfigHl && child.href === "/monitoramento/temas") ||
                        (sidebarTarget === "avatar-config" &&
                          child.href === "/avatares/foto-real/treinar");
                      const isHashLink = child.href.includes("#");
                      const locked = isNavHrefLocked(child.href);

                      return {
                        key: child.href + child.label,
                        label: child.label,
                        href: child.href,
                        active: childActive,
                        highlighted: childHl,
                        isHashLink,
                        locked,
                        onHashClick:
                          !locked && isHashLink
                            ? (event: React.MouseEvent) => {
                                event.preventDefault();
                                navigateToMonitorSection(child.href);
                              }
                            : undefined,
                        onboardingAnchor:
                          child.href === "/monitoramento/temas"
                            ? "temas-config"
                            : child.href === "/avatares/foto-real/treinar"
                              ? "avatar-config"
                              : undefined,
                        icon: child.icon ?? (child.variant === "settings" ? SettingsGearIcon : undefined),
                        groupBreakBefore: child.groupBreakBefore,
                        dividerBefore: child.dividerBefore,
                      };
                    })}
                  />
                </div>
              </div>
            </div>
          );
        })}

        <div className="space-y-1.5">
          {NAV_SINGLES_PRIMARY.map((item) => renderSingle(item))}
        </div>

        <div className="my-4 border-t border-md-border" aria-hidden="true" />

        <div className="space-y-1.5">
          {NAV_SINGLES_SECONDARY.map((item) => renderSingle(item))}
        </div>

        <div className="rounded-xl">
          <div className={rowClassName(earlyAccessActive)}>
            <Link
              href="/acesso-antecipado/dados"
              className="flex min-w-0 flex-1 items-center gap-3 no-underline"
              onClick={handleLinkNavigate}
            >
              <AcessoAntecipadoIcon className={rowIconClassName(earlyAccessActive)} />
              <span className={rowLabelClassName(earlyAccessActive)}>{EARLY_ACCESS_LABEL}</span>
              {guestCreditsExhausted ? (
                <span
                  className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)] animate-pulse"
                  title="Ação Requerida"
                />
              ) : null}
            </Link>
            <button
              type="button"
              onClick={() => toggleBlock(EARLY_ACCESS_LABEL)}
              aria-expanded={earlyAccessExpanded}
              aria-label={
                earlyAccessExpanded ? "Recolher Acesso antecipado" : "Expandir Acesso antecipado"
              }
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-md-surface-inset text-md-text-soft transition hover:text-md-text"
            >
              <ChevronDownIcon
                className={`h-3.5 w-3.5 transition-transform duration-200 ${earlyAccessExpanded ? "rotate-180" : ""}`}
              />
            </button>
          </div>

          <div
            className={`grid transition-[grid-template-rows] duration-200 ease-out ${
              earlyAccessExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            }`}
          >
            <div className="overflow-hidden">
              <ChildList
                rows={earlyAccessChildren.map((child) => ({
                  key: child.href,
                  label: child.label,
                  href: child.href,
                  active: isChildActive(pathname, child.href, activeHash, pendingMonitorHash),
                  icon: child.icon,
                  actionDot: child.showActionDot,
                  locked: isNavHrefLocked(child.href),
                }))}
              />
            </div>
          </div>
        </div>
      </nav>

      <div className="mt-auto px-4 pb-3 pt-3 border-t border-md-border-soft space-y-3">
        <div className="flex flex-col items-start gap-1.5 px-0.5">
          {mounted && !pathname.startsWith("/acesso-antecipado") ? (
            <button
              type="button"
              onClick={() => {
                restartOnboarding();
                handleLinkNavigate();
              }}
              className="text-left text-xs text-md-text-soft transition-colors hover:text-md-text"
            >
              Passo-a-passo guiado
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              onOpenSupport();
              handleLinkNavigate();
            }}
            className="text-left text-xs text-md-text-soft transition-colors hover:text-md-text"
          >
            Suporte
          </button>
        </div>
        <AppearanceToggle />
      </div>

      {sessionEmail ? (
        <div className="p-4 border-t border-md-border-soft space-y-2">
          <div className="flex items-center justify-between gap-2">
            {canToggleAccountMode ? (
              <button
                type="button"
                onClick={() => setEmailMenuOpen((open) => !open)}
                className="text-xs text-md-text-soft truncate text-left hover:text-md-text transition-colors"
                title={sessionEmail}
              >
                {sessionEmail}
              </button>
            ) : (
              <span className="text-xs text-md-text-soft truncate" title={sessionEmail}>
                {sessionEmail}
              </span>
            )}
            <button
              type="button"
              onClick={onSignOut}
              className="text-xs text-md-text-soft hover:text-md-text border border-md-border rounded-lg px-2.5 py-1 transition-colors shrink-0"
            >
              Sair
            </button>
          </div>
          {canToggleAccountMode && emailMenuOpen ? (
            <Link
              href={"/dev/modo-conta" as Route}
              className="block text-[10px] tracking-wide text-md-text-soft hover:text-md-text transition-colors no-underline"
              onClick={() => {
                setEmailMenuOpen(false);
                handleLinkNavigate();
              }}
            >
              Tipo de conta (trial + 3 planos)
            </Link>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

export function NavSidebar({
  sessionEmail,
  onSignOut,
  onLogoSecretClick,
  onOpenSupport,
}: {
  sessionEmail: string | null;
  onSignOut: () => void;
  onLogoSecretClick?: () => void;
  onOpenSupport: () => void;
}) {
  const pathname = usePathname();
  const drawerId = useId();
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  // Fecha o drawer ao mudar de rota.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Escape + scroll lock enquanto o drawer está aberto.
  useEffect(() => {
    if (!mobileOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileOpen]);

  // Em resize para desktop, garante drawer fechado.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => {
      if (mq.matches) {
        setMobileOpen(false);
      }
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <>
      <header className="relative isolate flex h-14 shrink-0 items-center justify-between gap-3 border-b border-md-border px-4 lg:hidden">
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-md-app-bg/95 backdrop-blur-md"
          aria-hidden
        />
        <Link
          href="/monitoramento"
          className="relative shrink-0 overflow-visible no-underline"
          aria-label="Mandato Digital — monitoramento"
          onClick={() => onLogoSecretClick?.()}
        >
          <BrandLogo priority />
        </Link>
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-md-border text-md-text transition hover:bg-md-overlay-hover"
          aria-expanded={mobileOpen}
          aria-controls={drawerId}
          aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? <CloseIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
        </button>
      </header>

      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          aria-label="Fechar menu"
          onClick={closeMobile}
        />
      ) : null}

      {/*
        Um único painel: no desktop fica no fluxo (lg:flex relative);
        no mobile só aparece como drawer fixo quando aberto.
      */}
      <aside
        id={drawerId}
        className={`${ASIDE_SURFACE} ${
          mobileOpen
            ? "flex fixed inset-y-0 left-0 z-50 max-w-[85vw] lg:static lg:z-10 lg:max-w-none"
            : "hidden lg:flex"
        }`}
        role={mobileOpen ? "dialog" : undefined}
        aria-modal={mobileOpen ? true : undefined}
        aria-label={mobileOpen ? "Navegação" : undefined}
      >
        <NavSidebarPanel
          sessionEmail={sessionEmail}
          onSignOut={onSignOut}
          onLogoSecretClick={onLogoSecretClick}
          onOpenSupport={onOpenSupport}
          onNavigate={mobileOpen ? closeMobile : undefined}
          headerExtra={
            mobileOpen ? (
              <button
                type="button"
                className="absolute right-0 top-0 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-md-border text-md-text-soft transition hover:text-md-text lg:hidden"
                aria-label="Fechar menu"
                onClick={closeMobile}
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            ) : null
          }
        />
      </aside>
    </>
  );
}
