import { InMemorySQLiteDatabase, createTestDatabase } from '../helpers/inMemoryDb';
import { SqliteDietRepository } from '@/database/repositories/SqliteDietRepository';
import { SqliteAuthRepository } from '@/database/repositories/SqliteAuthRepository';
import { DietStateManager } from '@/context/DietContext';
import { FoodItem } from '@/types/domain';

describe('Unit: DietStateManager & Nutrition State Logic', () => {
  let db: InMemorySQLiteDatabase;
  let dietRepo: SqliteDietRepository;
  let authRepo: SqliteAuthRepository;
  let manager: DietStateManager;
  const TEST_DATE = '2026-11-06';

  const mockChicken: FoodItem = {
    id: 'taco-peito-frango-grelhado',
    name: 'Peito de frango, grelhado',
    category: 'Carnes e Ovos',
    servingGrams: 100,
    calories: 159,
    protein: 32.0,
    carbs: 0.0,
    fat: 2.5,
    source: 'taco',
  };

  beforeEach(async () => {
    db = await createTestDatabase();
    dietRepo = new SqliteDietRepository(db);
    authRepo = new SqliteAuthRepository(db);
    manager = new DietStateManager(dietRepo, authRepo, TEST_DATE);
    await manager.loadData();
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  it('1. initializes with current date and loads clean empty totals', () => {
    expect(manager.selectedDate).toBe(TEST_DATE);
    expect(manager.dailySummary.totalCalories).toBe(0);
    expect(manager.dailySummary.totalProtein).toBe(0);
    expect(manager.waterTotalMl).toBe(0);
    expect(manager.userProfile?.targetCalories).toBe(2000);
  });

  it('2. setDate updates date and fetches logs for the new date', async () => {
    await manager.setDate('2026-11-07');
    expect(manager.selectedDate).toBe('2026-11-07');
    expect(manager.dailySummary.date).toBe('2026-11-07');
  });

  it('3. goToNextDay and goToPreviousDay step dates by +1 / -1 day', async () => {
    await manager.goToNextDay();
    expect(manager.selectedDate).toBe('2026-11-07');

    await manager.goToPreviousDay();
    expect(manager.selectedDate).toBe('2026-11-06');
  });

  it('4. addFoodLog scales macros and persists log, updating daily summary', async () => {
    // 150g of chicken (100g base = 159 kcal, 32g P, 2.5g F)
    // 150g -> 238.5 kcal, 48.0g P, 3.8g F
    const log = await manager.addFoodLog({
      mealType: 'lunch',
      food: mockChicken,
      servingGrams: 150,
    });

    expect(log.id).toBeDefined();
    expect(log.servingGrams).toBe(150);
    expect(log.calories).toBe(238.5);
    expect(log.protein).toBe(48.0);

    expect(manager.dailySummary.totalCalories).toBe(238.5);
    expect(manager.dailySummary.totalProtein).toBe(48.0);
    expect(manager.dailySummary.meals.lunch.length).toBe(1);

    const mealSummaries = manager.getMealsSummary();
    expect(mealSummaries.lunch.calories).toBe(238.5);
    expect(mealSummaries.lunch.protein).toBe(48.0);
  });

  it('5. updateFoodLog updates portion grams and recalculates daily summary', async () => {
    const log = await manager.addFoodLog({
      mealType: 'breakfast',
      food: mockChicken,
      servingGrams: 100,
    });
    expect(manager.dailySummary.totalCalories).toBe(159);

    await manager.updateFoodLog(log.id, {
      servingGrams: 200,
      calories: 318,
      protein: 64,
      fat: 5,
    });

    expect(manager.dailySummary.totalCalories).toBe(318);
    expect(manager.dailySummary.totalProtein).toBe(64);
  });

  it('6. deleteFoodLog removes item and subtracts its macros from daily total', async () => {
    const log = await manager.addFoodLog({
      mealType: 'dinner',
      food: mockChicken,
      servingGrams: 100,
    });
    expect(manager.dailySummary.meals.dinner.length).toBe(1);

    await manager.deleteFoodLog(log.id);

    expect(manager.dailySummary.meals.dinner.length).toBe(0);
    expect(manager.dailySummary.totalCalories).toBe(0);
  });

  it('7. addWater increments total water volume immediately', async () => {
    await manager.addWater(250);
    expect(manager.waterTotalMl).toBe(250);

    await manager.addWater(500);
    expect(manager.waterTotalMl).toBe(750);
    expect(manager.waterLogs.length).toBe(2);
  });

  it('8. decrementWater reduces water total', async () => {
    await manager.addWater(500);
    expect(manager.waterTotalMl).toBe(500);

    await manager.decrementWater(250);
    expect(manager.waterTotalMl).toBe(250);
  });

  it('9. decrementWater clamps to 0ml without allowing negative balance', async () => {
    await manager.addWater(100);
    await manager.decrementWater(250);

    expect(manager.waterTotalMl).toBe(0);
  });

  it('10. resetWater clears all daily water logs', async () => {
    await manager.addWater(500);
    await manager.addWater(250);
    expect(manager.waterTotalMl).toBe(750);

    await manager.resetWater();
    expect(manager.waterTotalMl).toBe(0);
    expect(manager.waterLogs.length).toBe(0);
  });

  it('11. notifies subscribers when state updates occur', async () => {
    const listener = jest.fn();
    const unsubscribe = manager.subscribe(listener);

    await manager.addWater(250);
    expect(listener).toHaveBeenCalled();

    unsubscribe();
    listener.mockClear();
    await manager.addWater(250);
    expect(listener).not.toHaveBeenCalled();
  });

  it('12. error handling gracefully sets error message without crashing', async () => {
    const failingDietRepo: any = {
      getDailyNutritionSummary: jest.fn().mockRejectedValue(new Error('DB failure')),
      getDailyWaterTotal: jest.fn().mockResolvedValue(0),
      getWaterLogs: jest.fn().mockResolvedValue([]),
    };

    const failManager = new DietStateManager(failingDietRepo, authRepo, TEST_DATE);
    await failManager.loadData();

    expect(failManager.error).toBe('DB failure');
    expect(failManager.isLoading).toBe(false);
  });
});
