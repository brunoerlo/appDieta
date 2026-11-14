import { FoodItem } from '../types/domain';

export interface IOpenFoodFactsService {
  searchFoods(query: string, pageSize?: number): Promise<FoodItem[]>;
  getFoodByBarcode(barcode: string): Promise<FoodItem | null>;
  searchByKeyword(query: string, limit?: number): Promise<FoodItem[]>;
  getProductByBarcode(barcode: string): Promise<FoodItem | null>;
}

export class OpenFoodFactsService implements IOpenFoodFactsService {
  private userAgent = 'IronTrack-App/1.0 (iOS; iPhone 16; contact@irontrack.app)';
  private timeoutMs = 4500;

  constructor(
    private fetchFn: typeof fetch = (...args: Parameters<typeof fetch>) => fetch(...args)
  ) {}

  private parseSafeNutrient(value: unknown, max = 10000): number | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    const normalized =
      typeof value === 'string' ? value.trim().replace(',', '.') : value;
    if (normalized === '') {
      return undefined;
    }
    const num = Number(normalized);
    if (!Number.isFinite(num)) {
      return undefined;
    }
    return Math.min(max, Math.max(0, num));
  }

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchFn(url, {
        method: 'GET',
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  mapProductToFoodItem(product: any): FoodItem | null {
    if (!product || typeof product !== 'object') return null;

    const rawName =
      typeof product.product_name_pt === 'string' && product.product_name_pt.trim().length > 0
        ? product.product_name_pt
        : typeof product.product_name === 'string'
        ? product.product_name
        : '';

    if (!rawName || rawName.trim().length === 0) {
      return null;
    }

    const brand =
      typeof product.brands === 'string' && product.brands.trim().length > 0
        ? product.brands.split(',')[0].trim()
        : '';

    const trimmedName = rawName.trim().slice(0, 200);
    const fullName = (
      brand && !trimmedName.toLowerCase().includes(brand.toLowerCase())
        ? `${trimmedName} (${brand})`
        : trimmedName
    ).slice(0, 200);

    const nutriments =
      product.nutriments && typeof product.nutriments === 'object' ? product.nutriments : {};

    const kcal100g = this.parseSafeNutrient(nutriments['energy-kcal_100g'], 20000);
    const kcal = this.parseSafeNutrient(nutriments['energy-kcal'], 20000);
    const kj100g = this.parseSafeNutrient(nutriments['energy_100g'], 84000);
    const kj = this.parseSafeNutrient(nutriments['energy'], 84000);

    let calories = 0;
    if (kcal100g !== undefined) {
      calories = kcal100g;
    } else if (kcal !== undefined) {
      calories = kcal;
    } else if (kj100g !== undefined) {
      calories = Math.min(20000, kj100g / 4.184);
    } else if (kj !== undefined) {
      calories = Math.min(20000, kj / 4.184);
    }

    const protein =
      this.parseSafeNutrient(nutriments.proteins_100g ?? nutriments.proteins, 1000) ?? 0;
    const carbs =
      this.parseSafeNutrient(
        nutriments.carbohydrates_100g ?? nutriments.carbohydrates,
        1000
      ) ?? 0;
    const fat = this.parseSafeNutrient(nutriments.fat_100g ?? nutriments.fat, 1000) ?? 0;
    const fiber = this.parseSafeNutrient(nutriments.fiber_100g ?? nutriments.fiber, 1000);

    const parsedServingQty = this.parseSafeNutrient(product.serving_quantity, 10000);
    const servingUnitGrams =
      parsedServingQty !== undefined && parsedServingQty > 0 ? parsedServingQty : 100;
    const servingUnitName =
      typeof product.serving_size === 'string' && product.serving_size.trim().length > 0
        ? product.serving_size.trim().slice(0, 50)
        : 'porção';

    const codeStr =
      product.code !== undefined && product.code !== null && String(product.code).trim().length > 0
        ? String(product.code).trim()
        : undefined;

    return {
      id: `off-${codeStr || Math.random().toString(36).substring(2, 9)}`,
      name: fullName,
      category: brand || 'Industrializados',
      servingGrams: 100, // Standardized 100g reference
      calories: Number(calories.toFixed(1)),
      protein: Number(protein.toFixed(1)),
      carbs: Number(carbs.toFixed(1)),
      fat: Number(fat.toFixed(1)),
      fiber: fiber !== undefined ? Number(fiber.toFixed(1)) : undefined,
      barcode: codeStr,
      source: 'openfoodfacts',
      servingUnitName,
      servingUnitGrams: Number(servingUnitGrams.toFixed(1)),
    };
  }

  async getFoodByBarcode(barcode: string): Promise<FoodItem | null> {
    const cleanBarcode = typeof barcode === 'string' ? barcode.trim() : '';
    if (!cleanBarcode) return null;

    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
      cleanBarcode
    )}.json?fields=code,product_name,product_name_pt,brands,serving_size,serving_quantity,nutriments`;

    try {
      const res = await this.fetchWithTimeout(url);
      if (!res.ok) return null;

      const data = await res.json();
      if (!data || data.status !== 1 || !data.product) {
        return null;
      }

      return this.mapProductToFoodItem(data.product);
    } catch {
      // Graceful offline/timeout fallback
      return null;
    }
  }

  async getProductByBarcode(barcode: string): Promise<FoodItem | null> {
    return this.getFoodByBarcode(barcode);
  }

  async searchFoods(query: string, pageSize = 20): Promise<FoodItem[]> {
    const cleanQuery = typeof query === 'string' ? query.trim().slice(0, 120) : '';
    if (!cleanQuery) return [];
    const safePageSize = Math.max(1, Math.min(50, Math.floor(Number(pageSize) || 20)));

    const url = `https://br.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
      cleanQuery
    )}&search_simple=1&action=process&json=1&page_size=${safePageSize}&fields=code,product_name,product_name_pt,brands,serving_size,serving_quantity,nutriments`;

    try {
      const res = await this.fetchWithTimeout(url);
      if (!res.ok) return [];

      const data = await res.json();
      if (!data || !data.products || !Array.isArray(data.products)) {
        return [];
      }

      const items: FoodItem[] = [];
      for (const p of data.products) {
        const item = this.mapProductToFoodItem(p);
        if (item) items.push(item);
      }
      return items;
    } catch {
      // Graceful offline/timeout fallback
      return [];
    }
  }

  async searchByKeyword(query: string, limit = 20): Promise<FoodItem[]> {
    return this.searchFoods(query, limit);
  }
}

export const openFoodFactsService = new OpenFoodFactsService();
