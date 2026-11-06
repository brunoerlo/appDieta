import { InMemorySQLiteDatabase, createTestDatabase } from '../helpers/inMemoryDb';
import { SqliteDietRepository } from '@/database/repositories/SqliteDietRepository';

describe('DietRepository Unit Tests', () => {
  let db: InMemorySQLiteDatabase;
  let repo: SqliteDietRepository;

  beforeEach(async () => {
    db = await createTestDatabase();
    repo = new SqliteDietRepository(db);
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  describe('TACO Seed & Food Search', () => {
    it('searches foods by query in <100ms with case-insensitivity', async () => {
      const start = performance.now();
      const resultsLower = await repo.searchFoods('frango');
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(100);
      expect(resultsLower.length).toBeGreaterThan(0);
      expect(resultsLower.some((f) => f.name.includes('frango'))).toBe(true);

      const resultsUpper = await repo.searchFoods('FRANGO');
      expect(resultsUpper.length).toBe(resultsLower.length);
    });

    it('prioritizes prefix matches over substring matches', async () => {
      const results = await repo.searchFoods('Banana');
      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results[0].name.startsWith('Banana')).toBe(true);
    });

    it('handles non-existent search and SQL injection attempts safely', async () => {
      const emptyResults = await repo.searchFoods('AlimentoInexistenteXYZ123');
      expect(emptyResults).toEqual([]);

      const injectionAttempt = await repo.searchFoods("' OR 1=1 --");
      expect(injectionAttempt).toEqual([]);
    });

    it('creates custom foods and retrieves them by search and id', async () => {
      const custom = await repo.createFood({
        name: 'Whey Protein Isolado Dux',
        category: 'Suplementos',
        servingGrams: 30,
        calories: 110,
        protein: 24,
        carbs: 1.5,
        fat: 0.8,
        source: 'custom',
        servingUnitName: 'scoop',
        servingUnitGrams: 30,
      });

      expect(custom.id).toBeDefined();
      expect(custom.source).toBe('custom');

      const found = await repo.searchFoods('Dux');
      expect(found.length).toBe(1);
      expect(found[0].name).toBe('Whey Protein Isolado Dux');
    });

    it('finds foods by barcode', async () => {
      await repo.createFood({
        name: 'Iogurte Grego Yopro 15g Proteína',
        category: 'Laticínios',
        servingGrams: 160,
        calories: 100,
        protein: 15,
        carbs: 8,
        fat: 0,
        barcode: '7891000100200',
        source: 'custom',
      });

      const found = await repo.getFoodByBarcode('7891000100200');
      expect(found).not.toBeNull();
      expect(found!.name).toBe('Iogurte Grego Yopro 15g Proteína');
      expect(found!.protein).toBe(15);

      const notFound = await repo.getFoodByBarcode('0000000000000');
      expect(notFound).toBeNull();
    });
  });

  describe('Diet Logs & Daily Meals', () => {
    it('adds meal logs and queries them by date', async () => {
      const date = '2026-11-06';
      const log1 = await repo.addDietLog({
        date,
        mealType: 'breakfast',
        foodName: 'Ovo de galinha, inteiro, cozido',
        servingGrams: 100,
        calories: 146,
        protein: 13.3,
        carbs: 0.6,
        fat: 9.5,
      });

      const log2 = await repo.addDietLog({
        date,
        mealType: 'lunch',
        foodName: 'Peito de frango, grelhado',
        servingGrams: 150,
        calories: 238.5,
        protein: 48,
        carbs: 0,
        fat: 3.75,
      });

      expect(log1.id).toBeDefined();
      expect(log2.id).toBeDefined();

      const dailyLogs = await repo.getDailyLogs(date);
      expect(dailyLogs).toHaveLength(2);

      const otherDayLogs = await repo.getDailyLogs('2026-11-07');
      expect(otherDayLogs).toHaveLength(0);
    });

    it('updates meal log servings and macros', async () => {
      const date = '2026-11-06';
      const log = await repo.addDietLog({
        date,
        mealType: 'snack',
        foodName: 'Banana prata, crua',
        servingGrams: 70,
        calories: 68.6,
        protein: 0.9,
        carbs: 18.2,
        fat: 0.07,
      });

      await repo.updateDietLog(log.id, {
        servingGrams: 140,
        calories: 137.2,
        carbs: 36.4,
      });

      const logs = await repo.getDailyLogs(date);
      expect(logs).toHaveLength(1);
      expect(logs[0].servingGrams).toBe(140);
      expect(logs[0].calories).toBe(137.2);
      expect(logs[0].carbs).toBe(36.4);
    });

    it('deletes meal log by ID', async () => {
      const date = '2026-11-06';
      const log = await repo.addDietLog({
        date,
        mealType: 'dinner',
        foodName: 'Arroz branco, cozido',
        servingGrams: 100,
        calories: 128,
        protein: 2.5,
        carbs: 28.1,
        fat: 0.2,
      });

      expect((await repo.getDailyLogs(date))).toHaveLength(1);

      await repo.deleteDietLog(log.id);
      expect((await repo.getDailyLogs(date))).toHaveLength(0);
    });
  });

  describe('Water Tracker & Daily Nutrition Summary', () => {
    it('tracks water increments and calculates daily total', async () => {
      const date = '2026-11-06';

      await repo.addWaterLog(date, 250);
      await repo.addWaterLog(date, 500);
      await repo.addWaterLog(date, 250);

      const logs = await repo.getWaterLogs(date);
      expect(logs).toHaveLength(3);

      const total = await repo.getDailyWaterTotal(date);
      expect(total).toBe(1000);

      await repo.resetWaterLogs(date);
      expect(await repo.getDailyWaterTotal(date)).toBe(0);
    });

    it('generates complete daily nutrition summary with macro aggregations and meals', async () => {
      const date = '2026-11-06';

      await repo.addDietLog({
        date,
        mealType: 'breakfast',
        foodName: 'Aveia em flocos',
        servingGrams: 50,
        calories: 197,
        protein: 6.95,
        carbs: 33.3,
        fat: 4.25,
      });

      await repo.addDietLog({
        date,
        mealType: 'lunch',
        foodName: 'Patinho moído',
        servingGrams: 150,
        calories: 328.5,
        protein: 53.85,
        carbs: 0,
        fat: 10.95,
      });

      await repo.addWaterLog(date, 500);

      const summary = await repo.getDailyNutritionSummary(date);
      expect(summary.date).toBe(date);
      expect(summary.totalCalories).toBeCloseTo(525.5, 1);
      expect(summary.totalProtein).toBeCloseTo(60.8, 1);
      expect(summary.totalCarbs).toBeCloseTo(33.3, 1);
      expect(summary.totalFat).toBeCloseTo(15.2, 1);
      expect(summary.totalWaterMl).toBe(500);
      expect(summary.meals.breakfast).toHaveLength(1);
      expect(summary.meals.lunch).toHaveLength(1);
      expect(summary.meals.dinner).toHaveLength(0);
    });
  });
});
