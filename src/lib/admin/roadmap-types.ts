export const ROADMAP_STATUSES = ["todo", "inprogress", "done"] as const;
export type RoadmapStatus = (typeof ROADMAP_STATUSES)[number];

export const ROADMAP_VALIDATED = ["pendente", "sim", "n/a"] as const;
export type RoadmapValidated = (typeof ROADMAP_VALIDATED)[number];

export const ROADMAP_SECTIONS = [
  "experiencia",
  "sistema-agora",
  "pos-25",
  "features-novas",
] as const;
export type RoadmapSection = (typeof ROADMAP_SECTIONS)[number];

export const ROADMAP_SECTION_LABELS: Record<RoadmapSection, string> = {
  experiencia: "1. Experiência e produto atual",
  "sistema-agora": "2. Atividades sistema — agora",
  "pos-25": "3. Pós 25/ — pagamentos e materialidade",
  "features-novas": "4. Features novas",
};

export const ROADMAP_STATUS_LABELS: Record<RoadmapStatus, string> = {
  todo: "A fazer",
  inprogress: "Em andamento",
  done: "Feito",
};

export const ROADMAP_VALIDATED_LABELS: Record<RoadmapValidated, string> = {
  pendente: "Pendente",
  sim: "Sim",
  "n/a": "N/A",
};

export type RoadmapTask = {
  id: string;
  title: string;
  status: RoadmapStatus;
  validatedByThiago: RoadmapValidated;
  observation: string;
  section: RoadmapSection;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type RoadmapTaskInput = {
  title: string;
  status?: RoadmapStatus;
  validatedByThiago?: RoadmapValidated;
  observation?: string;
  section?: RoadmapSection;
  sortOrder?: number;
};

export function isRoadmapStatus(value: unknown): value is RoadmapStatus {
  return ROADMAP_STATUSES.includes(value as RoadmapStatus);
}

export function isRoadmapValidated(value: unknown): value is RoadmapValidated {
  return ROADMAP_VALIDATED.includes(value as RoadmapValidated);
}

export function isRoadmapSection(value: unknown): value is RoadmapSection {
  return ROADMAP_SECTIONS.includes(value as RoadmapSection);
}
