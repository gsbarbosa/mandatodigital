import { describe, expect, it } from "vitest";

import type { ProfileFormState } from "@/components/product/shared";

import {
  countPendingConfigNavSections,
  isAvatarSectionComplete,
  isFontesSectionComplete,
  isMonitoringConfigured,
  isPerfilBasicsComplete,
  isPerfilSectionComplete,
  isRadarSectionComplete,
  parseConfigSectionFromPathname,
  resolveConfigSectionStatus,
  shouldShowAvatarInNav,
} from "./config-setup-status";

const baseForm: ProfileFormState = {
  fullName: "",
  role: "",
  city: "",
  state: "",
  audience: "",
  spectrum: "",
  archetype: "",
  voiceTones: [],
  keyIssues: "",
  slogans: "",
  redLines: "",
  referenceExamples: "",
  bio: "",
  personaArchetypes: [],
  sentinelThemes: [],
  oppositionThemes: [],
  customRadarThemes: [],
  interestProfiles: [],
  interestSites: [],
  oppositionProfiles: [],
  oppositionSites: [],
  glossaryTerms: "",
  trainingReferenceLinks: [],
  youtubeVideoUrl: "",
  avatarType: "",
  avatarVideoTopic: "",
  argilAvatarId: "",
  argilVoiceId: "",
  avatarTrainingStatus: "",
};

describe("config-setup-status", () => {
  it("marca perfil completo com campos básicos e espectro", () => {
    expect(
      isPerfilSectionComplete({
        ...baseForm,
        fullName: "Maria",
        role: "Vereadora",
        city: "Recife",
        state: "PE",
        bio: "Bio.",
        spectrum: "centro",
      }),
    ).toBe(true);
  });

  it("separa perfil básico (checklist) de perfil completo (sidebar)", () => {
    const basicsOnly = {
      ...baseForm,
      fullName: "Maria",
      role: "Vereadora",
      city: "Recife",
      state: "PE",
      bio: "Bio.",
      spectrum: "",
    };

    expect(isPerfilBasicsComplete(basicsOnly)).toBe(true);
    expect(isPerfilSectionComplete(basicsOnly)).toBe(false);
  });

  it("monitoramento considera temas ou fontes", () => {
    expect(isMonitoringConfigured({ ...baseForm, interestSites: ["g1.com.br"] })).toBe(true);
  });

  it("parseia rota /configuracoes/radar", () => {
    expect(parseConfigSectionFromPathname("/configuracoes/radar")).toBe("radar");
    expect(parseConfigSectionFromPathname("/configuracoes")).toBeNull();
  });

  it("oculta avatar da nav quando concluído", () => {
    expect(
      shouldShowAvatarInNav({
        trainingAssets: [],
        hasReadyTwin: true,
      }),
    ).toBe(false);
  });

  it("fontes opcional não entra na contagem de pendentes", () => {
    expect(
      countPendingConfigNavSections({
        profileForm: {
          ...baseForm,
          fullName: "Maria",
          role: "Vereadora",
          city: "Recife",
          state: "PE",
          bio: "Bio.",
          spectrum: "centro",
          sentinelThemes: ["Saúde"],
        },
        trainingAssets: [],
        includeAvatarInNav: false,
      }),
    ).toBe(0);
  });

  it("conta pendentes na nav sem avatar concluído", () => {
    expect(
      countPendingConfigNavSections({
        profileForm: baseForm,
        trainingAssets: [],
        includeAvatarInNav: true,
      }),
    ).toBeGreaterThan(0);
  });

  it("separa radar de fontes", () => {
    const withTheme = { ...baseForm, sentinelThemes: ["Saúde"] };
    const withSite = { ...baseForm, interestSites: ["g1.com.br"] };

    expect(isRadarSectionComplete(withTheme)).toBe(true);
    expect(isFontesSectionComplete(withTheme)).toBe(false);
    expect(isRadarSectionComplete(withSite)).toBe(false);
    expect(isFontesSectionComplete(withSite)).toBe(true);
  });

  it("marca avatar completo com voz e foto ou gêmeo pronto", () => {
    expect(
      isAvatarSectionComplete({
        trainingAssets: [
          {
            id: "1",
            profileId: "p1",
            draftProfileId: null,
            sourceType: "upload",
            trainingRole: "voice_audio",
            storageProvider: "supabase",
            storageBucket: "b",
            storagePath: "a",
            originalFilename: "a.mp3",
            mimeType: "audio/mpeg",
            sizeBytes: 1,
            status: "uploaded",
            errorMessage: "",
            createdAt: "",
            updatedAt: "",
          },
          {
            id: "2",
            profileId: "p1",
            draftProfileId: null,
            sourceType: "upload",
            trainingRole: "avatar_image",
            storageProvider: "supabase",
            storageBucket: "b",
            storagePath: "b",
            originalFilename: "b.jpg",
            mimeType: "image/jpeg",
            sizeBytes: 1,
            status: "uploaded",
            errorMessage: "",
            createdAt: "",
            updatedAt: "",
          },
        ],
      }),
    ).toBe(true);

    expect(
      isAvatarSectionComplete({
        trainingAssets: [],
        hasReadyTwin: true,
      }),
    ).toBe(true);
  });

  it("resolve status de canais como coming_soon", () => {
    expect(
      resolveConfigSectionStatus("canais", {
        profileForm: baseForm,
        trainingAssets: [],
      }),
    ).toBe("coming_soon");
  });
});
