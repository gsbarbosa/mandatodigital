/** Utilitários de entrada BR: CPF, telefone e e-mail. */

export function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

/** Máscara 000.000.000-00 */
export function formatCpf(value: string) {
  const d = digitsOnly(value).slice(0, 11);
  if (d.length <= 3) {
    return d;
  }
  if (d.length <= 6) {
    return `${d.slice(0, 3)}.${d.slice(3)}`;
  }
  if (d.length <= 9) {
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  }
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Valida CPF pelos dígitos verificadores (rejeita sequências repetidas). */
export function isValidCpf(value: string) {
  const cpf = digitsOnly(value);
  if (cpf.length !== 11) {
    return false;
  }
  if (/^(\d)\1{10}$/.test(cpf)) {
    return false;
  }

  const calcDigit = (base: string, factor: number) => {
    let sum = 0;
    for (let i = 0; i < base.length; i += 1) {
      sum += Number(base[i]) * (factor - i);
    }
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };

  const d1 = calcDigit(cpf.slice(0, 9), 10);
  const d2 = calcDigit(cpf.slice(0, 10), 11);
  return d1 === Number(cpf[9]) && d2 === Number(cpf[10]);
}

/** Máscara (00) 0000-0000 ou (00) 00000-0000 */
export function formatPhoneBr(value: string) {
  const d = digitsOnly(value).slice(0, 11);
  if (d.length === 0) {
    return "";
  }
  if (d.length <= 2) {
    return `(${d}`;
  }
  if (d.length <= 6) {
    return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  }
  if (d.length <= 10) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function isValidPhoneBr(value: string) {
  const d = digitsOnly(value);
  return d.length === 10 || d.length === 11;
}

/** “Máscara” de e-mail: minúsculas, sem espaços. */
export function formatEmailInput(value: string) {
  return value.replace(/\s+/g, "").toLowerCase();
}

/**
 * Valida estrutura básica de e-mail:
 * local@domínio.tld (tld ≥ 2 letras; sem espaços; um @).
 */
export function isValidEmail(value: string) {
  const email = formatEmailInput(value);
  if (!email || email.length > 254) {
    return false;
  }
  return /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/i.test(email);
}
