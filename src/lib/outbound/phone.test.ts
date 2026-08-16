import { describe, expect, it } from "vitest";

import { classifyPhone, firstMobileE164, splitPhoneField } from "@/lib/outbound/phone";

describe("splitPhoneField", () => {
  it("separa múltiplos números do mesmo campo", () => {
    expect(splitPhoneField("(68) 99985-1500 /  (68) 99984-7220")).toEqual([
      "(68) 99985-1500",
      "(68) 99984-7220",
    ]);
  });

  it("ignora campo vazio", () => {
    expect(splitPhoneField("")).toEqual([]);
  });
});

describe("classifyPhone", () => {
  it("normaliza móvel de 11 dígitos", () => {
    expect(classifyPhone("(68) 99963-7040")).toEqual({
      raw: "(68) 99963-7040",
      e164: "5568999637040",
      isMobile: true,
    });
  });

  it("acrescenta o 9º dígito em móvel legado de 8 dígitos", () => {
    expect(classifyPhone("(68) 9999-4488")?.e164).toBe("5568999994488");
  });

  it("classifica fixo como não-móvel e preserva os 8 dígitos", () => {
    const result = classifyPhone("(68) 3227-8771");
    expect(result?.isMobile).toBe(false);
    expect(result?.e164).toBe("556832278771");
  });

  it("remove o código do país quando já vem no número", () => {
    expect(classifyPhone("+55 (11) 98888-7777")?.e164).toBe("5511988887777");
  });

  it("descarta número curto ou com DDD inválido", () => {
    expect(classifyPhone("1234")).toBeNull();
  });

  // Regressão: remover o "0" à esquerda transformava um DDD inexistente em
  // outro válido — "(01) 99999-9999" virava a linha 19 9999-9999.
  it("descarta DDD iniciado em zero em vez de reinterpretar o número", () => {
    expect(classifyPhone("(01) 99999-9999")).toBeNull();
  });

  it("remove o prefixo de discagem quando sobra número suficiente", () => {
    expect(classifyPhone("011999998888")?.e164).toBe("5511999998888");
  });
});

describe("firstMobileE164", () => {
  it("escolhe o primeiro móvel ignorando o fixo que vem antes", () => {
    expect(firstMobileE164("(68) 3227-8771 / (68) 99963-7040")).toBe("5568999637040");
  });

  it("retorna vazio quando o campo só tem fixo", () => {
    expect(firstMobileE164("(68) 3227-8771")).toBe("");
  });
});
