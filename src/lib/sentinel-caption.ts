/**
 * Remove hashtags da legenda antes do match de temas — evita falso positivo
 * (#vacina, #sus) sem relação com o corpo do texto.
 */
export function stripHashtagsForThemeMatching(text: string) {
  return text
    .replace(/#[\p{L}\p{N}_]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
