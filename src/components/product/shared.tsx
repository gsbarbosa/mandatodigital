import {
  archetypeOptions,
  avatarVoicePaceOptions,
  defaultFormats,
  defaultIntensities,
} from "@/lib/constants";
import { resolveSentinelThemeSpheres, unionSentinelThemes } from "@/lib/sentinel-profile-themes";
import type { DashboardData } from "@/lib/types";
import type {
  ContentFormat,
  IntensityLevel,
  SocialHandle,
} from "@/lib/types";

export type ProfileFormState = {
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
  personaArchetypes: string[];
  sentinelThemes: string[];
  sentinelThemesFederal: string[];
  sentinelThemesEstadual: string[];
  oppositionThemes: string[];
  customRadarThemes: string[];
  interestProfiles: SocialHandle[];
  interestSites: string[];
  oppositionProfiles: SocialHandle[];
  oppositionSites: string[];
  glossaryTerms: string;
  trainingReferenceLinks: string[];
  youtubeVideoUrl: string;
  avatarType: string;
  avatarVideoTopic: string;
  notificationEmail: string;
  avatarEmotions: string[];
  voicePace: string;
  editingStyles: string[];
  factCheckingSources: string[];
  hardDataSources: string[];
  distributionChannels: string[];
  distributionWindows: string[];
  autoPublish: boolean;
};

export type RequestFormState = {
  topic: string;
  objective: string;
  format: ContentFormat;
  intensity: IntensityLevel;
  context: string;
  keyFacts: string;
  desiredCallToAction: string;
  mandatoryTerms: string;
};


export type ApiErrorPayload = {
  message?: string;
  issues?: {
    fieldErrors?: Record<string, string[] | undefined>;
    formErrors?: string[];
  };
};

export function toTextarea(items: string[]) {
  return items.join("\n");
}

export function parseTextarea(value: string) {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function buildProfileState(data: DashboardData["profile"]): ProfileFormState {
  const themeSpheres = data
    ? resolveSentinelThemeSpheres(data)
    : { federal: [], estadual: [] };

  return {
    id: data?.id,
    fullName: data?.fullName ?? "",
    role: data?.role ?? "",
    city: data?.city ?? "",
    state: data?.state ?? "",
    audience: data?.audience ?? "",
    spectrum: data?.spectrum ?? "",
    archetype: data?.archetype ?? archetypeOptions[0],
    voiceTones: data?.voiceTones ?? [],
    keyIssues: toTextarea(data?.keyIssues ?? []),
    slogans: toTextarea(data?.slogans ?? []),
    redLines: toTextarea(data?.redLines ?? []),
    referenceExamples: toTextarea(data?.referenceExamples ?? []),
    bio:
      data?.bio ??
      "Mandato focado em entregas concretas, linguagem clara e defesa consistente das pautas prioritarias.",
    personaArchetypes:
      data?.personaArchetypes?.length
        ? data.personaArchetypes
        : data?.archetype
          ? [data.archetype]
          : [],
    sentinelThemes: data ? unionSentinelThemes(themeSpheres) : [],
    sentinelThemesFederal: themeSpheres.federal,
    sentinelThemesEstadual: themeSpheres.estadual,
    oppositionThemes: data?.oppositionThemes ?? [],
    customRadarThemes: data?.customRadarThemes ?? [],
    interestProfiles: data?.interestProfiles ?? [],
    interestSites: data?.interestSites ?? [],
    oppositionProfiles: data?.oppositionProfiles ?? [],
    oppositionSites: data?.oppositionSites ?? [],
    glossaryTerms: toTextarea(data?.glossaryTerms ?? []),
    trainingReferenceLinks: data?.trainingReferenceLinks ?? [],
    youtubeVideoUrl: data?.youtubeVideoUrl ?? "",
    avatarType: data?.avatarType ?? "",
    avatarVideoTopic: data?.avatarVideoTopic ?? "",
    notificationEmail: data?.notificationEmail ?? "",
    avatarEmotions: data?.avatarEmotions ?? ["Manter o estilo do video original"],
    voicePace: data?.voicePace ?? avatarVoicePaceOptions[0],
    editingStyles: data?.editingStyles ?? ["Manter o formato original (Apenas legendas)"],
    factCheckingSources: data?.factCheckingSources ?? [],
    hardDataSources: data?.hardDataSources ?? [],
    distributionChannels: data?.distributionChannels ?? [],
    distributionWindows: data?.distributionWindows ?? [],
    autoPublish: data?.autoPublish ?? false,
  };
}

export function buildRequestState(): RequestFormState {
  return {
    topic: "",
    objective: "",
    format: defaultFormats[0],
    intensity: defaultIntensities[1],
    context: "",
    keyFacts: "",
    desiredCallToAction: "",
    mandatoryTerms: "",
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
    sentinelThemes: "Temas de interesse",
    oppositionThemes: "Temas da oposicao",
    customRadarThemes: "Temas personalizados",
    interestProfiles: "Perfis de interesse",
    interestSites: "Portais monitorados",
    oppositionProfiles: "Perfis da oposicao",
    oppositionSites: "Portais da oposicao",
  slogans: "Bordoes / assinaturas",
    glossaryTerms: "Glossario pessoal",
    trainingReferenceLinks: "Base de treino",
    youtubeVideoUrl: "URL do YouTube",
    avatarType: "Tipo de avatar",
    avatarVideoTopic: "Tema do video",
    notificationEmail: "Seu e-mail",
    personaArchetypes: "Arquetipos de persona",
    avatarEmotions: "Emocao do avatar",
    voicePace: "Velocidade da voz",
    editingStyles: "Estilos de edicao",
    factCheckingSources: "Agencias de checagem",
    hardDataSources: "Bases governamentais",
    distributionChannels: "Canais de distribuicao",
    distributionWindows: "Janelas de disparo",
    autoPublish: "Aprovacao automatica",
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
    mandatoryTerms: "Palavras obrigatorias",
};

export function formatApiError(payload: ApiErrorPayload) {
  const formErrors = payload.issues?.formErrors?.filter(Boolean) ?? [];
  const fieldErrors = Object.entries(payload.issues?.fieldErrors ?? {}).flatMap(
    ([field, messages]) =>
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

