import { describe, expect, it } from "vitest";

import { sampleValidationTopics } from "@/lib/constants";
import { buildFallbackVariants } from "@/lib/fallback-generator";
import type { ContentRequestInput } from "@/lib/schemas";
import type { PoliticianProfile } from "@/lib/types";

const profile: PoliticianProfile = {
  id: "profile-validation",
  fullName: "Carlos Andrade",
  role: "Deputado Estadual",
  city: "Fortaleza",
  state: "CE",
  audience: "classe media, bairros populares e comerciantes locais",
  spectrum: "Centro-Direita",
  archetype: "Construtor",
  voiceTones: ["Pragmatico", "Popular"],
  keyIssues: ["Saude publica", "Emprego e renda", "Infraestrutura urbana"],
  slogans: ["Trabalho que aparece"],
  redLines: ["nao inventar numero", "nao prometer o que depende de outro ente"],
  referenceExamples: ["fala objetiva", "cobranca com proposta"],
  bio: "Parlamentar focado em entrega, fiscalizacao e linguagem simples para conectar problema local com solucao pratica.",
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
  notificationEmail: "",
  avatarEmotions: [],
  voicePace: "Manter velocidade original",
  editingStyles: [],
  factCheckingSources: [],
  hardDataSources: [],
  distributionChannels: [],
  distributionWindows: [],
  autoPublish: false,
  updatedAt: "2026-05-25T00:00:00.000Z",
};

describe("validacao do fluxo de geracao", () => {
  it("sustenta tres pautas tipicas do MVP sem retornar conteudo vazio", () => {
    for (const topic of sampleValidationTopics) {
      const request: ContentRequestInput = {
        topic,
        objective: "organizar uma resposta publica com cobranca e proposta",
        format: "Post Instagram",
        intensity: "Firme",
        context: "a equipe quer tom objetivo, sem perder proximidade com quem mora na cidade",
        keyFacts: ["ha impacto local direto", "a cobranca precisa vir com caminho de solucao"],
        desiredCallToAction: "comente como isso afeta o seu bairro",
        mandatoryTerms: [],
      };

      const variants = buildFallbackVariants(profile, request, "preview");

      expect(variants).toHaveLength(3);
      expect(variants.every((item) => item.body.length > 120)).toBe(true);
      expect(variants.some((item) => item.body.includes(topic))).toBe(true);
    }
  });
});
