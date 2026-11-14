import { getDatabaseAsync, runMigrationV3, runMigrations } from '../../src/database/connection';
import { BEVERAGES_SEED } from '../../src/database/seed/tacoFoods';
import { SqliteDietRepository } from '../../src/database/repositories/SqliteDietRepository';
import { LightTheme, DarkTheme, getTheme } from '../../src/constants/theme';
import appJson from '../../app.json';
import pkgJson from '../../package.json';
import * as fs from 'fs';
import * as path from 'path';

describe('Challenger M9: Empirical Stress & Verification Test Suite', () => {
  describe('1. Migration V3 Idempotency & Database Schema Stress', () => {
    it('verifies that running runMigrationV3 multiple consecutive times is strictly idempotent', async () => {
      const db = await getDatabaseAsync();

      // Check baseline
      const initialCount = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) as count FROM foods WHERE category = 'Bebidas';"
      );
      expect(initialCount?.count).toBe(15);

      // Execute runMigrationV3 10 times consecutively
      for (let i = 0; i < 10; i++) {
        await runMigrationV3(db);
      }

      // Verify count has not multiplied or duplicated
      const postCount = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) as count FROM foods WHERE category = 'Bebidas';"
      );
      expect(postCount?.count).toBe(15);

      // Verify PRAGMA user_version is 4 (including V4 multi-user isolation migration)
      const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
      expect(version?.user_version).toBe(4);
    });

    it('verifies concurrent execution of runMigrations does not produce duplicate foods or throw constraint errors', async () => {
      const db = await getDatabaseAsync();

      // Launch 10 concurrent migration attempts
      const promises = Array.from({ length: 10 }, () => runMigrations(db));
      await expect(Promise.all(promises)).resolves.toBeDefined();

      const drinksCount = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) as count FROM foods WHERE category = 'Bebidas';"
      );
      expect(drinksCount?.count).toBe(15);

      const totalFoods = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM foods;'
      );
      // 42 TACO + 11 Dishes + 15 Beverages = 68
      expect(totalFoods?.count).toBe(68);
    });

    it('verifies every beverage seed conforms to schema requirements', () => {
      expect(BEVERAGES_SEED).toHaveLength(15);
      const ids = new Set<string>();

      for (const drink of BEVERAGES_SEED) {
        expect(drink.id).toMatch(/^drink-/);
        expect(ids.has(drink.id)).toBe(false);
        ids.add(drink.id);

        expect(drink.category).toBe('Bebidas');
        expect(drink.servingGrams).toBe(100);
        expect(drink.servingUnitName).toMatch(/ml/);
        expect(drink.calories).toBeGreaterThanOrEqual(0);
        expect(drink.protein).toBeGreaterThanOrEqual(0);
        expect(drink.carbs).toBeGreaterThanOrEqual(0);
        expect(drink.fat).toBeGreaterThanOrEqual(0);
        expect(drink.source).toBe('recipe');
        expect(typeof drink.nameNormalized).toBe('string');
        expect(drink.nameNormalized!.length).toBeGreaterThan(0);
      }
    });
  });

  describe('2. Beverages Search Behavior & Tab Filtering', () => {
    it('verifies empty search returns Refeições first, Bebidas second, then TACO foods', async () => {
      const db = await getDatabaseAsync();
      const repo = new SqliteDietRepository(db);

      const results = await repo.searchFoods('', 100);
      expect(results.length).toBe(68);

      // First 11 must be Refeições
      const meals = results.slice(0, 11);
      for (const m of meals) {
        expect(m.category).toBe('Refeições');
      }

      // Next 15 must be Bebidas
      const drinks = results.slice(11, 26);
      for (const d of drinks) {
        expect(d.category).toBe('Bebidas');
      }

      // Remaining 42 must NOT be Refeições or Bebidas
      const others = results.slice(26);
      expect(others.length).toBe(42);
      for (const o of others) {
        expect(o.category).not.toBe('Refeições');
        expect(o.category).not.toBe('Bebidas');
      }
    });

    it('verifies search filtering for "drinks" tab returns all 15 beverages', async () => {
      const db = await getDatabaseAsync();
      const repo = new SqliteDietRepository(db);

      const results = await repo.searchFoods('', 100);
      const drinksTab = results.filter((item) => item.category === 'Bebidas');
      expect(drinksTab.length).toBe(15);

      const mealsTab = results.filter(
        (item) => item.category === 'Refeições' || (item.source === 'recipe' && item.category !== 'Bebidas')
      );
      expect(mealsTab.length).toBe(11);
      expect(mealsTab.some((m) => m.category === 'Bebidas')).toBe(false);

      const tacoTab = results.filter(
        (item) => item.source === 'taco' && item.category !== 'Refeições' && item.category !== 'Bebidas'
      );
      expect(tacoTab.length).toBe(42);
      expect(tacoTab.some((t) => t.category === 'Bebidas')).toBe(false);
    });

    it('EMPIRICAL BUG REPRODUCTION: renderSourceBadge in search.tsx returns "Refeição" for seeded beverages because item.source === "recipe"', () => {
      // In src/app/nutrition/search.tsx (lines 155-161):
      // const renderSourceBadge = (item: FoodItem) => {
      //   if (item.category === 'Refeições' || item.source === 'recipe') {
      //     return <Text style={styles.badgeMeal}>Refeição</Text>;
      //   }
      //   if (item.category === 'Bebidas') {
      //     return <Text style={styles.badgeDrink}>Bebida</Text>;
      //   }
      // };

      const simulateRenderBadge = (item: { category?: string; source: string }) => {
        if (item.category === 'Refeições' || item.source === 'recipe') {
          return 'Refeição';
        }
        if (item.category === 'Bebidas') {
          return 'Bebida';
        }
        return item.source;
      };

      // For every seeded beverage, item.category is 'Bebidas' BUT item.source is 'recipe'
      for (const drink of BEVERAGES_SEED) {
        const badge = simulateRenderBadge(drink);
        // BUG CONFIRMED: it evaluates to 'Refeição' instead of 'Bebida'!
        expect(badge).toBe('Refeição');
      }

      // Expected correct logic:
      const correctedRenderBadge = (item: { category?: string; source: string }) => {
        if (item.category === 'Bebidas') {
          return 'Bebida';
        }
        if (item.category === 'Refeições' || item.source === 'recipe') {
          return 'Refeição';
        }
        return item.source;
      };

      for (const drink of BEVERAGES_SEED) {
        expect(correctedRenderBadge(drink)).toBe('Bebida');
      }
    });
  });

  describe('3. Liquid Portion Sizes in ml & Macro Scaling', () => {
    it('verifies linear macro and calorie recalculation across standard liquid portion presets (100ml, 200ml, 350ml, 500ml)', () => {
      const orangeJuice = BEVERAGES_SEED.find((d) => d.id === 'drink-suco-laranja-natural')!;
      expect(orangeJuice).toBeDefined();

      const calculateMacrosForMl = (food: typeof orangeJuice, volumeMl: number) => {
        const baseGrams = food.servingGrams > 0 ? food.servingGrams : 100;
        const ratio = volumeMl / baseGrams;
        return {
          volumeMl,
          calories: Number((food.calories * ratio).toFixed(1)),
          protein: Number((food.protein * ratio).toFixed(1)),
          carbs: Number((food.carbs * ratio).toFixed(1)),
          fat: Number((food.fat * ratio).toFixed(1)),
        };
      };

      // 100ml base: 45 kcal, 0.7g P, 10.4g C, 0.2g G
      expect(calculateMacrosForMl(orangeJuice, 100)).toEqual({
        volumeMl: 100,
        calories: 45,
        protein: 0.7,
        carbs: 10.4,
        fat: 0.2,
      });

      // 200ml cup: 90 kcal, 1.4g P, 20.8g C, 0.4g G
      expect(calculateMacrosForMl(orangeJuice, 200)).toEqual({
        volumeMl: 200,
        calories: 90,
        protein: 1.4,
        carbs: 20.8,
        fat: 0.4,
      });

      // 350ml can: 157.5 kcal, 2.4g P (0.7 * 3.5 = 2.4499...), 36.4g C, 0.7g G
      expect(calculateMacrosForMl(orangeJuice, 350)).toEqual({
        volumeMl: 350,
        calories: 157.5,
        protein: 2.4,
        carbs: 36.4,
        fat: 0.7,
      });

      // 500ml bottle: 225 kcal, 3.5g P, 52.0g C, 1.0g G
      expect(calculateMacrosForMl(orangeJuice, 500)).toEqual({
        volumeMl: 500,
        calories: 225,
        protein: 3.5,
        carbs: 52,
        fat: 1,
      });
    });

    it('verifies boundary and extreme volumes (0ml, negative, large volume)', () => {
      const milk = BEVERAGES_SEED.find((d) => d.id === 'drink-leite-integral')!;

      const calculateSafely = (food: typeof milk, volumeMl: number) => {
        const baseGrams = food.servingGrams > 0 ? food.servingGrams : 100;
        const ratio = (volumeMl > 0 ? volumeMl : 0) / baseGrams;
        return {
          calories: Number((food.calories * ratio).toFixed(1)),
          protein: Number((food.protein * ratio).toFixed(1)),
        };
      };

      expect(calculateSafely(milk, 0)).toEqual({ calories: 0, protein: 0 });
      expect(calculateSafely(milk, -50)).toEqual({ calories: 0, protein: 0 });

      // 2000ml (2 liters)
      const bigPortion = calculateSafely(milk, 2000);
      expect(bigPortion.calories).toBe(1200);
      expect(bigPortion.protein).toBe(64);
      expect(Number.isFinite(bigPortion.calories)).toBe(true);
    });

    it('EMPIRICAL BUG REPRODUCTION: FoodLogRow displays "g" instead of "ml" for custom drinks because foodId does not start with "drink-"', () => {
      // In FoodLogRow.tsx line 21:
      // const isDrink = entry.foodId?.startsWith('drink-');
      // const unitLabel = isDrink ? 'ml' : 'g';

      // Seeded beverage
      const seededLogEntry = {
        foodId: 'drink-cafe-com-leite',
        foodName: 'Café com leite',
        servingGrams: 200,
      };
      const isSeededDrink = seededLogEntry.foodId?.startsWith('drink-');
      const seededUnit = isSeededDrink ? 'ml' : 'g';
      expect(seededUnit).toBe('ml');

      // Custom beverage created via custom.tsx (where foodId is generated as `food-${timestamp}-${rand}`)
      const customDrinkLogEntry = {
        foodId: 'food-1731000000000-xyz123',
        foodName: 'Suco de Abacaxi Caseiro',
        servingGrams: 300,
      };
      const isCustomDrink = customDrinkLogEntry.foodId?.startsWith('drink-');
      const customUnit = isCustomDrink ? 'ml' : 'g';

      // BUG CONFIRMED: custom drink is displayed as "300g" instead of "300ml"!
      expect(customUnit).toBe('g');
    });
  });

  describe('4. Theme Token Consistency & Dynamic Contrast', () => {
    it('verifies exact 1:1 color token key parity between LightTheme and DarkTheme', () => {
      const darkColorKeys = Object.keys(DarkTheme.colors).sort();
      const lightColorKeys = Object.keys(LightTheme.colors).sort();

      expect(lightColorKeys).toEqual(darkColorKeys);
      expect(darkColorKeys.length).toBe(22);

      // Verify each token has a non-empty string value
      for (const key of darkColorKeys) {
        const darkVal = (DarkTheme.colors as Record<string, string>)[key];
        const lightVal = (LightTheme.colors as Record<string, string>)[key];
        expect(typeof darkVal).toBe('string');
        expect(darkVal.length).toBeGreaterThan(0);
        expect(typeof lightVal).toBe('string');
        expect(lightVal.length).toBeGreaterThan(0);
      }
    });

    it('verifies spacing and borderRadius objects are strictly identical', () => {
      expect(LightTheme.spacing).toEqual(DarkTheme.spacing);
      expect(LightTheme.borderRadius).toEqual(DarkTheme.borderRadius);
    });

    it('verifies getTheme returns the expected theme instance for light and dark modes', () => {
      expect(getTheme('light')).toBe(LightTheme);
      expect(getTheme('dark')).toBe(DarkTheme);
      // Default fallback
      expect(getTheme()).toBe(DarkTheme);
    });
  });

  describe('5. Rebranding & Cryptographic Invariance', () => {
    it('verifies app.json and package.json have been updated to -Frango / MenosFrango', () => {
      expect(appJson.expo.name).toBe('-Frango');
      expect(appJson.expo.slug).toBe('MenosFrango');
      expect(appJson.expo.userInterfaceStyle).toBe('automatic');
      expect(pkgJson.name).toBe('menosfrango');
    });

    it('verifies per-user cryptographic salt generation and v2$ hash format in SqliteAuthRepository', () => {
      const authRepoPath = path.resolve(__dirname, '../../src/database/repositories/SqliteAuthRepository.ts');
      const content = fs.readFileSync(authRepoPath, 'utf8');

      // Per-user CSPRNG salt generation and v2$<salt>$<digest> format
      expect(content).toContain('export function generateSalt(byteLength = 16): string');
      expect(content).toContain('return `v2$${effectiveSalt}$${digest}`;');
    });
  });
});
