/**
 * Opt-out de template frio. Fail-closed: só marca com pedido explícito de parar.
 */

const OPT_OUT_EXACT = new Set([
  "parar",
  "pare",
  "stop",
  "sair",
  "cancelar",
  "cancela",
  "descadastre",
  "descadastrar",
  "nao",
  "não",
  "nao obrigado",
  "não obrigado",
  "nao, obrigado",
  "não, obrigado",
]);

const OPT_OUT_PHRASES = [
  "nao tenho interesse",
  "não tenho interesse",
  "nao quero mais",
  "não quero mais",
  "pode parar",
  "pare de mandar",
  "nao me envie",
  "não me envie",
  "remover meu numero",
  "remover meu número",
];

export function normalizeOptOutText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isOptOutText(text: string): boolean {
  const normalized = normalizeOptOutText(text);
  if (!normalized) {
    return false;
  }
  if (OPT_OUT_EXACT.has(normalized)) {
    return true;
  }
  return OPT_OUT_PHRASES.some((phrase) => normalized.includes(phrase));
}
