import { describe, expect, it } from "vitest";

import {
  isRegistrationAllowedPath,
  PLAN_SELECTION_PATH,
  REGISTRATION_REQUIRED_PATH,
  resolveIncompleteRegistrationPath,
  resolvePostLoginPath,
} from "@/lib/registration-gate";

describe("registration-gate", () => {
  describe("isRegistrationAllowedPath", () => {
    it("permite dados pessoais e planos", () => {
      expect(isRegistrationAllowedPath("/acesso-antecipado/dados")).toBe(true);
      expect(isRegistrationAllowedPath("/acesso-antecipado/dados/")).toBe(true);
      expect(isRegistrationAllowedPath("/acesso-antecipado/planos")).toBe(true);
      expect(isRegistrationAllowedPath("/acesso-antecipado/planos/")).toBe(true);
    });

    it("bloqueia demonstracao, cnpj e o restante do produto", () => {
      expect(isRegistrationAllowedPath("/acesso-antecipado/demonstracao")).toBe(false);
      expect(isRegistrationAllowedPath("/acesso-antecipado/cnpj")).toBe(false);
      expect(isRegistrationAllowedPath("/monitoramento")).toBe(false);
      expect(isRegistrationAllowedPath("/app")).toBe(false);
      expect(isRegistrationAllowedPath("/criativo")).toBe(false);
    });
  });

  describe("resolveIncompleteRegistrationPath", () => {
    it("manda para planos quando ainda falta plano (legado)", () => {
      expect(
        resolveIncompleteRegistrationPath({
          needsPlanSelection: true,
        }),
      ).toBe(PLAN_SELECTION_PATH);

      expect(
        resolveIncompleteRegistrationPath({
          needsPlanSelection: false,
        }),
      ).toBe(REGISTRATION_REQUIRED_PATH);
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

    it("manda para planos quando so falta escolher o plano (legado)", () => {
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

    it("respeita next seguro quando o cadastro esta completo", () => {
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

    it("rejeita next invalido e cai em /app", () => {
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
