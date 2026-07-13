import { describe, expect, it } from "vitest";

import { formatApiErrorMessage } from "@/lib/api";
import { HEYGEN_VOICE_CLONE_LIMIT_MESSAGE } from "@/lib/heygen-voice-resolve";

describe("formatApiErrorMessage", () => {
  it("traduz limite de clone de voz para mensagem amigavel", () => {
    const message = formatApiErrorMessage(new Error(HEYGEN_VOICE_CLONE_LIMIT_MESSAGE));
    expect(message).toContain("Limite de clones de voz");
    expect(message.toLowerCase()).not.toContain("contact support");
  });
});
