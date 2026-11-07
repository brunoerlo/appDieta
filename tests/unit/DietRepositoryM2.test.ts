import { InMemorySQLiteDatabase, createTestDatabase } from '../helpers/inMemoryDb';
import { SqliteDietRepository } from '@/database/repositories/SqliteDietRepository';

describe('Unit: DietRepository M2 Enhancements', () => {
  let db: InMemorySQLiteDatabase;
  let repo: SqliteDietRepository;
  const TEST_DATE = '2026-11-06';

  beforeEach(async () => {
    db = await createTestDatabase();
    repo = new SqliteDietRepository(db);
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  describe('Accent-Insensitive Search (name_normalized)', () => {
    it('finds "Pão francês" when querying with unaccented "pao frances"', async () => {
      const results = await repo.searchFoods('pao frances');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toBe('Pão francês');
    });

    it('finds "Pão francês" when querying with uppercase accented "PÃO FRANCÊS"', async () => {
      const results = await repo.searchFoods('PÃO FRANCÊS');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toBe('Pão francês');
    });

    it('finds "Maçã fuji" when querying with unaccented "maca"', async () => {
      const results = await repo.searchFoods('maca');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((f) => f.name.toLowerCase().includes('maçã'))).toBe(true);
    });

    it('finds "Feijão carioca" when querying with unaccented "feijao"', async () => {
      const results = await repo.searchFoods('feijao');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((f) => f.name.toLowerCase().includes('feijão'))).toBe(true);
    });

    it('finds "Mamão papaia" when querying with unaccented "mamao"', async () => {
      const results = await repo.searchFoods('mamao');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((f) => f.name.toLowerCase().includes('mamão'))).toBe(true);
    });

    it('executes food search in <100ms across catalog', async () => {
      const start = performance.now();
      const results = await repo.searchFoods('frango');
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(100);
      expect(results.length).toBeGreaterThan(0);
    });

    it('automatically normalizes name when creating custom food', async () => {
      const created = await repo.createFood({
        name: 'Açaí Orgânico com Guaraná',
        category: 'Sobremesas',
        servingGrams: 100,
        calories: 120,
        protein: 1.5,
        carbs: 22.0,
        fat: 2.5,
        source: 'custom',
      });

      expect(created.id).toBeDefined();

      // Search with unaccented query
      const hits = await repo.searchFoods('organico');
      expect(hits.length).toBe(1);
      expect(hits[0].name).toBe('Açaí Orgânico com Guaraná');
    });
  });

  describe('Water Tracking & Non-Negative Clamping', () => {
    it('sums positive water increments (+250ml, +500ml)', async () => {
      await repo.addWaterLog(TEST_DATE, 250);
      await repo.addWaterLog(TEST_DATE, 500);

      const total = await repo.getDailyWaterTotal(TEST_DATE);
      expect(total).toBe(750);
    });

    it('decrementWaterLog decreases water total by specified amount', async () => {
      await repo.addWaterLog(TEST_DATE, 500);
      const decLog = await repo.decrementWaterLog(TEST_DATE, 250);

      expect(decLog).not.toBeNull();
      expect(decLog?.amountMl).toBe(-250);

      const total = await repo.getDailyWaterTotal(TEST_DATE);
      expect(total).toBe(250);
    });

    it('decrementWaterLog clamps to 0ml when decrement exceeds current total (never negative)', async () => {
      await repo.addWaterLog(TEST_DATE, 100);

      // Decrementing 250ml when total is only 100ml should decrement exactly 100ml to reach 0ml
      const decLog = await repo.decrementWaterLog(TEST_DATE, 250);
      expect(decLog).not.toBeNull();
      expect(decLog?.amountMl).toBe(-100);

      const total = await repo.getDailyWaterTotal(TEST_DATE);
      expect(total).toBe(0);
    });

    it('decrementWaterLog returns null and does nothing when current water total is already 0ml', async () => {
      const decLog = await repo.decrementWaterLog(TEST_DATE, 250);
      expect(decLog).toBeNull();

      const total = await repo.getDailyWaterTotal(TEST_DATE);
      expect(total).toBe(0);
    });

    it('resetWaterLogs removes all entries for the date resetting balance to 0ml', async () => {
      await repo.addWaterLog(TEST_DATE, 250);
      await repo.addWaterLog(TEST_DATE, 500);

      await repo.resetWaterLogs(TEST_DATE);

      const logs = await repo.getWaterLogs(TEST_DATE);
      expect(logs.length).toBe(0);

      const total = await repo.getDailyWaterTotal(TEST_DATE);
      expect(total).toBe(0);
    });
  });
});
