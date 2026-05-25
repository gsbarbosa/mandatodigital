import { promises as fs } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import type {
  ContentRequestInput,
  FeedbackInput,
  GeneratedContentUpdateInput,
  ProfileInput,
} from "@/lib/schemas";
import type {
  AppDatabase,
  ContentFeedback,
  ContentRequest,
  DashboardData,
  GeneratedContent,
  PoliticianProfile,
} from "@/lib/types";

const DATABASE_PATH = path.join(process.cwd(), "data", "mandato-digital.json");

const EMPTY_DATABASE: AppDatabase = {
  profile: null,
  contentRequests: [],
  generatedContents: [],
  feedback: [],
};

type GeneratedContentSeed = Pick<
  GeneratedContent,
  "title" | "angle" | "body" | "promptPreview" | "provider"
>;

type Repository = {
  getDashboard(): Promise<DashboardData>;
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
};

function nowIso() {
  return new Date().toISOString();
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

const localRepository: Repository = {
  async getDashboard() {
    return readLocalDatabase();
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
};

const supabaseRepository: Repository = {
  async getDashboard() {
    const client = getSupabaseClient();
    const [profileRes, requestRes, generatedRes, feedbackRes] = await Promise.all([
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
    ]);

    if (profileRes.error) throw profileRes.error;
    if (requestRes.error) throw requestRes.error;
    if (generatedRes.error) throw generatedRes.error;
    if (feedbackRes.error) throw feedbackRes.error;

    return {
      profile: profileRes.data[0] ? mapProfileRow(profileRes.data[0]) : null,
      contentRequests: requestRes.data.map(mapRequestRow),
      generatedContents: generatedRes.data.map(mapGeneratedContentRow),
      feedback: feedbackRes.data.map(mapFeedbackRow),
    };
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
};

export function getRepository(): Repository {
  return isSupabaseConfigured() ? supabaseRepository : localRepository;
}
