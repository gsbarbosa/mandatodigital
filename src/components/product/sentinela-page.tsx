"use client";

import Link from "next/link";

import {
  oppositionThemeGroups,
  sentinelThemeGroups,
  socialNetworkOptions,
} from "@/lib/constants";

import {
  DynamicSocialListField,
  DynamicStringListField,
  ToggleGridField,
  updateToggleValues,
} from "./config-controls";
import { useProductApp } from "./provider";
import { PhaseSectionIntro, SectionCard, workflowStageById } from "./shared";

export function SentinelaPage() {
  const { profile, profileForm, setProfileForm, saveProfile, isSavingProfile } =
    useProductApp();

  return (
    <section className="phase-section">
      <PhaseSectionIntro stage={workflowStageById.sentinela} />

      <div className="grid-main">
        <div className="column-main">
          <SectionCard title="Radar de pautas" subtitle="Captação manual/semiassistida">
            <p className="empty-state">
              No MVP, o Sentinela ainda nao varre a web automaticamente, mas ja captura
              o que deve entrar em monitoramento: temas, oposicao, perfis e portais.
            </p>

            {sentinelThemeGroups.map((group) => (
              <ToggleGridField
                key={group.title}
                label={group.title}
                values={profileForm.sentinelThemes}
                options={group.options}
                onToggle={(value) =>
                  setProfileForm((current) => ({
                    ...current,
                    sentinelThemes: updateToggleValues(current.sentinelThemes, value),
                  }))
                }
              />
            ))}

            <div className="field-grid">
              {[0, 1, 2].map((index) => (
                <label key={index} className="field">
                  <span>{`Tema personalizado ${index + 1}`}</span>
                  <input
                    value={profileForm.customRadarThemes[index] ?? ""}
                    onChange={(event) =>
                      setProfileForm((current) => ({
                        ...current,
                        customRadarThemes: Array.from({ length: 3 }, (_, itemIndex) =>
                          itemIndex === index
                            ? event.target.value
                            : current.customRadarThemes[itemIndex] ?? "",
                        ),
                      }))
                    }
                    placeholder={`Tema ${index + 1}...`}
                  />
                </label>
              ))}
            </div>

            <div className="field-grid">
              <DynamicSocialListField
                label="Perfis de interesse"
                fieldKey="interestProfiles"
                values={profileForm.interestProfiles}
                networkOptions={socialNetworkOptions}
                addLabel="Adicionar perfil monitorado"
                setProfileForm={setProfileForm}
              />
              <DynamicStringListField
                label="Portais e sites de interesse"
                fieldKey="interestSites"
                values={profileForm.interestSites}
                placeholder="www.portalregional.com"
                addLabel="Adicionar portal monitorado"
                setProfileForm={setProfileForm}
              />
            </div>
          </SectionCard>

          <SectionCard title="Rastreio da oposicao" subtitle="Assuntos e vozes adversarias">
            {oppositionThemeGroups.map((group) => (
              <ToggleGridField
                key={group.title}
                label={group.title}
                values={profileForm.oppositionThemes}
                options={group.options}
                onToggle={(value) =>
                  setProfileForm((current) => ({
                    ...current,
                    oppositionThemes: updateToggleValues(current.oppositionThemes, value),
                  }))
                }
              />
            ))}

            <div className="field-grid">
              <DynamicSocialListField
                label="Perfis dos adversarios diretos"
                fieldKey="oppositionProfiles"
                values={profileForm.oppositionProfiles}
                networkOptions={socialNetworkOptions}
                addLabel="Adicionar adversario"
                setProfileForm={setProfileForm}
              />
              <DynamicStringListField
                label="Blogs e portais de oposicao"
                fieldKey="oppositionSites"
                values={profileForm.oppositionSites}
                placeholder="www.blog-oposicao.com.br"
                addLabel="Adicionar portal de oposicao"
                setProfileForm={setProfileForm}
              />
            </div>

            <div className="button-row">
              <button
                type="button"
                className="primary-button"
                onClick={() => void saveProfile()}
                disabled={isSavingProfile}
              >
                {isSavingProfile ? "Salvando radar..." : "Salvar Sentinela"}
              </button>
            </div>
          </SectionCard>
        </div>

        <aside className="column-side">
          <SectionCard title="Saida do sentinela" subtitle="Fila priorizada">
            <div className="feedback-stack">
              <div className="linked-card">
                <strong>Temas monitorados</strong>
                <span>
                  {(profile?.sentinelThemes.length ?? 0) +
                    (profile?.customRadarThemes.length ?? 0)}{" "}
                  temas ativos no radar do mandato.
                </span>
              </div>
              <div className="linked-card">
                <strong>Oposicao</strong>
                <span>
                  {(profile?.oppositionProfiles.length ?? 0) +
                    (profile?.oppositionSites.length ?? 0)}{" "}
                  fontes adversarias acompanhadas.
                </span>
              </div>
            </div>

            <div className="button-row">
              <Link href="/curador" className="secondary-button">
                Seguir para Curador
              </Link>
            </div>
          </SectionCard>
        </aside>
      </div>
    </section>
  );
}
