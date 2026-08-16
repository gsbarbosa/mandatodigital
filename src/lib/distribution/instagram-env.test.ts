import { describe, expect, it } from "vitest";

import { instagramRedirectUriFromRequest } from "@/lib/distribution/instagram-env";

describe("instagramRedirectUriFromRequest", () => {
  it("usa o host de staging no callback", () => {
    const request = new Request("https://internal.example/api/distribution/connections/link", {
      headers: {
        "x-forwarded-host": "mandatodigital-stg--madatodigital.us-central1.hosted.app",
        "x-forwarded-proto": "https",
      },
    });
    expect(instagramRedirectUriFromRequest(request)).toBe(
      "https://mandatodigital-stg--madatodigital.us-central1.hosted.app/api/distribution/instagram/callback",
    );
  });
});
