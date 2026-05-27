"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

import {
  contentRequestInputSchema,
  productFeedbackInputSchema,
  profileInputSchema,
} from "@/lib/schemas";
import type { DashboardData } from "@/lib/types";
import type {
  ContentRequest,
  ContentStatus,
  EvaluationReport,
  GeneratedContent,
  ProfileTrainingAsset,
  ProductFeedback,
} from "@/lib/types";

import {
  buildEvaluationReportsFromDashboard,
  buildProductFeedbackState,
  buildProfileState,
  buildRequestState,
  formatApiError,
  parseTextarea,
  type ApiErrorPayload,
  type ProductFeedbackFormState,
  type ProfileFormState,
  type RequestFormState,
} from "./shared";

type ProductAppContextValue = {
  profile: DashboardData["profile"];
  profileForm: ProfileFormState;
  setProfileForm: Dispatch<SetStateAction<ProfileFormState>>;
  requestForm: RequestFormState;
  setRequestForm: Dispatch<SetStateAction<RequestFormState>>;
  requests: ContentRequest[];
  contents: GeneratedContent[];
  feedback: DashboardData["feedback"];
  trainingAssets: ProfileTrainingAsset[];
  productFeedbacks: ProductFeedback[];
  evaluationReports: EvaluationReport[];
  latestApprovedContent: GeneratedContent | null;
  requestsWithContent: ContentRequest[];
  statusMessage: string | null;
  errorMessage: string | null;
  isSavingProfile: boolean;
  isGenerating: boolean;
  isSavingContent: boolean;
  isSubmittingProductFeedback: boolean;
  isUploadingTrainingAssets: boolean;
  isUploadingConsentAsset: boolean;
  isUploadingDatasetAsset: boolean;
  isLoadingEvaluations: boolean;
  isFeedbackWidgetOpen: boolean;
  isEvaluatingContentRequestId: string | null;
  setFeedbackWidgetOpen: Dispatch<SetStateAction<boolean>>;
  saveProfile: () => Promise<void>;
  uploadTrainingAssets: (
    files: File[],
    trainingRole: "dataset" | "consent",
  ) => Promise<ProfileTrainingAsset[]>;
  generateContent: () => Promise<GeneratedContent[]>;
  updateContent: (
    contentId: string,
    input: { body?: string; status?: ContentStatus },
  ) => Promise<GeneratedContent | null>;
  submitFeedback: (
    contentId: string,
    note: string,
  ) => Promise<DashboardData["feedback"][number] | null>;
  submitProductFeedback: (
    input: ProductFeedbackFormState,
  ) => Promise<ProductFeedback | null>;
  reloadEvaluationReports: () => Promise<void>;
  evaluateContentRequest: (contentRequestId: string) => Promise<EvaluationReport | null>;
  getContentById: (contentId: string) => GeneratedContent | null;
  getRequestById: (requestId: string) => ContentRequest | null;
  getRequestForContentId: (contentId: string) => ContentRequest | null;
  getFeedbackForContentId: (contentId: string) => DashboardData["feedback"];
  getEvaluationReportById: (runId: string) => EvaluationReport | null;
};

const ProductAppContext = createContext<ProductAppContextValue | null>(null);

function sortReportsByDate(reports: EvaluationReport[]) {
  return [...reports].sort(
    (left, right) =>
      new Date(right.run.createdAt).getTime() - new Date(left.run.createdAt).getTime(),
  );
}

export function ProductAppProvider({
  initialData,
  children,
}: {
  initialData: DashboardData;
  children: ReactNode;
}) {
  const initialEvaluationReports = buildEvaluationReportsFromDashboard(initialData);
  const [profile, setProfile] = useState(initialData.profile);
  const [profileForm, setProfileForm] = useState(() =>
    buildProfileState(initialData.profile),
  );
  const [requestForm, setRequestForm] = useState<RequestFormState>(buildRequestState());
  const [requests, setRequests] = useState<ContentRequest[]>(initialData.contentRequests);
  const [contents, setContents] = useState<GeneratedContent[]>(
    initialData.generatedContents,
  );
  const [feedback, setFeedback] = useState(initialData.feedback);
  const [trainingAssets, setTrainingAssets] = useState<ProfileTrainingAsset[]>(
    initialData.trainingAssets ?? [],
  );
  const [productFeedbacks, setProductFeedbacks] = useState<ProductFeedback[]>(
    initialData.productFeedbacks ?? [],
  );
  const [evaluationReports, setEvaluationReports] = useState<EvaluationReport[]>(
    sortReportsByDate(initialEvaluationReports),
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingContent, setIsSavingContent] = useState(false);
  const [isSubmittingProductFeedback, setIsSubmittingProductFeedback] =
    useState(false);
  const [uploadingTrainingRoles, setUploadingTrainingRoles] = useState<
    Array<"dataset" | "consent">
  >([]);
  const [isLoadingEvaluations, setIsLoadingEvaluations] = useState(false);
  const [isFeedbackWidgetOpen, setFeedbackWidgetOpen] = useState(false);
  const [isEvaluatingContentRequestId, setIsEvaluatingContentRequestId] = useState<
    string | null
  >(null);

  const isUploadingTrainingAssets = uploadingTrainingRoles.length > 0;
  const isUploadingConsentAsset = uploadingTrainingRoles.includes("consent");
  const isUploadingDatasetAsset = uploadingTrainingRoles.includes("dataset");

  const latestApprovedContent = useMemo(
    () => contents.find((item) => item.status === "aprovado") ?? null,
    [contents],
  );

  const requestsWithContent = useMemo(() => {
    const requestIds = new Set(contents.map((item) => item.contentRequestId));
    return requests.filter((item) => requestIds.has(item.id));
  }, [contents, requests]);

  useEffect(() => {
    let isMounted = true;

    async function loadInitialReports() {
      setIsLoadingEvaluations(true);

      try {
        const response = await fetch("/api/evals/runs?limit=20");
        const payload = (await response.json()) as {
          reports?: EvaluationReport[];
          message?: string;
        };

        if (!response.ok) {
          throw new Error(payload.message || "Nao foi possivel carregar as avaliacoes.");
        }

        if (!isMounted) {
          return;
        }

        setEvaluationReports(sortReportsByDate(payload.reports ?? []));
      } catch {
        if (!isMounted) {
          return;
        }
      } finally {
        if (isMounted) {
          setIsLoadingEvaluations(false);
        }
      }
    }

    void loadInitialReports();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleApi<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
    setErrorMessage(null);
    const response = await fetch(input, init);
    const contentType = response.headers.get("content-type") ?? "";

    // Alguns erros (ex: Request Entity Too Large) podem vir como texto/HTML.
    // Para não falhar com "Unexpected token ... is not valid JSON", tentamos JSON primeiro
    // e caímos para texto quando necessário.
    let payload: unknown;
    try {
      payload = contentType.includes("application/json")
        ? await response.json()
        : await response.text();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const apiErrorPayload =
        typeof payload === "string"
          ? ({ message: payload } satisfies ApiErrorPayload)
          : (payload as ApiErrorPayload | null);
      throw new Error(
        formatApiError(apiErrorPayload ?? { message: "Falha na operacao." }),
      );
    }

    return (payload ?? ({} as T)) as T;
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
        personaArchetypes: profileForm.personaArchetypes,
        sentinelThemes: profileForm.sentinelThemes,
        oppositionThemes: profileForm.oppositionThemes,
        customRadarThemes: profileForm.customRadarThemes.filter(Boolean),
        interestProfiles: profileForm.interestProfiles.filter(
          (item) => item.network.trim() && item.handle.trim(),
        ),
        interestSites: profileForm.interestSites.filter(Boolean),
        oppositionProfiles: profileForm.oppositionProfiles.filter(
          (item) => item.network.trim() && item.handle.trim(),
        ),
        oppositionSites: profileForm.oppositionSites.filter(Boolean),
        glossaryTerms: parseTextarea(profileForm.glossaryTerms),
        trainingReferenceLinks: profileForm.trainingReferenceLinks.filter(Boolean),
        youtubeVideoUrl: profileForm.youtubeVideoUrl,
        avatarType: profileForm.avatarType,
        avatarVideoTopic: profileForm.avatarVideoTopic,
        notificationEmail: profileForm.notificationEmail,
        avatarEmotions: profileForm.avatarEmotions,
        voicePace: profileForm.voicePace,
        editingStyles: profileForm.editingStyles,
        factCheckingSources: profileForm.factCheckingSources,
        hardDataSources: profileForm.hardDataSources,
        distributionChannels: profileForm.distributionChannels,
        distributionWindows: profileForm.distributionWindows,
        autoPublish: profileForm.autoPublish,
      };

      const parsedPayload = profileInputSchema.safeParse(payload);

      if (!parsedPayload.success) {
        throw new Error(
          formatApiError({
            issues: parsedPayload.error.flatten(),
          }),
        );
      }

      const result = await handleApi<{ profile: DashboardData["profile"] }>("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      setProfile(result.profile);
      setProfileForm(buildProfileState(result.profile));
      setTrainingAssets((current) =>
        current.map((asset) =>
          asset.draftProfileId === result.profile?.id
            ? {
                ...asset,
                profileId: result.profile?.id ?? asset.profileId,
                draftProfileId: null,
              }
            : asset,
        ),
      );
      setStatusMessage(
        "Configuracao salva. O onboarding profundo do mandato ja esta persistido para as proximas etapas.",
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Nao foi possivel salvar o perfil.",
      );
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function uploadFileToSignedUrl(input: { signedUrl: string; token: string; file: File }) {
    const url = new URL(input.signedUrl);
    if (!url.searchParams.get("token")) {
      url.searchParams.set("token", input.token);
    }

    const body = new FormData();
    body.append("cacheControl", "3600");
    body.append("", input.file);

    const response = await fetch(url.toString(), {
      method: "PUT",
      headers: {
        "x-upsert": "false",
      },
      body,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(text || `Upload falhou (${response.status}).`);
    }
  }

  async function uploadTrainingAssets(files: File[], trainingRole: "dataset" | "consent") {
    if (!files.length) {
      return [];
    }

    setUploadingTrainingRoles((current) =>
      current.includes(trainingRole) ? current : [...current, trainingRole],
    );
    setStatusMessage(null);

    try {
      const profileReferenceId = profile?.id ?? profileForm.id ?? crypto.randomUUID();

      if (!profileForm.id) {
        setProfileForm((current) => ({ ...current, id: profileReferenceId }));
      }

      const isPersistedProfile = Boolean(profile?.id);
      const profileId = isPersistedProfile ? profileReferenceId : null;
      const draftProfileId = isPersistedProfile ? null : profileReferenceId;

      const uploadedAssets: ProfileTrainingAsset[] = [];

      for (const file of files) {
        const signed = await handleApi<{
          signedUrl?: string;
          token?: string;
          storageProvider?: "supabase";
          storageBucket?: string;
          storagePath?: string;
          message?: string;
        }>("/api/profile/training-assets/signed-upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            profileId,
            draftProfileId,
            trainingRole,
            filename: file.name,
          }),
        }).catch(() => null);

        if (signed?.signedUrl && signed?.token && signed.storagePath) {
          await uploadFileToSignedUrl({ signedUrl: signed.signedUrl, token: signed.token, file });

          const registered = await handleApi<{ assets: ProfileTrainingAsset[] }>(
            "/api/profile/training-assets/register",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                profileId,
                draftProfileId,
                trainingRole,
                storageProvider: "supabase",
                storageBucket: signed.storageBucket ?? null,
                storagePath: signed.storagePath,
                originalFilename: file.name,
                mimeType: file.type,
                sizeBytes: file.size,
              }),
            },
          );

          uploadedAssets.push(...registered.assets);
          continue;
        }

        // Fallback (dev/teste local): upload via API tradicional (multipart).
        const formData = new FormData();
        formData.append(isPersistedProfile ? "profileId" : "draftProfileId", profileReferenceId);
        formData.append("trainingRole", trainingRole);
        formData.append("files", file);

        const result = await handleApi<{ assets: ProfileTrainingAsset[] }>(
          "/api/profile/training-assets",
          {
            method: "POST",
            body: formData,
          },
        );

        uploadedAssets.push(...result.assets);
      }

      setTrainingAssets((current) => [...uploadedAssets, ...current]);
      setStatusMessage(
        trainingRole === "consent"
          ? "Video de autorizacao enviado."
          : "Video(s) de treinamento enviados.",
      );

      return uploadedAssets;
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Nao foi possivel enviar os assets de treino.",
      );
      return [];
    } finally {
      setUploadingTrainingRoles((current) => current.filter((role) => role !== trainingRole));
    }
  }

  async function generateContent() {
    if (!profile) {
      setErrorMessage("Salve o perfil do parlamentar antes de gerar conteudo.");
      return [];
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
        mandatoryTerms: parseTextarea(requestForm.mandatoryTerms),
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
      setRequestForm(buildRequestState());
      setStatusMessage(
        "Geracao concluida. Voce ja pode revisar, editar e aprovar a melhor versao.",
      );

      return result.generatedContents;
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Nao foi possivel gerar as versoes.",
      );
      return [];
    } finally {
      setIsGenerating(false);
    }
  }

  async function updateContent(
    contentId: string,
    input: { body?: string; status?: ContentStatus },
  ) {
    setIsSavingContent(true);
    setStatusMessage(null);

    try {
      const result = await handleApi<{ generatedContent: GeneratedContent }>(
        `/api/generated-contents/${contentId}`,
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

      return result.generatedContent;
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Nao foi possivel atualizar o conteudo.",
      );
      return null;
    } finally {
      setIsSavingContent(false);
    }
  }

  async function submitFeedback(contentId: string, note: string) {
    if (!note.trim()) {
      return null;
    }

    try {
      const result = await handleApi<{ feedback: DashboardData["feedback"][number] }>(
        `/api/generated-contents/${contentId}/feedback`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ note }),
        },
      );

      setFeedback((current) => [result.feedback, ...current]);
      setStatusMessage("Feedback registrado para calibrar as proximas geracoes.");

      return result.feedback;
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Nao foi possivel registrar o feedback.",
      );
      return null;
    }
  }

  async function submitProductFeedback(input: ProductFeedbackFormState) {
    setIsSubmittingProductFeedback(true);
    setStatusMessage(null);

    try {
      const parsedPayload = productFeedbackInputSchema.safeParse(input);

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
          body: JSON.stringify(input),
        },
      );

      setProductFeedbacks((current) => [result.feedback, ...current]);
      setFeedbackWidgetOpen(true);
      setStatusMessage(
        "Feedback analisado. A IA classificou a observacao e registrou o proximo passo sugerido.",
      );

      return result.feedback;
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Nao foi possivel analisar o feedback de produto.",
      );
      return null;
    } finally {
      setIsSubmittingProductFeedback(false);
    }
  }

  async function reloadEvaluationReports() {
    setIsLoadingEvaluations(true);

    try {
      const result = await handleApi<{ reports: EvaluationReport[] }>("/api/evals/runs?limit=20");
      setEvaluationReports(sortReportsByDate(result.reports));
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Nao foi possivel carregar as avaliacoes do core.",
      );
    } finally {
      setIsLoadingEvaluations(false);
    }
  }

  async function evaluateContentRequest(contentRequestId: string) {
    setIsEvaluatingContentRequestId(contentRequestId);
    setStatusMessage(null);

    try {
      const result = await handleApi<{ report: EvaluationReport }>("/api/evals/judge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contentRequestId,
        }),
      });

      setEvaluationReports((current) =>
        sortReportsByDate([
          result.report,
          ...current.filter((item) => item.run.id !== result.report.run.id),
        ]),
      );
      setStatusMessage(
        "Avaliacao concluida. O juiz da LLM atribuiu nota e registrou o racional da execucao.",
      );

      return result.report;
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Nao foi possivel avaliar a geracao selecionada.",
      );
      return null;
    } finally {
      setIsEvaluatingContentRequestId(null);
    }
  }

  function getContentById(contentId: string) {
    return contents.find((item) => item.id === contentId) ?? null;
  }

  function getRequestById(requestId: string) {
    return requests.find((item) => item.id === requestId) ?? null;
  }

  function getRequestForContentId(contentId: string) {
    const content = getContentById(contentId);
    return content ? getRequestById(content.contentRequestId) : null;
  }

  function getFeedbackForContentId(contentId: string) {
    return feedback.filter((item) => item.generatedContentId === contentId);
  }

  function getEvaluationReportById(runId: string) {
    return evaluationReports.find((item) => item.run.id === runId) ?? null;
  }

  const value: ProductAppContextValue = {
    profile,
    profileForm,
    setProfileForm,
    requestForm,
    setRequestForm,
    requests,
    contents,
    feedback,
    trainingAssets,
    productFeedbacks,
    evaluationReports,
    latestApprovedContent,
    requestsWithContent,
    statusMessage,
    errorMessage,
    isSavingProfile,
    isGenerating,
    isSavingContent,
    isSubmittingProductFeedback,
    isUploadingTrainingAssets,
    isUploadingConsentAsset,
    isUploadingDatasetAsset,
    isLoadingEvaluations,
    isFeedbackWidgetOpen,
    isEvaluatingContentRequestId,
    setFeedbackWidgetOpen,
    saveProfile,
    uploadTrainingAssets,
    generateContent,
    updateContent,
    submitFeedback,
    submitProductFeedback,
    reloadEvaluationReports,
    evaluateContentRequest,
    getContentById,
    getRequestById,
    getRequestForContentId,
    getFeedbackForContentId,
    getEvaluationReportById,
  };

  return <ProductAppContext.Provider value={value}>{children}</ProductAppContext.Provider>;
}

export function useProductApp() {
  const context = useContext(ProductAppContext);

  if (!context) {
    throw new Error("useProductApp deve ser usado dentro de ProductAppProvider.");
  }

  return context;
}

export function useInitialProductFeedbackForm() {
  return useState<ProductFeedbackFormState>(buildProductFeedbackState());
}
