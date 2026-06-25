import type { CreativeProject } from "@/lib/types";

export const FREE_PROMPT_CREATIVE_TOPIC_LABEL =
  "Conteúdo gerado a partir de Prompt Livre";

export function formatCreativeProjectTitle(
  project: Pick<CreativeProject, "topic" | "useFreePrompt">,
) {
  if (project.useFreePrompt) {
    return FREE_PROMPT_CREATIVE_TOPIC_LABEL;
  }

  return project.topic.trim() || "(sem tema)";
}

export function resolveCreativeProjectTopicForSave(input: {
  topic: string;
  useFreePrompt: boolean;
}) {
  if (input.useFreePrompt) {
    return FREE_PROMPT_CREATIVE_TOPIC_LABEL;
  }

  return input.topic;
}
