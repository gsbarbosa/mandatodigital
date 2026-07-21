export type AdminProviderId =
  | "firebase"
  | "openai"
  | "anthropic"
  | "heygen"
  | "elevenlabs"
  | "resend"
  | "brasilapi"
  | "apify"
  | "serpapi"
  | "pubsub";

export type AdminProviderStatus = "configured" | "missing" | "optional";

export type AdminProvider = {
  id: AdminProviderId;
  name: string;
  category: "infra" | "llm" | "video" | "voice" | "email" | "data" | "jobs";
  description: string;
  docsUrl?: string;
  envKeys: string[];
  status: AdminProviderStatus;
  required: boolean;
};

function hasEnv(key: string) {
  return Boolean(process.env[key]?.trim());
}

function statusFor(keys: string[], required: boolean): AdminProviderStatus {
  const ok = keys.every((key) => hasEnv(key));
  if (ok) {
    return "configured";
  }
  return required ? "missing" : "optional";
}

export function listAdminProviders(): AdminProvider[] {
  const firebaseConfigured =
    hasEnv("FIREBASE_SERVICE_ACCOUNT_JSON") ||
    hasEnv("FIREBASE_CONFIG") ||
    hasEnv("K_SERVICE") ||
    (hasEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID") && hasEnv("NEXT_PUBLIC_FIREBASE_API_KEY"));

  return [
    {
      id: "firebase",
      name: "Firebase",
      category: "infra",
      description: "Auth, Firestore e Storage — base da plataforma.",
      docsUrl: "https://firebase.google.com/docs",
      envKeys: ["NEXT_PUBLIC_FIREBASE_PROJECT_ID", "FIREBASE_SERVICE_ACCOUNT_JSON"],
      status: firebaseConfigured ? "configured" : "missing",
      required: true,
    },
    {
      id: "openai",
      name: "OpenAI",
      category: "llm",
      description: "LLM principal, expansão Sentinela, fact-check e caricaturas.",
      docsUrl: "https://platform.openai.com/docs",
      envKeys: ["OPENAI_API_KEY"],
      status: statusFor(["OPENAI_API_KEY"], true),
      required: true,
    },
    {
      id: "anthropic",
      name: "Anthropic",
      category: "llm",
      description: "LLM alternativo / juiz de evals.",
      docsUrl: "https://docs.anthropic.com",
      envKeys: ["ANTHROPIC_API_KEY"],
      status: statusFor(["ANTHROPIC_API_KEY"], false),
      required: false,
    },
    {
      id: "heygen",
      name: "HeyGen",
      category: "video",
      description: "Avatares (3D, caricato, gêmeo), clone de voz e render de vídeo.",
      docsUrl: "https://docs.heygen.com",
      envKeys: ["HEYGEN_API_KEY"],
      status: statusFor(["HEYGEN_API_KEY"], true),
      required: true,
    },
    {
      id: "elevenlabs",
      name: "ElevenLabs",
      category: "voice",
      description: "Clone IVC + TTS (path audio_url no HeyGen).",
      docsUrl: "https://elevenlabs.io/docs",
      envKeys: ["ELEVENLABS_API_KEY"],
      status: statusFor(["ELEVENLABS_API_KEY"], false),
      required: false,
    },
    {
      id: "resend",
      name: "Resend",
      category: "email",
      description: "Envio de contrato e dossiê após aceite do CNPJ.",
      docsUrl: "https://resend.com/docs",
      envKeys: ["RESEND_API_KEY"],
      status: statusFor(["RESEND_API_KEY"], false),
      required: false,
    },
    {
      id: "brasilapi",
      name: "BrasilAPI",
      category: "data",
      description: "Lookup de CNPJ (natureza jurídica eleitoral). Sem API key.",
      docsUrl: "https://brasilapi.com.br/docs",
      envKeys: [],
      status: "configured",
      required: true,
    },
    {
      id: "apify",
      name: "Apify",
      category: "data",
      description: "Scraping de Instagram para pipeline social do Sentinela.",
      docsUrl: "https://docs.apify.com",
      envKeys: ["APIFY_TOKEN"],
      status: hasEnv("APIFY_TOKEN") || hasEnv("APIFY_API_TOKEN") ? "configured" : "optional",
      required: false,
    },
    {
      id: "serpapi",
      name: "SerpAPI",
      category: "data",
      description: "Google Trends opcional (flag SENTINEL_SERPAPI_KEY).",
      docsUrl: "https://serpapi.com",
      envKeys: ["SENTINEL_SERPAPI_KEY"],
      status: statusFor(["SENTINEL_SERPAPI_KEY"], false),
      required: false,
    },
    {
      id: "pubsub",
      name: "Google Pub/Sub",
      category: "jobs",
      description: "Fila de jobs async (selo FFmpeg / voice).",
      docsUrl: "https://cloud.google.com/pubsub/docs",
      envKeys: ["PUBSUB_JOBS_ENABLED"],
      status: process.env.PUBSUB_JOBS_ENABLED === "true" ? "configured" : "optional",
      required: false,
    },
  ];
}
