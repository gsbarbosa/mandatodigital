"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { useOnboarding, type OnboardingBridge } from "./onboarding-provider";

/* ----------------------------- ícones ----------------------------- */

function RadarVisual() {
  return (
    <div className="relative h-24 w-24 rounded-full bg-[radial-gradient(circle,rgba(34,211,238,0.06)_0%,transparent_70%)]">
      <span className="absolute inset-0 rounded-full border border-cyan-400/25" />
      <span className="absolute inset-5 rounded-full border border-cyan-400/25" />
      <span
        className="absolute inset-0 rounded-full animate-[spin_3s_linear_infinite] motion-reduce:animate-none"
        style={{ background: "conic-gradient(from 0deg, rgba(34,211,238,0.55), transparent 35%)" }}
      />
      <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300 shadow-[0_0_8px_#22d3ee]" />
    </div>
  );
}

function IconTarget() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.2" />
    </svg>
  );
}
function IconEye() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function IconPlay() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
function IconArrow() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-slate-600">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
function IconShield() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-16 w-16 text-cyan-400">
      <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}
function IconBadge() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[17px] w-[17px]">
      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function IconAudit() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[17px] w-[17px]">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <path d="M14 2v6h6M9 15l2 2 4-4" />
    </svg>
  );
}
function IconWater() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[17px] w-[17px]">
      <path d="M12 2s6 6.5 6 11a6 6 0 01-12 0c0-4.5 6-11 6-11z" />
    </svg>
  );
}
function IconSpark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
    </svg>
  );
}
function IconClose() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

/* ----------------------------- shell do modal ----------------------------- */

function ModalShell({
  children,
  onClose,
  maxWidth = "max-w-md",
}: {
  children: ReactNode;
  onClose?: () => void;
  maxWidth?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(4,6,12,0.74)] p-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`relative w-full ${maxWidth} rounded-[18px] border border-slate-800 bg-[#10141f] p-7 shadow-[0_30px_70px_rgba(0,0,0,0.5)]`}
      >
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="absolute right-3.5 top-3.5 flex h-6 w-6 items-center justify-center rounded-full bg-slate-700/40 text-slate-400 transition-colors hover:bg-slate-700/70 hover:text-white"
          >
            <IconClose />
          </button>
        ) : null}
        {children}
      </div>
    </div>
  );
}

function PrimaryButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-[10px] bg-gradient-to-r from-cyan-400 to-blue-600 px-5 py-3 text-sm font-bold text-white shadow-[0_0_20px_rgba(6,182,212,0.22)] transition-[filter] hover:brightness-110"
    >
      {children}
    </button>
  );
}

/* ----------------------------- boas-vindas ----------------------------- */

type Slide = { visual: ReactNode; title: string; body: ReactNode };

function FlowStep({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex w-[86px] flex-col items-center gap-2 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-400/25 bg-cyan-400/10 text-cyan-400">
        {icon}
      </span>
      <span className="text-[10.5px] font-semibold leading-tight text-slate-300">{label}</span>
    </div>
  );
}

const WELCOME_SLIDES: Slide[] = [
  {
    visual: <RadarVisual />,
    title: "Boas-vindas ao Mandato Digital",
    body: "Monitoramos notícias e redes sociais sobre você e seus adversários, todos os dias, para você nunca perder uma pauta relevante.",
  },
  {
    visual: (
      <div className="flex items-center gap-1.5">
        <FlowStep icon={<IconTarget />} label="Selecionar Temas" />
        <IconArrow />
        <FlowStep icon={<IconEye />} label="Ver notícias dos temas" />
        <IconArrow />
        <FlowStep icon={<IconPlay />} label="Pautar e Gerar Vídeo" />
      </div>
    ),
    title: "Você escolhe, nós produzimos!",
    body: "Selecionar Temas → Ver notícias dos temas → Pautar e Gerar Vídeo. Você revisa e aprova cada etapa antes de publicar.",
  },
  {
    visual: <IconShield />,
    title: "Tudo dentro da lei eleitoral.",
    body: "Fact-check automático, aprovação humana obrigatória e trilha de auditoria completa — pensado para as regras do TSE.",
  },
];

function WelcomeModal() {
  const { markWelcomeSeen } = useOnboarding();
  const [index, setIndex] = useState(0);
  const slide = WELCOME_SLIDES[index];
  const isLast = index === WELCOME_SLIDES.length - 1;

  return (
    <ModalShell onClose={markWelcomeSeen} maxWidth="max-w-[440px]">
      <div className="mb-4 flex h-28 items-center justify-center">{slide.visual}</div>
      <h2 className="mb-2.5 text-balance text-center text-lg font-bold text-white">{slide.title}</h2>
      <p className="text-center text-[13px] leading-relaxed text-slate-400">{slide.body}</p>

      <div className="my-5 flex justify-center gap-1.5">
        {WELCOME_SLIDES.map((_, dot) => (
          <span
            key={dot}
            className={
              dot === index
                ? "h-1.5 w-4 rounded-full bg-cyan-400"
                : "h-1.5 w-1.5 rounded-full bg-slate-600"
            }
          />
        ))}
      </div>

      <PrimaryButton onClick={isLast ? markWelcomeSeen : () => setIndex((current) => current + 1)}>
        {isLast ? "Começar configuração" : "Próximo"}
      </PrimaryButton>
    </ModalShell>
  );
}

/* ----------------------------- pontes ----------------------------- */

function Guarantee({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="flex gap-3 border-b border-slate-800/70 py-3.5 last:border-b-0">
      <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] bg-cyan-400/10 text-cyan-400">
        {icon}
      </span>
      <div>
        <h4 className="text-[13.5px] font-bold text-slate-100">{title}</h4>
        <p className="text-[12.5px] leading-snug text-slate-400">{body}</p>
      </div>
    </div>
  );
}

const GUARANTEES = [
  {
    icon: <IconBadge />,
    title: "Fact-check por IA",
    body: "Toda afirmação do roteiro passa pela auditoria do Mandato Digital antes de virar vídeo.",
  },
  {
    icon: <IconEye />,
    title: "Aprovação humana obrigatória",
    body: "Nenhum vídeo é publicado automaticamente — você sempre revisa e aprova antes.",
  },
  {
    icon: <IconAudit />,
    title: "Trilha de auditoria completa",
    body: "Cada pauta, roteiro e aprovação tem o seu log registrado para eventuais necessidades junto ao TSE.",
  },
  {
    icon: <IconWater />,
    title: "Marca d’água identificável",
    body: "Vídeos gerados por IA são sinalizados, conforme as regras do TSE para 2026.",
  },
];

function BridgeModal({ kind }: { kind: Exclude<OnboardingBridge, null> }) {
  const { closeBridge } = useOnboarding();
  const router = useRouter();

  if (kind === "afterRadar") {
    return (
      <ModalShell onClose={closeBridge}>
        <div className="mb-4 flex h-24 items-center justify-center">
          <RadarVisual />
        </div>
        <h2 className="mb-2.5 text-center text-lg font-bold text-white">Radar ativado!</h2>
        <p className="mb-6 text-center text-[13px] leading-relaxed text-slate-400">
          Enquanto nossos robôs estão buscando por notícias nos temas selecionados, vamos aproveitar
          para configurar o seu avatar.
        </p>
        <PrimaryButton
          onClick={() => {
            closeBridge();
            router.push("/avatares/foto-real/treinar" as Route);
          }}
        >
          Configurar avatar
        </PrimaryButton>
      </ModalShell>
    );
  }

  if (kind === "afterUploads") {
    return (
      <ModalShell onClose={closeBridge}>
        <div className="mx-auto mb-4 flex h-[54px] w-[54px] items-center justify-center rounded-[14px] bg-cyan-400/10 text-cyan-400">
          <IconSpark />
        </div>
        <h2 className="mb-2.5 text-center text-lg font-bold text-white">Avatar em treinamento</h2>
        <p className="mb-6 text-center text-[13px] leading-relaxed text-slate-400">
          Agora que as notícias estão saindo do forno, paute alguma para testar a criação do
          conteúdo.
        </p>
        <PrimaryButton
          onClick={() => {
            closeBridge();
            router.push("/monitoramento" as Route);
          }}
        >
          Ver minhas pautas
        </PrimaryButton>
      </ModalShell>
    );
  }

  // kind === "compliance"
  return (
    <ModalShell onClose={closeBridge} maxWidth="max-w-[500px]">
      <h2 className="text-[16px] font-bold text-white">Enquanto o vídeo fica pronto</h2>
      <p className="mb-2 mt-1 flex items-center gap-2 text-[12.5px] text-slate-400">
        <span className="h-[18px] w-[18px] shrink-0 animate-spin rounded-full border-2 border-cyan-400/25 border-t-cyan-400 motion-reduce:animate-none" />
        Pode levar até 03 minutinhos. Algumas informações importantes:
      </p>
      <div className="mt-2">
        {GUARANTEES.map((item) => (
          <Guarantee key={item.title} icon={item.icon} title={item.title} body={item.body} />
        ))}
      </div>
      <div className="mt-5">
        <PrimaryButton onClick={closeBridge}>Entendi, continuar</PrimaryButton>
      </div>
    </ModalShell>
  );
}

/* ----------------------------- orquestrador ----------------------------- */

export function OnboardingModals() {
  const { mounted, showWelcome, bridge } = useOnboarding();

  if (!mounted) {
    return null;
  }
  if (showWelcome) {
    return <WelcomeModal />;
  }
  if (bridge) {
    return <BridgeModal kind={bridge} />;
  }
  return null;
}
