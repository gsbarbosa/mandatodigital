"use client";

import Link from "next/link";

import {
  archetypeOptions,
  spectrumOptions,
  voiceToneOptions,
} from "@/lib/constants";

import { DynamicStringListField } from "./config-controls";
import { useProductApp } from "./provider";
import { PhaseSectionIntro, SectionCard, workflowStageById } from "./shared";

export function CuradorPage() {
  const { profile, profileForm, setProfileForm, saveProfile, isSavingProfile } =
    useProductApp();

  function toggleVoiceTone(tone: string) {
    setProfileForm((current) => {
      const hasTone = current.voiceTones.includes(tone);

      if (hasTone) {
        if (current.voiceTones.length === 1) {
          return current;
        }

        return {
          ...current,
          voiceTones: current.voiceTones.filter((item) => item !== tone),
        };
      }

      if (current.voiceTones.length >= 3) {
        return current;
      }

      return {
        ...current,
        voiceTones: [...current.voiceTones, tone],
      };
    });
  }

  return (
    <section className="phase-section">
      <PhaseSectionIntro stage={workflowStageById.curador} />

      <div className="grid-main">
        <div className="column-main">
          <SectionCard title="Onboarding do parlamentar" subtitle="Persona, ideologia e voz">
            <div className="field-grid">
              <label className="field">
                <span>Nome publico</span>
                <input
                  value={profileForm.fullName}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,
                      fullName: event.target.value,
                    }))
                  }
                  placeholder="Ex.: Maria Souza"
                  data-testid="profile-full-name"
                />
              </label>

              <label className="field">
                <span>Cargo / posicao</span>
                <input
                  value={profileForm.role}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,
                      role: event.target.value,
                    }))
                  }
                  placeholder="Ex.: Vereadora"
                  data-testid="profile-role"
                />
              </label>

              <label className="field">
                <span>Cidade</span>
                <input
                  value={profileForm.city}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,
                      city: event.target.value,
                    }))
                  }
                  placeholder="Ex.: Recife"
                  data-testid="profile-city"
                />
              </label>

              <label className="field">
                <span>UF</span>
                <input
                  value={profileForm.state}
                  maxLength={2}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,
                      state: event.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="PE"
                  data-testid="profile-state"
                />
              </label>
            </div>

            <label className="field">
              <span>Eleitorado prioritario</span>
              <input
                value={profileForm.audience}
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,
                    audience: event.target.value,
                  }))
                }
                placeholder="Ex.: familias de bairro, empreendedores e servidores"
                data-testid="profile-audience"
              />
            </label>

            <div className="control-group">
              <span className="control-label">Posicionamento ideologico</span>
              <div className="option-grid">
                {spectrumOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={profileForm.spectrum === option ? "option active" : "option"}
                    onClick={() =>
                      setProfileForm((current) => ({ ...current, spectrum: option }))
                    }
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="control-group">
              <span className="control-label">Arquetipo principal</span>
              <div className="option-grid">
                {archetypeOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={profileForm.archetype === option ? "option active" : "option"}
                    onClick={() =>
                      setProfileForm((current) => ({ ...current, archetype: option }))
                    }
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="control-group">
              <span className="control-label">Modificadores de tom</span>
              <div className="option-grid compact">
                {voiceToneOptions.map((tone) => (
                  <button
                    key={tone}
                    type="button"
                    className={
                      profileForm.voiceTones.includes(tone) ? "option active" : "option"
                    }
                    onClick={() => toggleVoiceTone(tone)}
                  >
                    {tone}
                  </button>
                ))}
              </div>
            </div>

            <div className="field-grid">
              <label className="field">
                <span>Pautas prioritarias</span>
                <textarea
                  value={profileForm.keyIssues}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,
                      keyIssues: event.target.value,
                    }))
                  }
                  placeholder={"Uma pauta por linha\nSaude publica\nSeguranca"}
                  data-testid="profile-key-issues"
                />
              </label>

              <label className="field">
                <span>Bordoes / assinaturas</span>
                <textarea
                  value={profileForm.slogans}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,
                      slogans: event.target.value,
                    }))
                  }
                  placeholder={"Uma referencia por linha\nGente em primeiro lugar"}
                  data-testid="profile-slogans"
                />
              </label>

              <label className="field">
                <span>Linhas vermelhas</span>
                <textarea
                  value={profileForm.redLines}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,
                      redLines: event.target.value,
                    }))
                  }
                  placeholder={"Ex.: nao atacar servidor publico\nnao prometer dado sem fonte"}
                  data-testid="profile-red-lines"
                />
              </label>

              <label className="field">
                <span>Exemplos de fala / referencia</span>
                <textarea
                  value={profileForm.referenceExamples}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,
                      referenceExamples: event.target.value,
                    }))
                  }
                  placeholder="Cole frases, trechos ou orientacoes internas"
                  data-testid="profile-reference-examples"
                />
              </label>
            </div>

            <label className="field">
              <span>Resumo da identidade</span>
              <textarea
                value={profileForm.bio}
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,
                    bio: event.target.value,
                  }))
                }
                placeholder="Como esse nome deve soar, o que defende e como costuma argumentar."
                data-testid="profile-bio"
              />
            </label>

            <label className="field">
              <span>Glossario pessoal</span>
              <textarea
                value={profileForm.glossaryTerms}
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,
                    glossaryTerms: event.target.value,
                  }))
                }
                placeholder={"Uma expressao por linha\nNossa gente\nTrabalhador"}
              />
            </label>

            <DynamicStringListField
              label="Base de treino e links de referencia"
              fieldKey="trainingReferenceLinks"
              values={profileForm.trainingReferenceLinks}
              placeholder="https://youtube.com/..."
              addLabel="Adicionar link de video"
              setProfileForm={setProfileForm}
              maxItems={5}
            />

            <button
              type="button"
              className="primary-button"
              onClick={() => void saveProfile()}
              disabled={isSavingProfile}
              data-testid="save-profile-button"
            >
              {isSavingProfile ? "Salvando..." : "Salvar onboarding"}
            </button>
          </SectionCard>
        </div>

        <aside className="column-side">
          <SectionCard title="Saida do curador" subtitle="Briefing organizado">
            {profile ? (
              <>
                <div className="linked-card">
                  <strong>{profile.fullName}</strong>
                  <span>
                    {profile.role} · {profile.city}/{profile.state} · {profile.spectrum}
                  </span>
                </div>
                <p className="empty-state">
                  O Curador deixa a base editorial pronta para a etapa criativa: voz,
                  pautas, linhas vermelhas, glossario e posicionamento.
                </p>
                <div className="button-row">
                  <Link href="/criativo" className="secondary-button">
                    Seguir para Criativo
                  </Link>
                </div>
              </>
            ) : (
              <p className="empty-state">
                Salve o onboarding para registrar o primeiro output do Curador.
              </p>
            )}
          </SectionCard>
        </aside>
      </div>
    </section>
  );
}
