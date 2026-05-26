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
  ProductFeedback,
} from "@/lib/types";

const DATABASE_PATH = path.join(process.cwd(), "data", "mandato-digital.json");

const EMPTY_DATABASE: AppDatabase = {
  profile: null,
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

export type Repository = {
  getDashboard(): Promise<DashboardData>;
  getContentRequestById(id: string): Promise<ContentRequest | null>;
  getGeneratedContentsByRequestId(contentRequestId: string): Promise<GeneratedContent[]>;
  saveProfile(input: ProfileInput): Promise<PoliticianProfile>;
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

async function ensureLocalDatabase() {
  await fs.mkdir(path.dirname(DATABASE_PATH), { recursive: true });

  try {
    await fs.access(DATABASE_PATH);
  } catch {
    await fs.writeFile(DATABASE_PATH, JSON.stringify(EMPTY_DATABASE, null, 2));
  }
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
    fullName: String(row.full_name),
    role: String(row.role),
    city: String(row.city),
    state: String(row.state),
    audience: String(row.audience),
    spectrum: String(row.spectrum),
    archetype: String(row.archetype),
    voiceTones: Array.isArray(row.voice_tones)
      ? row.voice_tones.map(String)
      : [],
    keyIssues: Array.isArray(row.key_issues) ? row.key_issues.map(String) : [],
    slogans: Array.isArray(row.slogans) ? row.slogans.map(String) : [],
    redLines: Array.isArray(row.red_lines) ? row.red_lines.map(String) : [],
    referenceExamples: Array.isArray(row.reference_examples)
      ? row.reference_examples.map(String)
      : [],
    bio: String(row.bio),
    updatedAt: String(row.updated_at),
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
      ...input,
      updatedAt: nowIso(),
    };

    database.profile = profile;
    await writeLocalDatabase(database);

    return profile;
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
    if (requestRes.error) throw requestRes.error;
    if (generatedRes.error) throw generatedRes.error;
    if (feedbackRes.error) throw feedbackRes.error;
    if (productFeedbackRes.error && !isMissingTableError(productFeedbackRes.error)) {
      throw productFeedbackRes.error;
    }
    if (evaluationRunsRes.error && !isMissingTableError(evaluationRunsRes.error)) {
      throw evaluationRunsRes.error;
    }
    if (
      evaluationCandidatesRes.error &&
      !isMissingTableError(evaluationCandidatesRes.error)
    ) {
      throw evaluationCandidatesRes.error;
    }
    if (evaluationScoresRes.error && !isMissingTableError(evaluationScoresRes.error)) {
      throw evaluationScoresRes.error;
    }

    const localDatabase =
      productFeedbackRes.error ||
      evaluationRunsRes.error ||
      evaluationCandidatesRes.error ||
      evaluationScoresRes.error
        ? await readLocalDatabase()
        : null;

    return {
      profile: profileRes.data[0] ? mapProfileRow(profileRes.data[0]) : null,
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
    return mapProfileRow(data);
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
      created_at: nowIso(),
    };

    const { data, error } = await client
      .from("content_requests")
      .insert(payload)
      .select("*")
      .single();

    if (error) throw error;
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
      if (isMissingTableError(error)) {
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
      if (isMissingTableError(error)) {
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
      if (isMissingTableError(error)) {
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
      if (isMissingTableError(error)) {
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
      if (isMissingTableError(error)) {
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
      if (isMissingTableError(runRes.error)) {
        return localRepository.getEvaluationReport(runId);
      }

      throw runRes.error;
    }

    if (candidateRes.error) {
      if (isMissingTableError(candidateRes.error)) {
        return localRepository.getEvaluationReport(runId);
      }

      throw candidateRes.error;
    }

    if (scoreRes.error) {
      if (isMissingTableError(scoreRes.error)) {
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
      if (isMissingTableError(runsRes.error)) {
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
      if (isMissingTableError(candidateRes.error)) {
        return localRepository.listEvaluationReports(limit);
      }

      throw candidateRes.error;
    }

    if (scoreRes.error) {
      if (isMissingTableError(scoreRes.error)) {
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