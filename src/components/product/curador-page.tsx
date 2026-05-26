"use client";

import { useId, useState } from "react";

import Link from "next/link";

import {
  archetypeOptions,
  avatarTypeOptions,
  spectrumOptions,
  voiceToneOptions,
} from "@/lib/constants";

import { useProductApp } from "./provider";

function toggleValue(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function PersonaTag({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      className={active ? "persona-tag active" : "persona-tag"}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function CuradorPage() {
  const uploadInputId = useId();
  const [selectedTrainingFiles, setSelectedTrainingFiles] = useState<string[]>([]);
  const [trainingRequested, setTrainingRequested] = useState(false);
  const { profile, profileForm, setProfileForm, saveProfile, isSavingProfile } =
    useProductApp();

  async function handleTrainIa() {
    setTrainingRequested(true);
    await saveProfile();
  }

  async function handleGenerateAvatar() {
    await saveProfile();
  }

  return (
    <section className="persona-page">
      <div className="persona-container">
        <div className="persona-card">
          <h2 className="sr-only">Onboarding do parlamentar</h2>

          <div className="persona-section-header">
            <div className="persona-header-icon" aria-hidden="true">
              UC
            </div>
            <h2>Calibragem de Persona</h2>
            <p>
              O Agente Curador usa estes dados para garantir que os roteiros tenham a
              sua cara.
            </p>
          </div>

          <div className="persona-form-group">
            <label className="persona-label">
              Upload de video <span className="persona-badge">Obrigatorio</span>
            </label>

            <label htmlFor={uploadInputId} className="upload-area persona-upload-area">
              <div className="persona-upload-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="persona-upload-svg"
                >
                  <path
                    d="M12 16V6M12 6L8.5 9.5M12 6L15.5 9.5M5 17.5V18C5 19.1046 5.89543 20 7 20H17C18.1046 20 19 19.1046 19 18V17.5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h4>BASE DE TREINO (CLONAGEM)</h4>
              <p>
                Upload de 1 a 5 videos originais
                <br />A IA mapeara sua cadencia, pausas, voz, estilo visual e
                comunicacional
              </p>
              <input
                id={uploadInputId}
                type="file"
                accept="video/*"
                multiple
                hidden
                onChange={(event) =>
                  setSelectedTrainingFiles(
                    Array.from(event.target.files ?? []).map((file) => file.name),
                  )
                }
              />
              <span className="persona-btn">Selecionar Arquivos</span>
            </label>

            {selectedTrainingFiles.length > 0 && (
              <div className="persona-upload-files">
                {selectedTrainingFiles.map((fileName) => (
                  <span key={fileName} className="persona-file-chip">
                    {fileName}
                  </span>
                ))}
              </div>
            )}

            <div className="persona-inline-field">
              <label className="persona-inline-label">URL do YouTube</label>
              <input
                type="url"
                className="persona-input-control"
                value={profileForm.youtubeVideoUrl}
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,
                    youtubeVideoUrl: event.target.value,
                  }))
                }
                placeholder="Cole aqui o link do video do YouTube..."
              />
            </div>

            <p className="persona-helper-text">
              E obrigatorio o upload de pelo menos um video de 3 minutos com o
              candidato falando de frente para a camera de forma natural sobre um tema
              qualquer. Esse video forma a base de como o candidato deve comunicar.
            </p>
          </div>

          <div className="persona-cta-block">
            <div className="persona-cta-row">
              <button
                type="button"
                className="persona-btn"
                onClick={() => void handleTrainIa()}
                disabled={isSavingProfile}
              >
                {isSavingProfile ? "Treinando..." : "Treinar a IA"}
              </button>
            </div>
            <p className="persona-helper-text">
              Enquanto estamos treinando a IA, fique a vontade para preencher os campos
              abaixo. Assim que concluido o treinamento, enviaremos uma notificacao para
              seu e-mail. Tempo aproximado de 5 minutos.
            </p>
            {trainingRequested && (
              <p className="persona-helper-text persona-helper-highlight">
                No MVP atual, o clique registra a calibragem e prepara a etapa criativa;
                o treino/render final ainda depende da camada externa.
              </p>
            )}
          </div>

          <hr className="persona-divider" />

          <div className="persona-form-group">
            <label className="persona-label">
              Posicionamento ideologico <span className="persona-badge">Obrigatorio</span>
            </label>
            <p className="persona-helper-text">
              O posicionamento ideologico compoe a base da resposta que a IA vai gerar
              sobre o tema.
            </p>
            <div className="persona-tag-list">
              {spectrumOptions.map((option) => (
                <PersonaTag
                  key={option}
                  active={profileForm.spectrum === option}
                  onClick={() =>
                    setProfileForm((current) => ({
                      ...current,
                      spectrum: option,
                    }))
                  }
                >
                  {option}
                </PersonaTag>
              ))}
            </div>
          </div>

          <div className="persona-form-group">
            <label className="persona-label">Glossario de expressoes</label>
            <p className="persona-helper-text">
              Inclua caracteristicas fundamentais da sua expressao, como por exemplo:
              ne, tipo, entendeu, sabe, ta, ok, certo, mano, assim.
            </p>
            <textarea
              className="persona-input-control"
              value={profileForm.glossaryTerms}
              onChange={(event) =>
                setProfileForm((current) => ({
                  ...current,
                  glossaryTerms: event.target.value,
                }))
              }
              placeholder="Digite suas expressoes, separadas por virgula..."
            />
          </div>

          <div className="persona-form-group">
            <label className="persona-label">Arquetipos de Persona Politica</label>
            <div className="persona-tag-list">
              {archetypeOptions.map((option) => (
                <PersonaTag
                  key={option}
                  active={profileForm.personaArchetypes.includes(option)}
                  onClick={() =>
                    setProfileForm((current) => {
                      const personaArchetypes = toggleValue(current.personaArchetypes, option);
                      return {
                        ...current,
                        personaArchetypes,
                        archetype: personaArchetypes[0] ?? current.archetype,
                      };
                    })
                  }
                >
                  {option}
                </PersonaTag>
              ))}
            </div>
            <p className="persona-helper-text persona-top-gap">
              A nao selecao de algum arquetipo nao traz prejuizo para sua identidade
              comunicacional, previamente mapeada pelos videos encaminhados.
            </p>
          </div>

          <div className="persona-form-group">
            <label className="persona-label">Tom de linguagem</label>
            <div className="persona-tag-list">
              {voiceToneOptions.map((tone) => (
                <PersonaTag
                  key={tone}
                  active={profileForm.voiceTones.includes(tone)}
                  onClick={() =>
                    setProfileForm((current) => {
                      const voiceTones = toggleValue(current.voiceTones, tone);
                      return {
                        ...current,
                        voiceTones: voiceTones.length ? voiceTones : current.voiceTones,
                      };
                    })
                  }
                >
                  {tone}
                </PersonaTag>
              ))}
            </div>
            <p className="persona-helper-text persona-top-gap">
              A nao selecao de algum modificador de tom nao traz prejuizo para sua
              identidade comunicacional, previamente mapeada pelos videos encaminhados.
            </p>
          </div>

          <div className="persona-form-group">
            <label className="persona-label">Tipo de Avatar</label>
            <div className="persona-tag-list">
              {avatarTypeOptions.map((option) => (
                <PersonaTag
                  key={option}
                  active={profileForm.avatarType === option}
                  onClick={() =>
                    setProfileForm((current) => ({
                      ...current,
                      avatarType: option,
                    }))
                  }
                >
                  {option}
                </PersonaTag>
              ))}
            </div>
          </div>

          <div className="persona-form-group">
            <label className="persona-label">Inserir tema do video</label>
            <input
              type="text"
              className="persona-input-control"
              value={profileForm.avatarVideoTopic}
              onChange={(event) =>
                setProfileForm((current) => ({
                  ...current,
                  avatarVideoTopic: event.target.value,
                }))
              }
              placeholder="Digite o tema do video..."
            />
          </div>

          <div className="persona-form-group">
            <label className="persona-label">Seu e-mail</label>
            <input
              type="email"
              className="persona-input-control"
              value={profileForm.notificationEmail}
              onChange={(event) =>
                setProfileForm((current) => ({
                  ...current,
                  notificationEmail: event.target.value,
                }))
              }
              placeholder="Digite seu e-mail..."
            />
            <p className="persona-helper-text persona-top-gap">
              Inclua seu e-mail para receber o video do avatar.
            </p>
          </div>

          <div className="persona-form-group persona-support-block">
            <label className="persona-label">Dados complementares do mandato</label>
            <p className="persona-helper-text">
              Esta camada nao aparece no HTML original, mas continua necessaria para o
              MVP executar geracao, auditoria e memoria editorial.
            </p>

            <div className="persona-grid-two">
              <label className="persona-compact-field">
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

              <label className="persona-compact-field">
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

              <label className="persona-compact-field">
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

              <label className="persona-compact-field">
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

            <label className="persona-compact-field">
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

            <div className="persona-grid-two">
              <label className="persona-compact-field">
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

              <label className="persona-compact-field">
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
            </div>
          </div>

          <div className="persona-generate-row">
            <button
              type="button"
              className="persona-btn persona-btn-large"
              onClick={() => void handleGenerateAvatar()}
              disabled={isSavingProfile}
              data-testid="save-profile-button"
            >
              {isSavingProfile ? "Salvando..." : "Gerar meu avatar"}
            </button>
          </div>

          <div className="persona-form-group">
            <label className="persona-label">Observacoes importantes:</label>
            <p className="persona-helper-text">
              Com foco na geracao de conteudo viral, a IA pode nao utilizar
              arquetipos da persona politica e ou tom de linguagem. O paradoxo das
              restricoes reduz a viralidade do video. Imagine o cenario: arquetipo
              estadista conciliador com tom indignado e tema corrupcao. O agente tenta
              equilibrar posturas conflitantes, e o resultado pode ficar inconsistente.
            </p>
          </div>

          <div className="persona-footer-row">
            <div className="linked-card persona-summary-card">
              <strong>{profile?.fullName || "Curador em calibragem"}</strong>
              <span>
                {profile
                  ? `${profile.role} - ${profile.city}/${profile.state} - ${profile.spectrum}`
                  : "Salve a calibragem para registrar a configuracao do mandato."}
              </span>
            </div>

            <Link href="/criativo" className="secondary-button persona-next-link">
              Seguir para Criativo
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
