"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  avatarEmotionOptions,
  avatarVoicePaceOptions,
  defaultFormats,
  defaultIntensities,
  editingStyleOptions,
} from "@/lib/constants";

import { ToggleGridField, updateToggleValues } from "./config-controls";
import { useProductApp } from "./provider";
import { PhaseSectionIntro, SectionCard, StatusPill, workflowStageById } from "./shared";

export function CriativoPage() {
  const router = useRouter();
  const {
    profile,
    profileForm,
    setProfileForm,
    saveProfile,
    isSavingProfile,
    requestForm,
    setRequestForm,
    generateContent,
    isGenerating,
    contents,
    getRequestForContentId,
  } = useProductApp();

  async function handleGenerateContent() {
    const generatedContents = await generateContent();

    if (generatedContents[0]) {
      router.push(`/auditor/${generatedContents[0].id}`);
    }
  }

  return (
    <section className="phase-section">
      <PhaseSectionIntro stage={workflowStageById.criativo} />

      <div className="grid-main">
        <div className="column-main">
          <SectionCard title="Avatar digital e edição" subtitle="Preferências criativas do mandato">
            <ToggleGridField
              label="Emoção e expressão"
              values={profileForm.avatarEmotions}
              options={avatarEmotionOptions}
              onToggle={(value) =>
                setProfileForm((current) => ({
                  ...current,
                  avatarEmotions: updateToggleValues(current.avatarEmotions, value),
                }))
              }
            />

            <div className="control-group">
              <span className="control-label">Velocidade da sintese de voz</span>
              <div className="option-grid">
                {avatarVoicePaceOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={profileForm.voicePace === option ? "option active" : "option"}
                    onClick={() =>
                      setProfileForm((current) => ({ ...current, voicePace: option }))
                    }
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <ToggleGridField
              label="Estilos de edição"
              values={profileForm.editingStyles}
              options={editingStyleOptions}
              onToggle={(value) =>
                setProfileForm((current) => ({
                  ...current,
                  editingStyles: updateToggleValues(current.editingStyles, value),
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
                {isSavingProfile ? "Salvando preferências..." : "Salvar preferências criativas"}
              </button>
            </div>
          </SectionCard>

          <SectionCard title="Nova pauta" subtitle="Geração com revisão humana">
            <label className="field">
              <span>Tema do dia</span>
              <textarea
                value={requestForm.topic}
                onChange={(event) =>
                  setRequestForm((current) => ({
                    ...current,
                    topic: event.target.value,
                  }))
                }
                placeholder="Ex.: aumento no tempo de espera para consultas especializadas"
                data-testid="request-topic"
              />
            </label>

            <div className="field-grid">
              <label className="field">
                <span>Objetivo da peça</span>
                <input
                  value={requestForm.objective}
                  onChange={(event) =>
                    setRequestForm((current) => ({
                      ...current,
                      objective: event.target.value,
                    }))
                  }
                  placeholder="Ex.: cobrar a prefeitura com autoridade"
                  data-testid="request-objective"
                />
              </label>

              <label className="field">
                <span>CTA desejado</span>
                <input
                  value={requestForm.desiredCallToAction}
                  onChange={(event) =>
                    setRequestForm((current) => ({
                      ...current,
                      desiredCallToAction: event.target.value,
                    }))
                  }
                  placeholder="Ex.: compartilhe e relate seu bairro"
                  data-testid="request-cta"
                />
              </label>
            </div>

            <div className="control-group">
              <span className="control-label">Formato</span>
              <div className="option-grid">
                {defaultFormats.map((format) => (
                  <button
                    key={format}
                    type="button"
                    className={requestForm.format === format ? "option active" : "option"}
                    onClick={() => setRequestForm((current) => ({ ...current, format }))}
                  >
                    {format}
                  </button>
                ))}
              </div>
            </div>

            <div className="control-group">
              <span className="control-label">Intensidade</span>
              <div className="option-grid compact">
                {defaultIntensities.map((intensity) => (
                  <button
                    key={intensity}
                    type="button"
                    className={
                      requestForm.intensity === intensity ? "option active" : "option"
                    }
                    onClick={() =>
                      setRequestForm((current) => ({ ...current, intensity }))
                    }
                  >
                    {intensity}
                  </button>
                ))}
              </div>
            </div>

            <label className="field">
              <span>Contexto adicional</span>
              <textarea
                value={requestForm.context}
                onChange={(event) =>
                  setRequestForm((current) => ({
                    ...current,
                    context: event.target.value,
                  }))
                }
                placeholder="O que a equipe já sabe, qual a leitura política e o enquadramento desejado."
                data-testid="request-context"
              />
            </label>

            <label className="field">
              <span>Fatos confirmados</span>
              <textarea
                value={requestForm.keyFacts}
                onChange={(event) =>
                  setRequestForm((current) => ({
                    ...current,
                    keyFacts: event.target.value,
                  }))
                }
                placeholder={"Uma informação por linha\nFila dobrou em 30 dias\nBairro X ficou sem medico"}
                data-testid="request-key-facts"
              />
            </label>

            <label className="field">
              <span>Palavras obrigatórias</span>
              <textarea
                value={requestForm.mandatoryTerms}
                onChange={(event) =>
                  setRequestForm((current) => ({
                    ...current,
                    mandatoryTerms: event.target.value,
                  }))
                }
                placeholder={"Uma expressão por linha\npovo trabalhador\nrespeito com a cidade"}
              />
            </label>

            <button
              type="button"
              className="primary-button"
              onClick={() => void handleGenerateContent()}
              disabled={isGenerating || !profile}
              data-testid="generate-content-button"
            >
              {isGenerating ? "Gerando 3 versões..." : "Gerar conteúdo"}
            </button>
          </SectionCard>
        </div>

        <aside className="column-side">
          <SectionCard title="Saída criativa" subtitle="Rascunhos disponíveis">
            <div className="linked-card">
              <strong>Modo principal do MVP</strong>
              <span>Roteiro curto de vídeo com revisão humana antes da publicação.</span>
            </div>

            {contents.length ? (
              <div className="history-list">
                {contents.slice(0, 3).map((item) => {
                  const linkedRequest = getRequestForContentId(item.id);

                  return (
                    <Link key={item.id} href={`/auditor/${item.id}`} className="history-item">
                      <div className="history-top">
                        <strong>{item.title}</strong>
                        <StatusPill status={item.status} />
                      </div>
                      <span>{linkedRequest?.topic ?? "Pauta sem referência"}</span>
                      <small>{new Date(item.createdAt).toLocaleDateString("pt-BR")}</small>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="empty-state">
                As saidas do Criativo aparecem aqui logo apos a primeira geração.
              </p>
            )}
          </SectionCard>
        </aside>
      </div>
    </section>
  );
}
