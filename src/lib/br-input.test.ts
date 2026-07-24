import { describe, expect, it } from "vitest";

import {
  digitsOnly,
  formatCpf,
  formatEmailInput,
  formatPhoneBr,
  isValidCpf,
  isValidEmail,
  isValidPhoneBr,
} from "@/lib/br-input";

describe("br-input", () => {
  it("formata CPF", () => {
    expect(formatCpf("529982247")).toBe("529.982.247");
    expect(formatCpf("52998224725")).toBe("529.982.247-25");
    expect(digitsOnly("529.982.247-25")).toBe("52998224725");
  });

  it("valida dígitos verificadores do CPF", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("11111111111")).toBe(false);
    expect(isValidCpf("52998224724")).toBe(false);
    expect(isValidCpf("123")).toBe(false);
  });

  it("formata telefone BR", () => {
    expect(formatPhoneBr("11987654321")).toBe("(11) 98765-4321");
    expect(formatPhoneBr("1134567890")).toBe("(11) 3456-7890");
    expect(isValidPhoneBr("(11) 98765-4321")).toBe(true);
    expect(isValidPhoneBr("119876")).toBe(false);
  });

  it("normaliza e valida e-mail", () => {
    expect(formatEmailInput(" Foo.Bar@Email.COM ")).toBe("foo.bar@email.com");
    expect(isValidEmail("foo@bar.com")).toBe(true);
    expect(isValidEmail("foo.bar+tag@mandato.digital")).toBe(true);
    expect(isValidEmail("foo")).toBe(false);
    expect(isValidEmail("foo@bar")).toBe(false);
    expect(isValidEmail("foo@bar.c")).toBe(false);
    expect(isValidEmail("@email.com")).toBe(false);
  });
});
