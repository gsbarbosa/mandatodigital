"use client";

import type { Route } from "next";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { updateToggleValues } from "@/components/product/config-controls";
import { MockToggleSection } from "@/components/product/mock-agent-ui";
import { useProductApp } from "@/components/product/provider";
import { sentinelThemeGroups } from "@/lib/constants";
import { configSectionHref } from "@/lib/config-setup-status";
import { markOnboardingV2Completed } from "@/lib/product-nav";

type OnboardingStep = 1 | 2 | 3;

export function OnboardingWizard() {
  const router = useRouter();
  const { profileForm, setProfileForm, saveProfile, isSavingProfile } = useProductApp();
  const [step, setStep] = useState<OnboardingStep>(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function saveAndAdvance(nextStep?: OnboardingStep) {
    setErrorMessage(null);

    try {
      await saveProfile({ allowDraftDefaults: true, throwOnError: true });
      if (nextStep) {
        setStep(nextStep);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível salvar.");
    }
  }

  function finishOnboarding() {
    markOnboardingV2Completed();
    router.replace("/inicio");
    router.refresh();
  }

  return (
    <div className="app-page agent-theme-inicio">
      <section className="app-panel app-panel-span-full onboarding-card">
          <p className="persona-helper-text persona-helper-highlight">Primeira configuração</p>
          <h1 data-testid="onboarding-heading">Configure seu mandato</h1>
          <p className="persona-helper-text">
            Três passos rápidos. Depois disso, o dia a dia fica em Início e Criar.
          </p>

          <ol className="onboarding-steps" aria-label="Progresso">
            {[1, 2, 3].map((item) => (
              <li
                key={item}
                className={[
                  "onboarding-step-indicator",
                  step === item ? "is-active" : step > item ? "is-done" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {item}
              </li>
            ))}
          </ol>

          {errorMessage ? (
            <p className="persona-helper-text persona-helper-highlight persona-top-gap">
              {errorMessage}
            </p>
          ) : null}

          {step === 1 ? (
            <div className="persona-form-group persona-top-gap" data-testid="onboarding-step-1">
              <h2>Quem você é</h2>
              <label className="persona-label">
                Nome completo
                <input
                  className="persona-input-control persona-top-gap"
                  value={profileForm.fullName}
                  onChange={(event) =>
                    setProfileForm((current) => ({ ...current, fullName: event.target.value }))
                  }
                />
              </label>
              <label className="persona-label persona-top-gap">
                Cargo
                <input
                  className="persona-input-control persona-top-gap"
                  value={profileForm.role}
                  onChange={(event) =>
                    setProfileForm((current) => ({ ...current, role: event.target.value }))
                  }
                />
              </label>
              <div className="persona-mock-two-column persona-top-gap">
                <label className="persona-label">
                  Cidade
                  <input
                    className="persona-input-control persona-top-gap"
                    value={profileForm.city}
                    onChange={(event) =>
                      setProfileForm((current) => ({ ...current, city: event.target.value }))
                    }
                  />
                </label>
                <label className="persona-label">
                  Estado (UF)
                  <input
                    className="persona-input-control persona-top-gap"
                    value={profileForm.state}
                    onChange={(event) =>
                      setProfileForm((current) => ({ ...current, state: event.target.value }))
                    }
                    maxLength={2}
                  />
                </label>
              </div>
              <label className="persona-label persona-top-gap">
                Bio curta
                <textarea
                  className="persona-input-control persona-top-gap"
                  value={profileForm.bio}
                  onChange={(event) =>
                    setProfileForm((current) => ({ ...current, bio: event.target.value }))
                  }
                  rows={3}
                />
              </label>
              <div className="persona-cta-row persona-top-gap">
                <button
                  type="button"
                  className="persona-btn persona-btn-large"
                  disabled={isSavingProfile}
                  onClick={() => void saveAndAdvance(2)}
                >
                  {isSavingProfile ? "Salvando..." : "Continuar"}
                </button>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="persona-form-group persona-top-gap" data-testid="onboarding-step-2">
              <h2>O que monitorar</h2>
              <p className="persona-helper-text">
                Escolha temas iniciais e, se quiser, um portal. Você pode refinar depois em
                Configurações.
              </p>
              {sentinelThemeGroups.map((group) => (
                <MockToggleSection
                  key={group.title}
                  title={group.title}
                  options={group.options}
                  values={profileForm.sentinelThemes}
                  gridClassName="persona-tag-list is-radar-theme-grid"
                  onToggle={(value) =>
                    setProfileForm((current) => ({
                      ...current,
                      sentinelThemes: updateToggleValues(current.sentinelThemes, value),
                    }))
                  }
                />
              ))}
              <label className="persona-label persona-top-gap">
                Portal de interesse (opcional)
                <input
                  className="persona-input-control persona-top-gap"
                  value={profileForm.interestSites[0] ?? ""}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,
                      interestSites: event.target.value.trim()
                        ? [event.target.value]
                        : [],
                    }))
                  }
                  placeholder="g1.com.br"
                />
              </label>
              <div className="persona-cta-row persona-top-gap">
                <button
                  type="button"
                  className="persona-btn persona-btn-secondary"
                  onClick={() => setStep(1)}
                >
                  Voltar
                </button>
                <button
                  type="button"
                  className="persona-btn persona-btn-large"
                  disabled={isSavingProfile}
                  onClick={() => void saveAndAdvance(3)}
                >
                  {isSavingProfile ? "Salvando..." : "Continuar"}
                </button>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="persona-form-group persona-top-gap" data-testid="onboarding-step-3">
              <h2>Avatar (opcional)</h2>
              <p className="persona-helper-text">
                Você pode enviar áudio, foto ou vídeo agora em Configuração › Avatar, ou pular e
                fazer depois.
              </p>
              <div className="persona-cta-row persona-top-gap">
                <button
                  type="button"
                  className="persona-btn persona-btn-secondary"
                  onClick={() => setStep(2)}
                >
                  Voltar
                </button>
                <button
                  type="button"
                  className="persona-btn persona-btn-secondary"
                  onClick={finishOnboarding}
                  data-testid="onboarding-skip"
                >
                  Fazer depois
                </button>
                <button
                  type="button"
                  className="persona-btn persona-btn-large"
                  onClick={() => {
                    markOnboardingV2Completed();
                    router.replace(configSectionHref("avatar") as Route);
                  }}
                  data-testid="onboarding-go-avatar"
                >
                  Configurar avatar
                </button>
                <button
                  type="button"
                  className="persona-btn persona-btn-large"
                  onClick={finishOnboarding}
                  data-testid="onboarding-finish"
                >
                  Ir para o Início
                </button>
              </div>
            </div>
          ) : null}
      </section>
    </div>
  );
}
