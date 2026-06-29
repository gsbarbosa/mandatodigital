"use client";

import Link from "next/link";

import {
  factCheckingSourceOptions,
  hardDataSourceOptions,
} from "@/lib/constants";

import { ToggleGridField, updateToggleValues } from "./config-controls";
import { useProductApp } from "./provider";
import { PhaseSectionIntro, SectionCard, StatusPill, workflowStageById } from "./shared";

export function AuditorPage() {
  const {
    contents,
    latestApprovedContent,
    getRequestForContentId,
    profile,
    profileForm,
    setProfileForm,
    saveProfile,
    isSavingProfile,
  } = useProductApp();

  return (
    <section className="phase-section">
      <PhaseSectionIntro stage={workflowStageById.auditor} />

      <div className="grid-main">
        <div className="column-main">
          <SectionCard title="Fontes de fact-checking" subtitle="Matriz de confianca">
            <ToggleGridField
              label="Agências de checagem parceiras"
              values={profileForm.factCheckingSources}
              options={factCheckingSourceOptions}
              onToggle={(value) =>
                setProfileForm((current) => ({
                  ...current,
                  factCheckingSources: updateToggleValues(
                    current.factCheckingSources,
                    value,
                  ),
                }))
              }
            />

            <ToggleGridField
              label="Bases governamentais"
              values={profileForm.hardDataSources}
              options={hardDataSourceOptions}
              onToggle={(value) =>
                setProfileForm((current) => ({
                  ...current,
                  hardDataSources: updateToggleValues(current.hardDataSources, value),
                }))
              }
            />

            <div className="button-row">
              <button
                type="button"
                className="secondary-button"
                onClick={() => void saveProfile()}
                disabled={isSavingProfile}
              >
                {isSavingProfile ? "Salvando matriz..." : "Salvar configuração do Auditor"}
              </button>
            </div>
          </SectionCard>

          <SectionCard title="Histórico reutilizavel" subtitle="Memória editorial">
            {contents.length ? (
              <div className="history-list">
                {contents.map((item) => {
                  const linkedRequest = getRequestForContentId(item.id);

                  return (
                    <Link key={item.id} href={`/auditor/${item.id}`} className="history-item">
                      <div className="history-top">
                        <strong>{item.title}</strong>
                        <StatusPill status={item.status} />
                      </div>
                      <span>{linkedRequest?.topic ?? "Pauta sem referência"}</span>
                      <small>
                        {linkedRequest?.format ?? "Formato não informado"} ·{" "}
                        {new Date(item.createdAt).toLocaleDateString("pt-BR")}
                      </small>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="empty-state">
                O histórico aparece aqui conforme a equipe gera e revisa novas peças.
              </p>
            )}
          </SectionCard>
        </div>

        <aside className="column-side">
          <SectionCard title="Saída do auditor" subtitle="Qualidade editorial">
            <div className="linked-card">
              <strong>Matriz de confianca</strong>
              <span>
                {(profile?.factCheckingSources.length ?? 0) +
                  (profile?.hardDataSources.length ?? 0)}{" "}
                fontes configuradas para apoiar a checagem humana.
              </span>
            </div>

            {latestApprovedContent ? (
              <>
                <div className="linked-card">
                  <strong>{latestApprovedContent.title}</strong>
                  <span>Já existe uma peça aprovada para seguir ao distribuidor.</span>
                </div>
                <div className="button-row">
                  <Link href="/distribuidor" className="secondary-button">
                    Ir para Distribuidor
                  </Link>
                </div>
              </>
            ) : contents[0] ? (
              <div className="button-row">
                <Link href={`/auditor/${contents[0].id}`} className="primary-button">
                  Abrir última peça para revisar
                </Link>
              </div>
            ) : (
              <p className="empty-state">
                Gere uma pauta no Criativo para abrir o fluxo de auditoria e aprovacao.
              </p>
            )}
          </SectionCard>
        </aside>
      </div>
    </section>
  );
}
