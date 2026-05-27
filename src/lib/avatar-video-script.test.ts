import { describe, expect, it } from "vitest";

import { buildAvatarVideoTranscript } from "@/lib/avatar-video-script";

describe("buildAvatarVideoTranscript", () => {
  it("monta script curto com tema e perfil", () => {
    const transcript = buildAvatarVideoTranscript({
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

    expect(transcript).toContain("Maria Souza");
    expect(transcript).toContain("tempo de espera em consultas");
    expect(transcript.length).toBeLessThanOrEqual(500);
  });
});
