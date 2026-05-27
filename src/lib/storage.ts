import { promises as fs } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import type {
  ContentRequestInput,
  EvaluationCandidateCreateInput,
  EvaluationRunCreateInput,
  EvaluationRunUpdateInput,
  EvaluationScoreInput,
  FeedbackInput,
  GeneratedContentUpdateInput,
  ProfileInput,
  ProductFeedbackAnalysis,
  ProductFeedbackInput,
  TrainingAssetCreateInput,
} from "@/lib/schemas";
import type {
  AppDatabase,
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
  ProductFeedback,
  SocialHandle,
} from "@/lib/types";

const DATABASE_PATH = path.join(process.cwd(), "data", "mandato-digital.json");
const LOCAL_TRAINING_ASSET_DIR = path.join(process.cwd(), "data", "training-assets");
const DEFAULT_TRAINING_ASSET_BUCKET = "persona-training-videos";

const EMPTY_DATABASE: AppDatabase = {
  profile: null,
  trainingAssets: [],
  contentRequests: [],
  generatedContents: [],
  feedback: [],
  productFeedbacks: [],
  evaluationRuns: [],
  evaluationCandidates: [],
  evaluationScores: [],
};

type GeneratedContentSeed = Pick<
  GeneratedContent,
  "title" | "angle" | "body" | "promptPreview" | "provider"
>;

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
  updateProfileArgilTraining(
    profileId: string,
    input: {
      argilAvatarId: string;
      argilVoiceId: string;
      avatarTrainingStatus: string;
    },
  ): Promise<PoliticianProfile | null>;
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
  createProductFeedback(
    input: ProductFeedbackInput,
    analysis: ProductFeedbackAnalysis,
  ): Promise<ProductFeedback>;
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

function isMissingTableError(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "PGRST205",
  );
}

function isMissingSchemaFieldError(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error.code === "PGRST204" || error.code === "42703" || error.code === "42P01"),
  );
}

function isSchemaCompatibilityError(error: unknown) {
  return isMissingTableError(error) || isMissingSchemaFieldError(error);
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
    personaArchetypes: [],
    sentinelThemes: [],
    oppositionThemes: [],
    customRadarThemes: [],
    interestProfiles: [],
    interestSites: [],
    oppositionProfiles: [],
    oppositionSites: [],
    glossaryTerms: [],
    trainingReferenceLinks: [],
    youtubeVideoUrl: "",
    avatarType: "",
    avatarVideoTopic: "",
    argilAvatarId: "",
    argilVoiceId: "",
    avatarTrainingStatus: "" as PoliticianProfile["avatarTrainingStatus"],
    notificationEmail: "",
    avatarEmotions: [],
    voicePace: "Manter velocidade original",
    editingStyles: [],
    factCheckingSources: [],
    hardDataSources: [],
    distributionChannels: [],
    distributionWindows: [],
    autoPublish: false,
  };
}

function getTrainingAssetBucketName() {
  return process.env.SUPABASE_TRAINING_ASSETS_BUCKET || DEFAULT_TRAINING_ASSET_BUCKET;
}

function sanitizeFilename(filename: string) {
  return filename
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function buildTrainingAssetStoragePath(referenceId: string, filename: string) {
  const safeFilename = sanitizeFilename(filename) || "arquivo.bin";
  return `${referenceId}/${crypto.randomUUID()}-${safeFilename}`;
}

function pickWorkflowProfileConfig(
  profile: Partial<PoliticianProfile> | null | undefined,
) {
  const defaults = buildDefaultWorkflowProfileConfig();

  if (!profile) {
    return defaults;
  }

  return {
    personaArchetypes: profile.personaArchetypes ?? defaults.personaArchetypes,
    sentinelThemes: profile.sentinelThemes ?? defaults.sentinelThemes,
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
    argilAvatarId: profile.argilAvatarId ?? defaults.argilAvatarId,
    argilVoiceId: profile.argilVoiceId ?? defaults.argilVoiceId,
    avatarTrainingStatus:
      profile.avatarTrainingStatus ?? defaults.avatarTrainingStatus,
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
  };
}

function mapWorkflowProfileConfigRow(row: Record<string, unknown> | null | undefined) {
  const defaults = buildDefaultWorkflowProfileConfig();

  if (!row) {
    return defaults;
  }

  return {
    personaArchetypes: Array.isArray(row.persona_archetypes)
      ? row.persona_archetypes.map(String)
      : defaults.personaArchetypes,
    sentinelThemes: Array.isArray(row.sentinel_themes)
      ? row.sentinel_themes.map(String)
      : defaults.sentinelThemes,
    oppositionThemes: Array.isArray(row.opposition_themes)
      ? row.opposition_themes.map(String)
      : defaults.oppositionThemes,
    customRadarThemes: Array.isArray(row.custom_radar_themes)
      ? row.custom_radar_themes.map(String)
      : defaults.customRadarThemes,
    interestProfiles: mapSocialHandles(row.interest_profiles),
    interestSites: Array.isArray(row.interest_sites)
      ? row.interest_sites.map(String)
      : defaults.interestSites,
    oppositionProfiles: mapSocialHandles(row.opposition_profiles),
    oppositionSites: Array.isArray(row.opposition_sites)
      ? row.opposition_sites.map(String)
      : defaults.oppositionSites,
    glossaryTerms: Array.isArray(row.glossary_terms)
      ? row.glossary_terms.map(String)
      : defaults.glossaryTerms,
    trainingReferenceLinks: Array.isArray(row.training_reference_links)
      ? row.training_reference_links.map(String)
      : defaults.trainingReferenceLinks,
    youtubeVideoUrl: String(row.youtube_video_url ?? defaults.youtubeVideoUrl),
    avatarType: String(row.avatar_type ?? defaults.avatarType),
    avatarVideoTopic: String(row.avatar_video_topic ?? defaults.avatarVideoTopic),
    argilAvatarId: String(row.argil_avatar_id ?? defaults.argilAvatarId),
    argilVoiceId: String(row.argil_voice_id ?? defaults.argilVoiceId),
    avatarTrainingStatus: String(
      row.avatar_training_status ?? defaults.avatarTrainingStatus,
    ) as PoliticianProfile["avatarTrainingStatus"],
    notificationEmail: String(row.notification_email ?? defaults.notificationEmail),
    avatarEmotions: Array.isArray(row.avatar_emotions)
      ? row.avatar_emotions.map(String)
      : defaults.avatarEmotions,
    voicePace: String(row.voice_pace ?? defaults.voicePace),
    editingStyles: Array.isArray(row.editing_styles)
      ? row.editing_styles.map(String)
      : defaults.editingStyles,
    factCheckingSources: Array.isArray(row.fact_checking_sources)
      ? row.fact_checking_sources.map(String)
      : defaults.factCheckingSources,
    hardDataSources: Array.isArray(row.hard_data_sources)
      ? row.hard_data_sources.map(String)
      : defaults.hardDataSources,
    distributionChannels: Array.isArray(row.distribution_channels)
      ? row.distribution_channels.map(String)
      : defaults.distributionChannels,
    distributionWindows: Array.isArray(row.distribution_windows)
      ? row.distribution_windows.map(String)
      : defaults.distributionWindows,
    autoPublish: Boolean(row.auto_publish ?? defaults.autoPublish),
  };
}

function mergeWorkflowProfileConfig(
  profile: PoliticianProfile | null,
  config?: Partial<PoliticianProfile> | null,
): PoliticianProfile | null {
  if (!profile) {
    return null;
  }

  return {
    ...profile,
    ...pickWorkflowProfileConfig(config),
  };
}

async function ensureLocalDatabase() {
  await fs.mkdir(path.dirname(DATABASE_PATH), { recursive: true });

  try {
    await fs.access(DATABASE_PATH);
  } catch {
    await fs.writeFile(DATABASE_PATH, JSON.stringify(EMPTY_DATABASE, null, 2));
  }
}

async function ensureLocalTrainingAssetDir() {
  await fs.mkdir(LOCAL_TRAINING_ASSET_DIR, { recursive: true });
}

async function readLocalDatabase(): Promise<AppDatabase> {
  await ensureLocalDatabase();
  const raw = await fs.readFile(DATABASE_PATH, "utf8");

  if (!raw.trim()) {
    return structuredClone(EMPTY_DATABASE);
  }

  return {
    ...structuredClone(EMPTY_DATABASE),
    ...JSON.parse(raw),
  } as AppDatabase;
}

async function writeLocalDatabase(database: AppDatabase) {
  await ensureLocalDatabase();
  await fs.writeFile(DATABASE_PATH, JSON.stringify(database, null, 2));
}

function isSupabaseConfigured() {
  return Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sao obrigatorios.");
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
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

function mapProfileRow(row: Record<string, unknown>): PoliticianProfile {
  return {
    id: String(row.id),
    fullName: String(row.full_name ?? ""),
    role: String(row.role ?? ""),
    city: String(row.city ?? ""),
    state: String(row.state ?? ""),
    audience: String(row.audience ?? ""),
    spectrum: String(row.spectrum ?? ""),
    archetype: String(row.archetype ?? ""),
    voiceTones: Array.isArray(row.voice_tones)
      ? row.voice_tones.map(String)
      : [],
    keyIssues: Array.isArray(row.key_issues) ? row.key_issues.map(String) : [],
    slogans: Array.isArray(row.slogans) ? row.slogans.map(String) : [],
    redLines: Array.isArray(row.red_lines) ? row.red_lines.map(String) : [],
    referenceExamples: Array.isArray(row.reference_examples)
      ? row.reference_examples.map(String)
      : [],
    bio: String(row.bio ?? ""),
    ...buildDefaultWorkflowProfileConfig(),
    updatedAt: String(row.updated_at ?? nowIso()),
  };
}

function mapRequestRow(row: Record<string, unknown>): ContentRequest {
  return {
    id: String(row.id),
    topic: String(row.topic),
    objective: String(row.objective),
    format: row.format as ContentRequest["format"],
    intensity: row.intensity as ContentRequest["intensity"],
    context: String(row.context ?? ""),
    keyFacts: Array.isArray(row.key_facts) ? row.key_facts.map(String) : [],
    desiredCallToAction: String(row.desired_call_to_action ?? ""),
    mandatoryTerms: Array.isArray(row.mandatory_terms)
      ? row.mandatory_terms.map(String)
      : [],
    createdAt: String(row.created_at),
  };
}

function mapGeneratedContentRow(row: Record<string, unknown>): GeneratedContent {
  return {
    id: String(row.id),
    contentRequestId: String(row.content_request_id),
    title: String(row.title),
    angle: String(row.angle),
    body: String(row.body),
    status: row.status as GeneratedContent["status"],
    promptPreview: String(row.prompt_preview),
    provider: String(row.provider),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapFeedbackRow(row: Record<string, unknown>): ContentFeedback {
  return {
    id: String(row.id),
    generatedContentId: String(row.generated_content_id),
    note: String(row.note),
    createdAt: String(row.created_at),
  };
}

function mapProductFeedbackRow(row: Record<string, unknown>): ProductFeedback {
  return {
    id: String(row.id),
    screen: String(row.screen ?? ""),
    workedWell: String(row.worked_well ?? ""),
    issueObserved: String(row.issue_observed),
    classification: row.classification as ProductFeedback["classification"],
    criticality: row.criticality as ProductFeedback["criticality"],
    rationale: String(row.rationale),
    scopeAssessment: String(row.scope_assessment),
    suggestedAction: String(row.suggested_action),
    implementationPrompt: String(row.implementation_prompt ?? ""),
    provider: String(row.provider),
    createdAt: String(row.created_at),
  };
}

function mapTrainingAssetRow(row: Record<string, unknown>): ProfileTrainingAsset {
  return {
    id: String(row.id),
    profileId: row.profile_id === null ? null : String(row.profile_id),
    draftProfileId:
      row.draft_profile_id === null ? null : String(row.draft_profile_id),
    sourceType: String(row.source_type ?? "upload") as ProfileTrainingAsset["sourceType"],
    storageProvider: String(row.storage_provider ?? "local") as ProfileTrainingAsset["storageProvider"],
    storageBucket: row.storage_bucket === null ? null : String(row.storage_bucket),
    storagePath: String(row.storage_path ?? ""),
    originalFilename: String(row.original_filename ?? ""),
    mimeType: String(row.mime_type ?? "application/octet-stream"),
    sizeBytes: Number(row.size_bytes ?? 0),
    status: String(row.status ?? "uploaded") as ProfileTrainingAsset["status"],
    errorMessage: String(row.error_message ?? ""),
    createdAt: String(row.created_at ?? nowIso()),
    updatedAt: String(row.updated_at ?? nowIso()),
  };
}

function mapEvaluationRunRow(row: Record<string, unknown>): EvaluationRun {
  return {
    id: String(row.id),
    contentRequestId:
      row.content_request_id === null ? null : String(row.content_request_id),
    profileId: row.profile_id === null ? null : String(row.profile_id),
    mode: String(row.mode) as EvaluationRun["mode"],
    status: String(row.status) as EvaluationRun["status"],
    primaryProvider: String(row.primary_provider ?? ""),
    primaryModel: String(row.primary_model ?? ""),
    judgeProvider: String(row.judge_provider ?? ""),
    judgeModel: String(row.judge_model ?? ""),
    winnerCandidateId:
      row.winner_candidate_id === null ? null : String(row.winner_candidate_id),
    winnerRecommendation: String(row.winner_recommendation ?? ""),
    judgeSummary: String(row.judge_summary ?? ""),
    errorMessage: String(row.error_message ?? ""),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapEvaluationCandidateRow(
  row: Record<string, unknown>,
): EvaluationCandidate {
  return {
    id: String(row.id),
    evaluationRunId: String(row.evaluation_run_id),
    contentRequestId:
      row.content_request_id === null ? null : String(row.content_request_id),
    generatedContentIds: Array.isArray(row.generated_content_ids)
      ? row.generated_content_ids.map(String)
      : [],
    role: String(row.role) as EvaluationCandidate["role"],
    provider: String(row.provider),
    model: String(row.model ?? ""),
    promptVersion: String(row.prompt_version),
    templateId: String(row.template_id),
    latencyMs: Number(row.latency_ms ?? 0),
    promptPreview: String(row.prompt_preview),
    rawResponse: String(row.raw_response ?? ""),
    tokenUsage:
      row.token_usage && typeof row.token_usage === "object"
        ? {
            inputTokens: Number(
              (row.token_usage as Record<string, unknown>).inputTokens ?? 0,
            ),
            outputTokens: Number(
              (row.token_usage as Record<string, unknown>).outputTokens ?? 0,
            ),
            totalTokens: Number(
              (row.token_usage as Record<string, unknown>).totalTokens ?? 0,
            ),
          }
        : null,
    outputVariants: Array.isArray(row.output_variants)
      ? row.output_variants.map((item) => ({
          title: String((item as Record<string, unknown>).title ?? ""),
          angle: String((item as Record<string, unknown>).angle ?? ""),
          body: String((item as Record<string, unknown>).body ?? ""),
        }))
      : [],
    status: String(row.status) as EvaluationCandidate["status"],
    createdAt: String(row.created_at),
  };
}

function mapEvaluationScoreRow(row: Record<string, unknown>): EvaluationScore {
  return {
    id: String(row.id),
    evaluationRunId: String(row.evaluation_run_id),
    candidateId: String(row.candidate_id),
    criterion: String(row.criterion) as EvaluationScore["criterion"],
    score: Number(row.score),
    rationale: String(row.rationale),
    verdict: String(row.verdict ?? ""),
    createdAt: String(row.created_at),
  };
}

const localRepository: Repository = {
  async getDashboard() {
    return readLocalDatabase();
  },

  async getContentRequestById(id) {
    const database = await readLocalDatabase();
    return database.contentRequests.find((item) => item.id === id) ?? null;
  },

  async getGeneratedContentsByRequestId(contentRequestId) {
    const database = await readLocalDatabase();
    return database.generatedContents.filter(
      (item) => item.contentRequestId === contentRequestId,
    );
  },

  async saveProfile(input) {
    const database = await readLocalDatabase();
    const profile: PoliticianProfile = {
      id: input.id ?? database.profile?.id ?? crypto.randomUUID(),
      ...buildDefaultWorkflowProfileConfig(),
      ...input,
      updatedAt: nowIso(),
    };

    database.profile = profile;
    database.trainingAssets = database.trainingAssets.map((asset) =>
      asset.draftProfileId === profile.id
        ? {
            ...asset,
            profileId: profile.id,
            draftProfileId: null,
            updatedAt: nowIso(),
          }
        : asset,
    );
    await writeLocalDatabase(database);

    return profile;
  },

  async createTrainingAssets(items) {
    const database = await readLocalDatabase();
    const timestamp = nowIso();
    const assets = items.map<ProfileTrainingAsset>((item) => ({
      id: crypto.randomUUID(),
      profileId: item.profileId ?? null,
      draftProfileId: item.draftProfileId ?? null,
      sourceType: item.sourceType,
      storageProvider: item.storageProvider,
      storageBucket: item.storageBucket ?? null,
      storagePath: item.storagePath,
      originalFilename: item.originalFilename,
      mimeType: item.mimeType,
      sizeBytes: item.sizeBytes,
      status: item.status,
      errorMessage: item.errorMessage,
      createdAt: timestamp,
      updatedAt: timestamp,
    }));

    database.trainingAssets = [...assets, ...database.trainingAssets];
    await writeLocalDatabase(database);

    return assets;
  },

  async listTrainingAssetsByProfile(profileId) {
    const database = await readLocalDatabase();
    return database.trainingAssets.filter((item) => item.profileId === profileId);
  },

  async listTrainingAssetsForReference(referenceId) {
    const database = await readLocalDatabase();
    return database.trainingAssets.filter(
      (item) =>
        item.profileId === referenceId || item.draftProfileId === referenceId,
    );
  },

  async getTrainingAssetById(id) {
    const database = await readLocalDatabase();
    return database.trainingAssets.find((item) => item.id === id) ?? null;
  },

  async updateProfileArgilTraining(profileId, input) {
    const database = await readLocalDatabase();

    if (!database.profile || database.profile.id !== profileId) {
      return null;
    }

    database.profile = {
      ...database.profile,
      argilAvatarId: input.argilAvatarId,
      argilVoiceId: input.argilVoiceId,
      avatarTrainingStatus: input.avatarTrainingStatus as PoliticianProfile["avatarTrainingStatus"],
      updatedAt: nowIso(),
    };
    await writeLocalDatabase(database);
    return database.profile;
  },

  async attachDraftTrainingAssets(profileId, draftProfileId) {
    const database = await readLocalDatabase();
    const attached: ProfileTrainingAsset[] = [];

    database.trainingAssets = database.trainingAssets.map((asset) => {
      if (asset.draftProfileId !== draftProfileId) {
        return asset;
      }

      const updated = {
        ...asset,
        profileId,
        draftProfileId: null,
        updatedAt: nowIso(),
      };
      attached.push(updated);
      return updated;
    });

    await writeLocalDatabase(database);
    return attached;
  },

  async createContentRequest(input) {
    const database = await readLocalDatabase();
    const request: ContentRequest = {
      id: crypto.randomUUID(),
      ...input,
      createdAt: nowIso(),
    };

    database.contentRequests.unshift(request);
    await writeLocalDatabase(database);

    return request;
  },

  async createGeneratedContents(contentRequestId, items) {
    const database = await readLocalDatabase();
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

    database.generatedContents = [...generated, ...database.generatedContents];
    await writeLocalDatabase(database);

    return generated;
  },

  async updateGeneratedContent(id, input) {
    const database = await readLocalDatabase();
    const index = database.generatedContents.findIndex((item) => item.id === id);

    if (index === -1) {
      throw new Error("Conteudo nao encontrado.");
    }

    const current = database.generatedContents[index];
    const updated: GeneratedContent = {
      ...current,
      body: input.body ?? current.body,
      status: input.status ?? current.status,
      updatedAt: nowIso(),
    };

    database.generatedContents[index] = updated;
    await writeLocalDatabase(database);

    return updated;
  },

  async addFeedback(generatedContentId, input) {
    const database = await readLocalDatabase();
    const feedback: ContentFeedback = {
      id: crypto.randomUUID(),
      generatedContentId,
      note: input.note,
      createdAt: nowIso(),
    };

    database.feedback.unshift(feedback);
    await writeLocalDatabase(database);

    return feedback;
  },

  async createProductFeedback(input, analysis) {
    const database = await readLocalDatabase();
    const feedback: ProductFeedback = {
      id: crypto.randomUUID(),
      screen: input.screen,
      workedWell: input.workedWell,
      issueObserved: input.issueObserved,
      classification: analysis.classification,
      criticality: analysis.criticality,
      rationale: analysis.rationale,
      scopeAssessment: analysis.scopeAssessment,
      suggestedAction: analysis.suggestedAction,
      implementationPrompt: analysis.implementationPrompt,
      provider: analysis.provider,
      createdAt: nowIso(),
    };

    database.productFeedbacks.unshift(feedback);
    await writeLocalDatabase(database);

    return feedback;
  },

  async createEvaluationRun(input) {
    const database = await readLocalDatabase();
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

    database.evaluationRuns.unshift(run);
    await writeLocalDatabase(database);

    return run;
  },

  async updateEvaluationRun(id, input) {
    const database = await readLocalDatabase();
    const index = database.evaluationRuns.findIndex((item) => item.id === id);

    if (index === -1) {
      throw new Error("Run de avaliacao nao encontrado.");
    }

    const current = database.evaluationRuns[index];
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

    database.evaluationRuns[index] = updated;
    await writeLocalDatabase(database);

    return updated;
  },

  async createEvaluationCandidates(items) {
    const database = await readLocalDatabase();
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

    database.evaluationCandidates = [...candidates, ...database.evaluationCandidates];
    await writeLocalDatabase(database);

    return candidates;
  },

  async createEvaluationScores(evaluationRunId, candidateId, scores) {
    const database = await readLocalDatabase();
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

    database.evaluationScores = [...created, ...database.evaluationScores];
    await writeLocalDatabase(database);

    return created;
  },

  async getEvaluationReport(runId) {
    const database = await readLocalDatabase();
    const run = database.evaluationRuns.find((item) => item.id === runId);

    if (!run) {
      return null;
    }

    return buildEvaluationReport(
      run,
      database.evaluationCandidates.filter(
        (candidate) => candidate.evaluationRunId === runId,
      ),
      database.evaluationScores.filter((score) => score.evaluationRunId === runId),
    );
  },

  async listEvaluationReports(limit = 20) {
    const database = await readLocalDatabase();
    return database.evaluationRuns
      .slice(0, limit)
      .map((run) =>
        buildEvaluationReport(
          run,
          database.evaluationCandidates.filter(
            (candidate) => candidate.evaluationRunId === run.id,
          ),
          database.evaluationScores.filter(
            (score) => score.evaluationRunId === run.id,
          ),
        ),
      );
  },
};

const supabaseRepository: Repository = {
  async getDashboard() {
    const client = getSupabaseClient();
    const [
      profileRes,
      workflowConfigRes,
      trainingAssetsRes,
      requestRes,
      generatedRes,
      feedbackRes,
      productFeedbackRes,
      evaluationRunsRes,
      evaluationCandidatesRes,
      evaluationScoresRes,
    ] = await Promise.all([
      client
        .from("politician_profiles")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1),
      client
        .from("mandate_workflow_configs")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1),
      client
        .from("profile_training_assets")
        .select("*")
        .order("created_at", { ascending: false }),
      client.from("content_requests").select("*").order("created_at", { ascending: false }),
      client
        .from("generated_contents")
        .select("*")
        .order("created_at", { ascending: false }),
      client.from("content_feedback").select("*").order("created_at", { ascending: false }),
      client.from("product_feedback").select("*").order("created_at", { ascending: false }),
      client.from("evaluation_runs").select("*").order("created_at", { ascending: false }),
      client
        .from("evaluation_candidates")
        .select("*")
        .order("created_at", { ascending: true }),
      client.from("evaluation_scores").select("*").order("created_at", { ascending: true }),
    ]);

    if (profileRes.error) throw profileRes.error;
    if (workflowConfigRes.error && !isSchemaCompatibilityError(workflowConfigRes.error)) {
      throw workflowConfigRes.error;
    }
    if (trainingAssetsRes.error && !isSchemaCompatibilityError(trainingAssetsRes.error)) {
      throw trainingAssetsRes.error;
    }
    if (requestRes.error) throw requestRes.error;
    if (generatedRes.error) throw generatedRes.error;
    if (feedbackRes.error) throw feedbackRes.error;
    if (productFeedbackRes.error && !isSchemaCompatibilityError(productFeedbackRes.error)) {
      throw productFeedbackRes.error;
    }
    if (evaluationRunsRes.error && !isSchemaCompatibilityError(evaluationRunsRes.error)) {
      throw evaluationRunsRes.error;
    }
    if (
      evaluationCandidatesRes.error &&
      !isSchemaCompatibilityError(evaluationCandidatesRes.error)
    ) {
      throw evaluationCandidatesRes.error;
    }
    if (evaluationScoresRes.error && !isSchemaCompatibilityError(evaluationScoresRes.error)) {
      throw evaluationScoresRes.error;
    }

    const localDatabase =
      workflowConfigRes.error ||
      trainingAssetsRes.error ||
      productFeedbackRes.error ||
      evaluationRunsRes.error ||
      evaluationCandidatesRes.error ||
      evaluationScoresRes.error
        ? await readLocalDatabase()
        : null;

    const profile = mergeWorkflowProfileConfig(
      profileRes.data[0] ? mapProfileRow(profileRes.data[0]) : null,
      workflowConfigRes.error
        ? pickWorkflowProfileConfig(localDatabase?.profile ?? null)
        : mapWorkflowProfileConfigRow(workflowConfigRes.data[0]),
    );
    const trainingAssets = trainingAssetsRes.error
      ? localDatabase?.trainingAssets ?? []
      : trainingAssetsRes.data
          .filter(
            (asset) =>
              !profile ||
              asset.profile_id === profile.id ||
              asset.draft_profile_id === profile.id,
          )
          .map(mapTrainingAssetRow);

    return {
      profile,
      trainingAssets,
      contentRequests: requestRes.data.map(mapRequestRow),
      generatedContents: generatedRes.data.map(mapGeneratedContentRow),
      feedback: feedbackRes.data.map(mapFeedbackRow),
      productFeedbacks: productFeedbackRes.error
        ? localDatabase?.productFeedbacks ?? []
        : productFeedbackRes.data.map(mapProductFeedbackRow),
      evaluationRuns: evaluationRunsRes.error
        ? localDatabase?.evaluationRuns ?? []
        : evaluationRunsRes.data.map(mapEvaluationRunRow),
      evaluationCandidates: evaluationCandidatesRes.error
        ? localDatabase?.evaluationCandidates ?? []
        : evaluationCandidatesRes.data.map(mapEvaluationCandidateRow),
      evaluationScores: evaluationScoresRes.error
        ? localDatabase?.evaluationScores ?? []
        : evaluationScoresRes.data.map(mapEvaluationScoreRow),
    };
  },

  async getContentRequestById(id) {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("content_requests")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data ? mapRequestRow(data) : null;
  },

  async getGeneratedContentsByRequestId(contentRequestId) {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("generated_contents")
      .select("*")
      .eq("content_request_id", contentRequestId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return data.map(mapGeneratedContentRow);
  },

  async saveProfile(input) {
    const client = getSupabaseClient();
    const existing = await client
      .from("politician_profiles")
      .select("id")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing.error) throw existing.error;

    const payload = {
      id: input.id ?? existing.data?.id ?? crypto.randomUUID(),
      full_name: input.fullName,
      role: input.role,
      city: input.city,
      state: input.state.toUpperCase(),
      audience: input.audience,
      spectrum: input.spectrum,
      archetype: input.archetype,
      voice_tones: input.voiceTones,
      key_issues: input.keyIssues,
      slogans: input.slogans,
      red_lines: input.redLines,
      reference_examples: input.referenceExamples,
      bio: input.bio,
      updated_at: nowIso(),
    };

    const { data, error } = await client
      .from("politician_profiles")
      .upsert(payload)
      .select("*")
      .single();

    if (error) throw error;
    const baseProfile = mapProfileRow(data);
    const workflowPayload = {
      profile_id: baseProfile.id,
      persona_archetypes: input.personaArchetypes,
      sentinel_themes: input.sentinelThemes,
      opposition_themes: input.oppositionThemes,
      custom_radar_themes: input.customRadarThemes,
      interest_profiles: input.interestProfiles,
      interest_sites: input.interestSites,
      opposition_profiles: input.oppositionProfiles,
      opposition_sites: input.oppositionSites,
      glossary_terms: input.glossaryTerms,
      training_reference_links: input.trainingReferenceLinks,
      youtube_video_url: input.youtubeVideoUrl,
      avatar_type: input.avatarType,
      avatar_video_topic: input.avatarVideoTopic,
      argil_avatar_id: input.argilAvatarId,
      argil_voice_id: input.argilVoiceId,
      avatar_training_status: input.avatarTrainingStatus,
      notification_email: input.notificationEmail,
      avatar_emotions: input.avatarEmotions,
      voice_pace: input.voicePace,
      editing_styles: input.editingStyles,
      fact_checking_sources: input.factCheckingSources,
      hard_data_sources: input.hardDataSources,
      distribution_channels: input.distributionChannels,
      distribution_windows: input.distributionWindows,
      auto_publish: input.autoPublish,
      updated_at: payload.updated_at,
    };
    const workflowResult = await client
      .from("mandate_workflow_configs")
      .upsert(workflowPayload)
      .select("*")
      .single();

    if (workflowResult.error) {
      if (
        isSchemaCompatibilityError(workflowResult.error)
      ) {
        await localRepository.saveProfile(input);
        return mergeWorkflowProfileConfig(baseProfile, input) as PoliticianProfile;
      }

      throw workflowResult.error;
    }

    await this.attachDraftTrainingAssets(baseProfile.id, baseProfile.id);

    return mergeWorkflowProfileConfig(
      baseProfile,
      mapWorkflowProfileConfigRow(workflowResult.data),
    ) as PoliticianProfile;
  },

  async createTrainingAssets(items) {
    const client = getSupabaseClient();
    const timestamp = nowIso();
    const payload = items.map((item) => ({
      id: crypto.randomUUID(),
      profile_id: item.profileId ?? null,
      draft_profile_id: item.draftProfileId ?? null,
      source_type: item.sourceType,
      storage_provider: item.storageProvider,
      storage_bucket: item.storageBucket ?? null,
      storage_path: item.storagePath,
      original_filename: item.originalFilename,
      mime_type: item.mimeType,
      size_bytes: item.sizeBytes,
      status: item.status,
      error_message: item.errorMessage,
      created_at: timestamp,
      updated_at: timestamp,
    }));

    const { data, error } = await client
      .from("profile_training_assets")
      .insert(payload)
      .select("*");

    if (error) {
      if (isSchemaCompatibilityError(error)) {
        return localRepository.createTrainingAssets(items);
      }

      throw error;
    }

    return data.map(mapTrainingAssetRow);
  },

  async listTrainingAssetsByProfile(profileId) {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("profile_training_assets")
      .select("*")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false });

    if (error) {
      if (isSchemaCompatibilityError(error)) {
        return localRepository.listTrainingAssetsByProfile(profileId);
      }

      throw error;
    }

    return data.map(mapTrainingAssetRow);
  },

  async listTrainingAssetsForReference(referenceId) {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("profile_training_assets")
      .select("*")
      .or(`profile_id.eq.${referenceId},draft_profile_id.eq.${referenceId}`)
      .order("created_at", { ascending: false });

    if (error) {
      if (isSchemaCompatibilityError(error)) {
        return localRepository.listTrainingAssetsForReference(referenceId);
      }

      throw error;
    }

    return data.map(mapTrainingAssetRow);
  },

  async getTrainingAssetById(id) {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("profile_training_assets")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      if (isSchemaCompatibilityError(error)) {
        return localRepository.getTrainingAssetById(id);
      }

      throw error;
    }

    return data ? mapTrainingAssetRow(data) : null;
  },

  async updateProfileArgilTraining(profileId, input) {
    const client = getSupabaseClient();
    const timestamp = nowIso();
    const payload = {
      argil_avatar_id: input.argilAvatarId,
      argil_voice_id: input.argilVoiceId,
      avatar_training_status: input.avatarTrainingStatus,
      updated_at: timestamp,
    };

    const { data, error } = await client
      .from("mandate_workflow_configs")
      .update(payload)
      .eq("profile_id", profileId)
      .select("*")
      .maybeSingle();

    if (error) {
      if (isSchemaCompatibilityError(error)) {
        return localRepository.updateProfileArgilTraining(profileId, input);
      }

      throw error;
    }

    if (!data) {
      return localRepository.updateProfileArgilTraining(profileId, input);
    }

    const profileRes = await client
      .from("politician_profiles")
      .select("*")
      .eq("id", profileId)
      .maybeSingle();

    if (profileRes.error || !profileRes.data) {
      return localRepository.updateProfileArgilTraining(profileId, input);
    }

    return mergeWorkflowProfileConfig(
      mapProfileRow(profileRes.data),
      mapWorkflowProfileConfigRow(data),
    );
  },

  async attachDraftTrainingAssets(profileId, draftProfileId) {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("profile_training_assets")
      .update({
        profile_id: profileId,
        draft_profile_id: null,
        updated_at: nowIso(),
      })
      .eq("draft_profile_id", draftProfileId)
      .select("*");

    if (error) {
      if (isSchemaCompatibilityError(error)) {
        return localRepository.attachDraftTrainingAssets(profileId, draftProfileId);
      }

      throw error;
    }

    return data.map(mapTrainingAssetRow);
  },

  async createContentRequest(input) {
    const client = getSupabaseClient();
    const payload = {
      id: crypto.randomUUID(),
      topic: input.topic,
      objective: input.objective,
      format: input.format,
      intensity: input.intensity,
      context: input.context,
      key_facts: input.keyFacts,
      desired_call_to_action: input.desiredCallToAction,
      mandatory_terms: input.mandatoryTerms,
      created_at: nowIso(),
    };

    const { data, error } = await client
      .from("content_requests")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      if (isMissingSchemaFieldError(error)) {
        const fallbackPayload = {
          id: payload.id,
          topic: payload.topic,
          objective: payload.objective,
          format: payload.format,
          intensity: payload.intensity,
          context: payload.context,
          key_facts: payload.key_facts,
          desired_call_to_action: payload.desired_call_to_action,
          created_at: payload.created_at,
        };
        const fallbackInsert = await client
          .from("content_requests")
          .insert(fallbackPayload)
          .select("*")
          .single();

        if (fallbackInsert.error) throw fallbackInsert.error;

        return {
          ...mapRequestRow(fallbackInsert.data),
          mandatoryTerms: input.mandatoryTerms,
        };
      }

      throw error;
    }

    return mapRequestRow(data);
  },

  async createGeneratedContents(contentRequestId, items) {
    const client = getSupabaseClient();
    const timestamp = nowIso();
    const payload = items.map((item) => ({
      id: crypto.randomUUID(),
      content_request_id: contentRequestId,
      title: item.title,
      angle: item.angle,
      body: item.body,
      prompt_preview: item.promptPreview,
      provider: item.provider,
      status: "rascunho",
      created_at: timestamp,
      updated_at: timestamp,
    }));

    const { data, error } = await client
      .from("generated_contents")
      .insert(payload)
      .select("*");

    if (error) throw error;
    return data.map(mapGeneratedContentRow);
  },

  async updateGeneratedContent(id, input) {
    const client = getSupabaseClient();
    const payload: Record<string, string> = {
      updated_at: nowIso(),
    };

    if (input.body) {
      payload.body = input.body;
    }

    if (input.status) {
      payload.status = input.status;
    }

    const { data, error } = await client
      .from("generated_contents")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;
    return mapGeneratedContentRow(data);
  },

  async addFeedback(generatedContentId, input) {
    const client = getSupabaseClient();
    const payload = {
      id: crypto.randomUUID(),
      generated_content_id: generatedContentId,
      note: input.note,
      created_at: nowIso(),
    };

    const { data, error } = await client
      .from("content_feedback")
      .insert(payload)
      .select("*")
      .single();

    if (error) throw error;
    return mapFeedbackRow(data);
  },

  async createProductFeedback(input, analysis) {
    const client = getSupabaseClient();
    const payload = {
      id: crypto.randomUUID(),
      screen: input.screen,
      worked_well: input.workedWell,
      issue_observed: input.issueObserved,
      classification: analysis.classification,
      criticality: analysis.criticality,
      rationale: analysis.rationale,
      scope_assessment: analysis.scopeAssessment,
      suggested_action: analysis.suggestedAction,
      implementation_prompt: analysis.implementationPrompt,
      provider: analysis.provider,
      created_at: nowIso(),
    };

    const { data, error } = await client
      .from("product_feedback")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      if (isSchemaCompatibilityError(error)) {
        return localRepository.createProductFeedback(input, analysis);
      }

      throw error;
    }

    return mapProductFeedbackRow(data);
  },

  async createEvaluationRun(input) {
    const client = getSupabaseClient();
    const timestamp = nowIso();
    const payload = {
      id: crypto.randomUUID(),
      content_request_id: input.contentRequestId ?? null,
      profile_id: input.profileId ?? null,
      mode: input.mode,
      status: input.status,
      primary_provider: input.primaryProvider,
      primary_model: input.primaryModel,
      judge_provider: input.judgeProvider,
      judge_model: input.judgeModel,
      winner_candidate_id: input.winnerCandidateId ?? null,
      winner_recommendation: input.winnerRecommendation,
      judge_summary: input.judgeSummary,
      error_message: input.errorMessage,
      created_at: timestamp,
      updated_at: timestamp,
    };

    const { data, error } = await client
      .from("evaluation_runs")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      if (isSchemaCompatibilityError(error)) {
        return localRepository.createEvaluationRun(input);
      }

      throw error;
    }

    return mapEvaluationRunRow(data);
  },

  async updateEvaluationRun(id, input) {
    const client = getSupabaseClient();
    const payload: Record<string, string | null> = {
      status: input.status,
      updated_at: nowIso(),
    };

    if ("winnerCandidateId" in input) {
      payload.winner_candidate_id = input.winnerCandidateId ?? null;
    }

    if (input.winnerRecommendation !== undefined) {
      payload.winner_recommendation = input.winnerRecommendation;
    }

    if (input.judgeSummary !== undefined) {
      payload.judge_summary = input.judgeSummary;
    }

    if (input.errorMessage !== undefined) {
      payload.error_message = input.errorMessage;
    }

    if (input.judgeProvider !== undefined) {
      payload.judge_provider = input.judgeProvider;
    }

    if (input.judgeModel !== undefined) {
      payload.judge_model = input.judgeModel;
    }

    const { data, error } = await client
      .from("evaluation_runs")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      if (isSchemaCompatibilityError(error)) {
        return localRepository.updateEvaluationRun(id, input);
      }

      throw error;
    }

    return mapEvaluationRunRow(data);
  },

  async createEvaluationCandidates(items) {
    const client = getSupabaseClient();
    const timestamp = nowIso();
    const payload = items.map((item) => ({
      id: crypto.randomUUID(),
      evaluation_run_id: item.evaluationRunId,
      content_request_id: item.contentRequestId ?? null,
      generated_content_ids: item.generatedContentIds,
      role: item.role,
      provider: item.provider,
      model: item.model,
      prompt_version: item.promptVersion,
      template_id: item.templateId,
      latency_ms: item.latencyMs,
      prompt_preview: item.promptPreview,
      raw_response: item.rawResponse,
      token_usage: item.tokenUsage,
      output_variants: item.outputVariants,
      status: item.status,
      created_at: timestamp,
    }));

    const { data, error } = await client
      .from("evaluation_candidates")
      .insert(payload)
      .select("*");

    if (error) {
      if (isSchemaCompatibilityError(error)) {
        return localRepository.createEvaluationCandidates(items);
      }

      throw error;
    }

    return data.map(mapEvaluationCandidateRow);
  },

  async createEvaluationScores(evaluationRunId, candidateId, scores) {
    const client = getSupabaseClient();
    const timestamp = nowIso();
    const payload = scores.map((score) => ({
      id: crypto.randomUUID(),
      evaluation_run_id: evaluationRunId,
      candidate_id: candidateId,
      criterion: score.criterion,
      score: score.score,
      rationale: score.rationale,
      verdict: score.verdict,
      created_at: timestamp,
    }));

    const { data, error } = await client
      .from("evaluation_scores")
      .insert(payload)
      .select("*");

    if (error) {
      if (isSchemaCompatibilityError(error)) {
        return localRepository.createEvaluationScores(
          evaluationRunId,
          candidateId,
          scores,
        );
      }

      throw error;
    }

    return data.map(mapEvaluationScoreRow);
  },

  async getEvaluationReport(runId) {
    const client = getSupabaseClient();
    const [runRes, candidateRes, scoreRes] = await Promise.all([
      client.from("evaluation_runs").select("*").eq("id", runId).maybeSingle(),
      client
        .from("evaluation_candidates")
        .select("*")
        .eq("evaluation_run_id", runId)
        .order("created_at", { ascending: true }),
      client
        .from("evaluation_scores")
        .select("*")
        .eq("evaluation_run_id", runId)
        .order("created_at", { ascending: true }),
    ]);

    if (runRes.error) {
      if (isSchemaCompatibilityError(runRes.error)) {
        return localRepository.getEvaluationReport(runId);
      }

      throw runRes.error;
    }

    if (candidateRes.error) {
      if (isSchemaCompatibilityError(candidateRes.error)) {
        return localRepository.getEvaluationReport(runId);
      }

      throw candidateRes.error;
    }

    if (scoreRes.error) {
      if (isSchemaCompatibilityError(scoreRes.error)) {
        return localRepository.getEvaluationReport(runId);
      }

      throw scoreRes.error;
    }

    if (!runRes.data) {
      return null;
    }

    return buildEvaluationReport(
      mapEvaluationRunRow(runRes.data),
      candidateRes.data.map(mapEvaluationCandidateRow),
      scoreRes.data.map(mapEvaluationScoreRow),
    );
  },

  async listEvaluationReports(limit = 20) {
    const client = getSupabaseClient();
    const runsRes = await client
      .from("evaluation_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (runsRes.error) {
      if (isSchemaCompatibilityError(runsRes.error)) {
        return localRepository.listEvaluationReports(limit);
      }

      throw runsRes.error;
    }

    if (!runsRes.data.length) {
      return [];
    }

    const runIds = runsRes.data.map((run) => String(run.id));
    const [candidateRes, scoreRes] = await Promise.all([
      client
        .from("evaluation_candidates")
        .select("*")
        .in("evaluation_run_id", runIds)
        .order("created_at", { ascending: true }),
      client
        .from("evaluation_scores")
        .select("*")
        .in("evaluation_run_id", runIds)
        .order("created_at", { ascending: true }),
    ]);

    if (candidateRes.error) {
      if (isSchemaCompatibilityError(candidateRes.error)) {
        return localRepository.listEvaluationReports(limit);
      }

      throw candidateRes.error;
    }

    if (scoreRes.error) {
      if (isSchemaCompatibilityError(scoreRes.error)) {
        return localRepository.listEvaluationReports(limit);
      }

      throw scoreRes.error;
    }

    const candidates = candidateRes.data.map(mapEvaluationCandidateRow);
    const scores = scoreRes.data.map(mapEvaluationScoreRow);

    return runsRes.data.map((run) =>
      buildEvaluationReport(
        mapEvaluationRunRow(run),
        candidates.filter((candidate) => candidate.evaluationRunId === String(run.id)),
        scores.filter((score) => score.evaluationRunId === String(run.id)),
      ),
    );
  },
};

export function getRepository(): Repository {
  return isSupabaseConfigured() ? supabaseRepository : localRepository;
}

export async function storeTrainingAssetFile(input: {
  referenceId: string;
  file: File;
}): Promise<StoredTrainingAssetFile> {
  const storagePath = buildTrainingAssetStoragePath(input.referenceId, input.file.name);
  const mimeType = input.file.type || "application/octet-stream";
  const arrayBuffer = await input.file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (isSupabaseConfigured()) {
    const client = getSupabaseClient();
    const bucketName = getTrainingAssetBucketName();
    const uploadResult = await client.storage
      .from(bucketName)
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadResult.error) {
      throw new Error(
        `Nao foi possivel enviar o arquivo para o Supabase Storage: ${uploadResult.error.message}`,
      );
    }

    return {
      storageProvider: "supabase",
      storageBucket: bucketName,
      storagePath,
      originalFilename: input.file.name,
      mimeType,
      sizeBytes: input.file.size,
    };
  }

  await ensureLocalTrainingAssetDir();
  const absolutePath = path.join(LOCAL_TRAINING_ASSET_DIR, storagePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, buffer);

  return {
    storageProvider: "local",
    storageBucket: null,
    storagePath,
    originalFilename: input.file.name,
    mimeType,
    sizeBytes: input.file.size,
  };
}

export async function deleteTrainingAssetFile(input: {
  storageProvider: StoredTrainingAssetFile["storageProvider"];
  storageBucket: string | null;
  storagePath: string;
}) {
  if (input.storageProvider === "supabase") {
    const bucketName = input.storageBucket ?? getTrainingAssetBucketName();
    const client = getSupabaseClient();
    const removeResult = await client.storage.from(bucketName).remove([input.storagePath]);

    if (removeResult.error) {
      throw new Error(
        `Nao foi possivel remover o arquivo do Supabase Storage: ${removeResult.error.message}`,
      );
    }

    return;
  }

  const absolutePath = path.join(LOCAL_TRAINING_ASSET_DIR, input.storagePath);
  await fs.rm(absolutePath, { force: true });
}