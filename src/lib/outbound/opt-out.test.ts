import { describe, expect, it } from "vitest";

import { isOptOutText } from "@/lib/outbound/opt-out";

describe("isOptOutText", () => {
  it("marca pedido explícito de parar", () => {
    expect(isOptOutText("Parar")).toBe(true);
    expect(isOptOutText("STOP")).toBe(true);
    expect(isOptOutText("Não, obrigado.")).toBe(true);
    expect(isOptOutText("Não, obrigada")).toBe(true);
    expect(isOptOutText("não, obrigada.")).toBe(true);
    expect(isOptOutText("não tenho interesse")).toBe(true);
  });

  it("não marca conversa normal", () => {
    expect(isOptOutText("tenho interesse")).toBe(false);
    expect(isOptOutText("pode me mandar a página")).toBe(false);
    expect(isOptOutText("")).toBe(false);
  });
});
