"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

import { mergeProfileInputForSave } from "@/lib/profile-save";
import {
  sanitizeMandateThemesOnLoad,
  sanitizeOppositionThemesOnLoad,
} from "@/lib/sentinel-radar-themes";
import { SUPABASE_STANDARD_UPLOAD_MAX_BYTES } from "@/lib/training-asset-upload-client";
import {
  contentRequestInputSchema,
  productFeedbackInputSchema,
  profileInputSchema,
} from "@/lib/schemas";
import type { ProfileInput } from "@/lib/schemas";
import type { DashboardData } from "@/lib/types";
import type { SessionUser } from "@/lib/auth/session";
import type {
  ContentRequest,
  ContentStatus,
  EvaluationReport,
  GeneratedContent,
  ProfileTrainingAsset,
  ProductFeedback,
  TrainingAssetRole,
} from "@/lib/types";

import { uploadTrainingFileToSupabase } from "@/lib/training-asset-upload-client";

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
import { useSentinelSignalsState } from "./use-sentinel-signals";
import type { MockSentinelSuggestion } from "@/lib/sentinel-mock-suggestions";
import type { SentinelSuggestionsMeta } from "@/lib/sentinel-types";

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
  dismissAppMessages: () => void;
  isSavingProfile: boolean;
  isGenerating: boolean;
  isSavingContent: boolean;
  isSubmittingProductFeedback: boolean;
  isUploadingTrainingAssets: boolean;
  isUploadingVoiceAudioAsset: boolean;
  isUploadingAvatarImageAsset: boolean;
  isUploadingTrainingVideoAsset: boolean;
  isLoadingEvaluations: boolean;
  isFeedbackWidgetOpen: boolean;
  isEvaluatingContentRequestId: string | null;
  setFeedbackWidgetOpen: Dispatch<SetStateAction<boolean>>;
  saveProfile: (options?: {
    allowDraftDefaults?: boolean;
    silent?: boolean;
    throwOnError?: boolean;
  }) => Promise<void>;
  uploadTrainingAssets: (
    files: File[],
    trainingRole: TrainingAssetRole,
    options?: { reportError?: "global" | "throw" },
  ) => Promise<ProfileTrainingAsset[]>;
  appendTrainingAssets: (assets: ProfileTrainingAsset[]) => void;
  removeTrainingAssetsById: (assetIds: string[]) => void;
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
  sessionUser: SessionUser | null;
  signOut: () => Promise<void>;
  sentinelSuggestions: MockSentinelSuggestion[];
  sentinelMeta: SentinelSuggestionsMeta | null;
  isLoadingSentinel: boolean;
  sentinelLoadError: string | null;
  isRefreshingSentinel: boolean;
  refreshSentinelSignals: () => Promise<void>;
  syncSentinelOnPageEnter: () => Promise<void>;
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
  sessionUser = null,
  children,
}: {
  initialData: DashboardData;
  sessionUser?: SessionUser | null;
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
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearStatusTimer = useCallback(() => {
    if (statusTimerRef.current) {
      clearTimeout(statusTimerRef.current);
      statusTimerRef.current = null;
    }
  }, []);

  const clearErrorTimer = useCallback(() => {
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }
  }, []);

  const dismissAppMessages = useCallback(() => {
    clearStatusTimer();
    clearErrorTimer();
    setStatusMessage(null);
    setErrorMessage(null);
  }, [clearErrorTimer, clearStatusTimer]);

  const publishStatusMessage = useCallback(
    (message: string, durationMs = 3600) => {
      clearStatusTimer();
      setStatusMessage(message);
      statusTimerRef.current = setTimeout(() => {
        setStatusMessage(null);
        statusTimerRef.current = null;
      }, durationMs);
    },
    [clearStatusTimer],
  );

  const publishErrorMessage = useCallback(
    (message: string, durationMs = 7000) => {
      clearErrorTimer();
      setErrorMessage(message);
      errorTimerRef.current = setTimeout(() => {
        setErrorMessage(null);
        errorTimerRef.current = null;
      }, durationMs);
    },
    [clearErrorTimer],
  );

  const {
    sentinelSuggestions,
    sentinelMeta,
    isLoadingSentinel,
    sentinelLoadError,
    isRefreshingSentinel,
    refreshSentinelSignals,
    syncSentinelOnPageEnter,
  } = useSentinelSignalsState({
    publishStatusMessage,
    publishErrorMessage,
  });

  useEffect(() => {
    return () => {
      clearStatusTimer();
      clearErrorTimer();
    };
  }, [clearErrorTimer, clearStatusTimer]);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingContent, setIsSavingContent] = useState(false);
  const [isSubmittingProductFeedback, setIsSubmittingProductFeedback] =
    useState(false);
  const [uploadingTrainingRoles, setUploadingTrainingRoles] = useState<
    TrainingAssetRole[]
  >([]);
  const [isLoadingEvaluations, setIsLoadingEvaluations] = useState(false);
  const [isFeedbackWidgetOpen, setFeedbackWidgetOpen] = useState(false);
  const [isEvaluatingContentRequestId, setIsEvaluatingContentRequestId] = useState<
    string | null
  >(null);

  const isUploadingTrainingAssets = uploadingTrainingRoles.length > 0;
  const isUploadingVoiceAudioAsset =
    uploadingTrainingRoles.includes("voice_audio");
  const isUploadingAvatarImageAsset =
    uploadingTrainingRoles.includes("avatar_image");
  const isUploadingTrainingVideoAsset = uploadingTrainingRoles.includes("dataset");

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
          throw new Error(payload.message || "Não foi possível carregar as avaliações.");
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
    clearErrorTimer();
    setErrorMessage(null);
    const response = await fetch(input, {
      credentials: "same-origin",
      ...init,
    });
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
        formatApiError(apiErrorPayload ?? { message: "Falha na operação." }),
      );
    }

    return (payload ?? ({} as T)) as T;
  }

  async function saveProfile(options?: {
    allowDraftDefaults?: boolean;
    silent?: boolean;
    throwOnError?: boolean;
  }) {
    setIsSavingProfile(true);
    clearStatusTimer();
    setStatusMessage(null);

    try {
      const rawPayload: ProfileInput = {
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
        sentinelThemes: sanitizeMandateThemesOnLoad(profileForm.sentinelThemes),
        oppositionThemes: sanitizeOppositionThemesOnLoad(profileForm.oppositionThemes),
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
        argilAvatarId: profileForm.argilAvatarId,
        argilVoiceId: profileForm.argilVoiceId,
        avatarTrainingStatus: (profileForm.avatarTrainingStatus ||
          "") as ProfileInput["avatarTrainingStatus"],
      };

      const payload = mergeProfileInputForSave(rawPayload, profile, {
        allowDraftDefaults: options?.allowDraftDefaults,
      });

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
        body: JSON.stringify({
          ...parsedPayload.data,
          draftSave: options?.allowDraftDefaults === true,
        }),
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
      if (!options?.silent) {
        publishStatusMessage(
          options?.allowDraftDefaults
            ? "Preferências do Curador salvas."
            : "Configuração salva.",
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Não foi possível salvar o perfil.";
      publishErrorMessage(message);
      if (options?.throwOnError) {
        throw error instanceof Error ? error : new Error(message);
      }
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function uploadTrainingAssets(
    files: File[],
    trainingRole: TrainingAssetRole,
    options?: { reportError?: "global" | "throw" },
  ) {
    if (!files.length) {
      return [];
    }

    setUploadingTrainingRoles((current) =>
      current.includes(trainingRole) ? current : [...current, trainingRole],
    );
    clearStatusTimer();
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
        const useServerUpload = file.size > SUPABASE_STANDARD_UPLOAD_MAX_BYTES;

        if (!useServerUpload) {
          const signed = await handleApi<{
            signedUrl?: string;
            token?: string;
            resumableEndpoint?: string;
            storageApiKey?: string;
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

          if (
            signed?.signedUrl &&
            signed?.token &&
            signed.storagePath &&
            signed.storageBucket &&
            signed.resumableEndpoint
          ) {
            await uploadTrainingFileToSupabase({
              signedUrl: signed.signedUrl,
              token: signed.token,
              storageBucket: signed.storageBucket,
              storagePath: signed.storagePath,
              resumableEndpoint: signed.resumableEndpoint,
              storageApiKey: signed.storageApiKey,
              file,
            });

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
        }

        const uploadParams = new URLSearchParams({
          trainingRole,
          filename: file.name,
        });
        if (isPersistedProfile) {
          uploadParams.set("profileId", profileReferenceId);
        } else {
          uploadParams.set("draftProfileId", profileReferenceId);
        }

        const result = await handleApi<{ assets: ProfileTrainingAsset[] }>(
          `/api/profile/training-assets/binary?${uploadParams.toString()}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": file.type || "application/octet-stream",
            },
            body: file,
          },
        );

        uploadedAssets.push(...result.assets);
      }

      setTrainingAssets((current) => [...uploadedAssets, ...current]);
      publishStatusMessage(
        trainingRole === "voice_audio"
          ? "Audio de voz enviado."
          : trainingRole === "avatar_image"
            ? "Foto para clone enviada."
            : trainingRole === "dataset"
              ? "Video de treino enviado. Se necessário, sera comprimido automaticamente."
              : "Asset de treinamento enviado.",
      );

      return uploadedAssets;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível enviar os assets de treino.";

      if (options?.reportError === "throw") {
        throw new Error(message);
      }

      publishErrorMessage(message);
      return [];
    } finally {
      setUploadingTrainingRoles((current) => current.filter((role) => role !== trainingRole));
    }
  }

  function appendTrainingAssets(assets: ProfileTrainingAsset[]) {
    if (!assets.length) {
      return;
    }

    setTrainingAssets((current) => [...assets, ...current]);
  }

  function removeTrainingAssetsById(assetIds: string[]) {
    const ids = new Set(assetIds.map((id) => id.trim()).filter(Boolean));
    if (!ids.size) {
      return;
    }

    setTrainingAssets((current) => current.filter((asset) => !ids.has(asset.id)));
  }

  async function generateContent() {
    if (!profile) {
      publishErrorMessage("Salve o perfil do parlamentar antes de gerar conteúdo.");
      return [];
    }

    setIsGenerating(true);
    clearStatusTimer();
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
      publishStatusMessage(
        "Geração concluída. Você já pode revisar, editar e aprovar a melhor versão.",
      );

      return result.generatedContents;
    } catch (error) {
      publishErrorMessage(
        error instanceof Error ? error.message : "Não foi possível gerar as versões.",
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
    clearStatusTimer();
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
      publishStatusMessage("Conteúdo atualizado e salvo no histórico.");

      return result.generatedContent;
    } catch (error) {
      publishErrorMessage(
        error instanceof Error ? error.message : "Não foi possível atualizar o conteúdo.",
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
      publishStatusMessage("Feedback registrado para calibrar as próximas gerações.");

      return result.feedback;
    } catch (error) {
      publishErrorMessage(
        error instanceof Error ? error.message : "Não foi possível registrar o feedback.",
      );
      return null;
    }
  }

  async function submitProductFeedback(input: ProductFeedbackFormState) {
    setIsSubmittingProductFeedback(true);
    clearStatusTimer();
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
      publishStatusMessage(
        "Feedback analisado. A IA classificou a observação e registrou o próximo passo sugerido.",
      );

      return result.feedback;
    } catch (error) {
      publishErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível analisar o feedback de produto.",
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
      publishErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar as avaliações do core.",
      );
    } finally {
      setIsLoadingEvaluations(false);
    }
  }

  async function evaluateContentRequest(contentRequestId: string) {
    setIsEvaluatingContentRequestId(contentRequestId);
    clearStatusTimer();
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
      publishStatusMessage(
        "Avaliação concluída. O juiz da LLM atribuiu nota e registrou o racional da execução.",
      );

      return result.report;
    } catch (error) {
      publishErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível avaliar a geração selecionada.",
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

  async function signOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    window.location.href = "/login";
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
    dismissAppMessages,
    isSavingProfile,
    isGenerating,
    isSavingContent,
    isSubmittingProductFeedback,
    isUploadingTrainingAssets,
    isUploadingVoiceAudioAsset,
    isUploadingAvatarImageAsset,
    isUploadingTrainingVideoAsset,
    isLoadingEvaluations,
    isFeedbackWidgetOpen,
    isEvaluatingContentRequestId,
    setFeedbackWidgetOpen,
    saveProfile,
    uploadTrainingAssets,
    appendTrainingAssets,
    removeTrainingAssetsById,
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
    sessionUser,
    signOut,
    sentinelSuggestions,
    sentinelMeta,
    isLoadingSentinel,
    sentinelLoadError,
    isRefreshingSentinel,
    refreshSentinelSignals,
    syncSentinelOnPageEnter,
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
