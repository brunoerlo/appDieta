import { OpenFoodFactsService } from '@/services/OpenFoodFactsService';

describe('Unit: OpenFoodFactsService', () => {
  let mockFetch: jest.Mock;
  let service: OpenFoodFactsService;

  beforeEach(() => {
    mockFetch = jest.fn();
    service = new OpenFoodFactsService(mockFetch as any);
  });

  describe('getFoodByBarcode', () => {
    it('parses valid JSON response and maps to FoodItem with 100g base reference', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 1,
          product: {
            code: '7898215150014',
            product_name: 'Leite Integral',
            product_name_pt: 'Leite Integral Piracanjuba',
            brands: 'Piracanjuba',
            serving_size: '200ml',
            serving_quantity: 200,
            nutriments: {
              'energy-kcal_100g': 60,
              proteins_100g: 3.1,
              carbohydrates_100g: 4.8,
              fat_100g: 3.0,
              fiber_100g: 0.0,
            },
          },
        }),
      });

      const food = await service.getFoodByBarcode('7898215150014');

      expect(food).not.toBeNull();
      expect(food?.name).toContain('Leite Integral Piracanjuba');
      expect(food?.barcode).toBe('7898215150014');
      expect(food?.servingGrams).toBe(100);
      expect(food?.calories).toBe(60);
      expect(food?.protein).toBe(3.1);
      expect(food?.carbs).toBe(4.8);
      expect(food?.fat).toBe(3.0);
      expect(food?.source).toBe('openfoodfacts');
    });

    it('extracts primary brand as category and handles brand in name', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 1,
          product: {
            code: '7891000100200',
            product_name: 'Iogurte Grego',
            brands: 'Nestle, Batavo',
            nutriments: {
              'energy-kcal': 80,
              proteins: 5,
              carbohydrates: 10,
              fat: 2,
            },
          },
        }),
      });

      const food = await service.getFoodByBarcode('7891000100200');
      expect(food?.category).toBe('Nestle');
      expect(food?.name).toBe('Iogurte Grego (Nestle)');
    });

    it('returns null when product is not found (status = 0)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 0,
          status_verbose: 'product not found',
        }),
      });

      const food = await service.getFoodByBarcode('0000000000000');
      expect(food).toBeNull();
    });

    it('returns null on HTTP 404 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const food = await service.getFoodByBarcode('1234567890123');
      expect(food).toBeNull();
    });

    it('handles network exceptions / timeouts gracefully returning null', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

      const food = await service.getFoodByBarcode('7891234567890');
      expect(food).toBeNull();
    });

    it('handles missing nutriments object without throwing and setting 0 values', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 1,
          product: {
            code: '7890000000001',
            product_name: 'Produto Desconhecido Sem Nutrientes',
          },
        }),
      });

      const food = await service.getFoodByBarcode('7890000000001');
      expect(food).not.toBeNull();
      expect(food?.calories).toBe(0);
      expect(food?.protein).toBe(0);
      expect(food?.carbs).toBe(0);
      expect(food?.fat).toBe(0);
    });

    it('returns null immediately when barcode is empty or whitespace', async () => {
      const food = await service.getFoodByBarcode('   ');
      expect(food).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('searchFoods', () => {
    it('returns empty array immediately when search query is empty', async () => {
      const results = await service.searchFoods('');
      expect(results).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('parses array of products and maps to FoodItem[]', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          count: 2,
          products: [
            {
              code: '111',
              product_name: 'Whey Protein Isolado',
              brands: 'Growth',
              nutriments: {
                'energy-kcal_100g': 380,
                proteins_100g: 80,
                carbohydrates_100g: 5,
                fat_100g: 2,
              },
            },
            {
              code: '222',
              product_name: 'Creatina Creapure',
              brands: 'Growth',
              nutriments: {
                'energy-kcal_100g': 0,
                proteins_100g: 0,
                carbohydrates_100g: 0,
                fat_100g: 0,
              },
            },
          ],
        }),
      });

      const results = await service.searchFoods('Growth');
      expect(results.length).toBe(2);
      expect(results[0].name).toContain('Whey Protein Isolado');
      expect(results[0].protein).toBe(80);
      expect(results[1].name).toContain('Creatina Creapure');
    });

    it('returns empty array when search returns 0 products', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          count: 0,
          products: [],
        }),
      });

      const results = await service.searchFoods('Inexistente12345XYZ');
      expect(results).toEqual([]);
    });

    it('handles network failure during search gracefully returning empty array', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection aborted'));

      const results = await service.searchFoods('Frango');
      expect(results).toEqual([]);
    });
  });
});
