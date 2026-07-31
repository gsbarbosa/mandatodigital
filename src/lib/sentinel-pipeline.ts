export type SentinelPipeline =
  | "manual"
  | "portal"
  | "semantic"
  | "social"
  | "legacy"
  | "geo-fallback";

export const SENTINEL_PIPELINE_WEIGHT: Record<SentinelPipeline, number> = {
  manual: 1,
  social: 1.05,
  /** Portais UF/nacionais: prioridade sobre Google News genérico. */
  portal: 1.12,
  semantic: 0.78,
  legacy: 0.9,
  /** Ampliação municipal quando temas do radar não cobrem a cidade. */
  "geo-fallback": 0.85,
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
    case "geo-fallback":
      return "Local (ampliado)";
    default:
      return "Radar";
  }
}

export function applyPipelineWeight(score: number, pipeline: SentinelPipeline) {
  return Math.min(99, Math.round(score * SENTINEL_PIPELINE_WEIGHT[pipeline]));
}
