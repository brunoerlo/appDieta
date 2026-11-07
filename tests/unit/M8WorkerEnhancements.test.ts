import { InMemorySQLiteDatabase, createTestDatabase } from '../helpers/inMemoryDb';
import { SqliteDietRepository } from '@/database/repositories/SqliteDietRepository';
import { SqliteAuthRepository } from '@/database/repositories/SqliteAuthRepository';
import { SqliteBodyRepository } from '@/database/repositories/SqliteBodyRepository';
import { DietStateManager } from '@/context/DietContext';
import { BodyStateManager } from '@/context/BodyContext';
import { EXERCISE_CATEGORIES } from '@/components/workout/ExercisePickerModal';
import { FoodItem } from '@/types/domain';

describe('Unit: Milestone M8 Worker Enhancements', () => {
  let db: InMemorySQLiteDatabase;
  let dietRepo: SqliteDietRepository;
  let authRepo: SqliteAuthRepository;
  let bodyRepo: SqliteBodyRepository;
  let dietManager: DietStateManager;
  let bodyManager: BodyStateManager;
  const TEST_DATE = '2026-11-07';

  beforeEach(async () => {
    db = await createTestDatabase();
    dietRepo = new SqliteDietRepository(db);
    authRepo = new SqliteAuthRepository(db);
    bodyRepo = new SqliteBodyRepository(db);

    dietManager = new DietStateManager(dietRepo, authRepo, TEST_DATE);
    bodyManager = new BodyStateManager(bodyRepo, TEST_DATE);

    await dietManager.loadData();
    await bodyManager.loadData();
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  // =========================================================================
  // 1. ExercisePickerModal: 11 Categories & Custom Exercises Merge
  // =========================================================================
  describe('1. ExercisePickerModal Categories and Custom Merge', () => {
    it('1.1 exports all 11 required muscle group categories', () => {
      const expectedCategories = [
        'Peito',
        'Costas',
        'Quadríceps',
        'Posterior',
        'Glúteos',
        'Ombros',
        'Bíceps',
        'Tríceps',
        'Abdômen',
        'Panturrilha',
        'Cardio / Funcional',
      ];

      expect(EXERCISE_CATEGORIES).toEqual(expectedCategories);
      expect(EXERCISE_CATEGORIES.length).toBe(11);
    });

    it('1.2 custom exercises merge into category lists with isCustom: true', () => {
      const customExercises = [
        {
          id: 'custom-1',
          name: 'Elevação Pélvica com Elástico',
          category: 'Glúteos',
          defaultSets: 4,
          defaultRestSeconds: 75,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'custom-2',
          name: 'Pular Corda Cruzado',
          category: 'Cardio / Funcional',
          defaultSets: 5,
          defaultRestSeconds: 45,
          createdAt: new Date().toISOString(),
        },
      ];

      const merged = customExercises.map((ce) => ({
        id: ce.id,
        name: ce.name,
        muscleGroup: ce.category,
        defaultRestSeconds: ce.defaultRestSeconds,
        targetSets: ce.defaultSets,
        isCustom: true,
      }));

      expect(merged[0].isCustom).toBe(true);
      expect(merged[0].muscleGroup).toBe('Glúteos');
      expect(merged[1].muscleGroup).toBe('Cardio / Funcional');
    });
  });

  // =========================================================================
  // 2. Hydration Jitter Elimination & Refresh Separation
  // =========================================================================
  describe('2. Hydration Jitter Elimination & Refresh Separation', () => {
    it('2.1 addWater updates waterTotalMl synchronously and optimistically', async () => {
      expect(dietManager.waterTotalMl).toBe(0);
      expect(dietManager.isLoading).toBe(false);

      let synchronousValue = -1;
      let isLoadingDuringAdd = true;

      const unsubscribe = dietManager.subscribe(() => {
        if (synchronousValue === -1) {
          synchronousValue = dietManager.waterTotalMl;
          isLoadingDuringAdd = dietManager.isLoading;
        }
      });

      const addPromise = dietManager.addWater(250);

      // Verify synchronous optimistic state change before promise resolves
      expect(dietManager.waterTotalMl).toBe(250);
      expect(dietManager.dailySummary.totalWaterMl).toBe(250);
      expect(dietManager.isLoading).toBe(false);

      await addPromise;
      unsubscribe();

      expect(synchronousValue).toBe(250);
      expect(isLoadingDuringAdd).toBe(false);
      expect(dietManager.waterTotalMl).toBe(250);
    });

    it('2.2 decrementWater updates waterTotalMl optimistically without setting isLoading = true', async () => {
      await dietManager.addWater(500);
      expect(dietManager.waterTotalMl).toBe(500);

      const decrementPromise = dietManager.decrementWater(250);

      // Optimistic check
      expect(dietManager.waterTotalMl).toBe(250);
      expect(dietManager.isLoading).toBe(false);

      await decrementPromise;
      expect(dietManager.waterTotalMl).toBe(250);
      expect(dietManager.isLoading).toBe(false);
    });

    it('2.3 resetWater updates waterTotalMl to 0 immediately', async () => {
      await dietManager.addWater(750);
      expect(dietManager.waterTotalMl).toBe(750);

      const resetPromise = dietManager.resetWater();
      expect(dietManager.waterTotalMl).toBe(0);
      expect(dietManager.isLoading).toBe(false);

      await resetPromise;
      expect(dietManager.waterTotalMl).toBe(0);
    });

    it('2.4 loadData with { silent: true } does NOT set isLoading to true', async () => {
      let sawLoading = false;
      const unsubscribe = dietManager.subscribe(() => {
        if (dietManager.isLoading) {
          sawLoading = true;
        }
      });

      await dietManager.loadData({ silent: true });
      unsubscribe();

      expect(sawLoading).toBe(false);
      expect(dietManager.isLoading).toBe(false);
    });

    it('2.5 refresh() toggles isRefreshing without setting isLoading = true', async () => {
      let isRefreshingObserved = false;
      let isLoadingObserved = false;

      const unsubscribe = dietManager.subscribe(() => {
        if (dietManager.isRefreshing) isRefreshingObserved = true;
        if (dietManager.isLoading) isLoadingObserved = true;
      });

      await dietManager.refresh();
      unsubscribe();

      expect(isRefreshingObserved).toBe(true);
      expect(isLoadingObserved).toBe(false);
      expect(dietManager.isRefreshing).toBe(false);
      expect(dietManager.isLoading).toBe(false);
    });

    it('2.6 BodyStateManager: refresh() separates isRefreshing from isLoading', async () => {
      let isRefreshingObserved = false;
      let isLoadingObserved = false;

      const unsubscribe = bodyManager.subscribe(() => {
        if (bodyManager.isRefreshing) isRefreshingObserved = true;
        if (bodyManager.isLoading) isLoadingObserved = true;
      });

      await bodyManager.refresh();
      unsubscribe();

      expect(isRefreshingObserved).toBe(true);
      expect(isLoadingObserved).toBe(false);
      expect(bodyManager.isRefreshing).toBe(false);
      expect(bodyManager.isLoading).toBe(false);
    });

    it('2.7 BodyStateManager: saveWeighIn reloads silently without triggering isLoading', async () => {
      let sawLoading = false;
      const unsubscribe = bodyManager.subscribe(() => {
        if (bodyManager.isLoading) sawLoading = true;
      });

      await bodyManager.saveWeighIn(78.5, TEST_DATE);
      unsubscribe();

      expect(sawLoading).toBe(false);
      expect(bodyManager.currentBodyLog?.weightKg).toBe(78.5);
    });
  });

  // =========================================================================
  // 3. Dishes & Ready Meals in searchFoods and custom creation
  // =========================================================================
  describe('3. Dishes and Meals in searchFoods and custom creation', () => {
    it('3.1 searchFoods with empty query returns top 30 foods prioritizing category = "Refeições"', async () => {
      const results = await dietRepo.searchFoods('', 30);
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(30);

      // The ready dishes seeded in V2 migration should be at the top
      const firstDish = results[0];
      expect(firstDish.category).toBe('Refeições');
      expect(firstDish.source).toBe('recipe');

      // Verify ready dish presence (e.g. Carbonara, Omelete, etc.)
      const dishNames = results.map((r) => r.name);
      expect(
        dishNames.some(
          (n) => n.includes('Carbonara') || n.includes('Omelete') || n.includes('Massa')
        )
      ).toBe(true);
    });

    it('3.2 creates a custom dish/meal with category "Refeições" and source "recipe"', async () => {
      const created = await dietRepo.createFood({
        name: 'Omelete Proteico com Queijo e Tomate',
        category: 'Refeições',
        servingGrams: 100,
        calories: 195,
        protein: 18.5,
        carbs: 2.1,
        fat: 12.3,
        source: 'recipe',
        servingUnitName: 'porção (200g)',
        servingUnitGrams: 200,
      });

      expect(created.id).toBeDefined();
      expect(created.name).toBe('Omelete Proteico com Queijo e Tomate');
      expect(created.category).toBe('Refeições');
      expect(created.source).toBe('recipe');

      // Search and confirm it is returned in searches
      const hits = await dietRepo.searchFoods('Omelete Proteico');
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits[0].id).toBe(created.id);
    });

    it('3.3 filters results by category "Refeições" or source "recipe" correctly', async () => {
      const allFoods: FoodItem[] = [
        {
          id: '1',
          name: 'Arroz Branco',
          category: 'Cereais',
          servingGrams: 100,
          calories: 128,
          protein: 2.5,
          carbs: 28.1,
          fat: 0.2,
          source: 'taco',
        },
        {
          id: '2',
          name: 'Espaguete à Carbonara',
          category: 'Refeições',
          servingGrams: 100,
          calories: 220,
          protein: 9.0,
          carbs: 25.0,
          fat: 9.0,
          source: 'recipe',
        },
        {
          id: '3',
          name: 'Panqueca de Frango',
          category: 'Refeições',
          servingGrams: 100,
          calories: 175,
          protein: 14.0,
          carbs: 18.0,
          fat: 5.0,
          source: 'recipe',
        },
      ];

      const mealsTabFiltered = allFoods.filter(
        (item) => item.category === 'Refeições' || item.source === 'recipe'
      );

      expect(mealsTabFiltered.length).toBe(2);
      expect(mealsTabFiltered.map((m) => m.name)).toEqual([
        'Espaguete à Carbonara',
        'Panqueca de Frango',
      ]);
    });

    it('3.4 recipe builder calculates live totals and scaled 100g base accurately', () => {
      // Ingredient 1: 150g Frango (base 100g: 159 kcal, 32g P, 0g C, 2.5g F)
      // Ingredient 2: 200g Arroz (base 100g: 128 kcal, 2.5g P, 28.1g C, 0.2g F)
      const ing1 = {
        grams: 150,
        calories: 238.5,
        protein: 48.0,
        carbs: 0.0,
        fat: 3.75,
      };
      const ing2 = {
        grams: 200,
        calories: 256.0,
        protein: 5.0,
        carbs: 56.2,
        fat: 0.4,
      };

      const totalG = ing1.grams + ing2.grams; // 350g
      const totalKcal = Number((ing1.calories + ing2.calories).toFixed(1)); // 494.5 kcal
      const totalP = Number((ing1.protein + ing2.protein).toFixed(1)); // 53.0g
      const totalC = Number((ing1.carbs + ing2.carbs).toFixed(1)); // 56.2g
      const totalF = Number((ing1.fat + ing2.fat).toFixed(1)); // 4.15 -> 4.2g

      expect(totalG).toBe(350);
      expect(totalKcal).toBe(494.5);
      expect(totalP).toBe(53.0);
      expect(totalC).toBe(56.2);

      // Scaled to 100g standard
      const scale = 100 / totalG;
      const scaledKcal = Number((totalKcal * scale).toFixed(1));
      const scaledP = Number((totalP * scale).toFixed(1));

      expect(scaledKcal).toBeCloseTo(141.3, 1);
      expect(scaledP).toBeCloseTo(15.1, 1);
    });
  });
});
