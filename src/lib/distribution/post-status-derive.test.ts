import { describe, expect, it } from "vitest";

import { derivePostStatus } from "@/lib/async-jobs-workers";

function state(status: string) {
  return {
    status,
    externalPostId: null,
    postUrl: null,
    error: null,
    updatedAt: "2026-08-17T00:00:00.000Z",
  } as never;
}

describe("derivePostStatus", () => {
  it("publicado vence a flag de agendamento", () => {
    // Regressao: com `scheduled` checado antes de `published`, todo pacote com
    // scheduledAt ficava preso em "scheduled" mesmo apos publicar tudo.
    expect(derivePostStatus([state("published")], true)).toBe("published");
    expect(derivePostStatus([state("published"), state("published")], true)).toBe(
      "published",
    );
  });

  it("mantem scheduled enquanto os canais nao publicaram", () => {
    expect(derivePostStatus([state("scheduled")], true)).toBe("scheduled");
    expect(derivePostStatus([state("scheduled")], false)).toBe("scheduled");
  });

  it("falha total e parcial vencem tudo", () => {
    expect(derivePostStatus([state("failed")], true)).toBe("failed");
    expect(derivePostStatus([state("failed"), state("published")], true)).toBe(
      "partial_failure",
    );
  });

  it("sem canais e failed", () => {
    expect(derivePostStatus([], false)).toBe("failed");
  });

  it("misto publicado/pendente ainda esta publicando", () => {
    expect(derivePostStatus([state("published"), state("pending")], false)).toBe(
      "publishing",
    );
  });
});
