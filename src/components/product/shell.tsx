"use client";

import type { ReactNode } from "react";

import { useProductApp } from "./provider";

import { HeygenDevKeyPanel, useHeygenDevPanelReveal } from "./heygen-dev-key-panel";
import { NavSidebar } from "./nav-sidebar";
import { OnboardingModals } from "./onboarding-modals";
import { OnboardingTracker } from "./onboarding-tracker";

export function ProductShell({ children }: { children: ReactNode }) {
  const { statusMessage, errorMessage, dismissMessages, sessionUser, signOut } =
    useProductApp();
  const {
    open: heygenDevOpen,
    setOpen: setHeygenDevOpen,
    handleSecretClick: handleHeygenLogoSecretClick,
  } = useHeygenDevPanelReveal();

  return (
    <div className="h-screen flex overflow-hidden bg-[#0B0F19] text-slate-300">
      <NavSidebar
        sessionEmail={sessionUser?.email ?? null}
        onSignOut={() => void signOut()}
        onLogoSecretClick={handleHeygenLogoSecretClick}
      />

      <main className="flex-1 overflow-y-auto bg-gradient-to-b from-[#0B0F19] to-slate-900 relative">
        <OnboardingTracker />
        <OnboardingModals />

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
