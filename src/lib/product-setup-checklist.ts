import type { ProfileFormState } from "@/components/product/shared";
import type { PoliticianProfile, ProfileTrainingAsset } from "@/lib/types";

import {
  configSectionHref,
  isAvatarSectionComplete,
  isMonitoringConfigured,
  isMonitoringConfiguredSaved,
  isPerfilBasicsComplete,
  isPerfilBasicsCompleteSaved,
} from "@/lib/config-setup-status";

export type SetupChecklistItem = {
  id: "profile" | "radar" | "avatar";
  label: string;
  description: string;
  done: boolean;
  href: string;
};

export function buildSetupChecklist(input: {
  profileForm: ProfileFormState;
  trainingAssets: ProfileTrainingAsset[];
}): SetupChecklistItem[] {
  const profileDone = isPerfilBasicsComplete(input.profileForm);
  const radarDone = isMonitoringConfigured(input.profileForm);
  const avatarDone = isAvatarSectionComplete({
    trainingAssets: input.trainingAssets,
  });

  return [
    {
      id: "profile",
      label: "Perfil básico",
      description: "Nome, cargo, cidade, estado e bio.",
      done: profileDone,
      href: configSectionHref("perfil"),
    },
    {
      id: "radar",
      label: "Radar de pauta",
      description: "Ao menos um tema ou portal monitorado.",
      done: radarDone,
      href: configSectionHref("radar"),
    },
    {
      id: "avatar",
      label: "Materiais de avatar",
      description: "Áudio, foto ou vídeo de treino (opcional para começar).",
      done: avatarDone,
      href: configSectionHref("avatar"),
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

  return isPerfilBasicsCompleteSaved(profile) && isMonitoringConfiguredSaved(profile);
}

export function resolveMandatorySetupHref(profile: PoliticianProfile | null) {
  if (!profile?.id?.trim() || !isPerfilBasicsCompleteSaved(profile)) {
    return configSectionHref("perfil");
  }

  if (!isMonitoringConfiguredSaved(profile)) {
    return configSectionHref("radar");
  }

  return configSectionHref("perfil");
}

export function getMandatorySetupBlockMessage(profile: PoliticianProfile | null) {
  if (!profile?.id?.trim()) {
    return "Salve o perfil em Configurações antes de gerar conteúdo.";
  }

  if (!isPerfilBasicsCompleteSaved(profile)) {
    return "Complete e salve nome, cargo, cidade, estado e bio em Configurações.";
  }

  if (!isMonitoringConfiguredSaved(profile)) {
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
