import type { ProfileFormState } from "@/components/product/shared";
import type { PoliticianProfile, ProfileTrainingAsset } from "@/lib/types";

export type ConfigSectionId = "perfil" | "avatar" | "radar" | "fontes" | "canais";

export type ConfigSectionStatus = "pending" | "complete" | "coming_soon";

export type ConfigSectionDef = {
  id: ConfigSectionId;
  label: string;
  oneTime?: boolean;
  /** Exibir no menu lateral (canais fica fora até existir produto). */
  showInNav?: boolean;
  /** Se false, vazio não conta como pendente na sidebar. */
  requiredForNav?: boolean;
};

export const configSections: ConfigSectionDef[] = [
  { id: "perfil", label: "Perfil", showInNav: true, requiredForNav: true },
  { id: "avatar", label: "Avatar", oneTime: true, showInNav: true, requiredForNav: true },
  { id: "radar", label: "Radar", showInNav: true, requiredForNav: true },
  { id: "fontes", label: "Fontes", showInNav: true, requiredForNav: false },
  { id: "canais", label: "Canais", showInNav: false },
];

export const configNavSections = configSections.filter((section) => section.showInNav !== false);

const CONFIG_SECTION_IDS = new Set<ConfigSectionId>(
  configSections.map((section) => section.id),
);

function hasText(value: string | null | undefined) {
  return Boolean(String(value ?? "").trim());
}

/** Checklist e gate de geração — identidade mínima, sem espectro. */
export function isPerfilBasicsComplete(form: ProfileFormState) {
  return (
    hasText(form.fullName) &&
    hasText(form.role) &&
    hasText(form.city) &&
    hasText(form.state) &&
    hasText(form.bio)
  );
}

export function isPerfilBasicsCompleteSaved(profile: PoliticianProfile) {
  return (
    hasText(profile.fullName) &&
    hasText(profile.role) &&
    hasText(profile.city) &&
    hasText(profile.state) &&
    hasText(profile.bio)
  );
}

/** Badge da seção Perfil na sidebar — inclui espectro ideológico. */
export function isPerfilSectionComplete(form: ProfileFormState) {
  return isPerfilBasicsComplete(form) && hasText(form.spectrum);
}

export function isRadarSectionComplete(form: ProfileFormState) {
  const customThemes = form.customRadarThemes.some((theme) => theme.trim().length > 0);
  return (
    form.sentinelThemes.length > 0 ||
    customThemes ||
    form.oppositionThemes.length > 0
  );
}

export function isFontesSectionComplete(form: ProfileFormState) {
  return (
    form.interestSites.some((site) => site.trim().length > 0) ||
    form.oppositionSites.some((site) => site.trim().length > 0)
  );
}

/** Temas ou portais — usado no checklist e no gate de geração. */
export function isMonitoringConfigured(form: ProfileFormState) {
  return isRadarSectionComplete(form) || isFontesSectionComplete(form);
}

export function isMonitoringConfiguredSaved(profile: PoliticianProfile) {
  const customThemes = profile.customRadarThemes?.some((theme) => theme.trim().length > 0) ?? false;
  return (
    (profile.sentinelThemes?.length ?? 0) > 0 ||
    customThemes ||
    (profile.oppositionThemes?.length ?? 0) > 0 ||
    (profile.interestSites?.some((site) => site.trim().length > 0) ?? false) ||
    (profile.oppositionSites?.some((site) => site.trim().length > 0) ?? false)
  );
}

/** Marco único: materiais mínimos ou gêmeo pronto na plataforma. */
export function isAvatarSectionComplete(input: {
  trainingAssets: ProfileTrainingAsset[];
  hasReadyTwin?: boolean;
}) {
  if (input.hasReadyTwin) {
    return true;
  }

  const hasVoice = input.trainingAssets.some((asset) => asset.trainingRole === "voice_audio");
  const hasPhoto = input.trainingAssets.some((asset) => asset.trainingRole === "avatar_image");
  const hasVideo = input.trainingAssets.some(
    (asset) =>
      asset.trainingRole === "dataset" &&
      String(asset.mimeType ?? "").toLowerCase().startsWith("video/"),
  );
  const hasCaricature = input.trainingAssets.some(
    (asset) => asset.trainingRole === "avatar_caricature",
  );

  return (
    (hasVoice && hasPhoto) ||
    (hasVoice && hasVideo) ||
    (hasVoice && hasCaricature)
  );
}

export function avatarNeedsTwinProbe(input: {
  trainingAssets: ProfileTrainingAsset[];
}) {
  return !isAvatarSectionComplete({ trainingAssets: input.trainingAssets, hasReadyTwin: false });
}

export function resolveConfigSectionStatus(
  section: ConfigSectionId,
  input: {
    profileForm: ProfileFormState;
    trainingAssets: ProfileTrainingAsset[];
    hasReadyTwin?: boolean;
  },
): ConfigSectionStatus {
  if (section === "canais") {
    return "coming_soon";
  }

  if (section === "perfil") {
    return isPerfilSectionComplete(input.profileForm) ? "complete" : "pending";
  }

  if (section === "radar") {
    return isRadarSectionComplete(input.profileForm) ? "complete" : "pending";
  }

  if (section === "fontes") {
    return isFontesSectionComplete(input.profileForm) ? "complete" : "pending";
  }

  return isAvatarSectionComplete({
    trainingAssets: input.trainingAssets,
    hasReadyTwin: input.hasReadyTwin,
  })
    ? "complete"
    : "pending";
}

export function isRequiredConfigNavSection(section: ConfigSectionId) {
  return configSections.find((item) => item.id === section)?.requiredForNav === true;
}

/** Status para sidebar — seções opcionais nunca ficam “Pendente”. */
export function resolveConfigNavSectionStatus(
  section: ConfigSectionId,
  input: {
    profileForm: ProfileFormState;
    trainingAssets: ProfileTrainingAsset[];
    hasReadyTwin?: boolean;
  },
): ConfigSectionStatus {
  const status = resolveConfigSectionStatus(section, input);
  if (!isRequiredConfigNavSection(section) && status === "pending") {
    return "complete";
  }
  return status;
}

export function countPendingConfigNavSections(input: {
  profileForm: ProfileFormState;
  trainingAssets: ProfileTrainingAsset[];
  hasReadyTwin?: boolean;
  includeAvatarInNav?: boolean;
}) {
  const includeAvatar = input.includeAvatarInNav ?? true;
  const sections = configNavSections.filter(
    (section) =>
      section.requiredForNav === true && (includeAvatar || section.id !== "avatar"),
  );

  return sections.filter(
    (section) =>
      resolveConfigNavSectionStatus(section.id, input) === "pending",
  ).length;
}

export function shouldShowAvatarInNav(input: {
  trainingAssets: ProfileTrainingAsset[];
  hasReadyTwin?: boolean;
}) {
  return !isAvatarSectionComplete(input);
}

/** @deprecated Prefer parseConfigSectionFromPathname ou parseConfigSectionSlug */
export function parseConfigTab(value: string | null): ConfigSectionId {
  return parseConfigSectionSlug(value) ?? "perfil";
}

export function parseConfigSectionSlug(value: string | null | undefined): ConfigSectionId | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized || !CONFIG_SECTION_IDS.has(normalized as ConfigSectionId)) {
    return null;
  }
  return normalized as ConfigSectionId;
}

export function parseConfigSectionFromPathname(pathname: string): ConfigSectionId | null {
  const match = pathname.match(/^\/configuracoes\/([^/?#]+)/);
  if (!match?.[1]) {
    return null;
  }
  return parseConfigSectionSlug(match[1]);
}

export function resolveConfigSectionLabel(section: ConfigSectionId) {
  return configSections.find((item) => item.id === section)?.label ?? "Configuração";
}

export function configSectionHref(section: ConfigSectionId) {
  return `/configuracoes/${section}`;
}

export function isConfigSectionPath(pathname: string) {
  return pathname === "/configuracoes" || pathname.startsWith("/configuracoes/");
}
