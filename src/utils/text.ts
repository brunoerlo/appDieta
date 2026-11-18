import { FoodItem } from '../types/domain';

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
 * Splits a search query into normalized word tokens (preserving punctuation inside symbols/JSON).
 */
export function tokenizeFoodQuery(query: string): string[] {
  const normalized = normalizeFoodText(query);
  if (!normalized) return [];
  return normalized
    .replace(/[,;]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8);
}

/**
 * Checks whether a food item matches all normalized query tokens across name / nameNormalized.
 */
export function matchesFoodTokens(
  item: { name: string; nameNormalized?: string | null },
  tokens: string[]
): boolean {
  if (tokens.length === 0) return true;
  const normName = normalizeFoodText(item.name);
  const normCached = item.nameNormalized ? normalizeFoodText(item.nameNormalized) : '';
  return tokens.every((t) => normName.includes(t) || (normCached.length > 0 && normCached.includes(t)));
}

/**
 * Deduplicates food items preserving order (earlier entries win) by id, barcode, and normalized (name + source).
 */
export function dedupeFoods(items: FoodItem[]): FoodItem[] {
  const seenIds = new Set<string>();
  const seenBarcodes = new Set<string>();
  const seenNameSource = new Set<string>();
  const result: FoodItem[] = [];

  for (const item of items) {
    if (!item || !item.id) continue;
    if (seenIds.has(item.id)) continue;

    const cleanBarcode = typeof item.barcode === 'string' ? item.barcode.trim() : '';
    if (cleanBarcode && seenBarcodes.has(cleanBarcode)) continue;

    const normName = item.nameNormalized
      ? normalizeFoodText(item.nameNormalized)
      : normalizeFoodText(item.name);
    const shouldDedupeByName = item.source !== 'custom';
    const nameSourceKey = shouldDedupeByName && normName ? `${normName}|${item.source}` : '';
    if (nameSourceKey && seenNameSource.has(nameSourceKey)) continue;

    seenIds.add(item.id);
    if (cleanBarcode) seenBarcodes.add(cleanBarcode);
    if (nameSourceKey) seenNameSource.add(nameSourceKey);
    result.push(item);
  }

  return result;
}

/**
 * Alias for normalizeFoodText.
 */
export const normalizeFoodName = normalizeFoodText;
