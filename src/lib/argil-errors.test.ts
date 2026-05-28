import { describe, expect, it } from "vitest";

import { formatArgilApiError, isArgilAvatarLimitError } from "@/lib/argil";

describe("formatArgilApiError", () => {
  it("traduz limite de avatares da Argil", () => {
    const message = formatArgilApiError(
      "/avatars",
      400,
      JSON.stringify({
        success: false,
        error: {
          code: "INVALID_INPUT",
          message:
            "Failed to create avatar: Avatar limit exceeded. Maximum allowed: 10, current count: 10",
        },
      }),
    );

    expect(isArgilAvatarLimitError(message)).toBe(true);
    expect(message).toContain("Limite de avatares na Argil");
    expect(message).toContain("app.argil.ai");
  });
});
