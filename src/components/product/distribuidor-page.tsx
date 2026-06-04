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
          <SectionCard title="Entrega para canais" subtitle="Operacao manual do MVP">
            <label className="switch-row">
              <div>
                <strong>Aprovacao automatica de conteudo</strong>
                <p>
                  Se ativado, o produto fica preparado para publicacao automatica em
                  fases futuras, embora no MVP a operacao ainda siga manual.
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
                {isSavingProfile ? "Salvando distribuicao..." : "Salvar Distribuidor"}
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
                    Existe ao menos uma peca aprovada pronta para seguir ao distribuidor.
                  </span>
                </div>
                <p className="empty-state">
                  Neste MVP, a saida do Distribuidor ainda e manual: copiar o roteiro
                  aprovado, respeitar os canais/janelas configurados e levar para a
                  operacao.
                </p>
              </>
            ) : (
              <p className="empty-state">
                Quando houver uma peca aprovada, ela aparecera aqui como input da fase
                de distribuicao.
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
