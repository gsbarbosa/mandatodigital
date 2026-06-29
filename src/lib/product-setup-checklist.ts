import type { ProfileFormState } from "@/components/product/shared";
import type { PoliticianProfile, ProfileTrainingAsset } from "@/lib/types";

export type SetupChecklistItem = {
  id: "profile" | "radar" | "avatar";
  label: string;
  description: string;
  done: boolean;
  href: string;
};

function hasProfileBasics(form: ProfileFormState) {
  return Boolean(
    form.fullName.trim() &&
      form.role.trim() &&
      form.city.trim() &&
      form.state.trim() &&
      form.bio.trim(),
  );
}

function hasProfileBasicsSaved(profile: PoliticianProfile) {
  return Boolean(
    profile.fullName?.trim() &&
      profile.role?.trim() &&
      profile.city?.trim() &&
      profile.state?.trim() &&
      profile.bio?.trim(),
  );
}

function hasRadarConfigured(form: ProfileFormState) {
  const customThemes = form.customRadarThemes.some((theme) => theme.trim().length > 0);
  return (
    form.sentinelThemes.length > 0 ||
    customThemes ||
    form.interestSites.some((site) => site.trim().length > 0) ||
    form.oppositionThemes.length > 0 ||
    form.oppositionSites.some((site) => site.trim().length > 0)
  );
}

function hasRadarSaved(profile: PoliticianProfile) {
  const customThemes = profile.customRadarThemes?.some((theme) => theme.trim().length > 0) ?? false;
  return (
    (profile.sentinelThemes?.length ?? 0) > 0 ||
    customThemes ||
    (profile.interestSites?.some((site) => site.trim().length > 0) ?? false) ||
    (profile.oppositionThemes?.length ?? 0) > 0 ||
    (profile.oppositionSites?.some((site) => site.trim().length > 0) ?? false)
  );
}

function hasAvatarMaterial(assets: ProfileTrainingAsset[]) {
  return assets.some(
    (asset) =>
      asset.trainingRole === "voice_audio" ||
      asset.trainingRole === "avatar_image" ||
      asset.trainingRole === "dataset",
  );
}

export function buildSetupChecklist(input: {
  profileForm: ProfileFormState;
  trainingAssets: ProfileTrainingAsset[];
}): SetupChecklistItem[] {
  const profileDone = hasProfileBasics(input.profileForm);
  const radarDone = hasRadarConfigured(input.profileForm);
  const avatarDone = hasAvatarMaterial(input.trainingAssets);

  return [
    {
      id: "profile",
      label: "Perfil básico",
      description: "Nome, cargo, cidade, estado e bio.",
      done: profileDone,
      href: "/configuracoes?tab=perfil",
    },
    {
      id: "radar",
      label: "Radar de pauta",
      description: "Ao menos um tema ou portal monitorado.",
      done: radarDone,
      href: "/configuracoes?tab=radar",
    },
    {
      id: "avatar",
      label: "Materiais de avatar",
      description: "Áudio, foto ou vídeo de treino (opcional para começar).",
      done: avatarDone,
      href: "/configuracoes?tab=perfil",
    },
  ];
}

export function isSetupChecklistComplete(input: {
  profileForm: ProfileFormState;
  trainingAssets: ProfileTrainingAsset[];
  requireAvatar?: boolean;
}) {
  const items = buildSetupChecklist(input);
  const required = input.requireAvatar ? items : items.filter((item) => item.id !== "avatar");
  return required.every((item) => item.done);
}

export function countPendingSetupItems(input: {
  profileForm: ProfileFormState;
  trainingAssets: ProfileTrainingAsset[];
}) {
  return buildSetupChecklist(input).filter((item) => !item.done && item.id !== "avatar").length;
}

/** Perfil persistido no banco — gate de geração de conteúdo. */
export function isMandatorySetupCompleteForProfile(profile: PoliticianProfile | null) {
  if (!profile?.id?.trim()) {
    return false;
  }

  return hasProfileBasicsSaved(profile) && hasRadarSaved(profile);
}

export function resolveMandatorySetupHref(profile: PoliticianProfile | null) {
  if (!profile?.id?.trim() || !hasProfileBasicsSaved(profile)) {
    return "/configuracoes?tab=perfil";
  }

  if (!hasRadarSaved(profile)) {
    return "/configuracoes?tab=radar";
  }

  return "/configuracoes";
}

export function getMandatorySetupBlockMessage(profile: PoliticianProfile | null) {
  if (!profile?.id?.trim()) {
    return "Salve o perfil em Configurações antes de gerar conteúdo.";
  }

  if (!hasProfileBasicsSaved(profile)) {
    return "Complete e salve nome, cargo, cidade, estado e bio em Configurações.";
  }

  if (!hasRadarSaved(profile)) {
    return "Configure e salve ao menos um tema ou portal do radar antes de gerar conteúdo.";
  }

  return "Complete a configuração inicial antes de gerar conteúdo.";
}

export function assertMandatorySetup(profile: PoliticianProfile | null):
  | { ok: true }
  | { ok: false; message: string } {
  if (isMandatorySetupCompleteForProfile(profile)) {
    return { ok: true };
  }

  return { ok: false, message: getMandatorySetupBlockMessage(profile) };
}
