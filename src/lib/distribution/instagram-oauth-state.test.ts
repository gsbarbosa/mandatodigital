import { describe, expect, it } from "vitest";

import {
  createInstagramOAuthState,
  parseInstagramOAuthState,
} from "@/lib/distribution/instagram-oauth-state";

describe("instagram oauth state", () => {
  it("assina e valida profileId/owner", () => {
    const state = createInstagramOAuthState("profile-1", "owner-9");
    expect(parseInstagramOAuthState(state)).toEqual({
      profileId: "profile-1",
      ownerUserId: "owner-9",
    });
  });

  it("rejeita assinatura adulterada", () => {
    const state = createInstagramOAuthState("profile-1", "owner-9");
    const tampered = `${state.slice(0, -2)}aa`;
    expect(parseInstagramOAuthState(tampered)).toBeNull();
  });
});
