import { describe, expect, it } from "vitest";

import { billingMethodFromAsaas, parseBillingMethod } from "./billing-method";

describe("billing-method", () => {
  it("parseia method do checkout", () => {
    expect(parseBillingMethod("pix")).toBe("pix");
    expect(parseBillingMethod("BOLETO")).toBe("boleto");
    expect(parseBillingMethod("cartao")).toBe(null);
  });

  it("mapeia billingType Asaas", () => {
    expect(billingMethodFromAsaas("PIX")).toBe("pix");
    expect(billingMethodFromAsaas("BOLETO")).toBe("boleto");
    expect(billingMethodFromAsaas("CREDIT_CARD")).toBe(null);
  });
});
