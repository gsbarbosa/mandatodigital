/**
 * Normalização de telefone brasileiro para E.164 + classificação móvel/fixo.
 *
 * A base de dirigentes do TSE traz o telefone em formato livre ("(68) 9999-4488"),
 * às vezes com vários números no mesmo campo separados por "/", e com números
 * anteriores ao 9º dígito. Só linha móvel serve para WhatsApp.
 */

const MOBILE_LEGACY_FIRST_DIGITS = new Set(["6", "7", "8", "9"]);

export type ClassifiedPhone = {
  raw: string;
  e164: string;
  isMobile: boolean;
};

/** Um campo pode conter vários números: "(68) 99985-1500 / (68) 99984-7220". */
export function splitPhoneField(field: string): string[] {
  return field
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * `null` quando o número não é reconhecível (tamanho ou DDD inválido).
 *
 * Convenção brasileira: móvel começa em 6-9, fixo em 2-5. Números de 8 dígitos
 * anteriores à migração ganham o 9º dígito quando são móveis.
 */
export function classifyPhone(raw: string): ClassifiedPhone | null {
  let digits = raw.replace(/\D/g, "");

  if (digits.startsWith("55") && digits.length > 11) {
    digits = digits.slice(2);
  }
  // Prefixo de discagem ("0" + número) só é removido quando sobra número
  // demais para ser um DDD+assinante normal. Um número de 10-11 dígitos que
  // começa com 0 tem DDD inválido (nenhum DDD começa com 0) e é descartado
  // adiante — remover o zero aqui viraria outro número real: "(01) 99999-9999"
  // vira "19 9999-9999", que é a linha de outra pessoa.
  if (digits.startsWith("0") && digits.length >= 12) {
    digits = digits.slice(1);
  }

  if (digits.length < 10 || digits.length > 11) {
    return null;
  }

  const ddd = digits.slice(0, 2);
  const dddNumber = Number(ddd);
  if (dddNumber < 11 || dddNumber > 99) {
    return null;
  }

  let subscriber = digits.slice(2);
  let isMobile: boolean;

  if (subscriber.length === 9) {
    isMobile = subscriber.startsWith("9");
  } else {
    isMobile = MOBILE_LEGACY_FIRST_DIGITS.has(subscriber[0] ?? "");
    if (isMobile) {
      subscriber = `9${subscriber}`;
    }
  }

  return { raw, e164: `55${ddd}${subscriber}`, isMobile };
}

/** Primeiro número móvel do campo, já em E.164. Vazio quando não há. */
export function firstMobileE164(field: string): string {
  for (const part of splitPhoneField(field)) {
    const classified = classifyPhone(part);
    if (classified?.isMobile) {
      return classified.e164;
    }
  }
  return "";
}
