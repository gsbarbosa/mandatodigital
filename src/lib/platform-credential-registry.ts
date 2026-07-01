export const PLATFORM_CREDENTIAL_IDS = [
  "openai",
  "anthropic",
  "perplexity",
  "apify",
  "heygen",
  "serpapi",
  "elevenlabs",
] as const;

export type PlatformCredentialId = (typeof PLATFORM_CREDENTIAL_IDS)[number];

export type PlatformCredentialDefinition = {
  id: PlatformCredentialId;
  label: string;
  description: string;
  envKeys: readonly string[];
  placeholder: string;
  docsUrl?: string;
};

export const PLATFORM_CREDENTIAL_REGISTRY: Record<
  PlatformCredentialId,
  PlatformCredentialDefinition
> = {
  openai: {
    id: "openai",
    label: "OpenAI",
    description: "Geracao de roteiros, expansao de temas e enriquecimento editorial do Sentinela.",
    envKeys: ["OPENAI_API_KEY"],
    placeholder: "sk-...",
    docsUrl: "https://platform.openai.com/api-keys",
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    description: "Provider alternativo de LLM (Claude) quando OpenAI nao estiver configurado.",
    envKeys: ["ANTHROPIC_API_KEY"],
    placeholder: "sk-ant-...",
    docsUrl: "https://console.anthropic.com/settings/keys",
  },
  perplexity: {
    id: "perplexity",
    label: "Perplexity",
    description: "Estrategista do Sentinela — contextualiza O que e Onde antes da coleta social.",
    envKeys: ["PERPLEXITY_API_KEY"],
    placeholder: "pplx-...",
    docsUrl: "https://www.perplexity.ai/settings/api",
  },
  apify: {
    id: "apify",
    label: "Apify",
    description: "Coleta social (Instagram e trends) — Quem e Quanto (engajamento).",
    envKeys: ["APIFY_API_TOKEN"],
    placeholder: "apify_api_...",
    docsUrl: "https://console.apify.com/account/integrations",
  },
  heygen: {
    id: "heygen",
    label: "HeyGen",
    description: "Avatar digital, treino de gêmeo e geracao de video no Criativo.",
    envKeys: ["HEYGEN_API_KEY"],
    placeholder: "x-api-key HeyGen",
    docsUrl: "https://app.heygen.com/settings?nav=API",
  },
  serpapi: {
    id: "serpapi",
    label: "SerpAPI",
    description: "Google Trends e buscas pagas opcionais para temas em alta.",
    envKeys: ["SENTINEL_SERPAPI_KEY"],
    placeholder: "chave SerpAPI",
    docsUrl: "https://serpapi.com/manage-api-key",
  },
  elevenlabs: {
    id: "elevenlabs",
    label: "ElevenLabs",
    description: "Clone de voz externo (futuro) integrado ao HeyGen.",
    envKeys: ["ELEVENLABS_API_KEY"],
    placeholder: "xi-...",
    docsUrl: "https://elevenlabs.io/app/settings/api-keys",
  },
};

export function isPlatformCredentialId(value: string): value is PlatformCredentialId {
  return (PLATFORM_CREDENTIAL_IDS as readonly string[]).includes(value);
}

export function readPlatformCredentialFromEnv(serviceId: PlatformCredentialId): string {
  const definition = PLATFORM_CREDENTIAL_REGISTRY[serviceId];
  for (const envKey of definition.envKeys) {
    const value = process.env[envKey]?.trim();
    if (value) {
      return value;
    }
  }
  return "";
}

export function maskPlatformCredential(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.length <= 8) {
    return "••••••••";
  }
  return `••••••••${trimmed.slice(-4)}`;
}
