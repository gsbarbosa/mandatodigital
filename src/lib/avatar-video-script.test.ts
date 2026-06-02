import { describe, expect, it } from "vitest";

import { buildAvatarVideoPrompt, buildAvatarVideoTranscriptFallback } from "@/lib/avatar-video-script";

describe("buildAvatarVideoTranscriptFallback", () => {
  it("monta script curto com tema e perfil", () => {
    const transcript = buildAvatarVideoTranscriptFallback({
      topic: "tempo de espera em consultas",
      profile: {
        id: "profile-1",
        fullName: "Maria Souza",
        role: "Vereadora",
        city: "Recife",
        state: "PE",
        audience: "familias",
        spectrum: "Centro-Direita",
        archetype: "Fiscal",
        voiceTones: [],
        keyIssues: [],
        slogans: [],
        redLines: [],
        referenceExamples: [],
        bio: "bio",
        personaArchetypes: [],
        sentinelThemes: [],
        oppositionThemes: [],
        customRadarThemes: [],
        interestProfiles: [],
        interestSites: [],
        oppositionProfiles: [],
        oppositionSites: [],
        glossaryTerms: ["ne", "ta"],
        trainingReferenceLinks: [],
        youtubeVideoUrl: "",
        avatarType: "",
        avatarVideoTopic: "",
        notificationEmail: "",
        avatarEmotions: [],
        voicePace: "",
        editingStyles: [],
        factCheckingSources: [],
        hardDataSources: [],
        distributionChannels: [],
        distributionWindows: [],
        autoPublish: false,
        updatedAt: new Date().toISOString(),
      },
    });

    expect(transcript).not.toContain("Maria Souza");
    expect(transcript).toContain("tempo de espera em consultas");
    expect(transcript.toLowerCase()).toContain("centro-direita");
    expect(transcript.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(160);
  });
});

describe("buildAvatarVideoPrompt", () => {
  it("expoe o prompt pai do doc video 03", () => {
    const prompt = buildAvatarVideoPrompt({
      topic: "Saude publica",
      profile: null,
    });

    expect(prompt.system).toContain("estrategista chefe");
    expect(prompt.user).toContain("Tema Central: Saude publica");
  });
});
