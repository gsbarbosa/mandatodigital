import { describe, expect, it } from "vitest";

import {
  isRegistrationAllowedPath,
  PLAN_SELECTION_PATH,
  REGISTRATION_REQUIRED_PATH,
  resolvePostLoginPath,
} from "@/lib/registration-gate";

describe("registration-gate", () => {
  describe("isRegistrationAllowedPath", () => {
    it("permite dados pessoais e escolha de plano", () => {
      expect(isRegistrationAllowedPath("/acesso-antecipado/dados")).toBe(true);
      expect(isRegistrationAllowedPath("/acesso-antecipado/dados/")).toBe(true);
      expect(isRegistrationAllowedPath("/acesso-antecipado/planos")).toBe(true);
      expect(isRegistrationAllowedPath("/acesso-antecipado/planos/")).toBe(true);
    });

    it("bloqueia cnpj e o restante do produto", () => {
      expect(isRegistrationAllowedPath("/acesso-antecipado/cnpj")).toBe(false);
      expect(isRegistrationAllowedPath("/monitoramento")).toBe(false);
      expect(isRegistrationAllowedPath("/app")).toBe(false);
      expect(isRegistrationAllowedPath("/criativo")).toBe(false);
    });
  });

  describe("resolvePostLoginPath", () => {
    it("manda cadastro incompleto para dados pessoais", () => {
      expect(
        resolvePostLoginPath({
          registrationComplete: false,
          nextPath: "/monitoramento",
        }),
      ).toBe(REGISTRATION_REQUIRED_PATH);

      expect(
        resolvePostLoginPath({
          registrationComplete: false,
          nextPath: "/acesso-antecipado/planos",
        }),
      ).toBe(REGISTRATION_REQUIRED_PATH);
    });

    it("manda para planos quando só falta escolher o plano", () => {
      expect(
        resolvePostLoginPath({
          registrationComplete: false,
          needsPlanSelection: true,
          nextPath: "/monitoramento",
        }),
      ).toBe(PLAN_SELECTION_PATH);
    });

    it("preserva o plano escolhido no redirect de cadastro incompleto", () => {
      expect(
        resolvePostLoginPath({
          registrationComplete: false,
          nextPath: "/acesso-antecipado/dados?plan=elite",
        }),
      ).toBe("/acesso-antecipado/dados?plan=elite");
    });

    it("respeita next seguro quando o cadastro está completo", () => {
      expect(
        resolvePostLoginPath({
          registrationComplete: true,
          nextPath: "/monitoramento",
        }),
      ).toBe("/monitoramento");

      expect(
        resolvePostLoginPath({
          registrationComplete: true,
          nextPath: null,
        }),
      ).toBe("/app");
    });

    it("rejeita next inválido e cai em /app", () => {
      expect(
        resolvePostLoginPath({
          registrationComplete: true,
          nextPath: "//evil.example",
        }),
      ).toBe("/app");

      expect(
        resolvePostLoginPath({
          registrationComplete: true,
          nextPath: "https://evil.example",
        }),
      ).toBe("/app");
    });
  });
});
