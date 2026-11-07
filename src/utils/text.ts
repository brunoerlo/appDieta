/**
 * Normalizes text for search by decomposing Unicode diacritics,
 * stripping accent marks, converting to lowercase, and trimming.
 * Example: "Pão francês" -> "pao frances"
 * Example: "Maçã fuji" -> "maca fuji"
 * Example: "AÇAÍ" -> "acai"
 */
export function normalizeFoodText(input: string): string {
  if (!input) return '';
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Alias for normalizeFoodText.
 */
export const normalizeFoodName = normalizeFoodText;
