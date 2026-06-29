"use client";

import Link from "next/link";

import {
  distributionChannelOptions,
  distributionWindowOptions,
} from "@/lib/constants";

import { ToggleGridField, updateToggleValues } from "./config-controls";
import { useProductApp } from "./provider";
import { PhaseSectionIntro, SectionCard, workflowStageById } from "./shared";

export function DistribuidorPage() {
  const {
    latestApprovedContent,
    profileForm,
    setProfileForm,
    saveProfile,
    isSavingProfile,
  } = useProductApp();

  return (
    <section className="phase-section">
      <PhaseSectionIntro stage={workflowStageById.distribuidor} />

      <div className="grid-main">
        <div className="column-main">
          <SectionCard title="Entrega para canais" subtitle="Operação manual do MVP">
            <label className="switch-row">
              <div>
                <strong>Aprovação automática de conteúdo</strong>
                <p>
                  Se ativado, o produto fica preparado para publicação automática em
                  fases futuras, embora no MVP a operação ainda siga manual.
                </p>
              </div>
              <input
                type="checkbox"
                checked={profileForm.autoPublish}
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,
                    autoPublish: event.target.checked,
                  }))
                }
              />
            </label>

            <ToggleGridField
              label="Canais habilitados"
              values={profileForm.distributionChannels}
              options={distributionChannelOptions}
              onToggle={(value) =>
                setProfileForm((current) => ({
                  ...current,
                  distributionChannels: updateToggleValues(
                    current.distributionChannels,
                    value,
                  ),
                }))
              }
            />

            <ToggleGridField
              label="Janelas autorizadas"
              values={profileForm.distributionWindows}
              options={distributionWindowOptions}
              onToggle={(value) =>
                setProfileForm((current) => ({
                  ...current,
                  distributionWindows: updateToggleValues(
                    current.distributionWindows,
                    value,
                  ),
                }))
              }
            />

            <div className="button-row">
              <button
                type="button"
                className="primary-button"
                onClick={() => void saveProfile()}
                disabled={isSavingProfile}
              >
                {isSavingProfile ? "Salvando distribuição..." : "Salvar Distribuidor"}
              </button>
            </div>
          </SectionCard>
        </div>

        <aside className="column-side">
          <SectionCard title="Pacote pronto para operar" subtitle="Handoff manual">
            {latestApprovedContent ? (
              <>
                <div className="linked-card">
                  <strong>{latestApprovedContent.title}</strong>
                  <span>
                    Existe ao menos uma peça aprovada pronta para seguir ao distribuidor.
                  </span>
                </div>
                <p className="empty-state">
                  Neste MVP, a saída do Distribuidor ainda e manual: copiar o roteiro
                  aprovado, respeitar os canais/janelas configurados e levar para a
                  operação.
                </p>
              </>
            ) : (
              <p className="empty-state">
                Quando houver uma peça aprovada, ela aparecerá aqui como input da fase
                de distribuição.
              </p>
            )}

            <div className="button-row">
              <Link href="/auditor" className="secondary-button">
                Voltar para Auditor
              </Link>
            </div>
          </SectionCard>
        </aside>
      </div>
    </section>
  );
}
