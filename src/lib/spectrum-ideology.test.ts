import { describe, expect, it } from "vitest";

import { classifyIdeologyLane } from "@/lib/spectrum-ideology";

describe("classifyIdeologyLane", () => {
  it("classifica esquerda, centro e direita", () => {
    expect(classifyIdeologyLane("Esquerda")).toBe("esquerda");
    expect(classifyIdeologyLane("Centro-Esquerda")).toBe("esquerda");
    expect(classifyIdeologyLane("Centro")).toBe("centro");
    expect(classifyIdeologyLane("Direita")).toBe("direita");
    expect(classifyIdeologyLane("Centro-Direita")).toBe("direita");
  });

  it("retorna null sem espectro", () => {
    expect(classifyIdeologyLane("")).toBeNull();
    expect(classifyIdeologyLane(undefined)).toBeNull();
  });
});
