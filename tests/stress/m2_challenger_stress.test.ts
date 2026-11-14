import { InMemorySQLiteDatabase, createTestDatabase } from '../helpers/inMemoryDb';
import { SqliteDietRepository } from '@/database/repositories/SqliteDietRepository';
import { TACO_FOODS_SEED } from '@/database/seed/tacoFoods';
import { normalizeFoodText } from '@/utils/text';
import { scaleMacros, isAtwaterConsistent } from '@/utils/nutrition';
import { SqliteAuthRepository } from '@/database/repositories/SqliteAuthRepository';
import { DietStateManager } from '@/context/DietContext';
import { performance } from 'perf_hooks';

describe('Milestone M2 Adversarial Stress & Challenger Test Suite', () => {
  let db: InMemorySQLiteDatabase;
  let dietRepo: SqliteDietRepository;

  beforeEach(async () => {
    db = await createTestDatabase();
    dietRepo = new SqliteDietRepository(db);
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  // =========================================================================
  // 1. ALL 42 TACO FOODS SEARCH BENCHMARK (< 100ms with/without accents)
  // =========================================================================
  describe('TACO 42 Foods Search Latency & Diacritic Benchmark', () => {
    it('verifies all 42 TACO foods are seeded and queryable', async () => {
      expect(TACO_FOODS_SEED.length).toBe(42);
      const row = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) as count FROM foods WHERE source = 'taco';"
      );
      expect(row?.count).toBe(42);
    });

    it('benchmarks all 42 TACO foods across exact, uppercase, and unaccented queries under 100ms', async () => {
      const latencies: number[] = [];
      const queryResultsLog: Array<{
        foodId: string;
        exactQuery: string;
        exactTimeMs: number;
        unaccentedQuery: string;
        unaccentedTimeMs: number;
        upperQuery: string;
        upperTimeMs: number;
      }> = [];

      for (const food of TACO_FOODS_SEED) {
        // Query 1: Exact Name
        const t0 = performance.now();
        const exactResults = await dietRepo.searchFoods(food.name, 20);
        const tExact = performance.now() - t0;
        latencies.push(tExact);

        expect(tExact).toBeLessThan(100);
        expect(exactResults.length).toBeGreaterThan(0);
        expect(exactResults.some((r) => r.id === food.id)).toBe(true);

        // Query 2: Unaccented Lowercase
        const unaccented = normalizeFoodText(food.name);
        const t1 = performance.now();
        const unaccentedResults = await dietRepo.searchFoods(unaccented, 20);
        const tUnacc = performance.now() - t1;
        latencies.push(tUnacc);

        expect(tUnacc).toBeLessThan(100);
        expect(unaccentedResults.length).toBeGreaterThan(0);
        expect(unaccentedResults.some((r) => r.id === food.id)).toBe(true);

        // Query 3: Uppercase
        const upper = food.name.toUpperCase();
        const t2 = performance.now();
        const upperResults = await dietRepo.searchFoods(upper, 20);
        const tUpper = performance.now() - t2;
        latencies.push(tUpper);

        expect(tUpper).toBeLessThan(100);
        expect(upperResults.length).toBeGreaterThan(0);
        expect(upperResults.some((r) => r.id === food.id)).toBe(true);

        queryResultsLog.push({
          foodId: food.id,
          exactQuery: food.name,
          exactTimeMs: Number(tExact.toFixed(3)),
          unaccentedQuery: unaccented,
          unaccentedTimeMs: Number(tUnacc.toFixed(3)),
          upperQuery: upper,
          upperTimeMs: Number(tUpper.toFixed(3)),
        });
      }

      latencies.sort((a, b) => a - b);
      const p50 = latencies[Math.floor(latencies.length * 0.5)];
      const p90 = latencies[Math.floor(latencies.length * 0.9)];
      const p99 = latencies[Math.floor(latencies.length * 0.99)];
      const max = latencies[latencies.length - 1];
      const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;

      console.log(`[TACO 42 BENCHMARK RESULTS] Total Queries Executed: ${latencies.length}`);
      console.log(`  P50 Latency: ${p50.toFixed(3)}ms`);
      console.log(`  P90 Latency: ${p90.toFixed(3)}ms`);
      console.log(`  P99 Latency: ${p99.toFixed(3)}ms`);
      console.log(`  Max Latency: ${max.toFixed(3)}ms`);
      console.log(`  Avg Latency: ${avg.toFixed(3)}ms`);

      expect(max).toBeLessThan(100);
      expect(avg).toBeLessThan(15);
    });

    it('verifies complex Portuguese diacritic queries and partial substrings match correctly', async () => {
      // Also insert a custom food with severe diacritics
      await dietRepo.createFood({
        name: 'Açaí com Banana e Guaraná 🥣',
        category: 'Frutas',
        servingGrams: 200,
        calories: 220,
        protein: 3.0,
        carbs: 43.0,
        fat: 4.0,
        source: 'custom',
      });

      const challengingQueries = [
        { query: 'pao', expectedId: 'taco-pao-frances' },
        { query: 'pão', expectedId: 'taco-pao-frances' },
        { query: 'PÃO', expectedId: 'taco-pao-frances' },
        { query: 'maca', expectedId: 'taco-maca-fuji' },
        { query: 'maçã', expectedId: 'taco-maca-fuji' },
        { query: 'MAÇÃ', expectedId: 'taco-maca-fuji' },
        { query: 'feijao', expectedId: 'taco-feijao-carioca-cozido' },
        { query: 'feijão', expectedId: 'taco-feijao-carioca-cozido' },
        { query: 'FEIJÃO', expectedId: 'taco-feijao-carioca-cozido' },
        { query: 'mucarela', expectedId: 'taco-queijo-mucarela' },
        { query: 'muçarela', expectedId: 'taco-queijo-mucarela' },
        { query: 'MUÇARELA', expectedId: 'taco-queijo-mucarela' },
        { query: 'brocolis', expectedId: 'taco-brocolis-cozido' },
        { query: 'brócolis', expectedId: 'taco-brocolis-cozido' },
        { query: 'BRÓCOLIS', expectedId: 'taco-brocolis-cozido' },
        { query: 'tilapia', expectedId: 'taco-tilapia-file-grelhado' },
        { query: 'tilápia', expectedId: 'taco-tilapia-file-grelhado' },
        { query: 'TILÁPIA', expectedId: 'taco-tilapia-file-grelhado' },
        { query: 'para', expectedId: 'taco-castanha-do-para' },
        { query: 'pará', expectedId: 'taco-castanha-do-para' },
        { query: 'PARÁ', expectedId: 'taco-castanha-do-para' },
        { query: 'mamao', expectedId: 'taco-mamao-papaia' },
        { query: 'mamão', expectedId: 'taco-mamao-papaia' },
        { query: 'MAMÃO', expectedId: 'taco-mamao-papaia' },
        { query: 'patinho moido', expectedId: 'taco-carne-patinho-moido' },
        { query: 'patinho moído', expectedId: 'taco-carne-patinho-moido' },
        { query: 'acai', expectedSubstring: 'Açaí' },
        { query: 'açaí', expectedSubstring: 'Açaí' },
        { query: 'AÇAÍ', expectedSubstring: 'Açaí' },
      ];

      for (const item of challengingQueries) {
        const t0 = performance.now();
        const results = await dietRepo.searchFoods(item.query, 10);
        const elapsed = performance.now() - t0;

        expect(elapsed).toBeLessThan(100);
        expect(results.length).toBeGreaterThan(0);
        if (item.expectedId) {
          const match = results.find((r) => r.id === item.expectedId);
          expect(match).toBeDefined();
        }
        if (item.expectedSubstring) {
          const match = results.some((r) => r.name.includes(item.expectedSubstring!));
          expect(match).toBe(true);
        }
      }
    });
  });

  // =========================================================================
  // 2. PORTION SCALING ON BOUNDARY AND EXTREME INPUTS (0g, 0.1g, 5000g)
  // =========================================================================
  describe('Portion Scaling Boundary & Extreme Inputs Stress', () => {
    const baseMacro = {
      calories: 159,
      protein: 32.0,
      carbs: 0.0,
      fat: 2.5,
      fiber: 0.0,
    };

    it('handles 0g boundary input without NaN or negative values', () => {
      const scaled = scaleMacros(100, 0, baseMacro);
      expect(scaled.calories).toBe(0);
      expect(scaled.protein).toBe(0);
      expect(scaled.carbs).toBe(0);
      expect(scaled.fat).toBe(0);
      expect(scaled.fiber).toBe(0);
      expect(Number.isNaN(scaled.calories)).toBe(false);
      expect(Number.isNaN(scaled.protein)).toBe(false);
    });

    it('handles negative grams gracefully clamped to 0', () => {
      const scaled = scaleMacros(100, -50, baseMacro);
      expect(scaled.calories).toBe(0);
      expect(scaled.protein).toBe(0);
      expect(scaled.carbs).toBe(0);
      expect(scaled.fat).toBe(0);
    });

    it('handles zero baseGrams gracefully without Division by Zero (NaN / Infinity)', () => {
      const scaled = scaleMacros(0, 100, baseMacro);
      expect(scaled.calories).toBe(0);
      expect(scaled.protein).toBe(0);
      expect(Number.isFinite(scaled.calories)).toBe(true);
      expect(Number.isFinite(scaled.protein)).toBe(true);
    });

    it('scales 0.1g micro-serving with single-decimal float precision', () => {
      const scaled = scaleMacros(100, 0.1, baseMacro);
      // factor = 0.1 / 100 = 0.001
      // calories = 159 * 0.001 = 0.159 -> 0.2
      // protein = 32.0 * 0.001 = 0.032 -> 0.0
      // fat = 2.5 * 0.001 = 0.0025 -> 0.0
      expect(scaled.calories).toBe(0.2);
      expect(scaled.protein).toBe(0.0);
      expect(scaled.fat).toBe(0.0);
      expect(scaled.carbs).toBe(0.0);
      expect(Number.isNaN(scaled.calories)).toBe(false);
    });

    it('scales 5000g massive macro portion without precision breakdown or overflow', () => {
      const scaled = scaleMacros(100, 5000, baseMacro);
      // factor = 50
      // calories = 159 * 50 = 7950.0
      // protein = 32.0 * 50 = 1600.0
      // fat = 2.5 * 50 = 125.0
      expect(scaled.calories).toBe(7950);
      expect(scaled.protein).toBe(1600);
      expect(scaled.fat).toBe(125);
      expect(scaled.carbs).toBe(0);
      expect(isAtwaterConsistent(scaled.calories, scaled.protein, scaled.carbs, scaled.fat)).toBe(true);
    });

    it('persists boundary portion logs (0g, 0.1g, 5000g) in SQLite database and computes summary', async () => {
      const date = '2026-11-06';

      // 1. Add 0g log
      const log0 = await dietRepo.addDietLog({
        date,
        mealType: 'breakfast',
        foodName: 'Peito de Frango (0g)',
        servingGrams: 0,
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
      });
      expect(log0.id).toBeDefined();

      // 2. Add 0.1g log
      const logMicro = await dietRepo.addDietLog({
        date,
        mealType: 'lunch',
        foodName: 'Peito de Frango (0.1g)',
        servingGrams: 0.1,
        calories: 0.2,
        protein: 0.0,
        carbs: 0.0,
        fat: 0.0,
      });
      expect(logMicro.id).toBeDefined();

      // 3. Add 5000g log
      const logMassive = await dietRepo.addDietLog({
        date,
        mealType: 'dinner',
        foodName: 'Peito de Frango (5000g)',
        servingGrams: 5000,
        calories: 7950,
        protein: 1600,
        carbs: 0,
        fat: 125,
      });
      expect(logMassive.id).toBeDefined();

      // Verify retrieval and summary aggregation
      const summary = await dietRepo.getDailyNutritionSummary(date);
      expect(summary.totalCalories).toBe(7950.2);
      expect(summary.totalProtein).toBe(1600.0);
      expect(summary.totalFat).toBe(125.0);
      expect(summary.totalCarbs).toBe(0.0);
      expect(summary.meals.breakfast.length).toBe(1);
      expect(summary.meals.lunch.length).toBe(1);
      expect(summary.meals.dinner.length).toBe(1);
    });
  });

  // =========================================================================
  // 3. RAPID WATER INCREMENT/DECREMENT SEQUENCES (100 OPERATIONS) & DB INTEGRITY
  // =========================================================================
  describe('Rapid Water Operations & DB Integrity Stress', () => {
    const testDate = '2026-11-06';

    it('executes 100 rapid sequential water operations verifying water total is NEVER negative', async () => {
      // Step 1: Initial state is 0ml
      let currentTotal = await dietRepo.getDailyWaterTotal(testDate);
      expect(currentTotal).toBe(0);

      // Step 2: Try 10 decrements from zero - all must return null and total must stay 0
      for (let i = 0; i < 10; i++) {
        const res = await dietRepo.decrementWaterLog(testDate, 250);
        expect(res).toBeNull();
        currentTotal = await dietRepo.getDailyWaterTotal(testDate);
        expect(currentTotal).toBe(0);
      }

      // Step 3: Run 90 rapid alternating operations (mix of increments and decrements)
      const operations: number[] = [
        250, 500, -250, -500, -500, // overdecrement attempt
        250, 250, 250, -250, 500,
        -1000, // huge decrement attempt
        250, 500, 250, 500, -250,
        -500, -250, -500, 250, 500
      ];

      // Repeat to reach 90 operations
      const opList: number[] = [];
      while (opList.length < 90) {
        opList.push(...operations);
      }
      opList.length = 90;

      for (let i = 0; i < opList.length; i++) {
        const op = opList[i];
        if (op > 0) {
          await dietRepo.addWaterLog(testDate, op);
        } else {
          await dietRepo.decrementWaterLog(testDate, Math.abs(op));
        }

        const totalAtStep = await dietRepo.getDailyWaterTotal(testDate);
        // CRITICAL INVARIANT: Total water must NEVER be negative
        expect(totalAtStep).toBeGreaterThanOrEqual(0);
      }

      // Step 4: Verify DB consistency
      const rawSumRow = await db.getFirstAsync<{ total: number | null }>(
        'SELECT SUM(amount_ml) as total FROM water_logs WHERE date = ?;',
        testDate
      );
      const rawLogs = await dietRepo.getWaterLogs(testDate);
      const finalReportedTotal = await dietRepo.getDailyWaterTotal(testDate);
      const summary = await dietRepo.getDailyNutritionSummary(testDate);

      console.log(`[WATER 100 OPS RESULTS]`);
      console.log(`  Raw DB Log Count: ${rawLogs.length}`);
      console.log(`  Raw DB Sum: ${rawSumRow?.total}ml`);
      console.log(`  Reported Daily Total: ${finalReportedTotal}ml`);
      console.log(`  Summary Total Water: ${summary.totalWaterMl}ml`);

      expect(finalReportedTotal).toBeGreaterThanOrEqual(0);
      expect(summary.totalWaterMl).toBe(finalReportedTotal);
      // DB raw sum must also never be negative because decrementWaterLog clamps to currentTotal
      expect(rawSumRow?.total ?? 0).toBeGreaterThanOrEqual(0);
      expect(rawSumRow?.total ?? 0).toBe(finalReportedTotal);
    });

    it('stress-tests boundary edge case: decrementing exact amount or larger than balance', async () => {
      const date = '2026-11-07';

      // Balance is 100ml
      await dietRepo.addWaterLog(date, 100);
      expect(await dietRepo.getDailyWaterTotal(date)).toBe(100);

      // Decrement 250ml: should clamp delta to 100ml, so total becomes 0ml
      const dec = await dietRepo.decrementWaterLog(date, 250);
      expect(dec).toBeDefined();
      expect(dec?.amountMl).toBe(-100);
      expect(await dietRepo.getDailyWaterTotal(date)).toBe(0);

      // Another decrement: should return null
      const decNull = await dietRepo.decrementWaterLog(date, 250);
      expect(decNull).toBeNull();
      expect(await dietRepo.getDailyWaterTotal(date)).toBe(0);

      // Adding 250ml immediately increases total to 250ml (no ghost debt!)
      await dietRepo.addWaterLog(date, 250);
      expect(await dietRepo.getDailyWaterTotal(date)).toBe(250);
    });

    it('verifies water isolation across multiple distinct dates under stress', async () => {
      const dates = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04'];

      for (let i = 0; i < dates.length; i++) {
        const d = dates[i];
        await dietRepo.addWaterLog(d, (i + 1) * 500);
      }

      // Decrement date 1 completely
      await dietRepo.decrementWaterLog(dates[0], 500);
      expect(await dietRepo.getDailyWaterTotal(dates[0])).toBe(0);

      // Verify other dates are unaffected
      expect(await dietRepo.getDailyWaterTotal(dates[1])).toBe(1000);
      expect(await dietRepo.getDailyWaterTotal(dates[2])).toBe(1500);
      expect(await dietRepo.getDailyWaterTotal(dates[3])).toBe(2000);

      // Reset date 2
      await dietRepo.resetWaterLogs(dates[1]);
      expect(await dietRepo.getDailyWaterTotal(dates[1])).toBe(0);
      expect(await dietRepo.getDailyWaterTotal(dates[2])).toBe(1500);
      expect(await dietRepo.getDailyWaterTotal(dates[3])).toBe(2000);
    });

    it('handles concurrent water operations and verifies non-negative invariant', async () => {
      const date = '2026-11-08';
      // Seed with 1000ml
      await dietRepo.addWaterLog(date, 1000);

      // Execute 20 concurrent increments and 20 concurrent decrements
      const concurrentTasks: Promise<any>[] = [];
      for (let i = 0; i < 20; i++) {
        concurrentTasks.push(dietRepo.addWaterLog(date, 250));
        concurrentTasks.push(dietRepo.decrementWaterLog(date, 250));
      }

      await Promise.all(concurrentTasks);

      const total = await dietRepo.getDailyWaterTotal(date);
      const rawSumRow = await db.getFirstAsync<{ total: number | null }>(
        'SELECT SUM(amount_ml) as total FROM water_logs WHERE date = ?;',
        date
      );

      console.log(`[CONCURRENT WATER STRESS]`);
      console.log(`  Reported Total: ${total}ml`);
      console.log(`  Raw DB Sum: ${rawSumRow?.total}ml`);

      expect(total).toBeGreaterThanOrEqual(0);
    });

    it('stress-tests DietStateManager under 100 rapid reactive water operations', async () => {
      const authRepo = new SqliteAuthRepository(db);
      const stateManager = new DietStateManager(dietRepo, authRepo, '2026-11-09');
      await stateManager.loadData();

      expect(stateManager.waterTotalMl).toBe(0);

      // Perform 100 rapid operations via StateManager
      for (let i = 0; i < 50; i++) {
        await stateManager.addWater(250);
        expect(stateManager.waterTotalMl).toBeGreaterThanOrEqual(0);
        await stateManager.decrementWater(500);
        expect(stateManager.waterTotalMl).toBeGreaterThanOrEqual(0);
      }

      // Final total must be >= 0
      expect(stateManager.waterTotalMl).toBeGreaterThanOrEqual(0);
      expect(stateManager.dailySummary.totalWaterMl).toBe(stateManager.waterTotalMl);

      // Reset
      await stateManager.resetWater();
      expect(stateManager.waterTotalMl).toBe(0);
    });

    it('stress-tests DietStateManager food logging with extreme portion sizes and zero serving sizes', async () => {
      const authRepo = new SqliteAuthRepository(db);
      const stateManager = new DietStateManager(dietRepo, authRepo, '2026-11-10');
      await stateManager.loadData();

      const testFood = TACO_FOODS_SEED[0]; // Peito de frango (159 cal, 32g P)

      // Log 0g is rejected by hardened validation
      await expect(
        stateManager.addFoodLog({
          mealType: 'breakfast',
          food: testFood as any,
          servingGrams: 0,
        })
      ).rejects.toThrow('A porção em gramas/ml deve ser maior que zero.');

      // Log 0.1g
      await stateManager.addFoodLog({
        mealType: 'lunch',
        food: testFood as any,
        servingGrams: 0.1,
      });

      // Log 5000g
      await stateManager.addFoodLog({
        mealType: 'dinner',
        food: testFood as any,
        servingGrams: 5000,
      });

      // Also test a food with servingGrams = 0 (anomalous food item)
      const zeroServingFood = {
        ...testFood,
        id: 'anomalous-zero-serving',
        servingGrams: 0,
        calories: 100,
        protein: 20,
        carbs: 0,
        fat: 0,
      };

      await stateManager.addFoodLog({
        mealType: 'snack',
        food: zeroServingFood as any,
        servingGrams: 50,
      });

      // Verify no NaN values in stateManager summary
      expect(Number.isNaN(stateManager.dailySummary.totalCalories)).toBe(false);
      expect(Number.isNaN(stateManager.dailySummary.totalProtein)).toBe(false);
      expect(Number.isNaN(stateManager.dailySummary.totalCarbs)).toBe(false);
      expect(Number.isNaN(stateManager.dailySummary.totalFat)).toBe(false);
      expect(stateManager.dailySummary.totalCalories).toBeGreaterThan(7000);
    });
  });
});
