import { describe, expect, it } from "vitest";

import { profileInputSchema } from "@/lib/schemas";
import { mergeProfileInputForSave } from "@/lib/profile-save";

describe("mergeProfileInputForSave", () => {
  it("preenche defaults no save do Curador quando campos estao vazios", () => {
    const merged = mergeProfileInputForSave(
      {
        fullName: "",
        role: "",
        city: "",
        state: "",
        audience: "",
        spectrum: "",
        archetype: "",
        voiceTones: [],
        keyIssues: [],
        slogans: [],
        redLines: [],
        referenceExamples: [],
        bio: "",
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
        avatarVideoTopic: "Tema teste",
        argilAvatarId: "",
        argilVoiceId: "",
        avatarTrainingStatus: "",
        notificationEmail: "",
        avatarEmotions: [],
        voicePace: "Manter velocidade original",
        editingStyles: [],
        factCheckingSources: [],
        hardDataSources: [],
        distributionChannels: [],
        distributionWindows: [],
        autoPublish: false,
      },
      null,
      { allowDraftDefaults: true },
    );

    const parsed = profileInputSchema.safeParse(merged);
    expect(parsed.success).toBe(true);
    expect(merged.fullName.length).toBeGreaterThanOrEqual(3);
    expect(merged.keyIssues.length).toBeGreaterThanOrEqual(1);
  });

  it("substitui campos parciais inválidos por defaults no save silencioso", () => {
    const merged = mergeProfileInputForSave(
      {
        fullName: "Jo",
        role: "V",
        city: "R",
        state: "P",
        audience: "AB",
        spectrum: "",
        archetype: "AB",
        voiceTones: [],
        keyIssues: [" "],
        slogans: [],
        redLines: [],
        referenceExamples: [],
        bio: "curta",
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
        avatarTrainingStatus: "",
        notificationEmail: "",
        avatarEmotions: [],
        voicePace: "Manter velocidade original",
        editingStyles: [],
        factCheckingSources: [],
        hardDataSources: [],
        distributionChannels: [],
        distributionWindows: [],
        autoPublish: false,
      },
      null,
      { allowDraftDefaults: true },
    );

    expect(profileInputSchema.safeParse(merged).success).toBe(true);
    expect(merged.fullName).toBe("Perfil em configuração");
    expect(merged.keyIssues).toEqual(["Comunicação política"]);
  });

  it("mantem espectro vazio quando o usuario não selecionou", () => {
    const merged = mergeProfileInputForSave(
      {
        fullName: "Joao Silva",
        role: "Vereador",
        city: "Recife",
        state: "PE",
        audience: "Bairros",
        spectrum: "",
        archetype: "O Conciliador (Uniao/Pontes)",
        voiceTones: [],
        keyIssues: ["Saude"],
        slogans: [],
        redLines: [],
        referenceExamples: [],
        bio: "Bio com mais de vinte caracteres para validacao.",
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
        avatarTrainingStatus: "",
        notificationEmail: "",
        avatarEmotions: [],
        voicePace: "Manter velocidade original",
        editingStyles: [],
        factCheckingSources: [],
        hardDataSources: [],
        distributionChannels: [],
        distributionWindows: [],
        autoPublish: false,
      },
      null,
      { allowDraftDefaults: true },
    );

    expect(merged.spectrum).toBe("");
    expect(profileInputSchema.safeParse(merged).success).toBe(true);
  });
});
