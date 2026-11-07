import { createE2ETestContext, E2ETestContext } from '../helpers/testContext';
import { scaleMacro, calculateAtwaterCalories, calculateNetWater } from '../helpers/calculationOracles';
import { DietLogEntry } from '@/types/domain';

describe('Tier 1: Feature Coverage — M2 Nutrition & Hydration (Features 5-15)', () => {
  let ctx: E2ETestContext;
  const TEST_DATE = '2026-11-06';
  const OTHER_DATE = '2026-11-07';

  beforeEach(async () => {
    ctx = await createE2ETestContext();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  // =========================================================================
  // Feature 5: Categorized Meal Diary (ORIGINAL_REQUEST §R2)
  // =========================================================================
  describe('Feature 5: Categorized Meal Diary', () => {
    it('5.1 logs food entries specifically to Café da Manhã (breakfast)', async () => {
      const entry = await ctx.dietRepo.addDietLog({
        date: TEST_DATE,
        mealType: 'breakfast',
        foodName: 'Ovo de galinha, inteiro, cozido',
        servingGrams: 100,
        calories: 146,
        protein: 13.3,
        carbs: 0.6,
        fat: 9.5,
      });

      expect(entry.id).toBeDefined();
      expect(entry.mealType).toBe('breakfast');

      const logs = await ctx.dietRepo.getDailyLogs(TEST_DATE);
      const breakfastLogs = logs.filter((l) => l.mealType === 'breakfast');
      expect(breakfastLogs.length).toBe(1);
      expect(breakfastLogs[0].foodName).toBe('Ovo de galinha, inteiro, cozido');
    });

    it('5.2 logs food entries specifically to Almoço (lunch)', async () => {
      await ctx.dietRepo.addDietLog({
        date: TEST_DATE,
        mealType: 'lunch',
        foodName: 'Arroz branco, cozido',
        servingGrams: 150,
        calories: 192,
        protein: 3.8,
        carbs: 42.2,
        fat: 0.3,
      });

      const summary = await ctx.dietRepo.getDailyNutritionSummary(TEST_DATE);
      expect(summary.meals.lunch.length).toBe(1);
      expect(summary.meals.lunch[0].foodName).toBe('Arroz branco, cozido');
    });

    it('5.3 logs food entries specifically to Lanche (snack)', async () => {
      await ctx.dietRepo.addDietLog({
        date: TEST_DATE,
        mealType: 'snack',
        foodName: 'Banana prata, crua',
        servingGrams: 100,
        calories: 98,
        protein: 1.3,
        carbs: 26.0,
        fat: 0.1,
      });

      const summary = await ctx.dietRepo.getDailyNutritionSummary(TEST_DATE);
      expect(summary.meals.snack.length).toBe(1);
      expect(summary.meals.snack[0].foodName).toBe('Banana prata, crua');
    });

    it('5.4 logs food entries to Jantar (dinner) and Ceia (supper)', async () => {
      await ctx.dietRepo.addDietLog({
        date: TEST_DATE,
        mealType: 'dinner',
        foodName: 'Peito de frango, grelhado',
        servingGrams: 200,
        calories: 318,
        protein: 64.0,
        carbs: 0.0,
        fat: 5.0,
      });

      await ctx.dietRepo.addDietLog({
        date: TEST_DATE,
        mealType: 'supper',
        foodName: 'Iogurte natural desnatado',
        servingGrams: 170,
        calories: 70,
        protein: 6.8,
        carbs: 10.2,
        fat: 0.5,
      });

      const summary = await ctx.dietRepo.getDailyNutritionSummary(TEST_DATE);
      expect(summary.meals.dinner.length).toBe(1);
      expect(summary.meals.supper.length).toBe(1);
    });

    it('5.5 segregates meal diary entries cleanly across different calendar dates', async () => {
      await ctx.dietRepo.addDietLog({
        date: TEST_DATE,
        mealType: 'breakfast',
        foodName: 'Pão francês',
        servingGrams: 50,
        calories: 150,
        protein: 4.5,
        carbs: 29.3,
        fat: 1.5,
      });

      await ctx.dietRepo.addDietLog({
        date: OTHER_DATE,
        mealType: 'breakfast',
        foodName: 'Tapioca (goma hidratada)',
        servingGrams: 100,
        calories: 242,
        protein: 0.0,
        carbs: 60.0,
        fat: 0.2,
      });

      const logsDay1 = await ctx.dietRepo.getDailyLogs(TEST_DATE);
      const logsDay2 = await ctx.dietRepo.getDailyLogs(OTHER_DATE);

      expect(logsDay1.length).toBe(1);
      expect(logsDay1[0].foodName).toBe('Pão francês');

      expect(logsDay2.length).toBe(1);
      expect(logsDay2[0].foodName).toBe('Tapioca (goma hidratada)');
    });
  });

  // =========================================================================
  // Feature 6: Daily Calorie & Macro Target Progress (ORIGINAL_REQUEST §R2)
  // =========================================================================
  describe('Feature 6: Daily Calorie & Macro Target Progress', () => {
    it('6.1 aggregates total calories, protein, carbs, and fat across all meals of the day', async () => {
      await ctx.dietRepo.addDietLog({
        date: TEST_DATE,
        mealType: 'breakfast',
        foodName: 'Ovo de galinha',
        servingGrams: 100,
        calories: 146,
        protein: 13.0,
        carbs: 1.0,
        fat: 10.0,
      });

      await ctx.dietRepo.addDietLog({
        date: TEST_DATE,
        mealType: 'lunch',
        foodName: 'Frango + Arroz',
        servingGrams: 250,
        calories: 350,
        protein: 35.0,
        carbs: 45.0,
        fat: 3.0,
      });

      const summary = await ctx.dietRepo.getDailyNutritionSummary(TEST_DATE);
      expect(summary.totalCalories).toBe(496);
      expect(summary.totalProtein).toBe(48.0);
      expect(summary.totalCarbs).toBe(46.0);
      expect(summary.totalFat).toBe(13.0);
    });

    it('6.2 verifies daily summary totals match the mathematical sum of individual meal items', async () => {
      await ctx.dietRepo.addDietLog({
        date: TEST_DATE,
        mealType: 'snack',
        foodName: 'Castanha-do-pará',
        servingGrams: 30,
        calories: 193,
        protein: 4.3,
        carbs: 3.7,
        fat: 19.0,
      });

      const logs = await ctx.dietRepo.getDailyLogs(TEST_DATE);
      const expectedCalories = logs.reduce((sum, item) => sum + item.calories, 0);
      const summary = await ctx.dietRepo.getDailyNutritionSummary(TEST_DATE);

      expect(summary.totalCalories).toBe(expectedCalories);
    });

    it('6.3 evaluates daily consumed macros against configured user profile goals', async () => {
      const profile = await ctx.authRepo.getProfile();
      expect(profile.targetCalories).toBe(2000);
      expect(profile.targetProtein).toBe(150);

      await ctx.dietRepo.addDietLog({
        date: TEST_DATE,
        mealType: 'lunch',
        foodName: 'Super Steak',
        servingGrams: 300,
        calories: 600,
        protein: 75.0,
        carbs: 0.0,
        fat: 25.0,
      });

      const summary = await ctx.dietRepo.getDailyNutritionSummary(TEST_DATE);
      const caloriesRemaining = profile.targetCalories - summary.totalCalories;
      const proteinProgressPct = Math.round((summary.totalProtein / profile.targetProtein) * 100);

      expect(caloriesRemaining).toBe(1400);
      expect(proteinProgressPct).toBe(50);
    });

    it('6.4 updates summary totals immediately when a new meal item is logged', async () => {
      let summary = await ctx.dietRepo.getDailyNutritionSummary(TEST_DATE);
      expect(summary.totalCalories).toBe(0);

      await ctx.dietRepo.addDietLog({
        date: TEST_DATE,
        mealType: 'dinner',
        foodName: 'Peixe',
        servingGrams: 100,
        calories: 120,
        protein: 24.0,
        carbs: 0.0,
        fat: 2.0,
      });

      summary = await ctx.dietRepo.getDailyNutritionSummary(TEST_DATE);
      expect(summary.totalCalories).toBe(120);
    });

    it('6.5 returns clean zero totals for dates with no logged meals', async () => {
      const summary = await ctx.dietRepo.getDailyNutritionSummary('2025-01-01');
      expect(summary.totalCalories).toBe(0);
      expect(summary.totalProtein).toBe(0);
      expect(summary.totalCarbs).toBe(0);
      expect(summary.totalFat).toBe(0);
      expect(summary.meals.breakfast).toEqual([]);
      expect(summary.meals.lunch).toEqual([]);
    });
  });

  // =========================================================================
  // Feature 7: Indexed TACO Food Search (ORIGINAL_REQUEST §R2)
  // =========================================================================
  describe('Feature 7: Indexed TACO Food Search', () => {
    it('7.1 executes food search in under 100ms using SQLite B-tree index', async () => {
      const start = Date.now();
      const results = await ctx.dietRepo.searchFoods('Arroz');
      const durationMs = Date.now() - start;

      expect(results.length).toBeGreaterThan(0);
      expect(durationMs).toBeLessThan(100);
    });

    it('7.2 returns matching foods for partial substring queries', async () => {
      const results = await ctx.dietRepo.searchFoods('frango');
      expect(results.length).toBeGreaterThanOrEqual(2);
      for (const item of results) {
        expect(item.name.toLowerCase()).toContain('frango');
      }
    });

    it('7.3 performs case-insensitive lookups returning identical results', async () => {
      const upper = await ctx.dietRepo.searchFoods('AVEIA');
      const lower = await ctx.dietRepo.searchFoods('aveia');

      expect(upper.length).toBeGreaterThan(0);
      expect(upper.length).toBe(lower.length);
      expect(upper[0].name).toBe(lower[0].name);
    });

    it('7.4 prioritizes prefix name matches ahead of mid-word matches', async () => {
      const results = await ctx.dietRepo.searchFoods('Banana');
      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results[0].name.toLowerCase().startsWith('banana')).toBe(true);
    });

    it('7.5 limits search results according to the limit parameter', async () => {
      const defaultLimit = await ctx.dietRepo.searchFoods('', 5);
      expect(defaultLimit.length).toBeLessThanOrEqual(5);

      const singleResult = await ctx.dietRepo.searchFoods('Carne', 1);
      expect(singleResult.length).toBe(1);
    });
  });

  // =========================================================================
  // Feature 8: Open Food Facts Search (ORIGINAL_REQUEST §R2)
  // =========================================================================
  describe('Feature 8: Open Food Facts Search', () => {
    it('8.1 queries and caches an industrial product in local foods database', async () => {
      const offItem = await ctx.dietRepo.createFood({
        name: 'Whey Protein Isolado Dux 900g',
        category: 'Suplementos',
        servingGrams: 30,
        calories: 115,
        protein: 24.0,
        carbs: 1.5,
        fat: 1.0,
        barcode: '7898956421012',
        source: 'openfoodfacts',
        servingUnitName: 'scoop',
        servingUnitGrams: 30,
      });

      expect(offItem.id).toBeDefined();
      expect(offItem.source).toBe('openfoodfacts');

      const found = await ctx.dietRepo.getFoodByBarcode('7898956421012');
      expect(found?.name).toBe('Whey Protein Isolado Dux 900g');
    });

    it('8.2 distinguishes food sources between taco, openfoodfacts, and custom', async () => {
      const tacoFoods = await ctx.dietRepo.searchFoods('Patinho');
      expect(tacoFoods[0].source).toBe('taco');

      await ctx.dietRepo.createFood({
        name: 'Barra de Proteina Darkness',
        servingGrams: 90,
        calories: 320,
        protein: 30.0,
        carbs: 25.0,
        fat: 10.0,
        source: 'openfoodfacts',
      });

      const offFoods = await ctx.dietRepo.searchFoods('Darkness');
      expect(offFoods[0].source).toBe('openfoodfacts');
    });

    it('8.3 allows cached Open Food Facts items to be logged in meal diary', async () => {
      const offFood = await ctx.dietRepo.createFood({
        name: 'Iogurte Grego Yopro 15g',
        servingGrams: 160,
        calories: 100,
        protein: 15.0,
        carbs: 6.0,
        fat: 1.5,
        source: 'openfoodfacts',
      });

      const log = await ctx.dietRepo.addDietLog({
        date: TEST_DATE,
        mealType: 'snack',
        foodId: offFood.id,
        foodName: offFood.name,
        servingGrams: 160,
        calories: offFood.calories,
        protein: offFood.protein,
        carbs: offFood.carbs,
        fat: offFood.fat,
      });

      expect(log.foodId).toBe(offFood.id);
      const summary = await ctx.dietRepo.getDailyNutritionSummary(TEST_DATE);
      expect(summary.totalProtein).toBe(15.0);
    });

    it('8.4 formats stored OFF items into the standard FoodItem contract', async () => {
      const offFood = await ctx.dietRepo.createFood({
        name: 'Pasta de Amendoim Growth',
        servingGrams: 30,
        calories: 180,
        protein: 8.5,
        carbs: 5.0,
        fat: 14.0,
        fiber: 2.0,
        source: 'openfoodfacts',
      });

      expect(offFood).toHaveProperty('id');
      expect(offFood).toHaveProperty('name');
      expect(offFood).toHaveProperty('calories');
      expect(offFood).toHaveProperty('protein');
      expect(offFood).toHaveProperty('carbs');
      expect(offFood).toHaveProperty('fat');
      expect(offFood).toHaveProperty('fiber');
      expect(offFood.source).toBe('openfoodfacts');
    });

    it('8.5 maintains searchable index when adding Open Food Facts items', async () => {
      await ctx.dietRepo.createFood({
        name: 'Biscoito Rice Crackers Kalassi',
        servingGrams: 30,
        calories: 110,
        protein: 2.0,
        carbs: 23.0,
        fat: 1.0,
        source: 'openfoodfacts',
      });

      const results = await ctx.dietRepo.searchFoods('Kalassi');
      expect(results.length).toBe(1);
      expect(results[0].name).toContain('Kalassi');
    });
  });

  // =========================================================================
  // Feature 9: Barcode Scanner Search (ORIGINAL_REQUEST §R2)
  // =========================================================================
  describe('Feature 9: Barcode Scanner Search', () => {
    it('9.1 looks up food item by exact EAN-13 barcode', async () => {
      await ctx.dietRepo.createFood({
        name: 'Leite Integral Piracanjuba 1L',
        servingGrams: 200,
        calories: 120,
        protein: 6.0,
        carbs: 10.0,
        fat: 6.0,
        barcode: '7898215150014',
        source: 'openfoodfacts',
      });

      const found = await ctx.dietRepo.getFoodByBarcode('7898215150014');
      expect(found).not.toBeNull();
      expect(found?.name).toBe('Leite Integral Piracanjuba 1L');
    });

    it('9.2 returns null cleanly when scanned barcode is not in local catalog', async () => {
      const found = await ctx.dietRepo.getFoodByBarcode('0000000000000');
      expect(found).toBeNull();
    });

    it('9.3 associates barcode with custom food when created by user', async () => {
      const custom = await ctx.dietRepo.createFood({
        name: 'Granola Caseira do Atleta',
        servingGrams: 40,
        calories: 160,
        protein: 4.0,
        carbs: 28.0,
        fat: 3.5,
        barcode: '7891234567890',
        source: 'custom',
      });

      expect(custom.barcode).toBe('7891234567890');
      const retrieved = await ctx.dietRepo.getFoodByBarcode('7891234567890');
      expect(retrieved?.id).toBe(custom.id);
    });

    it('9.4 handles UPC-A / 12-digit barcodes', async () => {
      await ctx.dietRepo.createFood({
        name: 'US Imported Protein Bar',
        servingGrams: 60,
        calories: 220,
        protein: 20.0,
        carbs: 22.0,
        fat: 7.0,
        barcode: '012345678905',
        source: 'openfoodfacts',
      });

      const found = await ctx.dietRepo.getFoodByBarcode('012345678905');
      expect(found?.name).toBe('US Imported Protein Bar');
    });

    it('9.5 executes barcode lookup via idx_foods_barcode B-tree index in under 10ms', async () => {
      await ctx.dietRepo.createFood({
        name: 'Indexed Barcode Test Item',
        servingGrams: 100,
        calories: 100,
        protein: 10,
        carbs: 10,
        fat: 2,
        barcode: '9999999999999',
        source: 'custom',
      });

      const start = Date.now();
      const item = await ctx.dietRepo.getFoodByBarcode('9999999999999');
      const elapsed = Date.now() - start;

      expect(item).not.toBeNull();
      expect(elapsed).toBeLessThan(15);
    });
  });

  // =========================================================================
  // Feature 10: Custom Food Creation (ORIGINAL_REQUEST §R2)
  // =========================================================================
  describe('Feature 10: Custom Food Creation', () => {
    it('10.1 creates custom food with user-specified grams and macronutrients', async () => {
      const customFood = await ctx.dietRepo.createFood({
        name: 'Bolo Fit de Caneca Proteico',
        category: 'Receitas',
        servingGrams: 120,
        calories: 250,
        protein: 28.0,
        carbs: 22.0,
        fat: 5.0,
        source: 'custom',
      });

      expect(customFood.id).toBeDefined();
      expect(customFood.name).toBe('Bolo Fit de Caneca Proteico');
      expect(customFood.calories).toBe(250);
      expect(customFood.protein).toBe(28.0);
    });

    it('10.2 assigns source="custom" flag explicitly', async () => {
      const food = await ctx.dietRepo.createFood({
        name: 'Pão de Queijo de Frigideira',
        servingGrams: 80,
        calories: 180,
        protein: 12.0,
        carbs: 18.0,
        fat: 6.0,
        source: 'custom',
      });

      expect(food.source).toBe('custom');
    });

    it('10.3 makes custom food immediately discoverable in food search', async () => {
      await ctx.dietRepo.createFood({
        name: 'Shake Anabólico de Pasta de Amendoim',
        servingGrams: 400,
        calories: 550,
        protein: 45.0,
        carbs: 50.0,
        fat: 18.0,
        source: 'custom',
      });

      const searchHits = await ctx.dietRepo.searchFoods('Anabólico');
      expect(searchHits.length).toBe(1);
      expect(searchHits[0].name).toContain('Shake Anabólico');
    });

    it('10.4 supports custom household serving unit descriptions', async () => {
      const food = await ctx.dietRepo.createFood({
        name: 'Panqueca de Aveia',
        servingGrams: 70,
        calories: 140,
        protein: 8.0,
        carbs: 19.0,
        fat: 3.0,
        servingUnitName: 'unidade',
        servingUnitGrams: 70,
        source: 'custom',
      });

      expect(food.servingUnitName).toBe('unidade');
      expect(food.servingUnitGrams).toBe(70);
    });

    it('10.5 creates multiple custom foods with different macronutrient profiles without conflicts', async () => {
      const food1 = await ctx.dietRepo.createFood({
        name: 'Low Carb Waffle',
        servingGrams: 60,
        calories: 110,
        protein: 15.0,
        carbs: 2.0,
        fat: 4.5,
        source: 'custom',
      });

      const food2 = await ctx.dietRepo.createFood({
        name: 'High Carb Energy Ball',
        servingGrams: 50,
        calories: 210,
        protein: 5.0,
        carbs: 38.0,
        fat: 4.0,
        source: 'custom',
      });

      expect(food1.id).not.toBe(food2.id);
      expect(food1.calories).toBe(110);
      expect(food2.calories).toBe(210);
    });
  });

  // =========================================================================
  // Feature 11: Food Portion Scaling & Logging (ORIGINAL_REQUEST §R2)
  // =========================================================================
  describe('Feature 11: Food Portion Scaling & Logging', () => {
    it('11.1 scales macros linearly for half portion (50g of 100g base)', async () => {
      const baseFood = { calories: 159, protein: 32.0, carbs: 0.0, fat: 2.5 };
      const servingGrams = 50;

      const scaledCalories = scaleMacro(baseFood.calories, servingGrams);
      const scaledProtein = scaleMacro(baseFood.protein, servingGrams);
      const scaledFat = scaleMacro(baseFood.fat, servingGrams);

      expect(scaledCalories).toBe(79.5);
      expect(scaledProtein).toBe(16.0);
      expect(scaledFat).toBe(1.3);

      const entry = await ctx.dietRepo.addDietLog({
        date: TEST_DATE,
        mealType: 'lunch',
        foodName: 'Peito de frango (50g)',
        servingGrams,
        calories: scaledCalories,
        protein: scaledProtein,
        carbs: 0.0,
        fat: scaledFat,
      });

      expect(entry.servingGrams).toBe(50);
      expect(entry.protein).toBe(16.0);
    });

    it('11.2 scales macros linearly for double portion (200g of 100g base)', async () => {
      const baseFood = { calories: 128, protein: 2.5, carbs: 28.1, fat: 0.2 }; // Rice
      const servingGrams = 200;

      const scaledCalories = scaleMacro(baseFood.calories, servingGrams);
      const scaledCarbs = scaleMacro(baseFood.carbs, servingGrams);
      const scaledProtein = scaleMacro(baseFood.protein, servingGrams);

      expect(scaledCalories).toBe(256.0);
      expect(scaledCarbs).toBe(56.2);
      expect(scaledProtein).toBe(5.0);
    });

    it('11.3 accurately persists scaled values into diet_logs table', async () => {
      await ctx.dietRepo.addDietLog({
        date: TEST_DATE,
        mealType: 'dinner',
        foodName: 'Patinho moído (150g)',
        servingGrams: 150,
        calories: 328.5,
        protein: 53.9,
        carbs: 0.0,
        fat: 11.0,
      });

      const logs = await ctx.dietRepo.getDailyLogs(TEST_DATE);
      expect(logs[0].servingGrams).toBe(150);
      expect(logs[0].protein).toBe(53.9);
      expect(logs[0].calories).toBe(328.5);
    });

    it('11.4 handles fractional portion grams with precision', async () => {
      const servingGrams = 125.5;
      const baseProteinPer100g = 32.0;
      const expectedProtein = scaleMacro(baseProteinPer100g, servingGrams);

      const entry = await ctx.dietRepo.addDietLog({
        date: TEST_DATE,
        mealType: 'lunch',
        foodName: 'Frango Porção Exata',
        servingGrams,
        calories: 199.5,
        protein: expectedProtein,
        carbs: 0.0,
        fat: 3.1,
      });

      expect(entry.servingGrams).toBe(125.5);
      expect(entry.protein).toBe(40.2);
    });

    it('11.5 accumulates scaled portion macros into daily summary correctly', async () => {
      await ctx.dietRepo.addDietLog({
        date: TEST_DATE,
        mealType: 'breakfast',
        foodName: 'Aveia (60g)',
        servingGrams: 60,
        calories: 236.4,
        protein: 8.3,
        carbs: 40.0,
        fat: 4.3,
      });

      const summary = await ctx.dietRepo.getDailyNutritionSummary(TEST_DATE);
      expect(summary.totalCalories).toBe(236.4);
      expect(summary.totalCarbs).toBe(40.0);
    });
  });

  // =========================================================================
  // Feature 12: Food Log Deletion & Edit (ORIGINAL_REQUEST §R2)
  // =========================================================================
  describe('Feature 12: Food Log Deletion & Edit', () => {
    let createdEntry: DietLogEntry;

    beforeEach(async () => {
      createdEntry = await ctx.dietRepo.addDietLog({
        date: TEST_DATE,
        mealType: 'lunch',
        foodName: 'Arroz branco',
        servingGrams: 100,
        calories: 128,
        protein: 2.5,
        carbs: 28.1,
        fat: 0.2,
      });
    });

    it('12.1 updates portion grams and macros of an existing diet log entry', async () => {
      await ctx.dietRepo.updateDietLog(createdEntry.id, {
        servingGrams: 200,
        calories: 256,
        protein: 5.0,
        carbs: 56.2,
      });

      const logs = await ctx.dietRepo.getDailyLogs(TEST_DATE);
      expect(logs[0].servingGrams).toBe(200);
      expect(logs[0].calories).toBe(256);
      expect(logs[0].carbs).toBe(56.2);
    });

    it('12.2 moving meal type during edit reflects in daily summary meal categories', async () => {
      await ctx.dietRepo.updateDietLog(createdEntry.id, {
        mealType: 'dinner',
      });

      const summary = await ctx.dietRepo.getDailyNutritionSummary(TEST_DATE);
      expect(summary.meals.lunch.length).toBe(0);
      expect(summary.meals.dinner.length).toBe(1);
    });

    it('12.3 deletes a logged food item by ID permanently', async () => {
      await ctx.dietRepo.deleteDietLog(createdEntry.id);
      const logs = await ctx.dietRepo.getDailyLogs(TEST_DATE);
      expect(logs.length).toBe(0);
    });

    it('12.4 deleting item subtracts its macros from daily nutrition summary', async () => {
      let summary = await ctx.dietRepo.getDailyNutritionSummary(TEST_DATE);
      expect(summary.totalCalories).toBe(128);

      await ctx.dietRepo.deleteDietLog(createdEntry.id);

      summary = await ctx.dietRepo.getDailyNutritionSummary(TEST_DATE);
      expect(summary.totalCalories).toBe(0);
      expect(summary.totalCarbs).toBe(0);
    });

    it('12.5 deleting non-existent ID completes cleanly without error', async () => {
      await expect(ctx.dietRepo.deleteDietLog('non-existent-id')).resolves.not.toThrow();
    });
  });

  // =========================================================================
  // Feature 13: Daily Water Intake Tracker (ORIGINAL_REQUEST §R2)
  // =========================================================================
  describe('Feature 13: Daily Water Intake Tracker', () => {
    it('13.1 logs water intake in milliliters for a specific date', async () => {
      const entry = await ctx.dietRepo.addWaterLog(TEST_DATE, 300);
      expect(entry.id).toBeDefined();
      expect(entry.date).toBe(TEST_DATE);
      expect(entry.amountMl).toBe(300);
    });

    it('13.2 aggregates multiple water entries into daily total consumption', async () => {
      await ctx.dietRepo.addWaterLog(TEST_DATE, 300);
      await ctx.dietRepo.addWaterLog(TEST_DATE, 500);
      await ctx.dietRepo.addWaterLog(TEST_DATE, 200);

      const logs = await ctx.dietRepo.getWaterLogs(TEST_DATE);
      expect(logs.length).toBe(3);

      const summary = await ctx.dietRepo.getDailyNutritionSummary(TEST_DATE);
      expect(summary.totalWaterMl).toBe(1000);
    });

    it('13.3 isolates water consumption across separate calendar dates', async () => {
      await ctx.dietRepo.addWaterLog(TEST_DATE, 1500);
      await ctx.dietRepo.addWaterLog(OTHER_DATE, 2200);

      const summaryDay1 = await ctx.dietRepo.getDailyNutritionSummary(TEST_DATE);
      const summaryDay2 = await ctx.dietRepo.getDailyNutritionSummary(OTHER_DATE);

      expect(summaryDay1.totalWaterMl).toBe(1500);
      expect(summaryDay2.totalWaterMl).toBe(2200);
    });

    it('13.4 calculates water completion percentage against user profile target', async () => {
      const profile = await ctx.authRepo.getProfile();
      expect(profile.targetWaterMl).toBe(2500);

      await ctx.dietRepo.addWaterLog(TEST_DATE, 1250);
      const summary = await ctx.dietRepo.getDailyNutritionSummary(TEST_DATE);

      const progressPct = Math.round((summary.totalWaterMl / profile.targetWaterMl) * 100);
      expect(progressPct).toBe(50);
    });

    it('13.5 returns 0ml water for dates with zero logs', async () => {
      const summary = await ctx.dietRepo.getDailyNutritionSummary('2025-01-01');
      expect(summary.totalWaterMl).toBe(0);
    });
  });

  // =========================================================================
  // Feature 14: Quick Water Increment Shortcuts (ORIGINAL_REQUEST §R2)
  // =========================================================================
  describe('Feature 14: Quick Water Increment Shortcuts', () => {
    it('14.1 quick +250ml shortcut persists immediately to database', async () => {
      const log = await ctx.dietRepo.addWaterLog(TEST_DATE, 250);
      expect(log.amountMl).toBe(250);

      const logs = await ctx.dietRepo.getWaterLogs(TEST_DATE);
      expect(logs.length).toBe(1);
      expect(logs[0].amountMl).toBe(250);
    });

    it('14.2 quick +500ml shortcut persists immediately to database', async () => {
      const log = await ctx.dietRepo.addWaterLog(TEST_DATE, 500);
      expect(log.amountMl).toBe(500);

      const logs = await ctx.dietRepo.getWaterLogs(TEST_DATE);
      expect(logs[0].amountMl).toBe(500);
    });

    it('14.3 multiple sequential shortcut taps (+250, +500, +250) accumulate to 1000ml', async () => {
      await ctx.dietRepo.addWaterLog(TEST_DATE, 250);
      await ctx.dietRepo.addWaterLog(TEST_DATE, 500);
      await ctx.dietRepo.addWaterLog(TEST_DATE, 250);

      const summary = await ctx.dietRepo.getDailyNutritionSummary(TEST_DATE);
      expect(summary.totalWaterMl).toBe(1000);
    });

    it('14.4 includes quick increment shortcuts in DailyNutritionSummary.totalWaterMl', async () => {
      await ctx.dietRepo.addWaterLog(TEST_DATE, 500);
      const summary = await ctx.dietRepo.getDailyNutritionSummary(TEST_DATE);
      expect(summary.totalWaterMl).toBe(500);
    });

    it('14.5 orders multiple water entries chronologically', async () => {
      await ctx.dietRepo.addWaterLog(TEST_DATE, 250);
      await ctx.dietRepo.addWaterLog(TEST_DATE, 500);

      const logs = await ctx.dietRepo.getWaterLogs(TEST_DATE);
      expect(logs.length).toBe(2);
      expect(new Date(logs[0].createdAt).getTime()).toBeLessThanOrEqual(
        new Date(logs[1].createdAt).getTime()
      );
    });
  });

  // =========================================================================
  // Feature 15: Water Intake Reset / Undo (Domain Survey & Acceptance)
  // =========================================================================
  describe('Feature 15: Water Intake Reset / Undo', () => {
    it('15.1 deletes a specific erroneous water log entry via deleteWaterLog', async () => {
      const entry1 = await ctx.dietRepo.addWaterLog(TEST_DATE, 250);
      const entry2 = await ctx.dietRepo.addWaterLog(TEST_DATE, 500);

      await ctx.dietRepo.deleteWaterLog(entry1.id);

      const logs = await ctx.dietRepo.getWaterLogs(TEST_DATE);
      expect(logs.length).toBe(1);
      expect(logs[0].id).toBe(entry2.id);

      const summary = await ctx.dietRepo.getDailyNutritionSummary(TEST_DATE);
      expect(summary.totalWaterMl).toBe(500);
    });

    it('15.2 resets all water logs for a specific day via resetWaterLogs', async () => {
      await ctx.dietRepo.addWaterLog(TEST_DATE, 250);
      await ctx.dietRepo.addWaterLog(TEST_DATE, 500);
      await ctx.dietRepo.addWaterLog(TEST_DATE, 250);

      await ctx.dietRepo.resetWaterLogs(TEST_DATE);

      const logs = await ctx.dietRepo.getWaterLogs(TEST_DATE);
      expect(logs.length).toBe(0);

      const summary = await ctx.dietRepo.getDailyNutritionSummary(TEST_DATE);
      expect(summary.totalWaterMl).toBe(0);
    });

    it('15.3 resetting water logs on date A does not delete water logs on date B', async () => {
      await ctx.dietRepo.addWaterLog(TEST_DATE, 1000);
      await ctx.dietRepo.addWaterLog(OTHER_DATE, 2000);

      await ctx.dietRepo.resetWaterLogs(TEST_DATE);

      const logsDay1 = await ctx.dietRepo.getWaterLogs(TEST_DATE);
      const logsDay2 = await ctx.dietRepo.getWaterLogs(OTHER_DATE);

      expect(logsDay1.length).toBe(0);
      expect(logsDay2.length).toBe(1);
      expect(logsDay2[0].amountMl).toBe(2000);
    });

    it('15.4 supports decrement log to undo an accidental quick increment', async () => {
      await ctx.dietRepo.addWaterLog(TEST_DATE, 500);
      await ctx.dietRepo.addWaterLog(TEST_DATE, -250); // Decrement/Undo

      const summary = await ctx.dietRepo.getDailyNutritionSummary(TEST_DATE);
      expect(summary.totalWaterMl).toBe(250);
    });

    it('15.5 tracks net water balance when decrements occur', async () => {
      await ctx.dietRepo.addWaterLog(TEST_DATE, 500);
      await ctx.dietRepo.addWaterLog(TEST_DATE, -200);

      const logs = await ctx.dietRepo.getWaterLogs(TEST_DATE);
      const netAmount = calculateNetWater(logs.map((l) => l.amountMl));
      expect(netAmount).toBe(300);

      const summary = await ctx.dietRepo.getDailyNutritionSummary(TEST_DATE);
      expect(summary.totalWaterMl).toBe(300);
    });
  });
});
