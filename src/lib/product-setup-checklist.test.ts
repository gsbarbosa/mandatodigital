import { describe, expect, it } from "vitest";

import type { ProfileFormState } from "@/components/product/shared";

import {
  assertMandatorySetup,
  buildSetupChecklist,
  countPendingSetupItems,
  isMandatorySetupCompleteForProfile,
  isSetupChecklistComplete,
} from "./product-setup-checklist";

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

describe("product-setup-checklist", () => {
  it("marca perfil e radar como pendentes no estado vazio", () => {
    const items = buildSetupChecklist({ profileForm: baseForm, trainingAssets: [] });
    expect(items.find((item) => item.id === "profile")?.done).toBe(false);
    expect(items.find((item) => item.id === "radar")?.done).toBe(false);
    expect(countPendingSetupItems({ profileForm: baseForm, trainingAssets: [] })).toBe(2);
  });

  it("considera setup completo sem avatar obrigatorio", () => {
    const form: ProfileFormState = {
      ...baseForm,
      fullName: "Maria",
      role: "Vereadora",
      city: "Recife",
      state: "PE",
      bio: "Bio minima.",
      sentinelThemes: ["Saude"],
    };

    expect(
      isSetupChecklistComplete({
        profileForm: form,
        trainingAssets: [],
      }),
    ).toBe(true);
  });

  it("detecta radar via portal cadastrado", () => {
    const form: ProfileFormState = {
      ...baseForm,
      interestSites: ["g1.com.br"],
    };

    expect(buildSetupChecklist({ profileForm: form, trainingAssets: [] }).find((i) => i.id === "radar")?.done).toBe(
      true,
    );
  });

  it("bloqueia geração quando perfil salvo não tem radar", () => {
    const savedProfile = {
      ...baseForm,
      id: "profile-1",
      fullName: "Maria",
      role: "Vereadora",
      city: "Recife",
      state: "PE",
      bio: "Bio minima.",
      sentinelThemes: [],
      customRadarThemes: [],
      interestSites: [],
      oppositionThemes: [],
      oppositionSites: [],
      updatedAt: "2026-01-01T00:00:00.000Z",
    } as import("@/lib/types").PoliticianProfile;

    expect(isMandatorySetupCompleteForProfile(savedProfile)).toBe(false);
    expect(assertMandatorySetup(savedProfile)).toEqual({
      ok: false,
      message: expect.stringContaining("radar"),
    });
  });

  it("libera geração quando perfil salvo tem basics e radar", () => {
    const savedProfile = {
      ...baseForm,
      id: "profile-1",
      fullName: "Maria",
      role: "Vereadora",
      city: "Recife",
      state: "PE",
      bio: "Bio minima.",
      sentinelThemes: ["Saude"],
      customRadarThemes: [],
      interestSites: [],
      oppositionThemes: [],
      oppositionSites: [],
      updatedAt: "2026-01-01T00:00:00.000Z",
    } as import("@/lib/types").PoliticianProfile;

    expect(isMandatorySetupCompleteForProfile(savedProfile)).toBe(true);
    expect(assertMandatorySetup(savedProfile)).toEqual({ ok: true });
  });
});
