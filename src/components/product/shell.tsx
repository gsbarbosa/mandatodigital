"use client";

import { useState, type ReactNode } from "react";

import { useProductApp } from "./provider";

import { HeygenDevKeyPanel, useHeygenDevPanelReveal } from "./heygen-dev-key-panel";
import { NavSidebar } from "./nav-sidebar";
import { OnboardingChecklist } from "./onboarding-checklist";
import { OnboardingCoachmark } from "./onboarding-coachmark";
import { OnboardingModals } from "./onboarding-modals";
import { SupportWidget } from "./support-widget";

export function ProductShell({ children }: { children: ReactNode }) {
  const { statusMessage, errorMessage, dismissMessages, sessionUser, signOut } =
    useProductApp();
  const {
    open: heygenDevOpen,
    setOpen: setHeygenDevOpen,
    handleSecretClick: handleHeygenLogoSecretClick,
  } = useHeygenDevPanelReveal();
  const [supportOpen, setSupportOpen] = useState(false);

  return (
    <div className="h-screen flex overflow-hidden bg-md-app-bg text-md-text-soft">
      <NavSidebar
        sessionEmail={sessionUser?.email ?? null}
        onSignOut={() => void signOut()}
        onLogoSecretClick={handleHeygenLogoSecretClick}
        onOpenSupport={() => setSupportOpen(true)}
      />

      <main className="flex-1 overflow-y-auto bg-gradient-to-b from-md-app-bg to-md-slate-900 relative">
        <OnboardingModals />
        <OnboardingCoachmark />
        <OnboardingChecklist />
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
