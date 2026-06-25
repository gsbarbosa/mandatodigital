import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/heygen", () => ({
  formatHeyGenError: (error: unknown) =>
    error instanceof Error ? error.message : String(error),
  heygenCreateAvatarConsent: vi.fn(),
  heygenGetAvatarGroup: vi.fn(),
}));

import {
  heygenCreateAvatarConsent,
  heygenGetAvatarGroup,
} from "@/lib/heygen";
import { resolveHeyGenAvatarConsentLink } from "@/lib/heygen-consent-resolve";

describe("resolveHeyGenAvatarConsentLink", () => {
  beforeEach(() => {
    vi.mocked(heygenCreateAvatarConsent).mockReset();
    vi.mocked(heygenGetAvatarGroup).mockReset();
  });

  it("nao solicita link quando consentimento ja esta aprovado", async () => {
    const result = await resolveHeyGenAvatarConsentLink({
      groupId: "group-1",
      consentStatus: "completed",
    });

    expect(result).toEqual({
      consentUrl: null,
      consentStatus: "completed",
      needsConsent: false,
    });
    expect(heygenCreateAvatarConsent).not.toHaveBeenCalled();
  });

  it("trata security code already binded como consentimento concluido", async () => {
    vi.mocked(heygenCreateAvatarConsent).mockRejectedValue(
      new Error("Security code already binded"),
    );
    vi.mocked(heygenGetAvatarGroup).mockResolvedValue({
      data: {
        avatar_group: {
          id: "group-1",
          consent_status: "pending",
          status: "pending_consent",
        },
      },
    });

    const result = await resolveHeyGenAvatarConsentLink({
      groupId: "group-1",
      consentStatus: "pending",
      requireFreshLink: true,
    });

    expect(result.needsConsent).toBe(false);
    expect(result.consentUrl).toBeNull();
  });
});
