import { describe, expect, it } from "vitest";

import {
  CANONICAL_PRODUCT_ORIGIN,
  getPasswordResetContinueUrl,
} from "@/lib/auth/redirect-url";

describe("getPasswordResetContinueUrl", () => {
  it("usa o apex canônico quando a origem é o domínio de produto", () => {
    expect(getPasswordResetContinueUrl("https://mandatodigital.ia.br")).toBe(
      `${CANONICAL_PRODUCT_ORIGIN}/login`,
    );
    expect(getPasswordResetContinueUrl("https://www.mandatodigital.ia.br")).toBe(
      `${CANONICAL_PRODUCT_ORIGIN}/login`,
    );
  });

  it("preserva localhost e hosts de staging", () => {
    expect(getPasswordResetContinueUrl("http://localhost:3000")).toBe(
      "http://localhost:3000/login",
    );
    expect(
      getPasswordResetContinueUrl(
        "https://mandatodigital-stg--madatodigital.us-central1.hosted.app",
      ),
    ).toBe("https://mandatodigital-stg--madatodigital.us-central1.hosted.app/login");
  });

  it("cai no apex quando a origem está ausente ou inválida", () => {
    expect(getPasswordResetContinueUrl()).toBe(`${CANONICAL_PRODUCT_ORIGIN}/login`);
    expect(getPasswordResetContinueUrl("not-a-url")).toBe(
      `${CANONICAL_PRODUCT_ORIGIN}/login`,
    );
  });
});
