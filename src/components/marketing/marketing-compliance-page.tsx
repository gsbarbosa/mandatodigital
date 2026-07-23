import type { ReactNode } from "react";

import {
  IconBank,
  IconBoleto,
  IconCheck,
  IconCheckSquare,
  IconCodeBrackets,
  IconCurrency,
  IconDocAlert,
  IconFileLock,
  IconFingerprint,
  IconIdCard,
  IconLgpd,
  IconQrFrame,
  IconReceipt,
  IconShieldCheck,
  IconThumbsUp,
  IconUsers,
} from "@/components/marketing/icons";
import { MarketingCtaBand } from "@/components/marketing/marketing-cta-band";
import { MarketingSection } from "@/components/marketing/marketing-section";
import {
  complianceAccounting,
  complianceContract,
  complianceElectoral,
  complianceHero,
  complianceNetwork,
  complianceOnboarding,
  compliancePayments,
  compliancePrivacy,
  complianceProtection,
} from "@/lib/marketing/compliance-content";

type Accent = "emerald" | "cyan" | "amber" | "rose" | "blue";

const ACCENT: Record<
  Accent,
  { text: string; soft: string; border: string; top: string; glow: string }
> = {
  emerald: {
    text: "text-emerald-400",
    soft: "bg-emerald-500/10",
    border: "border-emerald-500/25",
    top: "bg-emerald-500",
    glow: "shadow-emerald-500/20",
  },
  cyan: {
    text: "text-cyan-400",
    soft: "bg-cyan-500/10",
    border: "border-cyan-500/25",
    top: "bg-cyan-500",
    glow: "shadow-cyan-500/20",
  },
  amber: {
    text: "text-amber-400",
    soft: "bg-amber-500/10",
    border: "border-amber-500/25",
    top: "bg-amber-500",
    glow: "shadow-amber-500/20",
  },
  rose: {
    text: "text-rose-400",
    soft: "bg-rose-500/10",
    border: "border-rose-500/25",
    top: "bg-rose-400",
    glow: "shadow-rose-500/20",
  },
  blue: {
    text: "text-blue-400",
    soft: "bg-blue-500/10",
    border: "border-blue-500/25",
    top: "bg-blue-500",
    glow: "shadow-blue-500/20",
  },
};

/** Card no estilo do site antigo: título colorido, divisor, texto, ícone grande embaixo. */
function ComplianceIconCard({
  title,
  children,
  icon,
  accent = "emerald",
}: {
  title: string;
  children: ReactNode;
  icon: ReactNode;
  accent?: Accent;
}) {
  const a = ACCENT[accent];
  return (
    <article
      className={`relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/45 p-6 pt-5 shadow-lg ${a.glow}`}
    >
      <div className={`absolute inset-x-0 top-0 h-0.5 ${a.top}`} aria-hidden />
      <h3 className={`text-lg font-bold ${a.text}`}>{title}</h3>
      <div className="mt-3 mb-5 h-px w-full bg-slate-700/70" aria-hidden />
      <div className="flex-1 text-sm leading-relaxed text-slate-300">{children}</div>
      <div className={`mt-8 flex justify-center ${a.text}`} aria-hidden>
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-2xl border ${a.border} ${a.soft}`}
        >
          {icon}
        </div>
      </div>
    </article>
  );
}

function TitleAccent({
  lead,
  accent,
  accentClass = "text-emerald-400",
}: {
  lead: string;
  accent: string;
  accentClass?: string;
}) {
  return (
    <>
      {lead} <span className={accentClass}>{accent}</span>
    </>
  );
}

function HeroLockVisual() {
  return (
    <div className="relative mx-auto flex aspect-square w-full max-w-md items-center justify-center">
      <div
        className="pointer-events-none absolute inset-[8%] rounded-full bg-cyan-500/10 blur-3xl"
        aria-hidden
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/marketing/compliance-lock.png"
        alt=""
        width={1024}
        height={1024}
        className="relative z-10 h-auto w-full max-w-[420px] object-contain drop-shadow-[0_0_40px_rgba(34,211,238,0.2)]"
        decoding="async"
      />
      <span className="sr-only">Cadeado digital com escudo de conformidade</span>
    </div>
  );
}

function FingerprintVisual() {
  return (
    <div className="relative mx-auto flex h-full min-h-[200px] items-center justify-center lg:min-h-0">
      <div className="relative w-full max-w-[220px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/marketing/fingerprint-scan.png"
          alt=""
          width={640}
          height={640}
          className="relative z-10 h-auto w-full"
          decoding="async"
        />
        <span className="sr-only">Validação biométrica / digital verificada</span>
      </div>
    </div>
  );
}

const ACCOUNTING_ICONS = [IconReceipt, IconBank, IconUsers] as const;
const PAYMENT_ICONS = [IconQrFrame, IconBoleto, IconCurrency, IconCheckSquare] as const;
const PAYMENT_ACCENTS: Accent[] = ["emerald", "cyan", "amber", "emerald"];
const ONBOARDING_ICONS = [IconDocAlert, IconIdCard, IconBank] as const;

export function MarketingCompliancePage() {
  return (
    <>
      {/* Hero — texto + visual de cadeado/escudo (site antigo) */}
      <section className="relative overflow-hidden border-b border-slate-800/40">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_70%_40%,rgba(34,211,238,0.12),transparent_55%),radial-gradient(ellipse_at_20%_80%,rgba(52,211,153,0.08),transparent_50%)]"
          aria-hidden
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-2 lg:gap-12">
          <div className="min-w-0">
            <p className="mb-4 inline-flex rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-400">
              {complianceHero.eyebrow}
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl lg:leading-tight">
              Dominância Narrativa com{" "}
              <span className="text-emerald-400">Segurança Jurídica</span>.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
              {complianceHero.body}
            </p>
          </div>
          <HeroLockVisual />
        </div>
      </section>

      <MarketingSection
        title={<TitleAccent lead="Conformidade" accent="Eleitoral" accentClass="text-rose-400" />}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <ComplianceIconCard
            title={complianceElectoral.cards[0].title}
            accent="rose"
            icon={<IconCheckSquare size={28} />}
          >
            <p>{complianceElectoral.cards[0].body}</p>
          </ComplianceIconCard>
          <ComplianceIconCard
            title={complianceElectoral.cards[1].title}
            accent="rose"
            icon={<IconCodeBrackets size={28} />}
          >
            <p>{complianceElectoral.cards[1].body}</p>
          </ComplianceIconCard>
        </div>
      </MarketingSection>

      {/* Transparência Contábil — 100% + lista com ícones distintos */}
      <MarketingSection
        title={<TitleAccent lead="Transparência" accent="Contábil" />}
        lead={complianceAccounting.body}
      >
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)]">
          <div className="rounded-3xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/15 via-slate-900/50 to-slate-950 p-8 text-center sm:p-10">
            <p className="text-6xl font-extrabold tracking-tight text-emerald-400 sm:text-7xl">
              100%
            </p>
            <p className="mt-3 text-xs font-bold uppercase tracking-[0.2em] text-white">
              {complianceAccounting.highlight.replace("100% ", "")}
            </p>
            <p className={`mt-4 text-sm font-semibold ${ACCENT.emerald.text}`}>
              {complianceAccounting.subtitle}
            </p>
          </div>
          <ul className="space-y-4">
            {complianceAccounting.items.map((item, index) => {
              const Icon = ACCOUNTING_ICONS[index] ?? IconReceipt;
              return (
                <li
                  key={item}
                  className="rounded-2xl border border-slate-800/80 bg-slate-900/40 px-4 py-4"
                >
                  <div className="grid grid-cols-[20px_minmax(0,1fr)] gap-x-3">
                    {/*
                      text-sm (14px) × leading 1.5 = 21px na 1ª linha.
                      Ícone 18px + mt 1.5px ≈ centro óptico da 1ª linha.
                    */}
                    <Icon
                      size={18}
                      className="mt-[1.5px] block text-emerald-400"
                      aria-hidden
                    />
                    <p className="m-0 text-sm leading-[1.5] text-slate-300">{item}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </MarketingSection>

      <MarketingSection
        title={
          <TitleAccent lead="Privacidade e" accent="Reputação" accentClass="text-cyan-400" />
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <ComplianceIconCard
            title={compliancePrivacy.cards[0].title}
            accent="cyan"
            icon={<IconThumbsUp size={28} />}
          >
            <p>{compliancePrivacy.cards[0].body}</p>
          </ComplianceIconCard>
          <ComplianceIconCard
            title={compliancePrivacy.cards[1].title}
            accent="blue"
            icon={<IconLgpd size={28} />}
          >
            <p>{compliancePrivacy.cards[1].body}</p>
          </ComplianceIconCard>
        </div>
      </MarketingSection>

      <MarketingSection>
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-12">
          <div className="min-w-0">
            <h2 className="text-3xl font-bold leading-[1.15] tracking-tight text-white sm:text-4xl">
              <span className="text-emerald-400">Proteção</span> contra acusações
            </h2>
            <ul className="mt-8 m-0 list-none space-y-5 p-0 sm:mt-10">
              {complianceProtection.items.map((item) => (
                <li
                  key={item.title}
                  className="grid grid-cols-[20px_minmax(0,1fr)] gap-x-3"
                >
                  <IconCheck
                    size={18}
                    className="mt-[1.5px] block text-emerald-400"
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="m-0 text-sm font-semibold leading-[1.5] text-white">
                      {item.title}
                    </p>
                    <p className="mt-1.5 m-0 text-sm leading-[1.5] text-slate-400">
                      {item.body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/*
            items-start alinha as caixas; mt fino compensa o half-leading do h2
            para o topo do quadro bater com o topo óptico do título.
          */}
          <div className="relative mt-[0.35rem] overflow-hidden rounded-3xl border border-slate-700/70 bg-gradient-to-br from-slate-900 via-slate-950 to-cyan-950/40 p-6 shadow-xl sm:mt-[0.45rem]">
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-emerald-500/20 blur-3xl" aria-hidden />
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-400/90">
              Materialidade
            </p>
            <p className="mt-2 text-lg font-bold text-white">Provas sob controle</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {[
                { label: "Logs", icon: IconFingerprint },
                { label: "Relatórios", icon: IconReceipt },
                { label: "Trilha", icon: IconFileLock },
                { label: "Escudo", icon: IconShieldCheck },
              ].map(({ label, icon: Icon }) => (
                <div
                  key={label}
                  className="rounded-2xl border border-slate-700/80 bg-slate-950/60 p-4 text-center"
                >
                  <Icon size={22} className="mx-auto text-cyan-400" />
                  <p className="mt-2 text-xs font-medium text-slate-400">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </MarketingSection>

      {/* Pagamentos — lista vertical com ícones (site antigo), não grid 2x2 genérico */}
      <MarketingSection
        title={
          <>
            <span className="text-emerald-400">Pagamentos alinhados</span> à Campanha
          </>
        }
        lead={compliancePayments.subtitle}
      >
        <ul className="m-0 list-none space-y-5 p-0">
          {compliancePayments.items.map((item, index) => {
            const Icon = PAYMENT_ICONS[index] ?? IconReceipt;
            const accent = PAYMENT_ACCENTS[index] ?? "emerald";
            const a = ACCENT[accent];
            return (
              <li
                key={item.title}
                className="grid grid-cols-[20px_minmax(0,1fr)] gap-x-3 border-b border-slate-800/80 pb-5"
              >
                <Icon
                  size={18}
                  className={`mt-[1.5px] block ${a.text}`}
                  aria-hidden
                />
                <div className="min-w-0">
                  <h3 className="m-0 text-sm font-bold leading-[1.5] text-white">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 m-0 text-sm leading-[1.5] text-slate-400">
                    {item.body}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </MarketingSection>

      <MarketingSection
        title={
          <TitleAccent
            lead="Seu Contrato como"
            accent="Escudo Jurídico"
            accentClass="text-cyan-400"
          />
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <ComplianceIconCard
            title={complianceContract.cards[0].title}
            accent="cyan"
            icon={<IconFileLock size={28} />}
          >
            <p>{complianceContract.cards[0].body}</p>
          </ComplianceIconCard>
          <ComplianceIconCard
            title={complianceContract.cards[1].title}
            accent="blue"
            icon={<IconIdCard size={28} />}
          >
            <p>{complianceContract.cards[1].body}</p>
          </ComplianceIconCard>
        </div>
      </MarketingSection>

      <MarketingSection
        title={
          <TitleAccent
            lead="Onboarding Focado na"
            accent="Formalidade"
            accentClass="text-cyan-400"
          />
        }
      >
        <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.7fr)]">
          <div className="grid gap-4 sm:grid-cols-3">
            {complianceOnboarding.cards.map((card, index) => {
              const Icon = ONBOARDING_ICONS[index] ?? IconIdCard;
              return (
                <ComplianceIconCard
                  key={card.title}
                  title={card.title}
                  accent="cyan"
                  icon={<Icon size={26} />}
                >
                  <p>{card.body}</p>
                </ComplianceIconCard>
              );
            })}
          </div>
          <FingerprintVisual />
        </div>
      </MarketingSection>

      <MarketingSection
        title={
          <TitleAccent
            lead="Autonomia com Rede de"
            accent="Proteção"
            accentClass="text-rose-400"
          />
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <ComplianceIconCard
            title={complianceNetwork.cards[0].title}
            accent="rose"
            icon={<IconShieldCheck size={28} />}
          >
            <p>{complianceNetwork.cards[0].body}</p>
          </ComplianceIconCard>
          <ComplianceIconCard
            title={complianceNetwork.cards[1].title}
            accent="amber"
            icon={<IconDocAlert size={28} />}
          >
            <p>{complianceNetwork.cards[1].body}</p>
          </ComplianceIconCard>
        </div>
      </MarketingSection>

      <MarketingCtaBand />
    </>
  );
}
