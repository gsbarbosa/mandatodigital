"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { useOnboarding, type OnboardingBridge } from "./onboarding-provider";
import { useProductApp } from "./provider";

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

function PrimaryButton({
  children,
  onClick,
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-[10px] bg-gradient-to-r from-cyan-400 to-blue-600 px-5 py-3 text-sm font-bold text-white shadow-[0_0_20px_rgba(6,182,212,0.22)] transition-[filter] hover:brightness-110 disabled:cursor-wait disabled:opacity-70"
    >
      {children}
    </button>
  );
}

function WelcomeModal() {
  const { markWelcomeSeen, startGuide, currentStepId } = useOnboarding();
  const router = useRouter();

  function begin() {
    markWelcomeSeen();
    const step = currentStepId ?? "temas-federal";
    startGuide(step);
    router.push("/monitoramento/temas#federal" as Route);
  }

  return (
    <ModalShell onClose={markWelcomeSeen} maxWidth="max-w-[420px]">
      <div className="mb-4 flex h-24 items-center justify-center">
        <RadarVisual />
      </div>
      <h2 className="mb-2 text-balance text-center text-lg font-bold text-white">
        Boas-vindas ao Mandato Digital
      </h2>
      <p className="text-center text-[13px] leading-relaxed text-slate-400">
        Vamos configurar seus temas (nacional → estadual → municipal → adversário) e depois treinar
        o avatar (foto, áudio, persona e glossário).
      </p>
      <div className="mt-6">
        <PrimaryButton onClick={begin}>Começar pelo nível nacional</PrimaryButton>
      </div>
      <button
        type="button"
        onClick={markWelcomeSeen}
        className="mt-3 w-full text-center text-[12px] font-medium text-slate-500 transition hover:text-slate-300"
      >
        Ver checklist depois
      </button>
    </ModalShell>
  );
}

function AfterThemesBridge() {
  const { closeBridge, startGuide } = useOnboarding();
  const { isSavingProfile } = useProductApp();
  const router = useRouter();

  return (
    <ModalShell onClose={closeBridge}>
      <div className="mb-4 flex h-24 items-center justify-center">
        <RadarVisual />
      </div>
      <h2 className="mb-2.5 text-center text-lg font-bold text-white">Temas configurados!</h2>
      <p className="mb-6 text-center text-[13px] leading-relaxed text-slate-400">
        Seu radar foi salvo e o Sentinela já está buscando as pautas. Enquanto isso, vamos treinar o
        avatar: foto, áudio, calibragem de persona e glossário.
      </p>
      <PrimaryButton
        disabled={isSavingProfile}
        onClick={() => {
          closeBridge();
          startGuide("avatar-foto");
          router.push("/avatares/foto-real/treinar#foto" as Route);
        }}
      >
        {isSavingProfile ? "Salvando radar..." : "Começar pelo envio da foto"}
      </PrimaryButton>
    </ModalShell>
  );
}

function AfterAvatarBridge() {
  const { closeBridge, startGuide } = useOnboarding();
  const router = useRouter();

  return (
    <ModalShell onClose={closeBridge}>
      <div className="mb-4 flex h-24 items-center justify-center">
        <RadarVisual />
      </div>
      <h2 className="mb-2.5 text-center text-lg font-bold text-white">
        O Sentinela já montou suas pautas
      </h2>
      <p className="mb-6 text-center text-[13px] leading-relaxed text-slate-400">
        Com os temas e o avatar prontos, o Sentinela vasculhou portais e redes e organizou as
        primeiras pautas do radar. No próximo passo, você vai pautar a primeira delas no Criativo.
      </p>
      <PrimaryButton
        onClick={() => {
          closeBridge();
          startGuide("pautas-pautar");
          router.push("/monitoramento" as Route);
        }}
      >
        Ver as pautas
      </PrimaryButton>
    </ModalShell>
  );
}

function AfterPautasBridge() {
  const { closeBridge, startGuide } = useOnboarding();
  const router = useRouter();

  return (
    <ModalShell onClose={closeBridge}>
      <div className="mx-auto mb-4 flex h-[54px] w-[54px] items-center justify-center rounded-[14px] bg-cyan-400/10 text-cyan-400">
        <IconSpark />
      </div>
      <h2 className="mb-2.5 text-center text-lg font-bold text-white">Hora de criar o roteiro</h2>
      <p className="mb-6 text-center text-[13px] leading-relaxed text-slate-400">
        Com a pauta escolhida, vamos definir arquétipo, tom de linguagem, tema e aprovar o roteiro
        antes de produzir o vídeo.
      </p>
      <PrimaryButton
        onClick={() => {
          closeBridge();
          startGuide("criativo-arquetipo");
          const onCriativo =
            typeof window !== "undefined" &&
            window.location.pathname.startsWith("/criativo/novo");
          if (onCriativo) {
            const next = `${window.location.pathname}${window.location.search}#arquetipo`;
            window.history.replaceState(null, "", next);
          } else {
            router.push("/criativo/novo#arquetipo" as Route);
          }
        }}
      >
        Começar pelo arquétipo
      </PrimaryButton>
    </ModalShell>
  );
}

function AfterRoteiroBridge() {
  const { closeBridge, startGuide } = useOnboarding();
  const router = useRouter();

  return (
    <ModalShell onClose={closeBridge}>
      <div className="mx-auto mb-4 flex h-[54px] w-[54px] items-center justify-center rounded-[14px] bg-cyan-400/10 text-cyan-400">
        <IconSpark />
      </div>
      <h2 className="mb-2.5 text-center text-lg font-bold text-white">Roteiro pronto</h2>
      <p className="mb-6 text-center text-[13px] leading-relaxed text-slate-400">
        Agora escolha o avatar e gere o vídeo. Em poucos cliques o conteúdo sai com a sua cara e a
        sua voz.
      </p>
      <PrimaryButton
        onClick={() => {
          closeBridge();
          startGuide("criativo-avatar");
          const onCriativo =
            typeof window !== "undefined" &&
            window.location.pathname.startsWith("/criativo/novo");
          if (onCriativo) {
            const next = `${window.location.pathname}${window.location.search}#avatar`;
            window.history.replaceState(null, "", next);
          } else {
            router.push("/criativo/novo#avatar" as Route);
          }
        }}
      >
        Escolher avatar
      </PrimaryButton>
    </ModalShell>
  );
}

function BridgeModal({ kind }: { kind: Exclude<OnboardingBridge, null> }) {
  const { closeBridge, startGuide } = useOnboarding();
  const router = useRouter();

  if (kind === "afterThemes") {
    return <AfterThemesBridge />;
  }

  if (kind === "afterAvatar") {
    return <AfterAvatarBridge />;
  }

  if (kind === "afterPautas") {
    return <AfterPautasBridge />;
  }

  if (kind === "afterRoteiro") {
    return <AfterRoteiroBridge />;
  }

  if (kind === "afterUploads") {
    return (
      <ModalShell onClose={closeBridge}>
        <div className="mx-auto mb-4 flex h-[54px] w-[54px] items-center justify-center rounded-[14px] bg-cyan-400/10 text-cyan-400">
          <IconSpark />
        </div>
        <h2 className="mb-2.5 text-center text-lg font-bold text-white">Mídia enviada</h2>
        <p className="mb-6 text-center text-[13px] leading-relaxed text-slate-400">
          Próximo passo: calibrar a persona e o glossário em Personalizar.
        </p>
        <PrimaryButton
          onClick={() => {
            closeBridge();
            startGuide("avatar-persona");
            router.push("/curador#persona" as Route);
          }}
        >
          Ir para calibragem
        </PrimaryButton>
      </ModalShell>
    );
  }

  return (
    <ModalShell onClose={closeBridge}>
      <h2 className="mb-2 text-center text-lg font-bold text-white">Onboarding quase lá</h2>
      <p className="mb-6 text-center text-[13px] leading-relaxed text-slate-400">
        Continue pelo checklist no canto inferior direito.
      </p>
      <PrimaryButton onClick={closeBridge}>Entendi</PrimaryButton>
    </ModalShell>
  );
}

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
