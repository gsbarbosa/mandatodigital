import { describe, expect, it } from "vitest";

import {
  normalizeAuthEmail,
  validateAuthCredentials,
  validateAuthEmail,
  validateAuthPassword,
} from "@/lib/auth-field-validation";

describe("auth-field-validation", () => {
  it("normaliza e valida e-mail", () => {
    expect(normalizeAuthEmail("  Foo.Bar@Email.COM ")).toBe("foo.bar@email.com");
    expect(validateAuthEmail("")).toMatch(/informe/i);
    expect(validateAuthEmail("sem-arroba")).toMatch(/inválido/i);
    expect(validateAuthEmail("ok@dominio.com")).toBeNull();
  });

  it("valida senha no login e no cadastro", () => {
    expect(validateAuthPassword("", "login")).toMatch(/informe/i);
    expect(validateAuthPassword("123", "login")).toMatch(/6/);
    expect(validateAuthPassword("123456", "login")).toBeNull();

    expect(validateAuthPassword("abcdefg", "signup")).toMatch(/8|número/i);
    expect(validateAuthPassword("abcdefgh", "signup")).toMatch(/número/i);
    expect(validateAuthPassword("12345678", "signup")).toMatch(/letra/i);
    expect(validateAuthPassword("abcde123", "signup")).toBeNull();
  });

  it("agrega erros de credenciais", () => {
    const errors = validateAuthCredentials({
      email: "x",
      password: "1",
      mode: "signup",
    });
    expect(errors.email).toBeTruthy();
    expect(errors.password).toBeTruthy();
  });
});
