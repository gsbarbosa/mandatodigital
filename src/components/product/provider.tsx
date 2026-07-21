"use client";

import {
  createContext,
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
import { unionSentinelThemes } from "@/lib/sentinel-profile-themes";
import {
  contentRequestInputSchema,
  profileInputSchema,
} from "@/lib/schemas";
import type { ProfileInput } from "@/lib/schemas";
import type { DashboardData } from "@/lib/types";
import type { SessionUser } from "@/lib/auth/session";
import type {
  ContentRequest,
  ContentStatus,
  GeneratedContent,
  ProfileTrainingAsset,
  TrainingAssetRole,
} from "@/lib/types";

import { uploadTrainingFileToSignedStorage } from "@/lib/training-asset-upload-client";
import { clearEarlyAccessBrowserState } from "@/lib/early-access";
import {
  guestCaricatureQuota,
  MAX_GUEST_CARICATURES_PER_VARIANT,
} from "@/lib/caricature-asset-variant";
import {
  isDevAccountModeEmail,
  readDevAccountModeFromDocumentCookie,
} from "@/lib/dev-account-mode";
import type { CaricatureVariant } from "@/lib/openai-caricature-prompts";
import { sanitizeProviderFacingMessage } from "@/lib/curador-heygen-prefs";

import {
  buildProfileState,
  buildRequestState,
  formatApiError,
  parseTextarea,
  type ApiErrorPayload,
  type ProfileFormState,
  type RequestFormState,
} from "./shared";

export type CaricatureRegenJob = {
  status: "idle" | "running" | "success" | "error";
  message: string | null;
};

const IDLE_CARICATURE_JOB: CaricatureRegenJob = { status: "idle", message: null };

type ProductAppContextValue = {
  profile: DashboardData["profile"];
  profileForm: ProfileFormState;
  setProfileForm: Dispatch<SetStateAction<ProfileFormState>>;
  requestForm: RequestFormState;
  setRequestForm: Dispatch<SetStateAction<RequestFormState>>;
  requests: ContentRequest[];
  contents: GeneratedContent[];
  trainingAssets: ProfileTrainingAsset[];
  latestApprovedContent: GeneratedContent | null;
  requestsWithContent: ContentRequest[];
  statusMessage: string | null;
  errorMessage: string | null;
  dismissMessages: () => void;
  isSavingProfile: boolean;
  isGenerating: boolean;
  isSavingContent: boolean;
  isUploadingTrainingAssets: boolean;
  isUploadingVoiceAudioAsset: boolean;
  isUploadingAvatarImageAsset: boolean;
  isUploadingTrainingVideoAsset: boolean;
  saveProfile: (options?: {
    allowDraftDefaults?: boolean;
    silent?: boolean;
    throwOnError?: boolean;
    sentinelRefreshPolicy?: "onboarding" | "themes" | "skip";
  }) => Promise<{
    sentinelRefreshSkipped?: boolean;
    sentinelRefreshMessage?: string | null;
  } | void>;
  uploadTrainingAssets: (
    files: File[],
    trainingRole: TrainingAssetRole,
    options?: { reportError?: "global" | "throw" },
  ) => Promise<ProfileTrainingAsset[]>;
  appendTrainingAssets: (assets: ProfileTrainingAsset[]) => void;
  removeTrainingAssetsById: (assetIds: string[]) => void;
  caricatureRegenJobs: Record<CaricatureVariant, CaricatureRegenJob>;
  regenerateCaricatureVariant: (input: {
    variant: CaricatureVariant;
    label: string;
  }) => Promise<void>;
  clearCaricatureRegenMessage: (variant: CaricatureVariant) => void;
  generateContent: () => Promise<GeneratedContent[]>;
  updateContent: (
    contentId: string,
    input: { body?: string; status?: ContentStatus },
  ) => Promise<GeneratedContent | null>;
  getContentById: (contentId: string) => GeneratedContent | null;
  getRequestById: (requestId: string) => ContentRequest | null;
  getRequestForContentId: (contentId: string) => ContentRequest | null;
  sessionUser: SessionUser | null;
  signOut: () => Promise<void>;
};

const ProductAppContext = createContext<ProductAppContextValue | null>(null);

export function ProductAppProvider({
  initialData,
  sessionUser = null,
  children,
}: {
  initialData: DashboardData;
  sessionUser?: SessionUser | null;
  children: ReactNode;
}) {
  const [profile, setProfile] = useState(initialData.profile);
  const [profileForm, setProfileForm] = useState(() =>
    buildProfileState(initialData.profile),
  );
  const [requestForm, setRequestForm] = useState<RequestFormState>(buildRequestState());
  const [requests, setRequests] = useState<ContentRequest[]>(initialData.contentRequests);
  const [contents, setContents] = useState<GeneratedContent[]>(
    initialData.generatedContents,
  );
  const [trainingAssets, setTrainingAssets] = useState<ProfileTrainingAsset[]>(
    initialData.trainingAssets ?? [],
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingContent, setIsSavingContent] = useState(false);
  const [uploadingTrainingRoles, setUploadingTrainingRoles] = useState<
    TrainingAssetRole[]
  >([]);
  const [caricatureRegenJobs, setCaricatureRegenJobs] = useState<
    Record<CaricatureVariant, CaricatureRegenJob>
  >({
    editorial: IDLE_CARICATURE_JOB,
    mascot_3d: IDLE_CARICATURE_JOB,
  });
  const caricatureRegenInFlightRef = useRef<Partial<Record<CaricatureVariant, boolean>>>({});

  function dismissMessages() {
    setStatusMessage(null);
    setErrorMessage(null);
  }

  useEffect(() => {
    if (!statusMessage && !errorMessage) {
      return;
    }

    const durationMs = errorMessage ? 4500 : 2800;
    const timer = window.setTimeout(() => {
      dismissMessages();
    }, durationMs);

    return () => window.clearTimeout(timer);
  }, [statusMessage, errorMessage]);

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

  async function handleApi<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
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
        formatApiError(apiErrorPayload ?? { message: "Falha na operacao." }),
      );
    }

    return (payload ?? ({} as T)) as T;
  }

  async function saveProfile(options?: {
    allowDraftDefaults?: boolean;
    silent?: boolean;
    throwOnError?: boolean;
    sentinelRefreshPolicy?: "onboarding" | "themes" | "skip";
  }) {
    setIsSavingProfile(true);
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
        sentinelThemesFederal: profileForm.sentinelThemesFederal,
        sentinelThemesEstadual: profileForm.sentinelThemesEstadual,
        sentinelThemes: unionSentinelThemes({
          federal: profileForm.sentinelThemesFederal,
          estadual: profileForm.sentinelThemesEstadual,
        }),
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

      const result = await handleApi<{
        profile: DashboardData["profile"];
        sentinelRefreshSkipped?: boolean;
        sentinelRefreshMessage?: string | null;
      }>("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...parsedPayload.data,
          draftSave: options?.allowDraftDefaults === true,
          sentinelRefreshPolicy: options?.sentinelRefreshPolicy ?? "themes",
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
        setStatusMessage(
          options?.allowDraftDefaults
            ? "Preferências do Curador salvas."
            : "Configuração salva.",
        );
      }

      return {
        sentinelRefreshSkipped: Boolean(result.sentinelRefreshSkipped),
        sentinelRefreshMessage: result.sentinelRefreshMessage ?? null,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Nao foi possivel salvar o perfil.";
      setErrorMessage(message);
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
          storageProvider?: "firebase";
          storageBucket?: string;
          storagePath?: string;
          contentType?: string;
          uploadMethod?: "put";
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
            mimeType: file.type || "application/octet-stream",
          }),
        }).catch(() => null);

        const canDirectUpload = Boolean(
          signed?.signedUrl && signed.storagePath && signed.storageBucket,
        );

        if (canDirectUpload && signed?.signedUrl && signed.storagePath && signed.storageBucket) {
          try {
            await uploadTrainingFileToSignedStorage({
              signedUrl: signed.signedUrl,
              storageBucket: signed.storageBucket,
              storagePath: signed.storagePath,
              storageProvider: "firebase",
              contentType: signed.contentType,
              uploadMethod: "put",
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
                  storageProvider: "firebase",
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
          } catch {
            // CORS/rede no PUT direto ao Storage — cai no proxy via API.
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
      setStatusMessage(
        trainingRole === "voice_audio"
          ? "Audio de voz enviado."
          : trainingRole === "avatar_image"
            ? "Foto para clone enviada."
            : trainingRole === "dataset"
              ? "Video de treino enviado. Se necessario, sera comprimido automaticamente."
              : "Asset de treinamento enviado.",
      );

      return uploadedAssets;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Nao foi possivel enviar os assets de treino.";

      if (options?.reportError === "throw") {
        throw new Error(message);
      }

      setErrorMessage(message);
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

  function clearCaricatureRegenMessage(variant: CaricatureVariant) {
    setCaricatureRegenJobs((current) => ({
      ...current,
      [variant]: {
        status: current[variant].status === "running" ? "running" : "idle",
        message: null,
      },
    }));
  }

  async function regenerateCaricatureVariant(input: {
    variant: CaricatureVariant;
    label: string;
  }) {
    const { variant, label } = input;
    if (caricatureRegenInFlightRef.current[variant]) {
      return;
    }
    caricatureRegenInFlightRef.current[variant] = true;

    setCaricatureRegenJobs((current) => ({
      ...current,
      [variant]: { status: "running", message: null },
    }));

    const sourcePhoto = [...trainingAssets]
      .filter((asset) => asset.trainingRole === "avatar_image")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    if (!sourcePhoto) {
      caricatureRegenInFlightRef.current[variant] = false;
      setCaricatureRegenJobs((current) => ({
        ...current,
        [variant]: {
          status: "error",
          message:
            "Envie a foto do Gêmeo Digital em Configurar avatar antes de regenerar este estilo.",
        },
      }));
      return;
    }

    const referenceId = profile?.id ?? profileForm.id ?? "";
    if (!referenceId) {
      caricatureRegenInFlightRef.current[variant] = false;
      setCaricatureRegenJobs((current) => ({
        ...current,
        [variant]: {
          status: "error",
          message: "Salve o perfil antes de regenerar o avatar.",
        },
      }));
      return;
    }

    const quota = guestCaricatureQuota({ assets: trainingAssets, variant });
    const premiumClient =
      isDevAccountModeEmail(sessionUser?.email) &&
      readDevAccountModeFromDocumentCookie() === "premium";
    if (!premiumClient && quota.reached) {
      caricatureRegenInFlightRef.current[variant] = false;
      setCaricatureRegenJobs((current) => ({
        ...current,
        [variant]: {
          status: "error",
          message: `Limite da versão para convidados atingido: no máximo ${MAX_GUEST_CARICATURES_PER_VARIANT} gerações de ${label} por conta.`,
        },
      }));
      return;
    }

    try {
      const response = await fetch("/api/openai/caricature", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceAssetId: sourcePhoto.id,
          referenceId,
          variant,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        asset?: ProfileTrainingAsset;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(
          sanitizeProviderFacingMessage(
            payload.message || `Não foi possível regenerar ${label}.`,
          ),
        );
      }

      if (!payload.asset) {
        throw new Error("Resposta inválida: caricatura sem identificador.");
      }

      // Mantém gerações anteriores para contabilizar o limite da versão convidados.
      appendTrainingAssets([payload.asset]);

      const successMessage = `${label} regenerado a partir da foto do Gêmeo Digital.`;
      setCaricatureRegenJobs((current) => ({
        ...current,
        [variant]: { status: "success", message: successMessage },
      }));
      setStatusMessage(successMessage);
      window.setTimeout(() => {
        setCaricatureRegenJobs((current) => {
          if (current[variant].status !== "success") {
            return current;
          }
          return { ...current, [variant]: IDLE_CARICATURE_JOB };
        });
      }, 5000);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : `Não foi possível regenerar ${label}.`;
      setCaricatureRegenJobs((current) => ({
        ...current,
        [variant]: { status: "error", message },
      }));
      setErrorMessage(message);
    } finally {
      caricatureRegenInFlightRef.current[variant] = false;
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

  async function signOut() {
    clearEarlyAccessBrowserState();
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
    trainingAssets,
    latestApprovedContent,
    requestsWithContent,
    statusMessage,
    errorMessage,
    dismissMessages,
    isSavingProfile,
    isGenerating,
    isSavingContent,
    isUploadingTrainingAssets,
    isUploadingVoiceAudioAsset,
    isUploadingAvatarImageAsset,
    isUploadingTrainingVideoAsset,
    saveProfile,
    uploadTrainingAssets,
    appendTrainingAssets,
    removeTrainingAssetsById,
    caricatureRegenJobs,
    regenerateCaricatureVariant,
    clearCaricatureRegenMessage,
    generateContent,
    updateContent,
    getContentById,
    getRequestById,
    getRequestForContentId,
    sessionUser,
    signOut,
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

