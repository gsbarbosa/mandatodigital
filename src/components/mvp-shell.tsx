"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import {
  archetypeOptions,
  defaultFormats,
  defaultIntensities,
  spectrumOptions,
  voiceToneOptions,
} from "@/lib/constants";
import {
  contentRequestInputSchema,
  productFeedbackInputSchema,
  profileInputSchema,
} from "@/lib/schemas";
import type { DashboardData } from "@/lib/types";
import type {
  ContentFormat,
  ContentRequest,
  ContentStatus,
  GeneratedContent,
  IntensityLevel,
  ProductFeedback,
} from "@/lib/types";

type ProfileFormState = {
  id?: string;
  fullName: string;
  role: string;
  city: string;
  state: string;
  audience: string;
  spectrum: string;
  archetype: string;
  voiceTones: string[];
  keyIssues: string;
  slogans: string;
  redLines: string;
  referenceExamples: string;
  bio: string;
};

type RequestFormState = {
  topic: string;
  objective: string;
  format: ContentFormat;
  intensity: IntensityLevel;
  context: string;
  keyFacts: string;
  desiredCallToAction: string;
};

type ProductFeedbackFormState = {
  screen: string;
  workedWell: string;
  issueObserved: string;
};

function toTextarea(items: string[]) {
  return items.join("\n");
}

function parseTextarea(value: string) {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildProfileState(data: DashboardData["profile"]): ProfileFormState {
  return {
    id: data?.id,
    fullName: data?.fullName ?? "",
    role: data?.role ?? "",
    city: data?.city ?? "",
    state: data?.state ?? "",
    audience: data?.audience ?? "",
    spectrum: data?.spectrum ?? spectrumOptions[0],
    archetype: data?.archetype ?? archetypeOptions[0],
    voiceTones: data?.voiceTones?.length ? data.voiceTones : ["Didatico"],
    keyIssues: toTextarea(data?.keyIssues ?? []),
    slogans: toTextarea(data?.slogans ?? []),
    redLines: toTextarea(data?.redLines ?? []),
    referenceExamples: toTextarea(data?.referenceExamples ?? []),
    bio:
      data?.bio ??
      "Mandato focado em entregas concretas, linguagem clara e defesa consistente das pautas prioritarias.",
  };
}

function buildRequestState(): RequestFormState {
  return {
    topic: "",
    objective: "",
    format: defaultFormats[0],
    intensity: defaultIntensities[1],
    context: "",
    keyFacts: "",
    desiredCallToAction: "",
  };
}

function buildProductFeedbackState(): ProductFeedbackFormState {
  return {
    screen: "",
    workedWell: "",
    issueObserved: "",
  };
}

const fieldLabels: Record<string, string> = {
  fullName: "Nome publico",
  role: "Cargo / posicao",
  city: "Cidade",
  state: "UF",
  audience: "Eleitorado prioritario",
  spectrum: "Espectro politico",
  archetype: "Arquetipo dominante",
  voiceTones: "Tons de voz",
  keyIssues: "Pautas prioritarias",
  slogans: "Bordoes / assinaturas",
  redLines: "Linhas vermelhas",
  referenceExamples: "Exemplos de fala / referencia",
  bio: "Resumo da identidade",
  topic: "Tema do dia",
  objective: "Objetivo da peca",
  format: "Formato",
  intensity: "Intensidade",
  context: "Contexto adicional",
  keyFacts: "Fatos confirmados",
  desiredCallToAction: "CTA desejado",
  screen: "Tela / fluxo",
  workedWell: "O que funcionou bem",
  issueObserved: "O que nao funcionou / observacao",
};

const productFeedbackLabelMap: Record<ProductFeedback["classification"], string> = {
  bug: "Bug",
  melhoria: "Melhoria",
  fora_do_escopo_atual: "Fora do escopo atual",
};

const productFeedbackCriticalityLabelMap: Record<
  ProductFeedback["criticality"],
  string
> = {
  alta: "Alta",
  media: "Media",
  baixa: "Baixa",
};

type ApiErrorPayload = {
  message?: string;
  issues?: {
    fieldErrors?: Record<string, string[] | undefined>;
    formErrors?: string[];
  };
};

function formatApiError(payload: ApiErrorPayload) {
  const formErrors = payload.issues?.formErrors?.filter(Boolean) ?? [];
  const fieldErrors = Object.entries(payload.issues?.fieldErrors ?? {})
    .flatMap(([field, messages]) =>
      (messages ?? []).filter(Boolean).map((message) => {
        const label = fieldLabels[field] ?? field;
        return `${label}: ${message}`;
      }),
    );

  if (fieldErrors.length || formErrors.length) {
    return [...fieldErrors, ...formErrors].join(" | ");
  }

  return payload.message || "Falha na operacao.";
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">{subtitle}</p>
          <h2>{title}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}

function StatusPill({ status }: { status: ContentStatus }) {
  return <span className={`status-pill status-${status}`}>{status}</span>;
}

function ProductFeedbackPill({
  classification,
}: {
  classification: ProductFeedback["classification"];
}) {
  return (
    <span className={`analysis-pill analysis-${classification}`}>
      {productFeedbackLabelMap[classification]}
    </span>
  );
}

function ProductFeedbackCriticalityPill({
  criticality,
}: {
  criticality: ProductFeedback["criticality"];
}) {
  return (
    <span className={`criticality-pill criticality-${criticality}`}>
      Criticidade {productFeedbackCriticalityLabelMap[criticality]}
    </span>
  );
}

export function MvpShell({ initialData }: { initialData: DashboardData }) {
  const [profile, setProfile] = useState(initialData.profile);
  const [profileForm, setProfileForm] = useState(() =>
    buildProfileState(initialData.profile),
  );
  const [requests, setRequests] = useState<ContentRequest[]>(
    initialData.contentRequests,
  );
  const [contents, setContents] = useState<GeneratedContent[]>(
    initialData.generatedContents,
  );
  const [feedback, setFeedback] = useState(initialData.feedback);
  const [productFeedbacks, setProductFeedbacks] = useState<ProductFeedback[]>(
    initialData.productFeedbacks ?? [],
  );
  const [requestForm, setRequestForm] = useState<RequestFormState>(
    buildRequestState(),
  );
  const [productFeedbackForm, setProductFeedbackForm] =
    useState<ProductFeedbackFormState>(buildProductFeedbackState());
  const [feedbackNote, setFeedbackNote] = useState("");
  const [selectedContentId, setSelectedContentId] = useState<string | null>(
    initialData.generatedContents[0]?.id ?? null,
  );
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingContent, setIsSavingContent] = useState(false);
  const [isFeedbackWidgetOpen, setIsFeedbackWidgetOpen] = useState(false);
  const [isSubmittingProductFeedback, setIsSubmittingProductFeedback] =
    useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedContent = useMemo(
    () => contents.find((item) => item.id === selectedContentId) ?? null,
    [contents, selectedContentId],
  );

  const selectedRequest = useMemo(
    () =>
      selectedContent
        ? requests.find((item) => item.id === selectedContent.contentRequestId) ?? null
        : null,
    [requests, selectedContent],
  );

  const selectedFeedback = useMemo(
    () =>
      selectedContent
        ? feedback.filter((item) => item.generatedContentId === selectedContent.id)
        : [],
    [feedback, selectedContent],
  );

  async function handleApi<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
    setErrorMessage(null);
    const response = await fetch(input, init);
    const payload = (await response.json()) as T & ApiErrorPayload;

    if (!response.ok) {
      throw new Error(formatApiError(payload));
    }

    return payload;
  }

  async function saveProfile() {
    setIsSavingProfile(true);
    setStatusMessage(null);

    try {
      const payload = {
        id: profileForm.id,
        fullName: profileForm.fullName,
        role: profileForm.role,
        city: profileForm.city,
        state: profileForm.state.toUpperCase(),
        audience: profileForm.audience,
        spectrum: profileForm.spectrum,
        archetype: profileForm.archetype,
        voiceTones: profileForm.voiceTones,
        keyIssues: parseTextarea(profileForm.keyIssues),
        slogans: parseTextarea(profileForm.slogans),
        redLines: parseTextarea(profileForm.redLines),
        referenceExamples: parseTextarea(profileForm.referenceExamples),
        bio: profileForm.bio,
      };

      const parsedPayload = profileInputSchema.safeParse(payload);

      if (!parsedPayload.success) {
        throw new Error(
          formatApiError({
            issues: parsedPayload.error.flatten(),
          }),
        );
      }

      const result = await handleApi<{ profile: DashboardData["profile"] }>(
        "/api/profile",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      setProfile(result.profile);
      setProfileForm(buildProfileState(result.profile));
      setStatusMessage("Perfil salvo. O onboarding ja esta persistido para a equipe.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Nao foi possivel salvar o perfil.",
      );
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function generateContent() {
    if (!profile) {
      setErrorMessage("Salve o perfil do parlamentar antes de gerar conteudo.");
      return;
    }

    setIsGenerating(true);
    setStatusMessage(null);

    try {
      const payload = {
        topic: requestForm.topic,
        objective: requestForm.objective,
        format: requestForm.format,
        intensity: requestForm.intensity,
        context: requestForm.context,
        keyFacts: parseTextarea(requestForm.keyFacts),
        desiredCallToAction: requestForm.desiredCallToAction,
      };

      const parsedPayload = contentRequestInputSchema.safeParse(payload);

      if (!parsedPayload.success) {
        throw new Error(
          formatApiError({
            issues: parsedPayload.error.flatten(),
          }),
        );
      }

      const result = await handleApi<{
        request: ContentRequest;
        generatedContents: GeneratedContent[];
      }>("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      setRequests((current) => [result.request, ...current]);
      setContents((current) => [...result.generatedContents, ...current]);
      setSelectedContentId(result.generatedContents[0]?.id ?? null);
      setRequestForm(buildRequestState());
      setStatusMessage(
        "Geracao concluida. Voce ja pode revisar, editar e aprovar a melhor versao.",
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Nao foi possivel gerar as versoes.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function updateContent(input: { body?: string; status?: ContentStatus }) {
    if (!selectedContent) {
      return;
    }

    setIsSavingContent(true);
    setStatusMessage(null);

    try {
      const result = await handleApi<{ generatedContent: GeneratedContent }>(
        `/api/generated-contents/${selectedContent.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(input),
        },
      );

      setContents((current) =>
        current.map((item) =>
          item.id === result.generatedContent.id ? result.generatedContent : item,
        ),
      );

      setStatusMessage("Conteudo atualizado e salvo no historico.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Nao foi possivel atualizar o conteudo.",
      );
    } finally {
      setIsSavingContent(false);
    }
  }

  async function submitFeedback() {
    if (!selectedContent || !feedbackNote.trim()) {
      return;
    }

    try {
      const result = await handleApi<{ feedback: DashboardData["feedback"][number] }>(
        `/api/generated-contents/${selectedContent.id}/feedback`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ note: feedbackNote }),
        },
      );

      setFeedback((current) => [result.feedback, ...current]);
      setFeedbackNote("");
      setStatusMessage("Feedback registrado para calibrar as proximas geracoes.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Nao foi possivel registrar o feedback.",
      );
    }
  }

  async function submitProductFeedback() {
    setIsSubmittingProductFeedback(true);
    setStatusMessage(null);

    try {
      const payload = {
        screen: productFeedbackForm.screen,
        workedWell: productFeedbackForm.workedWell,
        issueObserved: productFeedbackForm.issueObserved,
      };

      const parsedPayload = productFeedbackInputSchema.safeParse(payload);

      if (!parsedPayload.success) {
        throw new Error(
          formatApiError({
            issues: parsedPayload.error.flatten(),
          }),
        );
      }

      const result = await handleApi<{ feedback: ProductFeedback }>(
        "/api/product-feedback",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      setProductFeedbacks((current) => [result.feedback, ...current]);
      setProductFeedbackForm(buildProductFeedbackState());
      setIsFeedbackWidgetOpen(true);
      setStatusMessage(
        "Feedback analisado. A IA classificou a observacao e registrou o proximo passo sugerido.",
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Nao foi possivel analisar o feedback de produto.",
      );
    } finally {
      setIsSubmittingProductFeedback(false);
    }
  }

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

  async function copySelectedContent() {
    if (!selectedContent) {
      return;
    }

    await navigator.clipboard.writeText(selectedContent.body);
    setStatusMessage("Texto copiado para uso imediato.");
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">MVP interno em operacao</p>
          <h1>Mandato Digital</h1>
          <p className="hero-copy">
            Do onboarding politico a revisao final, esta versao ja concentra o
            fluxo minimo para transformar pauta manual em conteudo pronto para uso.
          </p>
        </div>

        <div className="hero-metrics">
          <div className="metric-card">
            <strong>{profile ? "1" : "0"}</strong>
            <span>perfil ativo</span>
          </div>
          <div className="metric-card">
            <strong>{requests.length}</strong>
            <span>pautas registradas</span>
          </div>
          <div className="metric-card">
            <strong>{contents.length}</strong>
            <span>pecas no historico</span>
          </div>
        </div>
      </section>

      {(statusMessage || errorMessage) && (
        <div className={`message-banner ${errorMessage ? "error" : "success"}`}>
          {errorMessage ?? statusMessage}
        </div>
      )}

      <div className="grid-main">
        <div className="column-main">
          <SectionCard
            title="Onboarding do parlamentar"
            subtitle="Identidade, pautas e voz"
          >
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
              />
            </label>

            <div className="control-group">
              <span className="control-label">Espectro politico</span>
              <div className="option-grid">
                {spectrumOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={
                      profileForm.spectrum === option ? "option active" : "option"
                    }
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
              <span className="control-label">Arquetipo dominante</span>
              <div className="option-grid">
                {archetypeOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={
                      profileForm.archetype === option ? "option active" : "option"
                    }
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
              <span className="control-label">Tons de voz ativos (ate 3)</span>
              <div className="option-grid compact">
                {voiceToneOptions.map((tone) => (
                  <button
                    key={tone}
                    type="button"
                    className={
                      profileForm.voiceTones.includes(tone)
                        ? "option active"
                        : "option"
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
                  placeholder={"Cole frases, trechos ou orientacoes internas"}
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
              />
            </label>

            <button
              type="button"
              className="primary-button"
              onClick={saveProfile}
              disabled={isSavingProfile}
            >
              {isSavingProfile ? "Salvando..." : "Salvar onboarding"}
            </button>
          </SectionCard>

          <SectionCard
            title="Nova pauta"
            subtitle="Geracao com revisao humana"
          >
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
              />
            </label>

            <div className="field-grid">
              <label className="field">
                <span>Objetivo da peca</span>
                <input
                  value={requestForm.objective}
                  onChange={(event) =>
                    setRequestForm((current) => ({
                      ...current,
                      objective: event.target.value,
                    }))
                  }
                  placeholder="Ex.: cobrar a prefeitura com autoridade"
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
                    className={
                      requestForm.format === format ? "option active" : "option"
                    }
                    onClick={() =>
                      setRequestForm((current) => ({ ...current, format }))
                    }
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
                placeholder="O que a equipe ja sabe, qual a leitura politica e o enquadramento desejado."
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
                placeholder={"Uma informacao por linha\nFila dobrou em 30 dias\nBairro X ficou sem medico"}
              />
            </label>

            <button
              type="button"
              className="primary-button"
              onClick={generateContent}
              disabled={isGenerating || !profile}
            >
              {isGenerating ? "Gerando 3 versoes..." : "Gerar conteudo"}
            </button>
          </SectionCard>
        </div>

        <aside className="column-side">
          <SectionCard
            title="Revisao e aprovacao"
            subtitle="Edicao humana obrigatoria"
          >
            {selectedContent ? (
              <>
                <div className="review-meta">
                  <div>
                    <h3>{selectedContent.title}</h3>
                    <p>{selectedContent.angle}</p>
                  </div>
                  <StatusPill status={selectedContent.status} />
                </div>

                {selectedRequest && (
                  <div className="linked-card">
                    <strong>{selectedRequest.format}</strong>
                    <span>{selectedRequest.topic}</span>
                  </div>
                )}

                <label className="field">
                  <span>Texto final</span>
                  <textarea
                    value={selectedContent.body}
                    onChange={(event) =>
                      setContents((current) =>
                        current.map((item) =>
                          item.id === selectedContent.id
                            ? { ...item, body: event.target.value }
                            : item,
                        ),
                      )
                    }
                    className="editor"
                  />
                </label>

                <details className="prompt-preview">
                  <summary>Ver contexto usado na geracao</summary>
                  <pre>{selectedContent.promptPreview}</pre>
                </details>

                <div className="button-row">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => updateContent({ body: selectedContent.body })}
                    disabled={isSavingContent}
                  >
                    Salvar rascunho
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      updateContent({
                        body: selectedContent.body,
                        status: "revisado",
                      })
                    }
                    disabled={isSavingContent}
                  >
                    Marcar revisado
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() =>
                      updateContent({
                        body: selectedContent.body,
                        status: "aprovado",
                      })
                    }
                    disabled={isSavingContent}
                  >
                    Aprovar
                  </button>
                </div>

                <div className="button-row">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={copySelectedContent}
                  >
                    Copiar texto
                  </button>
                </div>

                <label className="field">
                  <span>Feedback para calibrar as proximas pecas</span>
                  <textarea
                    value={feedbackNote}
                    onChange={(event) => setFeedbackNote(event.target.value)}
                    placeholder="Ex.: manter mais firmeza na abertura e evitar repetir o mesmo CTA."
                  />
                </label>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={submitFeedback}
                >
                  Registrar feedback
                </button>

                {selectedFeedback.length > 0 && (
                  <div className="feedback-stack">
                    {selectedFeedback.map((item) => (
                      <article key={item.id} className="feedback-card">
                        <strong>{new Date(item.createdAt).toLocaleString("pt-BR")}</strong>
                        <p>{item.note}</p>
                      </article>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="empty-state">
                Gere uma pauta para abrir o fluxo de revisao, aprovacao e historico.
              </p>
            )}
          </SectionCard>

          <SectionCard title="Historico reutilizavel" subtitle="Memoria editorial">
            {contents.length ? (
              <div className="history-list">
                {contents.map((item) => {
                  const linkedRequest = requests.find(
                    (request) => request.id === item.contentRequestId,
                  );

                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={
                        item.id === selectedContentId ? "history-item active" : "history-item"
                      }
                      onClick={() => setSelectedContentId(item.id)}
                    >
                      <div className="history-top">
                        <strong>{item.title}</strong>
                        <StatusPill status={item.status} />
                      </div>
                      <span>{linkedRequest?.topic ?? "Pauta sem referencia"}</span>
                      <small>
                        {linkedRequest?.format ?? "Formato nao informado"} ·{" "}
                        {new Date(item.createdAt).toLocaleDateString("pt-BR")}
                      </small>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="empty-state">
                O historico aparece aqui conforme a equipe gera e revisa novas pecas.
              </p>
            )}
          </SectionCard>
        </aside>
      </div>

      <button
        type="button"
        className="feedback-fab"
        onClick={() => setIsFeedbackWidgetOpen((current) => !current)}
      >
        {isFeedbackWidgetOpen ? "Fechar feedback" : "Feedback do produto"}
      </button>

      {isFeedbackWidgetOpen && (
        <button
          type="button"
          className="feedback-overlay"
          aria-label="Fechar painel de feedback"
          onClick={() => setIsFeedbackWidgetOpen(false)}
        />
      )}

      <aside
        className={`feedback-drawer ${isFeedbackWidgetOpen ? "open" : ""}`}
        aria-hidden={!isFeedbackWidgetOpen}
      >
        <div className="feedback-drawer-header">
          <div>
            <p className="eyebrow">Canal do produto</p>
            <h2>O que funcionou e o que nao funcionou</h2>
          </div>
          <button
            type="button"
            className="feedback-close"
            onClick={() => setIsFeedbackWidgetOpen(false)}
          >
            Fechar
          </button>
        </div>

        <p className="feedback-helper">
          Seu parceiro de produto pode descrever a experiencia aqui. A IA analisa
          automaticamente se o relato indica bug, melhoria ou algo fora do escopo
          atual da entrega.
        </p>

        <label className="field">
          <span>Tela / fluxo</span>
          <input
            value={productFeedbackForm.screen}
            onChange={(event) =>
              setProductFeedbackForm((current) => ({
                ...current,
                screen: event.target.value,
              }))
            }
            placeholder="Ex.: onboarding, geracao de pauta, revisao final"
          />
        </label>

        <label className="field">
          <span>O que funcionou bem</span>
          <textarea
            value={productFeedbackForm.workedWell}
            onChange={(event) =>
              setProductFeedbackForm((current) => ({
                ...current,
                workedWell: event.target.value,
              }))
            }
            placeholder="Ex.: a geracao saiu rapida e as 3 versoes vieram com boa variacao"
          />
        </label>

        <label className="field">
          <span>O que nao funcionou / observacao</span>
          <textarea
            value={productFeedbackForm.issueObserved}
            onChange={(event) =>
              setProductFeedbackForm((current) => ({
                ...current,
                issueObserved: event.target.value,
              }))
            }
            placeholder="Ex.: ao salvar o onboarding parece que faltam pistas visuais; ou entao o botao nao salvou nada"
          />
        </label>

        <button
          type="button"
          className="primary-button"
          onClick={submitProductFeedback}
          disabled={isSubmittingProductFeedback}
        >
          {isSubmittingProductFeedback ? "Analisando feedback..." : "Analisar feedback"}
        </button>

        <div className="product-feedback-history">
          <div className="feedback-drawer-header compact">
            <div>
              <p className="eyebrow">Ultimas analises</p>
              <h3>Historico de feedback do produto</h3>
            </div>
          </div>

          {productFeedbacks.length ? (
            <div className="feedback-stack">
              {productFeedbacks.map((item) => (
                <article key={item.id} className="feedback-analysis-card">
                  <div className="feedback-analysis-top">
                    <div className="feedback-analysis-badges">
                      <ProductFeedbackPill classification={item.classification} />
                      <ProductFeedbackCriticalityPill criticality={item.criticality} />
                    </div>
                    <strong>{new Date(item.createdAt).toLocaleString("pt-BR")}</strong>
                  </div>

                  {item.screen && (
                    <p className="feedback-line">
                      <span>Tela:</span> {item.screen}
                    </p>
                  )}

                  {item.workedWell && (
                    <p className="feedback-line">
                      <span>Funcionou bem:</span> {item.workedWell}
                    </p>
                  )}

                  <p className="feedback-line">
                    <span>Observacao:</span> {item.issueObserved}
                  </p>
                  <p className="feedback-line">
                    <span>Leitura da IA:</span> {item.rationale}
                  </p>
                  <p className="feedback-line">
                    <span>Escopo atual:</span> {item.scopeAssessment}
                  </p>
                  <p className="feedback-line">
                    <span>Proximo passo:</span> {item.suggestedAction}
                  </p>
                  <p className="feedback-line">
                    <span>Implementar agora:</span> {item.implementationPrompt}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-state">
              As analises de produto aparecem aqui assim que o primeiro feedback for enviado.
            </p>
          )}
        </div>
      </aside>
    </main>
  );
}
