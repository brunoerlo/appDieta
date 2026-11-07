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

    const name = product.product_name_pt || product.product_name;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return null;
    }

    const brand = product.brands ? product.brands.split(',')[0].trim() : '';
    const fullName = brand && !name.toLowerCase().includes(brand.toLowerCase())
      ? `${name.trim()} (${brand})`
      : name.trim();

    const nutriments = product.nutriments || {};

    let calories = 0;
    if (typeof nutriments['energy-kcal_100g'] === 'number') {
      calories = nutriments['energy-kcal_100g'];
    } else if (typeof nutriments['energy-kcal'] === 'number') {
      calories = nutriments['energy-kcal'];
    } else if (typeof nutriments['energy_100g'] === 'number') {
      calories = nutriments['energy_100g'] / 4.184;
    } else if (typeof nutriments['energy'] === 'number') {
      calories = nutriments['energy'] / 4.184;
    }

    const protein = Number(nutriments.proteins_100g ?? nutriments.proteins ?? 0);
    const carbs = Number(nutriments.carbohydrates_100g ?? nutriments.carbohydrates ?? 0);
    const fat = Number(nutriments.fat_100g ?? nutriments.fat ?? 0);
    const fiber = nutriments.fiber_100g !== undefined
      ? Number(nutriments.fiber_100g)
      : nutriments.fiber !== undefined
      ? Number(nutriments.fiber)
      : undefined;

    const servingUnitGrams = typeof product.serving_quantity === 'number' && product.serving_quantity > 0
      ? product.serving_quantity
      : 100;
    const servingUnitName = product.serving_size ? product.serving_size.trim() : 'porção';

    return {
      id: `off-${product.code || Math.random().toString(36).substring(2, 9)}`,
      name: fullName,
      category: brand || 'Industrializados',
      servingGrams: 100, // Standardized 100g reference
      calories: Number(calories.toFixed(1)),
      protein: Number(protein.toFixed(1)),
      carbs: Number(carbs.toFixed(1)),
      fat: Number(fat.toFixed(1)),
      fiber: fiber !== undefined ? Number(fiber.toFixed(1)) : undefined,
      barcode: product.code || undefined,
      source: 'openfoodfacts',
      servingUnitName,
      servingUnitGrams,
    };
  }

  async getFoodByBarcode(barcode: string): Promise<FoodItem | null> {
    const cleanBarcode = barcode ? barcode.trim() : '';
    if (!cleanBarcode) return null;

    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
      cleanBarcode
    )}.json?fields=code,product_name,product_name_pt,brands,serving_size,serving_quantity,nutriments`;

    try {
      const res = await this.fetchWithTimeout(url);
      if (!res.ok) return null;

      const data = await res.json();
      if (data.status !== 1 || !data.product) {
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
    const cleanQuery = query ? query.trim().slice(0, 120) : '';
    if (!cleanQuery) return [];
    const safePageSize = Math.max(1, Math.min(50, Math.floor(Number(pageSize) || 20)));

    const url = `https://br.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
      cleanQuery
    )}&search_simple=1&action=process&json=1&page_size=${safePageSize}&fields=code,product_name,product_name_pt,brands,serving_size,serving_quantity,nutriments`;

    try {
      const res = await this.fetchWithTimeout(url);
      if (!res.ok) return [];

      const data = await res.json();
      if (!data.products || !Array.isArray(data.products)) {
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
