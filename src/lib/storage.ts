import {
  deleteTrainingAssetObject,
  uploadTrainingAssetBuffer,
} from "@/lib/training-asset-storage";
import { COLLECTIONS, col } from "@/lib/firebase/collections";
import { getStorageOwnerUserId } from "@/lib/storage-context";
import { migrateFlatSentinelThemes, unionSentinelThemes } from "@/lib/sentinel-profile-themes";

import type {
  ContentRequestInput,
  EvaluationCandidateCreateInput,
  EvaluationRunCreateInput,
  EvaluationRunUpdateInput,
  EvaluationScoreInput,
  FeedbackInput,
  GeneratedContentUpdateInput,
  ProfileInput,
  TrainingAssetCreateInput,
} from "@/lib/schemas";
import type {
  ContentFeedback,
  ContentRequest,
  DashboardData,
  EvaluationCandidate,
  EvaluationReport,
  EvaluationRun,
  EvaluationScore,
  GeneratedContent,
  PoliticianProfile,
  ProfileTrainingAsset,
  SocialHandle,
} from "@/lib/types";

type GeneratedContentSeed = Pick<
  GeneratedContent,
  "title" | "angle" | "body" | "promptPreview" | "provider"
>;

type WorkflowProfileConfig = ReturnType<typeof buildDefaultWorkflowProfileConfig>;

type ProfileDoc = {
  id: string;
  ownerUserId?: string;
  fullName: string;
  role: string;
  city: string;
  state: string;
  audience: string;
  spectrum: string;
  archetype: string;
  voiceTones: string[];
  keyIssues: string[];
  slogans: string[];
  redLines: string[];
  referenceExamples: string[];
  bio: string;
  updatedAt: string;
};

type ContentRequestDoc = ContentRequest & { profileId?: string | null };

export type StoredTrainingAssetFile = {
  storageProvider: ProfileTrainingAsset["storageProvider"];
  storageBucket: string | null;
  storagePath: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
};

export type Repository = {
  getDashboard(): Promise<DashboardData>;
  getContentRequestById(id: string): Promise<ContentRequest | null>;
  getGeneratedContentsByRequestId(contentRequestId: string): Promise<GeneratedContent[]>;
  saveProfile(input: ProfileInput): Promise<PoliticianProfile>;
  createTrainingAssets(items: TrainingAssetCreateInput[]): Promise<ProfileTrainingAsset[]>;
  listTrainingAssetsByProfile(profileId: string): Promise<ProfileTrainingAsset[]>;
  listTrainingAssetsForReference(referenceId: string): Promise<ProfileTrainingAsset[]>;
  getTrainingAssetById(id: string): Promise<ProfileTrainingAsset | null>;
  deleteTrainingAsset(id: string): Promise<void>;
  attachDraftTrainingAssets(
    profileId: string,
    draftProfileId: string,
  ): Promise<ProfileTrainingAsset[]>;
  createContentRequest(input: ContentRequestInput): Promise<ContentRequest>;
  createGeneratedContents(
    contentRequestId: string,
    items: GeneratedContentSeed[],
  ): Promise<GeneratedContent[]>;
  updateGeneratedContent(
    id: string,
    input: GeneratedContentUpdateInput,
  ): Promise<GeneratedContent>;
  addFeedback(
    generatedContentId: string,
    input: FeedbackInput,
  ): Promise<ContentFeedback>;
  createEvaluationRun(input: EvaluationRunCreateInput): Promise<EvaluationRun>;
  updateEvaluationRun(
    id: string,
    input: EvaluationRunUpdateInput,
  ): Promise<EvaluationRun>;
  createEvaluationCandidates(
    items: EvaluationCandidateCreateInput[],
  ): Promise<EvaluationCandidate[]>;
  createEvaluationScores(
    evaluationRunId: string,
    candidateId: string,
    scores: EvaluationScoreInput[],
  ): Promise<EvaluationScore[]>;
  getEvaluationReport(runId: string): Promise<EvaluationReport | null>;
  listEvaluationReports(limit?: number): Promise<EvaluationReport[]>;
};

function nowIso() {
  return new Date().toISOString();
}

function mapSocialHandles(input: unknown): SocialHandle[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const network = String(record.network ?? "").trim();
      const handle = String(record.handle ?? "").trim();

      if (!network || !handle) {
        return null;
      }

      return { network, handle };
    })
    .filter((item): item is SocialHandle => Boolean(item));
}

function buildDefaultWorkflowProfileConfig() {
  return {
    personaArchetypes: [] as string[],
    sentinelThemes: [] as string[],
    sentinelThemesFederal: [] as string[],
    sentinelThemesEstadual: [] as string[],
    oppositionThemes: [] as string[],
    customRadarThemes: [] as string[],
    interestProfiles: [] as SocialHandle[],
    interestSites: [] as string[],
    oppositionProfiles: [] as SocialHandle[],
    oppositionSites: [] as string[],
    glossaryTerms: [] as string[],
    trainingReferenceLinks: [] as string[],
    youtubeVideoUrl: "",
    avatarType: "",
    avatarVideoTopic: "",
    notificationEmail: "",
    avatarEmotions: [] as string[],
    voicePace: "Manter velocidade original",
    editingStyles: [] as string[],
    factCheckingSources: [] as string[],
    hardDataSources: [] as string[],
    distributionChannels: [] as string[],
    distributionWindows: [] as string[],
    autoPublish: false,
  };
}

function normalizeWorkflowSentinelThemes<
  T extends {
    sentinelThemes: string[];
    sentinelThemesFederal?: string[];
    sentinelThemesEstadual?: string[];
  },
>(config: T): T {
  if (
    config.sentinelThemesFederal !== undefined ||
    config.sentinelThemesEstadual !== undefined
  ) {
    const federal = config.sentinelThemesFederal ?? [];
    const estadual = config.sentinelThemesEstadual ?? [];
    const legacyThemes = config.sentinelThemes ?? [];

    if (federal.length === 0 && estadual.length === 0 && legacyThemes.length > 0) {
      const migrated = migrateFlatSentinelThemes(legacyThemes);
      return {
        ...config,
        sentinelThemesFederal: migrated.federal,
        sentinelThemesEstadual: migrated.estadual,
        sentinelThemes: unionSentinelThemes(migrated),
      };
    }

    return {
      ...config,
      sentinelThemesFederal: federal,
      sentinelThemesEstadual: estadual,
      sentinelThemes: unionSentinelThemes({ federal, estadual }),
    };
  }

  const migrated = migrateFlatSentinelThemes(config.sentinelThemes);
  return {
    ...config,
    sentinelThemesFederal: migrated.federal,
    sentinelThemesEstadual: migrated.estadual,
    sentinelThemes: unionSentinelThemes(migrated),
  };
}

function pickWorkflowProfileConfig(
  profile: Partial<PoliticianProfile> | null | undefined,
): WorkflowProfileConfig {
  const defaults = buildDefaultWorkflowProfileConfig();

  if (!profile) {
    return defaults;
  }

  return normalizeWorkflowSentinelThemes({
    personaArchetypes: profile.personaArchetypes ?? defaults.personaArchetypes,
    sentinelThemes: profile.sentinelThemes ?? defaults.sentinelThemes,
    sentinelThemesFederal: profile.sentinelThemesFederal ?? defaults.sentinelThemesFederal,
    sentinelThemesEstadual: profile.sentinelThemesEstadual ?? defaults.sentinelThemesEstadual,
    oppositionThemes: profile.oppositionThemes ?? defaults.oppositionThemes,
    customRadarThemes: profile.customRadarThemes ?? defaults.customRadarThemes,
    interestProfiles: profile.interestProfiles ?? defaults.interestProfiles,
    interestSites: profile.interestSites ?? defaults.interestSites,
    oppositionProfiles: profile.oppositionProfiles ?? defaults.oppositionProfiles,
    oppositionSites: profile.oppositionSites ?? defaults.oppositionSites,
    glossaryTerms: profile.glossaryTerms ?? defaults.glossaryTerms,
    trainingReferenceLinks:
      profile.trainingReferenceLinks ?? defaults.trainingReferenceLinks,
    youtubeVideoUrl: profile.youtubeVideoUrl ?? defaults.youtubeVideoUrl,
    avatarType: profile.avatarType ?? defaults.avatarType,
    avatarVideoTopic: profile.avatarVideoTopic ?? defaults.avatarVideoTopic,
    notificationEmail: profile.notificationEmail ?? defaults.notificationEmail,
    avatarEmotions: profile.avatarEmotions ?? defaults.avatarEmotions,
    voicePace: profile.voicePace ?? defaults.voicePace,
    editingStyles: profile.editingStyles ?? defaults.editingStyles,
    factCheckingSources: profile.factCheckingSources ?? defaults.factCheckingSources,
    hardDataSources: profile.hardDataSources ?? defaults.hardDataSources,
    distributionChannels:
      profile.distributionChannels ?? defaults.distributionChannels,
    distributionWindows:
      profile.distributionWindows ?? defaults.distributionWindows,
    autoPublish: profile.autoPublish ?? defaults.autoPublish,
  });
}

function mapWorkflowFromDoc(data: Record<string, unknown> | undefined): WorkflowProfileConfig {
  const defaults = buildDefaultWorkflowProfileConfig();
  if (!data) {
    return defaults;
  }

  return normalizeWorkflowSentinelThemes({
    personaArchetypes: Array.isArray(data.personaArchetypes)
      ? data.personaArchetypes.map(String)
      : defaults.personaArchetypes,
    sentinelThemes: Array.isArray(data.sentinelThemes)
      ? data.sentinelThemes.map(String)
      : defaults.sentinelThemes,
    sentinelThemesFederal: Array.isArray(data.sentinelThemesFederal)
      ? data.sentinelThemesFederal.map(String)
      : defaults.sentinelThemesFederal,
    sentinelThemesEstadual: Array.isArray(data.sentinelThemesEstadual)
      ? data.sentinelThemesEstadual.map(String)
      : defaults.sentinelThemesEstadual,
    oppositionThemes: Array.isArray(data.oppositionThemes)
      ? data.oppositionThemes.map(String)
      : defaults.oppositionThemes,
    customRadarThemes: Array.isArray(data.customRadarThemes)
      ? data.customRadarThemes.map(String)
      : defaults.customRadarThemes,
    interestProfiles: mapSocialHandles(data.interestProfiles),
    interestSites: Array.isArray(data.interestSites)
      ? data.interestSites.map(String)
      : defaults.interestSites,
    oppositionProfiles: mapSocialHandles(data.oppositionProfiles),
    oppositionSites: Array.isArray(data.oppositionSites)
      ? data.oppositionSites.map(String)
      : defaults.oppositionSites,
    glossaryTerms: Array.isArray(data.glossaryTerms)
      ? data.glossaryTerms.map(String)
      : defaults.glossaryTerms,
    trainingReferenceLinks: Array.isArray(data.trainingReferenceLinks)
      ? data.trainingReferenceLinks.map(String)
      : defaults.trainingReferenceLinks,
    youtubeVideoUrl: String(data.youtubeVideoUrl ?? defaults.youtubeVideoUrl),
    avatarType: String(data.avatarType ?? defaults.avatarType),
    avatarVideoTopic: String(data.avatarVideoTopic ?? defaults.avatarVideoTopic),
    notificationEmail: String(data.notificationEmail ?? defaults.notificationEmail),
    avatarEmotions: Array.isArray(data.avatarEmotions)
      ? data.avatarEmotions.map(String)
      : defaults.avatarEmotions,
    voicePace: String(data.voicePace ?? defaults.voicePace),
    editingStyles: Array.isArray(data.editingStyles)
      ? data.editingStyles.map(String)
      : defaults.editingStyles,
    factCheckingSources: Array.isArray(data.factCheckingSources)
      ? data.factCheckingSources.map(String)
      : defaults.factCheckingSources,
    hardDataSources: Array.isArray(data.hardDataSources)
      ? data.hardDataSources.map(String)
      : defaults.hardDataSources,
    distributionChannels: Array.isArray(data.distributionChannels)
      ? data.distributionChannels.map(String)
      : defaults.distributionChannels,
    distributionWindows: Array.isArray(data.distributionWindows)
      ? data.distributionWindows.map(String)
      : defaults.distributionWindows,
    autoPublish: Boolean(data.autoPublish ?? defaults.autoPublish),
  });
}

function mergeWorkflowProfileConfig(
  base: Omit<PoliticianProfile, keyof WorkflowProfileConfig> & Partial<WorkflowProfileConfig>,
  workflow: WorkflowProfileConfig,
): PoliticianProfile {
  return {
    ...base,
    ...workflow,
  } as PoliticianProfile;
}

function mapProfileFromDoc(
  data: Record<string, unknown>,
  workflow?: WorkflowProfileConfig,
): PoliticianProfile {
  const base = {
    id: String(data.id),
    fullName: String(data.fullName ?? ""),
    role: String(data.role ?? ""),
    city: String(data.city ?? ""),
    state: String(data.state ?? ""),
    audience: String(data.audience ?? ""),
    spectrum: String(data.spectrum ?? ""),
    archetype: String(data.archetype ?? ""),
    voiceTones: Array.isArray(data.voiceTones) ? data.voiceTones.map(String) : [],
    keyIssues: Array.isArray(data.keyIssues) ? data.keyIssues.map(String) : [],
    slogans: Array.isArray(data.slogans) ? data.slogans.map(String) : [],
    redLines: Array.isArray(data.redLines) ? data.redLines.map(String) : [],
    referenceExamples: Array.isArray(data.referenceExamples)
      ? data.referenceExamples.map(String)
      : [],
    bio: String(data.bio ?? ""),
    updatedAt: String(data.updatedAt ?? nowIso()),
  };

  return mergeWorkflowProfileConfig(base, workflow ?? buildDefaultWorkflowProfileConfig());
}

function mapTrainingAssetFromDoc(id: string, data: Record<string, unknown>): ProfileTrainingAsset {
  return {
    id,
    profileId: data.profileId == null ? null : String(data.profileId),
    draftProfileId: data.draftProfileId == null ? null : String(data.draftProfileId),
    sourceType: String(data.sourceType ?? "upload") as ProfileTrainingAsset["sourceType"],
    trainingRole: String(data.trainingRole ?? "dataset") as ProfileTrainingAsset["trainingRole"],
    storageProvider: "firebase",
    storageBucket: data.storageBucket == null ? null : String(data.storageBucket),
    storagePath: String(data.storagePath ?? ""),
    originalFilename: String(data.originalFilename ?? ""),
    mimeType: String(data.mimeType ?? "application/octet-stream"),
    sizeBytes: Number(data.sizeBytes ?? 0),
    status: String(data.status ?? "uploaded") as ProfileTrainingAsset["status"],
    errorMessage: String(data.errorMessage ?? ""),
    createdAt: String(data.createdAt ?? nowIso()),
    updatedAt: String(data.updatedAt ?? nowIso()),
  };
}

function mapContentRequestFromDoc(id: string, data: Record<string, unknown>): ContentRequest {
  return {
    id,
    topic: String(data.topic ?? ""),
    objective: String(data.objective ?? ""),
    format: data.format as ContentRequest["format"],
    intensity: data.intensity as ContentRequest["intensity"],
    context: String(data.context ?? ""),
    keyFacts: Array.isArray(data.keyFacts) ? data.keyFacts.map(String) : [],
    desiredCallToAction: String(data.desiredCallToAction ?? ""),
    mandatoryTerms: Array.isArray(data.mandatoryTerms)
      ? data.mandatoryTerms.map(String)
      : [],
    createdAt: String(data.createdAt ?? nowIso()),
  };
}

function mapGeneratedContentFromDoc(
  id: string,
  data: Record<string, unknown>,
): GeneratedContent {
  return {
    id,
    contentRequestId: String(data.contentRequestId ?? ""),
    title: String(data.title ?? ""),
    angle: String(data.angle ?? ""),
    body: String(data.body ?? ""),
    status: data.status as GeneratedContent["status"],
    promptPreview: String(data.promptPreview ?? ""),
    provider: String(data.provider ?? ""),
    createdAt: String(data.createdAt ?? nowIso()),
    updatedAt: String(data.updatedAt ?? nowIso()),
  };
}

function mapFeedbackFromDoc(id: string, data: Record<string, unknown>): ContentFeedback {
  return {
    id,
    generatedContentId: String(data.generatedContentId ?? ""),
    note: String(data.note ?? ""),
    createdAt: String(data.createdAt ?? nowIso()),
  };
}

function mapEvaluationRunFromDoc(id: string, data: Record<string, unknown>): EvaluationRun {
  return {
    id,
    contentRequestId:
      data.contentRequestId == null ? null : String(data.contentRequestId),
    profileId: data.profileId == null ? null : String(data.profileId),
    mode: String(data.mode) as EvaluationRun["mode"],
    status: String(data.status) as EvaluationRun["status"],
    primaryProvider: String(data.primaryProvider ?? ""),
    primaryModel: String(data.primaryModel ?? ""),
    judgeProvider: String(data.judgeProvider ?? ""),
    judgeModel: String(data.judgeModel ?? ""),
    winnerCandidateId:
      data.winnerCandidateId == null ? null : String(data.winnerCandidateId),
    winnerRecommendation: String(data.winnerRecommendation ?? ""),
    judgeSummary: String(data.judgeSummary ?? ""),
    errorMessage: String(data.errorMessage ?? ""),
    createdAt: String(data.createdAt ?? nowIso()),
    updatedAt: String(data.updatedAt ?? nowIso()),
  };
}

function mapEvaluationCandidateFromDoc(
  id: string,
  data: Record<string, unknown>,
): EvaluationCandidate {
  return {
    id,
    evaluationRunId: String(data.evaluationRunId ?? ""),
    contentRequestId:
      data.contentRequestId == null ? null : String(data.contentRequestId),
    generatedContentIds: Array.isArray(data.generatedContentIds)
      ? data.generatedContentIds.map(String)
      : [],
    role: String(data.role) as EvaluationCandidate["role"],
    provider: String(data.provider ?? ""),
    model: String(data.model ?? ""),
    promptVersion: String(data.promptVersion ?? ""),
    templateId: String(data.templateId ?? ""),
    latencyMs: Number(data.latencyMs ?? 0),
    promptPreview: String(data.promptPreview ?? ""),
    rawResponse: String(data.rawResponse ?? ""),
    tokenUsage:
      data.tokenUsage && typeof data.tokenUsage === "object"
        ? {
            inputTokens: Number(
              (data.tokenUsage as Record<string, unknown>).inputTokens ?? 0,
            ),
            outputTokens: Number(
              (data.tokenUsage as Record<string, unknown>).outputTokens ?? 0,
            ),
            totalTokens: Number(
              (data.tokenUsage as Record<string, unknown>).totalTokens ?? 0,
            ),
          }
        : null,
    outputVariants: Array.isArray(data.outputVariants)
      ? data.outputVariants.map((item) => ({
          title: String((item as Record<string, unknown>).title ?? ""),
          angle: String((item as Record<string, unknown>).angle ?? ""),
          body: String((item as Record<string, unknown>).body ?? ""),
        }))
      : [],
    status: String(data.status) as EvaluationCandidate["status"],
    createdAt: String(data.createdAt ?? nowIso()),
  };
}

function mapEvaluationScoreFromDoc(
  id: string,
  data: Record<string, unknown>,
): EvaluationScore {
  return {
    id,
    evaluationRunId: String(data.evaluationRunId ?? ""),
    candidateId: String(data.candidateId ?? ""),
    criterion: String(data.criterion) as EvaluationScore["criterion"],
    score: Number(data.score),
    rationale: String(data.rationale ?? ""),
    verdict: String(data.verdict ?? ""),
    createdAt: String(data.createdAt ?? nowIso()),
  };
}

function buildEvaluationReport(
  run: EvaluationRun,
  candidates: EvaluationCandidate[],
  scores: EvaluationScore[],
): EvaluationReport {
  const candidateReports = candidates.map((candidate) => {
    const candidateScores = scores.filter(
      (score) => score.candidateId === candidate.id,
    );
    const overall =
      candidateScores.find((score) => score.criterion === "overall")?.score ??
      (candidateScores.length
        ? candidateScores.reduce((sum, score) => sum + score.score, 0) /
          candidateScores.length
        : 0);

    return {
      ...candidate,
      scores: candidateScores,
      totalScore: Number(overall.toFixed(2)),
    };
  });

  const winner =
    candidateReports.find((candidate) => candidate.id === run.winnerCandidateId) ??
    candidateReports.sort((left, right) => right.totalScore - left.totalScore)[0] ??
    null;

  return {
    run,
    candidates: candidateReports,
    winner,
  };
}

function emptyDashboardData(): DashboardData {
  return {
    profile: null,
    trainingAssets: [],
    contentRequests: [],
    generatedContents: [],
    feedback: [],
    evaluationRuns: [],
    evaluationCandidates: [],
    evaluationScores: [],
  };
}

async function fetchProfileForOwner(
  ownerUserId: string | undefined,
): Promise<PoliticianProfile | null> {
  let snap;
  if (ownerUserId) {
    snap = await col(COLLECTIONS.politicianProfiles)
      .where("ownerUserId", "==", ownerUserId)
      .limit(1)
      .get();
  } else {
    snap = await col(COLLECTIONS.politicianProfiles)
      .orderBy("updatedAt", "desc")
      .limit(1)
      .get();
  }

  if (snap.empty) {
    return null;
  }

  const doc = snap.docs[0];
  const data = { id: doc.id, ...doc.data() };
  const workflowSnap = await col(COLLECTIONS.mandateWorkflowConfigs).doc(doc.id).get();
  const workflow = mapWorkflowFromDoc(
    workflowSnap.exists ? (workflowSnap.data() as Record<string, unknown>) : undefined,
  );
  return mapProfileFromDoc(data, workflow);
}

async function resolveProfileIdForSave(
  ownerUserId: string | undefined,
  inputId: string | undefined,
  existingId: string | undefined,
) {
  if (existingId) {
    if (inputId && inputId !== existingId) {
      throw new Error("Nao e permitido salvar o perfil de outro usuario.");
    }
    return existingId;
  }

  if (!inputId) {
    return crypto.randomUUID();
  }

  if (!ownerUserId) {
    return inputId;
  }

  const existing = await col(COLLECTIONS.politicianProfiles).doc(inputId).get();
  if (existing.exists) {
    const data = existing.data() as { ownerUserId?: string } | undefined;
    if (data?.ownerUserId && data.ownerUserId !== ownerUserId) {
      return crypto.randomUUID();
    }
  }

  return inputId;
}

async function queryDocsByField(
  collectionName: typeof COLLECTIONS[keyof typeof COLLECTIONS],
  field: string,
  value: string,
  orderField?: string,
  limit?: number,
) {
  let query = col(collectionName).where(field, "==", value);
  if (orderField) {
    query = query.orderBy(orderField, "desc");
  }
  if (limit) {
    query = query.limit(limit);
  }
  const snap = await query.get();
  return snap.docs;
}

const firestoreRepository: Repository = {
  async getDashboard() {
    const ownerUserId = getStorageOwnerUserId();
    const profile = await fetchProfileForOwner(ownerUserId);

    if (ownerUserId && !profile) {
      return emptyDashboardData();
    }

    if (!profile) {
      return emptyDashboardData();
    }

    const [
      trainingSnap,
      requestsSnap,
      evalRunsSnap,
    ] = await Promise.all([
      col(COLLECTIONS.profileTrainingAssets)
        .where("profileId", "==", profile.id)
        .orderBy("createdAt", "desc")
        .get(),
      col(COLLECTIONS.contentRequests)
        .where("profileId", "==", profile.id)
        .orderBy("createdAt", "desc")
        .get(),
      col(COLLECTIONS.evaluationRuns)
        .where("profileId", "==", profile.id)
        .orderBy("createdAt", "desc")
        .limit(50)
        .get(),
    ]);

    const contentRequests = requestsSnap.docs.map((doc) =>
      mapContentRequestFromDoc(doc.id, doc.data() as Record<string, unknown>),
    );
    const requestIds = contentRequests.map((item) => item.id);

    const generatedContents: GeneratedContent[] = [];
    const feedback: ContentFeedback[] = [];

    // Firestore `in` queries are capped at 10; chunk request ids.
    for (let i = 0; i < requestIds.length; i += 10) {
      const chunk = requestIds.slice(i, i + 10);
      if (chunk.length === 0) continue;
      const genSnap = await col(COLLECTIONS.generatedContents)
        .where("contentRequestId", "in", chunk)
        .get();
      for (const doc of genSnap.docs) {
        generatedContents.push(
          mapGeneratedContentFromDoc(doc.id, doc.data() as Record<string, unknown>),
        );
      }
    }

    const contentIds = generatedContents.map((item) => item.id);
    for (let i = 0; i < contentIds.length; i += 10) {
      const chunk = contentIds.slice(i, i + 10);
      if (chunk.length === 0) continue;
      const fbSnap = await col(COLLECTIONS.contentFeedback)
        .where("generatedContentId", "in", chunk)
        .get();
      for (const doc of fbSnap.docs) {
        feedback.push(mapFeedbackFromDoc(doc.id, doc.data() as Record<string, unknown>));
      }
    }

    const evaluationRuns = evalRunsSnap.docs.map((doc) =>
      mapEvaluationRunFromDoc(doc.id, doc.data() as Record<string, unknown>),
    );
    const runIds = evaluationRuns.map((item) => item.id);
    const evaluationCandidates: EvaluationCandidate[] = [];
    const evaluationScores: EvaluationScore[] = [];

    for (let i = 0; i < runIds.length; i += 10) {
      const chunk = runIds.slice(i, i + 10);
      if (chunk.length === 0) continue;
      const [candSnap, scoreSnap] = await Promise.all([
        col(COLLECTIONS.evaluationCandidates)
          .where("evaluationRunId", "in", chunk)
          .get(),
        col(COLLECTIONS.evaluationScores)
          .where("evaluationRunId", "in", chunk)
          .get(),
      ]);
      for (const doc of candSnap.docs) {
        evaluationCandidates.push(
          mapEvaluationCandidateFromDoc(doc.id, doc.data() as Record<string, unknown>),
        );
      }
      for (const doc of scoreSnap.docs) {
        evaluationScores.push(
          mapEvaluationScoreFromDoc(doc.id, doc.data() as Record<string, unknown>),
        );
      }
    }

    return {
      profile,
      trainingAssets: trainingSnap.docs.map((doc) =>
        mapTrainingAssetFromDoc(doc.id, doc.data() as Record<string, unknown>),
      ),
      contentRequests,
      generatedContents: generatedContents.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
      feedback: feedback.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
      evaluationRuns,
      evaluationCandidates,
      evaluationScores,
    };
  },

  async getContentRequestById(id) {
    const snap = await col(COLLECTIONS.contentRequests).doc(id).get();
    if (!snap.exists) {
      return null;
    }

    const data = snap.data() as Record<string, unknown>;
    const ownerUserId = getStorageOwnerUserId();
    if (ownerUserId) {
      const profile = await fetchProfileForOwner(ownerUserId);
      if (!profile) {
        return null;
      }
      const requestProfileId = data.profileId ? String(data.profileId) : null;
      if (requestProfileId && requestProfileId !== profile.id) {
        return null;
      }
    }

    return mapContentRequestFromDoc(snap.id, data);
  },

  async getGeneratedContentsByRequestId(contentRequestId) {
    const docs = await queryDocsByField(
      COLLECTIONS.generatedContents,
      "contentRequestId",
      contentRequestId,
      "createdAt",
    );
    return docs
      .map((doc) => mapGeneratedContentFromDoc(doc.id, doc.data() as Record<string, unknown>))
      .sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
  },

  async saveProfile(input) {
    const ownerUserId = getStorageOwnerUserId();
    const existing = await fetchProfileForOwner(ownerUserId);
    const profileId = await resolveProfileIdForSave(
      ownerUserId,
      input.id,
      existing?.id,
    );
    const updatedAt = nowIso();

    const profileDoc: ProfileDoc = {
      id: profileId,
      ...(ownerUserId ? { ownerUserId } : {}),
      fullName: input.fullName,
      role: input.role,
      city: input.city,
      state: input.state.toUpperCase(),
      audience: input.audience,
      spectrum: input.spectrum,
      archetype: input.archetype,
      voiceTones: input.voiceTones,
      keyIssues: input.keyIssues,
      slogans: input.slogans,
      redLines: input.redLines,
      referenceExamples: input.referenceExamples,
      bio: input.bio,
      updatedAt,
    };

    const workflow = pickWorkflowProfileConfig(input as Partial<PoliticianProfile>);
    const workflowDoc = {
      profileId,
      ...workflow,
      sentinelThemes: unionSentinelThemes({
        federal: input.sentinelThemesFederal ?? [],
        estadual: input.sentinelThemesEstadual ?? [],
      }),
      sentinelThemesFederal: input.sentinelThemesFederal ?? [],
      sentinelThemesEstadual: input.sentinelThemesEstadual ?? [],
      updatedAt,
    };

    await col(COLLECTIONS.politicianProfiles).doc(profileId).set(profileDoc, { merge: true });
    await col(COLLECTIONS.mandateWorkflowConfigs).doc(profileId).set(workflowDoc, {
      merge: true,
    });

    await this.attachDraftTrainingAssets(profileId, profileId);

    return mergeWorkflowProfileConfig(
      {
        id: profileId,
        fullName: profileDoc.fullName,
        role: profileDoc.role,
        city: profileDoc.city,
        state: profileDoc.state,
        audience: profileDoc.audience,
        spectrum: profileDoc.spectrum,
        archetype: profileDoc.archetype,
        voiceTones: profileDoc.voiceTones,
        keyIssues: profileDoc.keyIssues,
        slogans: profileDoc.slogans,
        redLines: profileDoc.redLines,
        referenceExamples: profileDoc.referenceExamples,
        bio: profileDoc.bio,
        updatedAt,
      },
      mapWorkflowFromDoc(workflowDoc),
    );
  },

  async createTrainingAssets(items) {
    const timestamp = nowIso();
    const assets = items.map<ProfileTrainingAsset>((item) => ({
      id: crypto.randomUUID(),
      profileId: item.profileId ?? null,
      draftProfileId: item.draftProfileId ?? null,
      sourceType: item.sourceType,
      trainingRole: item.trainingRole,
      storageProvider: "firebase",
      storageBucket: item.storageBucket ?? null,
      storagePath: item.storagePath,
      originalFilename: item.originalFilename,
      mimeType: item.mimeType,
      sizeBytes: item.sizeBytes,
      status: item.status,
      errorMessage: item.errorMessage ?? "",
      createdAt: timestamp,
      updatedAt: timestamp,
    }));

    const batch = col(COLLECTIONS.profileTrainingAssets).firestore.batch();
    for (const asset of assets) {
      batch.set(col(COLLECTIONS.profileTrainingAssets).doc(asset.id), asset);
    }
    await batch.commit();
    return assets;
  },

  async listTrainingAssetsByProfile(profileId) {
    const docs = await queryDocsByField(
      COLLECTIONS.profileTrainingAssets,
      "profileId",
      profileId,
      "createdAt",
    );
    return docs.map((doc) =>
      mapTrainingAssetFromDoc(doc.id, doc.data() as Record<string, unknown>),
    );
  },

  async listTrainingAssetsForReference(referenceId) {
    const [byProfile, byDraft] = await Promise.all([
      queryDocsByField(
        COLLECTIONS.profileTrainingAssets,
        "profileId",
        referenceId,
        "createdAt",
      ),
      queryDocsByField(
        COLLECTIONS.profileTrainingAssets,
        "draftProfileId",
        referenceId,
        "createdAt",
      ),
    ]);

    const map = new Map<string, ProfileTrainingAsset>();
    for (const doc of [...byProfile, ...byDraft]) {
      map.set(doc.id, mapTrainingAssetFromDoc(doc.id, doc.data() as Record<string, unknown>));
    }
    return Array.from(map.values());
  },

  async getTrainingAssetById(id) {
    const snap = await col(COLLECTIONS.profileTrainingAssets).doc(id).get();
    if (!snap.exists) {
      return null;
    }
    return mapTrainingAssetFromDoc(snap.id, snap.data() as Record<string, unknown>);
  },

  async deleteTrainingAsset(id) {
    const asset = await this.getTrainingAssetById(id);
    if (!asset) {
      return;
    }

    await col(COLLECTIONS.profileTrainingAssets).doc(id).delete();

    try {
      await deleteTrainingAssetObject({
        storageProvider: asset.storageProvider,
        storageBucket: asset.storageBucket,
        storagePath: asset.storagePath,
      });
    } catch {
      // Registro já removido; falha no blob não bloqueia.
    }
  },

  async attachDraftTrainingAssets(profileId, draftProfileId) {
    const docs = await queryDocsByField(
      COLLECTIONS.profileTrainingAssets,
      "draftProfileId",
      draftProfileId,
    );
    const attached: ProfileTrainingAsset[] = [];
    const timestamp = nowIso();
    const batch = col(COLLECTIONS.profileTrainingAssets).firestore.batch();

    for (const doc of docs) {
      const updated = {
        ...mapTrainingAssetFromDoc(doc.id, doc.data() as Record<string, unknown>),
        profileId,
        draftProfileId: null,
        updatedAt: timestamp,
      };
      batch.set(doc.ref, updated, { merge: true });
      attached.push(updated);
    }

    if (attached.length > 0) {
      await batch.commit();
    }
    return attached;
  },

  async createContentRequest(input) {
    const ownerUserId = getStorageOwnerUserId();
    const profile = ownerUserId ? await fetchProfileForOwner(ownerUserId) : null;

    if (ownerUserId && !profile) {
      throw new Error("Salve o perfil antes de criar pautas de conteudo.");
    }

    const request: ContentRequestDoc = {
      id: crypto.randomUUID(),
      ...(profile ? { profileId: profile.id } : {}),
      topic: input.topic,
      objective: input.objective,
      format: input.format,
      intensity: input.intensity,
      context: input.context,
      keyFacts: input.keyFacts,
      desiredCallToAction: input.desiredCallToAction,
      mandatoryTerms: input.mandatoryTerms,
      createdAt: nowIso(),
    };

    await col(COLLECTIONS.contentRequests).doc(request.id).set(request);
    return mapContentRequestFromDoc(request.id, request as unknown as Record<string, unknown>);
  },

  async createGeneratedContents(contentRequestId, items) {
    const timestamp = nowIso();
    const generated = items.map<GeneratedContent>((item) => ({
      id: crypto.randomUUID(),
      contentRequestId,
      title: item.title,
      angle: item.angle,
      body: item.body,
      promptPreview: item.promptPreview,
      provider: item.provider,
      status: "rascunho",
      createdAt: timestamp,
      updatedAt: timestamp,
    }));

    const batch = col(COLLECTIONS.generatedContents).firestore.batch();
    for (const item of generated) {
      batch.set(col(COLLECTIONS.generatedContents).doc(item.id), item);
    }
    await batch.commit();
    return generated;
  },

  async updateGeneratedContent(id, input) {
    const ref = col(COLLECTIONS.generatedContents).doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new Error("Conteudo nao encontrado.");
    }

    const current = mapGeneratedContentFromDoc(
      snap.id,
      snap.data() as Record<string, unknown>,
    );
    const updated: GeneratedContent = {
      ...current,
      body: input.body ?? current.body,
      status: input.status ?? current.status,
      updatedAt: nowIso(),
    };
    await ref.set(updated, { merge: true });
    return updated;
  },

  async addFeedback(generatedContentId, input) {
    const feedback: ContentFeedback = {
      id: crypto.randomUUID(),
      generatedContentId,
      note: input.note,
      createdAt: nowIso(),
    };
    await col(COLLECTIONS.contentFeedback).doc(feedback.id).set(feedback);
    return feedback;
  },

  async createEvaluationRun(input) {
    const timestamp = nowIso();
    const run: EvaluationRun = {
      id: crypto.randomUUID(),
      contentRequestId: input.contentRequestId ?? null,
      profileId: input.profileId ?? null,
      mode: input.mode,
      status: input.status,
      primaryProvider: input.primaryProvider,
      primaryModel: input.primaryModel,
      judgeProvider: input.judgeProvider,
      judgeModel: input.judgeModel,
      winnerCandidateId: input.winnerCandidateId ?? null,
      winnerRecommendation: input.winnerRecommendation,
      judgeSummary: input.judgeSummary,
      errorMessage: input.errorMessage,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await col(COLLECTIONS.evaluationRuns).doc(run.id).set(run);
    return run;
  },

  async updateEvaluationRun(id, input) {
    const ref = col(COLLECTIONS.evaluationRuns).doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new Error("Run de avaliacao nao encontrado.");
    }

    const current = mapEvaluationRunFromDoc(
      snap.id,
      snap.data() as Record<string, unknown>,
    );
    const updated: EvaluationRun = {
      ...current,
      status: input.status,
      winnerCandidateId: input.winnerCandidateId ?? current.winnerCandidateId,
      winnerRecommendation:
        input.winnerRecommendation ?? current.winnerRecommendation,
      judgeSummary: input.judgeSummary ?? current.judgeSummary,
      errorMessage: input.errorMessage ?? current.errorMessage,
      judgeProvider: input.judgeProvider ?? current.judgeProvider,
      judgeModel: input.judgeModel ?? current.judgeModel,
      updatedAt: nowIso(),
    };
    await ref.set(updated, { merge: true });
    return updated;
  },

  async createEvaluationCandidates(items) {
    const timestamp = nowIso();
    const candidates = items.map<EvaluationCandidate>((item) => ({
      id: crypto.randomUUID(),
      evaluationRunId: item.evaluationRunId,
      contentRequestId: item.contentRequestId ?? null,
      generatedContentIds: item.generatedContentIds,
      role: item.role,
      provider: item.provider,
      model: item.model,
      promptVersion: item.promptVersion,
      templateId: item.templateId,
      latencyMs: item.latencyMs,
      promptPreview: item.promptPreview,
      rawResponse: item.rawResponse,
      tokenUsage: item.tokenUsage,
      outputVariants: item.outputVariants,
      status: item.status,
      createdAt: timestamp,
    }));

    const batch = col(COLLECTIONS.evaluationCandidates).firestore.batch();
    for (const candidate of candidates) {
      batch.set(col(COLLECTIONS.evaluationCandidates).doc(candidate.id), candidate);
    }
    await batch.commit();
    return candidates;
  },

  async createEvaluationScores(evaluationRunId, candidateId, scores) {
    const timestamp = nowIso();
    const created = scores.map<EvaluationScore>((score) => ({
      id: crypto.randomUUID(),
      evaluationRunId,
      candidateId,
      criterion: score.criterion,
      score: score.score,
      rationale: score.rationale,
      verdict: score.verdict,
      createdAt: timestamp,
    }));

    const batch = col(COLLECTIONS.evaluationScores).firestore.batch();
    for (const score of created) {
      batch.set(col(COLLECTIONS.evaluationScores).doc(score.id), score);
    }
    await batch.commit();
    return created;
  },

  async getEvaluationReport(runId) {
    const runSnap = await col(COLLECTIONS.evaluationRuns).doc(runId).get();
    if (!runSnap.exists) {
      return null;
    }

    const run = mapEvaluationRunFromDoc(
      runSnap.id,
      runSnap.data() as Record<string, unknown>,
    );
    const [candDocs, scoreDocs] = await Promise.all([
      queryDocsByField(COLLECTIONS.evaluationCandidates, "evaluationRunId", runId),
      queryDocsByField(COLLECTIONS.evaluationScores, "evaluationRunId", runId),
    ]);

    return buildEvaluationReport(
      run,
      candDocs.map((doc) =>
        mapEvaluationCandidateFromDoc(doc.id, doc.data() as Record<string, unknown>),
      ),
      scoreDocs.map((doc) =>
        mapEvaluationScoreFromDoc(doc.id, doc.data() as Record<string, unknown>),
      ),
    );
  },

  async listEvaluationReports(limit = 20) {
    const ownerUserId = getStorageOwnerUserId();
    const profile = await fetchProfileForOwner(ownerUserId);

    let runsSnap;
    if (profile) {
      runsSnap = await col(COLLECTIONS.evaluationRuns)
        .where("profileId", "==", profile.id)
        .orderBy("createdAt", "desc")
        .limit(limit)
        .get();
    } else {
      runsSnap = await col(COLLECTIONS.evaluationRuns)
        .orderBy("createdAt", "desc")
        .limit(limit)
        .get();
    }

    const reports: EvaluationReport[] = [];
    for (const doc of runsSnap.docs) {
      const report = await this.getEvaluationReport(doc.id);
      if (report) {
        reports.push(report);
      }
    }
    return reports;
  },
};

export function getRepository(): Repository {
  return firestoreRepository;
}

export async function storeTrainingAssetBytes(input: {
  referenceId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  buffer: Buffer;
}): Promise<StoredTrainingAssetFile> {
  const mimeType = input.mimeType || "application/octet-stream";
  const uploaded = await uploadTrainingAssetBuffer({
    referenceId: input.referenceId,
    filename: input.filename,
    buffer: input.buffer,
    mimeType,
  });

  return {
    storageProvider: uploaded.storageProvider,
    storageBucket: uploaded.storageBucket,
    storagePath: uploaded.storagePath,
    originalFilename: input.filename,
    mimeType,
    sizeBytes: input.sizeBytes,
  };
}

export async function storeTrainingAssetFile(input: {
  referenceId: string;
  file: File;
}): Promise<StoredTrainingAssetFile> {
  const mimeType = input.file.type || "application/octet-stream";
  const arrayBuffer = await input.file.arrayBuffer();

  return storeTrainingAssetBytes({
    referenceId: input.referenceId,
    filename: input.file.name,
    mimeType,
    sizeBytes: input.file.size,
    buffer: Buffer.from(arrayBuffer),
  });
}

export async function deleteTrainingAssetFile(input: {
  storageProvider: StoredTrainingAssetFile["storageProvider"];
  storageBucket: string | null;
  storagePath: string;
}) {
  await deleteTrainingAssetObject(input);
}
