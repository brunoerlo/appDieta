import { InMemorySQLiteDatabase, createTestDatabase } from '../helpers/inMemoryDb';
import { SqliteDietRepository } from '@/database/repositories/SqliteDietRepository';
import { SqliteAuthRepository } from '@/database/repositories/SqliteAuthRepository';
import { DietStateManager } from '@/context/DietContext';
import { OpenFoodFactsService } from '@/services/OpenFoodFactsService';
import {
  scaleMacros,
  calculateAtwaterCalories,
  isAtwaterConsistent,
  summarizeDietLogs,
} from '@/utils/nutrition';
import { normalizeFoodText } from '@/utils/text';
import { FoodItem, MealType } from '@/types/domain';

describe('Tier 5 Adversarial Stress & Vulnerability Hardening: DB & Nutrition', () => {
  let db: InMemorySQLiteDatabase;
  let dietRepo: SqliteDietRepository;
  let authRepo: SqliteAuthRepository;
  let stateManager: DietStateManager;
  const TEST_DATE = '2026-11-06';
  const OTHER_DATE = '2026-11-07';

  beforeEach(async () => {
    db = await createTestDatabase();
    dietRepo = new SqliteDietRepository(db);
    authRepo = new SqliteAuthRepository(db);
    stateManager = new DietStateManager(dietRepo, authRepo, TEST_DATE);
    await stateManager.loadData();
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  // =========================================================================
  // DIMENSION 1: Negative Water Logs & Undo Boundary Edge Cases
  // =========================================================================
  describe('Dimension 1: Negative Water Logs & Undo Boundary Edge Cases', () => {
    it('1.1 returns null and preserves empty water logs when decrementing with 0 balance', async () => {
      // Baseline: verify 0ml consumed
      const initialTotal = await dietRepo.getDailyWaterTotal(TEST_DATE);
      expect(initialTotal).toBe(0);

      // Attempt decrement on empty balance
      const decResult = await dietRepo.decrementWaterLog(TEST_DATE, 250);
      expect(decResult).toBeNull();

      // Verify no records inserted
      const logs = await dietRepo.getWaterLogs(TEST_DATE);
      expect(logs).toHaveLength(0);

      const afterTotal = await dietRepo.getDailyWaterTotal(TEST_DATE);
      expect(afterTotal).toBe(0);

      // Verify raw count in database table
      const countRow = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM water_logs WHERE date = ?;',
        TEST_DATE
      );
      expect(countRow?.count).toBe(0);
    });

    it('1.2 clamps decrement to current balance when requested decrement exceeds current total', async () => {
      // Add +150ml
      await dietRepo.addWaterLog(TEST_DATE, 150);
      let total = await dietRepo.getDailyWaterTotal(TEST_DATE);
      expect(total).toBe(150);

      // Request decrement of 500ml (exceeds 150ml)
      const decResult = await dietRepo.decrementWaterLog(TEST_DATE, 500);
      expect(decResult).not.toBeNull();
      // Should clamp delta to Math.min(500, 150) = 150, inserting -150
      expect(decResult?.amountMl).toBe(-150);

      // Balance must reach exactly 0, not negative
      total = await dietRepo.getDailyWaterTotal(TEST_DATE);
      expect(total).toBe(0);

      // Raw database contains both records summing to 0
      const rawSum = await db.getFirstAsync<{ total: number }>(
        'SELECT SUM(amount_ml) as total FROM water_logs WHERE date = ?;',
        TEST_DATE
      );
      expect(rawSum?.total).toBe(0);
    });

    it('1.3 handles negative number passed to decrementWaterLog via Math.abs', async () => {
      await dietRepo.addWaterLog(TEST_DATE, 500);

      // User or caller passes -200 instead of +200 to decrement
      const decResult = await dietRepo.decrementWaterLog(TEST_DATE, -200);
      expect(decResult).not.toBeNull();
      expect(decResult?.amountMl).toBe(-200);

      const total = await dietRepo.getDailyWaterTotal(TEST_DATE);
      expect(total).toBe(300);
    });

    it('1.4 uncovers race condition: concurrent decrements cause phantom negative balance in DB', async () => {
      // Start with 200ml
      await dietRepo.addWaterLog(TEST_DATE, 200);
      expect(await dietRepo.getDailyWaterTotal(TEST_DATE)).toBe(200);

      // Concurrently execute 5 decrements of 200ml without transactional serialization
      // In a concurrent environment, all 5 read currentTotal = 200, so each inserts -200ml!
      await Promise.all([
        dietRepo.decrementWaterLog(TEST_DATE, 200),
        dietRepo.decrementWaterLog(TEST_DATE, 200),
        dietRepo.decrementWaterLog(TEST_DATE, 200),
        dietRepo.decrementWaterLog(TEST_DATE, 200),
        dietRepo.decrementWaterLog(TEST_DATE, 200),
      ]);

      // Check raw database state
      const rawSumRow = await db.getFirstAsync<{ total: number }>(
        'SELECT SUM(amount_ml) as total FROM water_logs WHERE date = ?;',
        TEST_DATE
      );
      // Raw sum is 200 - (5 * 200) = -800ml!
      expect(rawSumRow?.total).toBe(-800);

      // getDailyWaterTotal clamps using Math.max(0, -800) = 0
      expect(await dietRepo.getDailyWaterTotal(TEST_DATE)).toBe(0);

      // CRITICAL HAZARD: If user now adds +250ml:
      await dietRepo.addWaterLog(TEST_DATE, 250);

      // The raw sum is now -800 + 250 = -550ml
      const postAddRawSum = await db.getFirstAsync<{ total: number }>(
        'SELECT SUM(amount_ml) as total FROM water_logs WHERE date = ?;',
        TEST_DATE
      );
      expect(postAddRawSum?.total).toBe(-550);

      // getDailyWaterTotal still returns 0 because -550 < 0!
      // The user's +250ml water intake was completely swallowed by the phantom negative deficit!
      const swallowedTotal = await dietRepo.getDailyWaterTotal(TEST_DATE);
      expect(swallowedTotal).toBe(0);

      // Fix/Reset clears the phantom deficit
      await dietRepo.resetWaterLogs(TEST_DATE);
      expect(await dietRepo.getDailyWaterTotal(TEST_DATE)).toBe(0);
      await dietRepo.addWaterLog(TEST_DATE, 250);
      expect(await dietRepo.getDailyWaterTotal(TEST_DATE)).toBe(250);
    });

    it('1.5 verifies DietStateManager state synchronization during rapid water operations', async () => {
      expect(stateManager.waterTotalMl).toBe(0);

      await stateManager.addWater(250);
      expect(stateManager.waterTotalMl).toBe(250);
      expect(stateManager.dailySummary.totalWaterMl).toBe(250);

      await stateManager.addWater(500);
      expect(stateManager.waterTotalMl).toBe(750);
      expect(stateManager.dailySummary.totalWaterMl).toBe(750);

      await stateManager.decrementWater(250);
      expect(stateManager.waterTotalMl).toBe(500);
      expect(stateManager.dailySummary.totalWaterMl).toBe(500);

      await stateManager.resetWater();
      expect(stateManager.waterTotalMl).toBe(0);
      expect(stateManager.dailySummary.totalWaterMl).toBe(0);
      expect(stateManager.waterLogs).toHaveLength(0);
    });
  });

  // =========================================================================
  // DIMENSION 2: Accented Food Search Edge Cases & Normalization
  // =========================================================================
  describe('Dimension 2: Accented Food Search Edge Cases', () => {
    it('2.1 matches foods across diverse diacritics, case-folding and unaccented terms', async () => {
      // Seed complex Brazilian custom food
      await dietRepo.createFood({
        name: 'Açaí Puro Orgânico da Amazônia',
        category: 'Frutas',
        servingGrams: 100,
        calories: 60,
        protein: 1.0,
        carbs: 6.0,
        fat: 4.0,
        source: 'custom',
      });

      const queries = [
        'Açaí Puro',
        'acai puro',
        'AÇAÍ PURO',
        'açaí',
        'acai',
        'amazonia',
        'Amazônia',
        'AMAZÔNIA',
        'organico',
        'Orgânico',
      ];

      for (const q of queries) {
        const results = await dietRepo.searchFoods(q);
        expect(results.length).toBeGreaterThan(0);
        expect(results.some((r) => r.name === 'Açaí Puro Orgânico da Amazônia')).toBe(true);
      }
    });

    it('2.2 demonstrates comma and punctuation search gap in TACO dataset', async () => {
      // In TACO: "Peito de frango, grelhado"
      // If user searches "frango grelhado", the comma in the food name prevents exact substring match
      const resultsWithoutComma = await dietRepo.searchFoods('frango grelhado');
      // "Peito de frango, grelhado" does NOT match because of ", " between frango and grelhado!
      const matchedTaco = resultsWithoutComma.some((r) => r.id === 'taco-peito-frango-grelhado');
      expect(matchedTaco).toBe(false);

      // But searching "frango" matches:
      const resultsSingleWord = await dietRepo.searchFoods('frango');
      expect(resultsSingleWord.some((r) => r.id === 'taco-peito-frango-grelhado')).toBe(true);

      // And searching "Peito de frango, grelhado" matches:
      const resultsWithComma = await dietRepo.searchFoods('frango, grelhado');
      expect(resultsWithComma.some((r) => r.id === 'taco-peito-frango-grelhado')).toBe(true);
    });

    it('2.3 handles punctuation, quotes, apostrophes, and SQL meta-characters safely', async () => {
      // Seed food with punctuation
      await dietRepo.createFood({
        name: "Pão d'água (caseiro) - 100% integral",
        category: 'Panificação',
        servingGrams: 50,
        calories: 120,
        protein: 4.5,
        carbs: 22.0,
        fat: 1.0,
        source: 'custom',
      });

      const challengingQueries = [
        "Pão d'água",
        "pao d'agua",
        "d'água",
        "(caseiro)",
        "- 100%",
        "100%",
        "pao",
        "'",
        "''",
        '"',
        "%",
        "%%",
        "_",
        "---",
        "pão OR '1'='1'",
      ];

      for (const query of challengingQueries) {
        await expect(dietRepo.searchFoods(query)).resolves.not.toThrow();
      }

      const specificResult = await dietRepo.searchFoods("Pão d'água");
      expect(specificResult.length).toBeGreaterThan(0);
      expect(specificResult[0].name).toContain("Pão d'água");
    });

    it('2.4 handles empty, whitespace-only, and ultra-large queries without database crash', async () => {
      const emptyRes = await dietRepo.searchFoods('');
      expect(emptyRes.length).toBeGreaterThan(0);
      expect(emptyRes.length).toBeLessThanOrEqual(30);
      expect(emptyRes[0].category).toBe('Refeições');

      const spaceRes = await dietRepo.searchFoods('   ');
      expect(spaceRes.length).toBeGreaterThan(0);
      expect(spaceRes.length).toBeLessThanOrEqual(30);
      expect(spaceRes[0].category).toBe('Refeições');

      // 2,000-character adversarial query
      const giantQuery = 'peito de frango '.repeat(150);
      const giantResults = await dietRepo.searchFoods(giantQuery);
      expect(Array.isArray(giantResults)).toBe(true);
      expect(giantResults).toHaveLength(0);
    });
  });

  // =========================================================================
  // DIMENSION 3: Open Food Facts API Response Anomalies
  // =========================================================================
  describe('Dimension 3: Open Food Facts API Response Anomalies', () => {
    it('3.1 handles HTTP error status codes (500, 502, 404, 429) gracefully', async () => {
      const mockFetch = jest.fn().mockImplementation(async (url: string) => {
        return {
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: async () => ({ error: 'Service Unavailable' }),
        } as unknown as Response;
      });

      const offService = new OpenFoodFactsService(mockFetch as any);

      const barcodeResult = await offService.getFoodByBarcode('7891000100103');
      expect(barcodeResult).toBeNull();

      const searchResult = await offService.searchFoods('Iogurte');
      expect(searchResult).toEqual([]);
    });

    it('3.2 handles malformed JSON responses without throwing unhandled exceptions', async () => {
      const mockFetch = jest.fn().mockImplementation(async () => {
        return {
          ok: true,
          status: 200,
          json: async () => {
            throw new SyntaxError('Unexpected token < in JSON at position 0');
          },
        } as unknown as Response;
      });

      const offService = new OpenFoodFactsService(mockFetch as any);

      await expect(offService.getFoodByBarcode('7891000100103')).resolves.toBeNull();
      await expect(offService.searchFoods('Whey')).resolves.toEqual([]);
    });

    it('3.3 handles missing product fields, empty nutriments, and kJ fallback', () => {
      const offService = new OpenFoodFactsService();

      // Case A: Missing product name pt and en
      const noNameProduct = {
        code: '123456',
        nutriments: { proteins_100g: 10 },
      };
      expect(offService.mapProductToFoodItem(noNameProduct)).toBeNull();

      // Case B: Null product
      expect(offService.mapProductToFoodItem(null)).toBeNull();
      expect(offService.mapProductToFoodItem(undefined)).toBeNull();

      // Case C: Nutriments without energy_kcal, but with energy_100g in kJ
      // 1 kcal = 4.184 kJ -> 836.8 kJ / 4.184 = 200 kcal
      const kjProduct = {
        code: '7890001',
        product_name: 'Barra Proteica',
        brands: 'FitBrand',
        nutriments: {
          energy_100g: 836.8, // in kJ
          proteins_100g: 20.0,
          carbohydrates_100g: 15.0,
          fat_100g: 5.0,
          fiber_100g: 8.0,
        },
        serving_quantity: 40,
        serving_size: '1 barra (40g)',
      };

      const mapped = offService.mapProductToFoodItem(kjProduct);
      expect(mapped).not.toBeNull();
      expect(mapped?.calories).toBe(200.0);
      expect(mapped?.protein).toBe(20.0);
      expect(mapped?.carbs).toBe(15.0);
      expect(mapped?.fat).toBe(5.0);
      expect(mapped?.fiber).toBe(8.0);
      expect(mapped?.servingUnitGrams).toBe(40);
      expect(mapped?.name).toBe('Barra Proteica (FitBrand)');

      // Case D: Completely empty nutriments
      const emptyNutrimentsProduct = {
        code: '7890002',
        product_name: 'Produto Desconhecido',
        nutriments: {},
      };
      const mappedEmpty = offService.mapProductToFoodItem(emptyNutrimentsProduct);
      expect(mappedEmpty).not.toBeNull();
      expect(mappedEmpty?.calories).toBe(0);
      expect(mappedEmpty?.protein).toBe(0);
      expect(mappedEmpty?.carbs).toBe(0);
      expect(mappedEmpty?.fat).toBe(0);
      expect(mappedEmpty?.servingUnitGrams).toBe(100); // defaults to 100g
    });

    it('3.4 handles network timeout / abort signal without unhandled rejection', async () => {
      const mockFetch = jest.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        return new Promise((_, reject) => {
          if (init?.signal) {
            init.signal.addEventListener('abort', () => {
              const err = new Error('The user aborted a request.');
              err.name = 'AbortError';
              reject(err);
            });
          }
        });
      });

      const offService = new OpenFoodFactsService(mockFetch as any);

      // Force timeout by setting a very short timeout or triggering abort
      // In OpenFoodFactsService, timeout is private (4500ms), but mock aborting returns null
      const abortPromise = offService.getFoodByBarcode('111111');
      // Abort is handled inside try-catch in getFoodByBarcode returning null
      mockFetch.mock.calls[0][1].signal.dispatchEvent(new Event('abort'));
      const result = await abortPromise;
      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // DIMENSION 4: Concurrent Operations & SQLite Transactions
  // =========================================================================
  describe('Dimension 4: Concurrent Operations & SQLite Transactions', () => {
    it('4.1 handles high-concurrency interleaved food logs and water logs without data corruption', async () => {
      const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner', 'supper'];
      const CONCURRENT_OPS = 20;

      // 20 concurrent food logs + 20 concurrent water logs
      const foodPromises = Array.from({ length: CONCURRENT_OPS }).map((_, i) => {
        const meal = MEAL_TYPES[i % MEAL_TYPES.length];
        return dietRepo.addDietLog({
          date: TEST_DATE,
          mealType: meal,
          foodName: `Alimento Concorrente #${i + 1}`,
          servingGrams: 100,
          calories: 100 + i,
          protein: 10,
          carbs: 10,
          fat: 2,
        });
      });

      const waterPromises = Array.from({ length: CONCURRENT_OPS }).map((_, i) => {
        return dietRepo.addWaterLog(TEST_DATE, 100);
      });

      // Fire all 40 operations concurrently
      const [foodResults, waterResults] = await Promise.all([
        Promise.all(foodPromises),
        Promise.all(waterPromises),
      ]);

      expect(foodResults).toHaveLength(CONCURRENT_OPS);
      expect(waterResults).toHaveLength(CONCURRENT_OPS);

      // Verify in SQLite
      const logs = await dietRepo.getDailyLogs(TEST_DATE);
      expect(logs).toHaveLength(CONCURRENT_OPS);

      const waterLogs = await dietRepo.getWaterLogs(TEST_DATE);
      expect(waterLogs).toHaveLength(CONCURRENT_OPS);

      const waterTotal = await dietRepo.getDailyWaterTotal(TEST_DATE);
      expect(waterTotal).toBe(CONCURRENT_OPS * 100); // 2000 ml

      // Verify summary aggregation
      const summary = await dietRepo.getDailyNutritionSummary(TEST_DATE);
      expect(summary.totalWaterMl).toBe(2000);
      expect(summary.totalProtein).toBe(CONCURRENT_OPS * 10);
      expect(summary.totalCarbs).toBe(CONCURRENT_OPS * 10);
      expect(summary.totalFat).toBe(CONCURRENT_OPS * 2);
    });

    it('4.2 rolls back all changes atomically when an error occurs inside withTransactionAsync', async () => {
      const countFoodsBefore = (await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM diet_logs;'))?.c ?? 0;
      const countWaterBefore = (await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM water_logs;'))?.c ?? 0;

      let caughtError = false;
      try {
        await db.withTransactionAsync(async () => {
          await dietRepo.addDietLog({
            date: TEST_DATE,
            mealType: 'breakfast',
            foodName: 'Item Transacional que deve falhar',
            servingGrams: 100,
            calories: 200,
            protein: 20,
            carbs: 20,
            fat: 5,
          });

          await dietRepo.addWaterLog(TEST_DATE, 500);

          // Force failure
          throw new Error('Falha catastrófica intencional para testar ROLLBACK');
        });
      } catch (err: any) {
        caughtError = true;
        expect(err.message).toContain('Falha catastrófica intencional');
      }

      expect(caughtError).toBe(true);

      // Verify ROLLBACK was executed: neither diet log nor water log was saved
      const countFoodsAfter = (await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM diet_logs;'))?.c ?? 0;
      const countWaterAfter = (await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM water_logs;'))?.c ?? 0;

      expect(countFoodsAfter).toBe(countFoodsBefore);
      expect(countWaterAfter).toBe(countWaterBefore);
    });

    it('4.3 verifies behavior of nested withTransactionAsync calls', async () => {
      // better-sqlite3 throws when executing BEGIN while inside an active transaction
      await expect(
        db.withTransactionAsync(async () => {
          await dietRepo.addWaterLog(TEST_DATE, 250);
          await db.withTransactionAsync(async () => {
            await dietRepo.addWaterLog(TEST_DATE, 250);
          });
        })
      ).rejects.toThrow(/transaction/i);
    });
  });

  // =========================================================================
  // DIMENSION 5: Custom Food Insertion with Duplicate Names & Extreme Macros
  // =========================================================================
  describe('Dimension 5: Custom Food Insertion & Extreme Macros', () => {
    it('5.1 allows duplicate food names with unique IDs in catalog and returns both in search', async () => {
      const food1 = await dietRepo.createFood({
        name: 'Whey Protein Isolado Baunilha',
        category: 'Suplementos',
        servingGrams: 30,
        calories: 120,
        protein: 27,
        carbs: 1,
        fat: 0.5,
        source: 'custom',
      });

      const food2 = await dietRepo.createFood({
        name: 'Whey Protein Isolado Baunilha',
        category: 'Suplementos',
        servingGrams: 30,
        calories: 110,
        protein: 26,
        carbs: 0.5,
        fat: 0.2,
        source: 'custom',
      });

      expect(food1.id).not.toBe(food2.id);

      const searchResults = await dietRepo.searchFoods('Whey Protein Isolado Baunilha');
      const matches = searchResults.filter((r) => r.name === 'Whey Protein Isolado Baunilha');
      expect(matches.length).toBe(2);
      expect(matches.map((m) => m.id)).toContain(food1.id);
      expect(matches.map((m) => m.id)).toContain(food2.id);
    });

    it('5.2 tests extreme physically impossible macros vs isAtwaterConsistent oracle', async () => {
      // 100g of food claiming 1000g of protein and 99,999 kcal
      const impossibleFood = await dietRepo.createFood({
        name: 'Super Proteína Mutante',
        category: 'Ficção',
        servingGrams: 100,
        calories: 99999,
        protein: 1000,
        carbs: 500,
        fat: 300,
        source: 'custom',
      });

      expect(impossibleFood.id).toBeDefined();

      // Theoretical Atwater energy: (1000 * 4) + (500 * 4) + (300 * 9) = 4000 + 2000 + 2700 = 8700 kcal
      const atwater = calculateAtwaterCalories(1000, 500, 300);
      expect(atwater).toBe(8700);

      // 99,999 kcal vs 8,700 kcal -> difference is huge, oracle MUST reject consistency
      const consistent = isAtwaterConsistent(99999, 1000, 500, 300, 15);
      expect(consistent).toBe(false);
    });

    it('5.3 permits negative macros in raw SQLite schema, observing impact on daily summary', async () => {
      // SQLite schema lacks CHECK(calories >= 0)
      const negLog = await dietRepo.addDietLog({
        date: TEST_DATE,
        mealType: 'dinner',
        foodName: 'Ajuste Manual Negativo',
        servingGrams: 100,
        calories: -300,
        protein: -25,
        carbs: -30,
        fat: -10,
      });

      expect(negLog.id).toBeDefined();

      const summary = await dietRepo.getDailyNutritionSummary(TEST_DATE);
      expect(summary.totalCalories).toBe(-300);
      expect(summary.totalProtein).toBe(-25);
      expect(summary.totalCarbs).toBe(-30);
      expect(summary.totalFat).toBe(-10);
    });
  });

  // =========================================================================
  // DIMENSION 6: Portion Scaling & Math Boundary Conditions
  // =========================================================================
  describe('Dimension 6: Portion Scaling & Math Boundary Conditions', () => {
    it('6.1 tests scaleMacros with zero, negative, and inverted base/target values', () => {
      const base = {
        calories: 150,
        protein: 20,
        carbs: 10,
        fat: 3,
        fiber: 2,
      };

      // Target = 0g -> returns zeros
      expect(scaleMacros(100, 0, base)).toEqual({
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
      });

      // Target < 0g -> returns zeros
      expect(scaleMacros(100, -50, base)).toEqual({
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
      });

      // Base <= 0g -> returns zeros (prevents division by zero)
      expect(scaleMacros(0, 100, base)).toEqual({
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
      });

      expect(scaleMacros(-100, 100, base)).toEqual({
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
      });
    });

    it('6.2 enforces contract parity: DietStateManager.addFoodLog rejects negative or zero portion scaling', async () => {
      const food: FoodItem = {
        id: 'food-test',
        name: 'Frango Teste',
        servingGrams: 100,
        calories: 160,
        protein: 30,
        carbs: 0,
        fat: 4,
        source: 'custom',
      };

      await expect(
        stateManager.addFoodLog({
          mealType: 'lunch',
          food,
          servingGrams: -100,
        })
      ).rejects.toThrow('A porção em gramas/ml deve ser maior que zero.');

      expect(stateManager.dailySummary.totalCalories).toBe(0);
      expect(stateManager.dailySummary.totalProtein).toBe(0);
    });

    it('6.3 scales micro-portions (0.5g) without floating-point distortion or NaN', () => {
      const base = {
        calories: 884, // 100g Olive Oil
        protein: 0,
        carbs: 0,
        fat: 100,
      };

      // 0.5g portion = 0.5 / 100 = 0.005 factor
      // calories = 884 * 0.005 = 4.42 -> 4.4
      // fat = 100 * 0.005 = 0.5
      const scaled = scaleMacros(100, 0.5, base);
      expect(scaled.calories).toBe(4.4);
      expect(scaled.fat).toBe(0.5);
      expect(Number.isFinite(scaled.calories)).toBe(true);
      expect(Number.isNaN(scaled.calories)).toBe(false);
    });

    it('6.4 handles massive portions (50,000g) without precision crash or overflow', () => {
      const base = {
        calories: 360,
        protein: 80,
        carbs: 5,
        fat: 2,
      };

      // 50,000g (50kg)
      // factor = 50,000 / 100 = 500
      // calories = 360 * 500 = 180,000
      // protein = 80 * 500 = 40,000
      const scaled = scaleMacros(100, 50000, base);
      expect(scaled.calories).toBe(180000);
      expect(scaled.protein).toBe(40000);
      expect(scaled.carbs).toBe(2500);
      expect(scaled.fat).toBe(1000);
    });

    it('6.5 verifies summarizeDietLogs eliminates floating point accumulation error (e.g. 0.1 + 0.2)', () => {
      // Create 100 micro logs each with 0.1g protein and 0.1g fat
      const logs = Array.from({ length: 100 }).map((_, i) => ({
        id: `log-${i}`,
        date: TEST_DATE,
        mealType: 'snack' as MealType,
        foodName: 'Micro item',
        servingGrams: 1,
        calories: 1.0,
        protein: 0.1,
        carbs: 0.1,
        fat: 0.1,
        createdAt: new Date().toISOString(),
      }));

      const summary = summarizeDietLogs(logs);

      // Without toFixed rounding, 100 * 0.1 in binary IEEE-754 might be 9.999999999999998
      expect(summary.totalProtein).toBe(10.0);
      expect(summary.totalCarbs).toBe(10.0);
      expect(summary.totalFat).toBe(10.0);
      expect(summary.totalCalories).toBe(100.0);
      expect(summary.meals.snack.protein).toBe(10.0);
    });
  });
});
