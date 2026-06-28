export type SentinelPipeline = "manual" | "portal" | "semantic" | "social" | "legacy";

export const SENTINEL_PIPELINE_WEIGHT: Record<SentinelPipeline, number> = {
  manual: 1,
  social: 1,
  portal: 0.95,
  semantic: 0.78,
  legacy: 0.9,
};

export function sentinelPipelineLabel(pipeline: SentinelPipeline) {
  switch (pipeline) {
    case "manual":
      return "Tema manual";
    case "portal":
      return "Portal";
    case "semantic":
      return "Semântico";
    case "social":
      return "Social";
    default:
      return "Radar";
  }
}

export function applyPipelineWeight(score: number, pipeline: SentinelPipeline) {
  return Math.min(99, Math.round(score * SENTINEL_PIPELINE_WEIGHT[pipeline]));
}
