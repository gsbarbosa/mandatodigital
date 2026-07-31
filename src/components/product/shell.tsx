"use client";

import { useState, type ReactNode } from "react";

import { useProductApp } from "./provider";

import { DemoAccountBadge } from "./demo-account-badge";
import { DemoDegustacaoBanner } from "./demo-degustacao-banner";
import { HeygenDevKeyPanel, useHeygenDevPanelReveal } from "./heygen-dev-key-panel";
import { NavSidebar } from "./nav-sidebar";
import { OnboardingChecklist } from "./onboarding-checklist";
import { OnboardingCoachmark } from "./onboarding-coachmark";
import { OnboardingModals } from "./onboarding-modals";
import { useOnboarding } from "./onboarding-provider";
import { SupportWidget } from "./support-widget";
import { getStepDef } from "@/lib/onboarding";

/**
 * Passos com tip fixo na lateral: o conteúdo abre espaço (só em telas largas)
 * para o card do onboarding não cobrir o texto da página.
 */
function guidedGutterClass(side: "left" | "right" | null) {
  if (side === "left") {
    return "xl:pl-[22rem]";
  }
  if (side === "right") {
    return "xl:pr-[22rem]";
  }
  return "";
}

export function ProductShell({ children }: { children: ReactNode }) {
  const { statusMessage, errorMessage, dismissMessages, sessionUser, signOut } =
    useProductApp();
  const { guideOpen, guideStepId } = useOnboarding();
  const {
    open: heygenDevOpen,
    setOpen: setHeygenDevOpen,
    handleSecretClick: handleHeygenLogoSecretClick,
  } = useHeygenDevPanelReveal();
  const [supportOpen, setSupportOpen] = useState(false);

  const guidedPlacement = guideOpen ? getStepDef(guideStepId)?.placement : undefined;
  const guidedSide =
    guidedPlacement === "left" || guidedPlacement === "right" ? guidedPlacement : null;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-md-app-bg text-md-text-soft lg:flex-row">
      <NavSidebar
        sessionEmail={sessionUser?.email ?? null}
        onSignOut={() => void signOut()}
        onLogoSecretClick={handleHeygenLogoSecretClick}
        onOpenSupport={() => setSupportOpen(true)}
      />

      <main
        className={`relative min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-gradient-to-b from-md-app-bg to-md-bg transition-[padding] duration-200 ${guidedGutterClass(guidedSide)}`}
      >
        <DemoAccountBadge />
        <DemoDegustacaoBanner />
        <OnboardingModals />
        <OnboardingCoachmark />
        <OnboardingChecklist hidden={supportOpen} />
        {supportOpen ? <SupportWidget onClose={() => setSupportOpen(false)} /> : null}

        <HeygenDevKeyPanel
          open={heygenDevOpen}
          onClose={() => setHeygenDevOpen(false)}
        />

        {(statusMessage || errorMessage) && (
          <div
            className={`status-toast ${errorMessage ? "error" : "success"}`}
            role={errorMessage ? "alert" : "status"}
            aria-live="polite"
          >
            <p className="status-toast-text">{errorMessage ?? statusMessage}</p>
            <button
              type="button"
              className="status-toast-dismiss"
              aria-label="Fechar aviso"
              onClick={dismissMessages}
            >
              ×
            </button>
          </div>
        )}

        {children}
      </main>
    </div>
  );
}
