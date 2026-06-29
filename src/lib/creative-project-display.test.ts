import { describe, expect, it } from "vitest";

import {
  FREE_PROMPT_CREATIVE_TOPIC_LABEL,
  formatCreativeProjectTitle,
  resolveCreativeProjectTopicForSave,
} from "@/lib/creative-project-display";

describe("creative-project-display", () => {
  it("usa titulo fixo na listagem quando foi prompt livre", () => {
    expect(
      formatCreativeProjectTitle({
        useFreePrompt: true,
        topic: "Tema antigo da Camara Municipal",
      }),
    ).toBe(FREE_PROMPT_CREATIVE_TOPIC_LABEL);
  });

  it("mantem o tema quando não foi prompt livre", () => {
    expect(
      formatCreativeProjectTitle({
        useFreePrompt: false,
        topic: "Saude no municipio",
      }),
    ).toBe("Saude no municipio");
  });

  it("salva titulo fixo ao persistir prompt livre", () => {
    expect(
      resolveCreativeProjectTopicForSave({
        useFreePrompt: true,
        topic: "Historico do sentinela",
      }),
    ).toBe(FREE_PROMPT_CREATIVE_TOPIC_LABEL);
  });
});
