import { createTestDatabase, InMemorySQLiteDatabase } from '../helpers/inMemoryDb';
import { ensureSeedFoodsPresent } from '@/database/connection';
import { SqliteDietRepository } from '@/database/repositories/SqliteDietRepository';
import { SupabaseDietRepository } from '@/database/repositories/SupabaseDietRepository';
import { TACO_FOODS_SEED } from '@/database/seed/tacoFoods';
import {
  dedupeFoods,
  matchesFoodTokens,
  tokenizeFoodQuery,
} from '@/utils/text';
import { FoodItem } from '@/types/domain';

function createFoodsQueryBuilder(result: { data?: any; error?: any } = { data: null, error: null }) {
  const builder: any = {
    select: jest.fn(() => builder),
    insert: jest.fn(() => builder),
    order: jest.fn(() => builder),
    limit: jest.fn(() => builder),
    or: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    returns: jest.fn(() => builder),
    single: jest.fn(async () => result),
    maybeSingle: jest.fn(async () => result),
    then: (resolve: (val: any) => void, reject?: (err: any) => void) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

describe('Food Search, TACO Seed Repair, and Deduplication', () => {
  let db: InMemorySQLiteDatabase;
  let sqliteRepo: SqliteDietRepository;

  beforeEach(async () => {
    db = await createTestDatabase();
    sqliteRepo = new SqliteDietRepository(db);
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  describe('text helpers (tokenizeFoodQuery, matchesFoodTokens, dedupeFoods)', () => {
    it('tokenizes multi-word accent/comma queries cleanly', () => {
      expect(tokenizeFoodQuery('  Frango, grelhado  ')).toEqual(['frango', 'grelhado']);
      expect(tokenizeFoodQuery('Arroz integral cozido')).toEqual(['arroz', 'integral', 'cozido']);
    });

    it('matches multi-word queries out-of-order / across commas', () => {
      expect(
        matchesFoodTokens(
          { name: 'Peito de frango, grelhado', nameNormalized: 'peito de frango grelhado' },
          tokenizeFoodQuery('frango grelhado')
        )
      ).toBe(true);
      expect(
        matchesFoodTokens(
          { name: 'Arroz, integral, cozido', nameNormalized: 'arroz integral cozido' },
          tokenizeFoodQuery('arroz cozido')
        )
      ).toBe(true);
      expect(
        matchesFoodTokens(
          { name: 'Peito de frango, grelhado', nameNormalized: 'peito de frango grelhado' },
          tokenizeFoodQuery('frango assado')
        )
      ).toBe(false);
    });

    it('dedupeFoods collapses duplicates by id, barcode, and normalized name + source', () => {
      const base: FoodItem = {
        id: 'uuid-1',
        name: 'Queijo Coalho (Tirolez)',
        nameNormalized: 'queijo coalho (tirolez)',
        category: 'Tirolez',
        servingGrams: 100,
        calories: 320,
        protein: 22,
        carbs: 2,
        fat: 25,
        barcode: '7896030519475',
        source: 'openfoodfacts',
        createdAt: '2026-11-15T10:00:00Z',
      };

      const dupSameBarcodeDiffId: FoodItem = { ...base, id: 'uuid-2' };
      const dupSameNameSourceNoBarcode: FoodItem = {
        ...base,
        id: 'off-123',
        barcode: undefined,
        name: 'queijo coalho (tirolez)',
      };
      const differentItem: FoodItem = {
        ...base,
        id: 'taco-1',
        name: 'Frango grelhado',
        nameNormalized: 'frango grelhado',
        barcode: undefined,
        source: 'taco',
      };

      const deduped = dedupeFoods([
        base,
        dupSameBarcodeDiffId,
        dupSameNameSourceNoBarcode,
        differentItem,
      ]);

      expect(deduped).toHaveLength(2);
      expect(deduped[0].id).toBe('uuid-1');
      expect(deduped[1].id).toBe('taco-1');
    });
  });

  describe('ensureSeedFoodsPresent', () => {
    it('repairs missing TACO foods via INSERT OR IGNORE even when foods table is non-empty', async () => {
      await db.runAsync("DELETE FROM foods WHERE source = 'taco';");
      const before = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) as count FROM foods WHERE source = 'taco';"
      );
      expect(before?.count).toBe(0);

      await ensureSeedFoodsPresent(db);

      const after = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) as count FROM foods WHERE source = 'taco';"
      );
      expect(after?.count).toBe(TACO_FOODS_SEED.length);
    });
  });

  describe('SqliteDietRepository multi-word search and createFood dedup', () => {
    it('finds TACO foods with multi-word queries like "frango grelhado" or "arroz cozido"', async () => {
      const chickenHits = await sqliteRepo.searchFoods('frango grelhado', 50);
      expect(chickenHits.some((f) => f.id === 'taco-peito-frango-grelhado')).toBe(true);

      const riceHits = await sqliteRepo.searchFoods('arroz cozido', 50);
      expect(riceHits.some((f) => f.id === 'taco-arroz-integral-cozido')).toBe(true);
    });

    it('reuses existing Open Food Facts food instead of duplicating on repeated createFood calls', async () => {
      const first = await sqliteRepo.createFood({
        name: 'Bife Coxão Mole (Swift)',
        category: 'Swift',
        servingGrams: 100,
        calories: 180,
        protein: 24,
        carbs: 0,
        fat: 9,
        barcode: '7908625604425',
        source: 'openfoodfacts',
      });

      const second = await sqliteRepo.createFood({
        name: 'Bife Coxão Mole (Swift)',
        category: 'Swift',
        servingGrams: 100,
        calories: 180,
        protein: 24,
        carbs: 0,
        fat: 9,
        barcode: '7908625604425',
        source: 'openfoodfacts',
      });

      expect(second.id).toBe(first.id);
      const hits = await sqliteRepo.searchFoods('Bife Coxao Mole', 50);
      expect(hits).toHaveLength(1);
    });
  });

  describe('SupabaseDietRepository localOnly fast path and deduplication', () => {
    it('localOnly search returns SQLite TACO items immediately without hitting Supabase network', async () => {
      const mockClient: any = { from: jest.fn() };
      const repo = new SupabaseDietRepository(mockClient, db);

      const results = await repo.searchFoods('frango grelhado', 200, { localOnly: true });
      expect(mockClient.from).not.toHaveBeenCalled();
      expect(results.some((f) => f.id === 'taco-peito-frango-grelhado')).toBe(true);
    });

    it('deduplicates repeated remote rows sharing barcode or normalized name+source', async () => {
      const row1 = {
        id: 'uuid-1',
        name: 'Bife Coxão Mole (Swift)',
        name_normalized: 'bife coxao mole (swift)',
        category: 'Swift',
        serving_grams: 100,
        calories: 180,
        protein: 24,
        carbs: 0,
        fat: 9,
        fiber: 0,
        barcode: '7908625604425',
        source: 'openfoodfacts',
        serving_unit_name: 'porção',
        serving_unit_grams: 100,
        created_at: '2026-11-15T10:00:00Z',
      };
      const row2 = { ...row1, id: 'uuid-2', created_at: '2026-11-16T10:00:00Z' };
      const row3 = { ...row1, id: 'uuid-3', created_at: '2026-11-17T10:00:00Z' };

      const builder = createFoodsQueryBuilder({ data: [row1, row2, row3], error: null });
      const mockClient: any = { from: jest.fn(() => builder) };
      const repo = new SupabaseDietRepository(mockClient, db);

      const results = await repo.searchFoods('bife coxao', 200);
      const matching = results.filter((r) => r.barcode === '7908625604425');
      expect(matching).toHaveLength(1);
    });

    it('createFood for openfoodfacts returns existing row instead of inserting a duplicate', async () => {
      const existingRow = {
        id: 'existing-uuid-1',
        name: 'Farinha de Aveia',
        name_normalized: 'farinha de aveia',
        category: 'Cereais',
        serving_grams: 100,
        calories: 370,
        protein: 14,
        carbs: 60,
        fat: 7,
        fiber: 9,
        barcode: '7896327501862',
        source: 'openfoodfacts',
        serving_unit_name: 'porção',
        serving_unit_grams: 30,
        created_at: '2026-11-14T10:00:00Z',
      };

      const selectBuilder = createFoodsQueryBuilder({ data: existingRow, error: null });
      const mockClient: any = { from: jest.fn(() => selectBuilder) };
      const repo = new SupabaseDietRepository(mockClient);

      const saved = await repo.createFood({
        name: 'Farinha de Aveia',
        category: 'Cereais',
        servingGrams: 100,
        calories: 370,
        protein: 14,
        carbs: 60,
        fat: 7,
        barcode: '7896327501862',
        source: 'openfoodfacts',
      });

      expect(saved.id).toBe('existing-uuid-1');
      expect(selectBuilder.insert).not.toHaveBeenCalled();
    });
  });
});
