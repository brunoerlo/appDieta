import { BEVERAGES_SEED, TACO_FOODS_SEED, READY_DISHES_SEED } from '../../src/database/seed/tacoFoods';
import { getDatabaseAsync } from '../../src/database/connection';
import { SqliteDietRepository } from '../../src/database/repositories/SqliteDietRepository';
import { getTheme, DarkTheme, LightTheme } from '../../src/constants/theme';
import { isBeverageEntry, getFoodBadgeLabel } from '../../src/utils/nutrition';
import appJson from '../../app.json';
import pkgJson from '../../package.json';
import * as fs from 'fs';
import * as path from 'path';

describe('Beverages Seed, Migration V3, Dynamic Theme & Rebrand Tests', () => {
  describe('1. Beverage Seed & Database Migration V3', () => {
    it('verifies BEVERAGES_SEED contains exactly 15 beverages with correct categories and units', () => {
      expect(BEVERAGES_SEED.length).toBe(15);
      for (const drink of BEVERAGES_SEED) {
        expect(drink.category).toBe('Bebidas');
        expect(drink.servingGrams).toBe(100);
        expect(drink.calories).toBeGreaterThanOrEqual(0);
        expect(drink.protein).toBeGreaterThanOrEqual(0);
        expect(drink.carbs).toBeGreaterThanOrEqual(0);
        expect(drink.fat).toBeGreaterThanOrEqual(0);
        expect(drink.servingUnitName).toMatch(/ml/);
        expect(drink.source).toBe('recipe');
      }
    });

    it('verifies database initializes to user_version 4 with all beverages seeded', async () => {
      const db = await getDatabaseAsync();
      const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
      expect(version?.user_version).toBe(4);

      const drinksCount = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) as count FROM foods WHERE category = 'Bebidas';"
      );
      expect(drinksCount?.count).toBe(15);

      const tacoCount = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) as count FROM foods WHERE source = 'taco';"
      );
      expect(tacoCount?.count).toBe(42);
    });

    it('verifies diet repository search empty query prioritization and limit handling', async () => {
      const db = await getDatabaseAsync();
      const repo = new SqliteDietRepository(db);

      // Default empty query caps at 30
      const defaultEmpty = await repo.searchFoods('');
      expect(defaultEmpty.length).toBeLessThanOrEqual(30);
      expect(defaultEmpty.length).toBeGreaterThan(0);
      expect(defaultEmpty[0].category).toBe('Refeições');

      // Explicit limit of 100 returns more items including beverages
      const expanded = await repo.searchFoods('', 100);
      expect(expanded.length).toBeGreaterThan(30);
      const hasBeverage = expanded.some((f) => f.category === 'Bebidas');
      expect(hasBeverage).toBe(true);
    });
  });

  describe('2. Dynamic Theme & Token Parity', () => {
    it('verifies LightTheme and DarkTheme have identical key structure', () => {
      const darkKeys = Object.keys(DarkTheme.colors).sort();
      const lightKeys = Object.keys(LightTheme.colors).sort();
      expect(lightKeys).toEqual(darkKeys);

      expect(getTheme('light')).toBe(LightTheme);
      expect(getTheme('dark')).toBe(DarkTheme);
    });

    it('verifies LightTheme contrast properties', () => {
      expect(LightTheme.colors.background).toBe('#F8F9FA');
      expect(LightTheme.colors.card).toBe('#FFFFFF');
      expect(LightTheme.colors.textPrimary).toBe('#0F172A');
      expect(DarkTheme.colors.background).toBe('#0A0A0C');
      expect(DarkTheme.colors.textPrimary).toBe('#FFFFFF');
    });
  });

  describe('3. Rebranding to -Frango / MenosFrango', () => {
    it('verifies app.json rebrand properties', () => {
      expect(appJson.expo.name).toBe('-Frango');
      expect(appJson.expo.slug).toBe('MenosFrango');
      expect(appJson.expo.userInterfaceStyle).toBe('automatic');
    });

    it('verifies package.json rebrand properties', () => {
      expect(pkgJson.name).toBe('menosfrango');
    });
  });

  describe('4. Food Item Badge Priority in Search & Utilities', () => {
    it('verifies all 15 seeded beverages evaluate strictly to "Bebida" badge', () => {
      expect(BEVERAGES_SEED).toHaveLength(15);
      for (const drink of BEVERAGES_SEED) {
        const badge = getFoodBadgeLabel(drink);
        expect(badge).toBe('Bebida');
      }
    });

    it('verifies all seeded ready dishes evaluate to "Refeição" badge', () => {
      expect(READY_DISHES_SEED.length).toBeGreaterThan(0);
      for (const dish of READY_DISHES_SEED) {
        const badge = getFoodBadgeLabel(dish);
        expect(badge).toBe('Refeição');
      }
    });

    it('verifies all TACO foods evaluate to "TACO" badge', () => {
      expect(TACO_FOODS_SEED.length).toBeGreaterThan(0);
      for (const taco of TACO_FOODS_SEED) {
        const badge = getFoodBadgeLabel(taco);
        expect(badge).toBe('TACO');
      }
    });

    it('verifies custom items (meals vs drinks vs regular)', () => {
      expect(getFoodBadgeLabel({ category: 'Bebidas', source: 'custom' })).toBe('Bebida');
      expect(getFoodBadgeLabel({ category: 'Refeições', source: 'custom' })).toBe('Refeição');
      expect(getFoodBadgeLabel({ category: 'Prato do Chefe', source: 'recipe' })).toBe('Refeição');
      expect(getFoodBadgeLabel({ category: 'Personalizados', source: 'custom' })).toBe('Custom');
      expect(getFoodBadgeLabel({ category: 'Snacks', source: 'openfoodfacts' })).toBe('OFF');
    });

    it('audits src/app/nutrition/search.tsx source code to confirm item.category === "Bebidas" takes precedence', () => {
      const searchFilePath = path.resolve(__dirname, '../../src/app/nutrition/search.tsx');
      const content = fs.readFileSync(searchFilePath, 'utf8');

      // Locate renderSourceBadge
      const badgeFnIndex = content.indexOf('const renderSourceBadge');
      expect(badgeFnIndex).toBeGreaterThan(-1);

      const snippet = content.slice(badgeFnIndex, badgeFnIndex + 400);

      const bebidasIdx = snippet.indexOf("item.category === 'Bebidas'");
      const refeicoesIdx = snippet.indexOf("item.category === 'Refeições'");

      expect(bebidasIdx).toBeGreaterThan(-1);
      expect(refeicoesIdx).toBeGreaterThan(-1);
      // Bebidas check must appear BEFORE Refeições check
      expect(bebidasIdx).toBeLessThan(refeicoesIdx);
    });
  });

  describe('5. FoodLogRow Unit Label Resolution (ml vs g) & Beverage Detection', () => {
    it('detects seeded beverages by drink- ID prefix', () => {
      expect(isBeverageEntry({ foodId: 'drink-cafe-expresso', foodName: 'Café Expresso' })).toBe(true);
      expect(isBeverageEntry({ id: 'drink-agua-de-coco', name: 'Água de Coco' })).toBe(true);
    });

    it('detects custom beverages with UUID/food- ID by Portuguese beverage keywords', () => {
      const customDrinks = [
        { foodId: 'food-1731000000000-xyz123', foodName: 'Suco de Abacaxi Natural' },
        { foodId: 'food-1731000000001-xyz124', foodName: 'Café Preto com Adoçante' },
        { foodId: 'food-1731000000002-xyz125', foodName: 'Cafe com canela' },
        { foodId: 'food-1731000000003-xyz126', foodName: 'Leite Integral da Fazenda' },
        { foodId: 'food-1731000000004-xyz127', foodName: 'Refrigerante Cola Zero' },
        { foodId: 'food-1731000000005-xyz128', foodName: 'Água Mineral com Limão' },
        { foodId: 'food-1731000000006-xyz129', foodName: 'Agua com gas' },
        { foodId: 'food-1731000000007-xyz130', foodName: 'Cerveja Puro Malte' },
        { foodId: 'food-1731000000008-xyz131', foodName: 'Bebida Vegetal de Amêndoas' },
        { foodId: 'food-1731000000009-xyz132', foodName: 'Shake de Proteína com Banana' },
        { foodId: 'food-1731000000010-xyz133', foodName: 'Chá Verde Gelado' },
        { foodId: 'food-1731000000011-xyz134', foodName: 'Vitamina de Abacate' },
        { foodId: 'food-1731000000012-xyz135', foodName: 'Kombucha Hibisco' },
        { foodId: 'food-1731000000013-xyz136', foodName: 'Isotônico de Tangerina' },
      ];

      for (const drink of customDrinks) {
        expect(isBeverageEntry(drink)).toBe(true);
      }
    });

    it('detects beverages by category "Bebidas" or servingUnitName containing "ml"', () => {
      expect(
        isBeverageEntry({
          foodId: 'food-random-999',
          foodName: 'Bebida Especial da Casa',
          category: 'Bebidas',
        })
      ).toBe(true);

      expect(
        isBeverageEntry({
          foodId: 'food-random-888',
          foodName: 'Bebida Misteriosa',
          servingUnitName: 'copo (200ml)',
        })
      ).toBe(true);

      expect(
        isBeverageEntry({
          foodId: 'food-random-777',
          foodName: 'Refresco Tropical (300ml)',
        })
      ).toBe(true);
    });

    it('strictly does not flag solid foods or meals as beverages', () => {
      const solidFoods = [
        { foodId: 'taco-1', foodName: 'Arroz branco cozido' },
        { foodId: 'taco-2', foodName: 'Feijão carioca cozido' },
        { foodId: 'taco-3', foodName: 'Filé de frango grelhado' },
        { foodId: 'taco-4', foodName: 'Ovo frito' },
        { foodId: 'taco-5', foodName: 'Pão francês' },
        { foodId: 'taco-6', foodName: 'Batata doce cozida' },
        { foodId: 'dish-carbonara', foodName: 'Espaguete à Carbonara' },
        { foodId: 'dish-lasanha', foodName: 'Lasanha à Bolonhesa' },
        { foodId: 'food-custom-dish', foodName: 'Panqueca de Carne com Aveia' },
        { foodId: 'taco-7', foodName: 'Maçã fuji' },
        { foodId: 'taco-8', foodName: 'Castanha do Pará' },
      ];

      for (const food of solidFoods) {
        expect(isBeverageEntry(food)).toBe(false);
      }
    });

    it('verifies unit resolution in FoodLogRow logic produces "ml" for custom drinks and "g" for solid food', () => {
      const customDrinkEntry = {
        id: 'log-1',
        date: '2026-11-07',
        mealType: 'snack' as const,
        foodId: 'food-1731000000000-xyz123',
        foodName: 'Suco de Abacaxi Caseiro',
        servingGrams: 300,
        calories: 120,
        protein: 1,
        carbs: 28,
        fat: 0,
        createdAt: '2026-11-07T15:00:00Z',
      };

      const customDishEntry = {
        id: 'log-2',
        date: '2026-11-07',
        mealType: 'lunch' as const,
        foodId: 'food-1731000000000-xyz456',
        foodName: 'Frango com Batata Doce',
        servingGrams: 250,
        calories: 350,
        protein: 40,
        carbs: 30,
        fat: 5,
        createdAt: '2026-11-07T12:00:00Z',
      };

      const drinkUnit = isBeverageEntry(customDrinkEntry) ? 'ml' : 'g';
      expect(drinkUnit).toBe('ml');

      const foodUnit = isBeverageEntry(customDishEntry) ? 'ml' : 'g';
      expect(foodUnit).toBe('g');
    });

    it('audits src/components/nutrition/FoodLogRow.tsx source code to confirm isBeverageEntry usage', () => {
      const rowFilePath = path.resolve(__dirname, '../../src/components/nutrition/FoodLogRow.tsx');
      const content = fs.readFileSync(rowFilePath, 'utf8');

      expect(content).toContain('isBeverageEntry');
      expect(content).toContain('const isDrink = isBeverageEntry(entry);');
      // Must not use the old naive check alone
      expect(content).not.toMatch(/const\s+isDrink\s*=\s*entry\.foodId\?\.startsWith\('drink-'\);/);
    });

    it('generates drink- ID prefix for beverages and food- for non-beverages in SqliteDietRepository.createFood', async () => {
      const db = await getDatabaseAsync();
      const repo = new SqliteDietRepository(db);

      const customBeverage = await repo.createFood({
        name: 'Guaraná Caseiro Especial',
        category: 'Bebidas',
        servingGrams: 100,
        calories: 40,
        protein: 0,
        carbs: 10,
        fat: 0,
        fiber: 0,
        source: 'custom',
        servingUnitName: 'ml',
        servingUnitGrams: 1,
      });

      expect(customBeverage.id.startsWith('drink-')).toBe(true);

      const customDish = await repo.createFood({
        name: 'Omelete de Forno',
        category: 'Refeições',
        servingGrams: 100,
        calories: 180,
        protein: 14,
        carbs: 2,
        fat: 12,
        fiber: 0,
        source: 'custom',
        servingUnitName: 'porção',
        servingUnitGrams: 150,
      });

      expect(customDish.id.startsWith('food-')).toBe(true);
    });

    it('ensures custom beverage logged to diet_logs retains drink- ID and renders "ml"', async () => {
      const db = await getDatabaseAsync();
      const repo = new SqliteDietRepository(db);

      const drink = await repo.createFood({
        name: 'Chá Gelado com Pêssego',
        category: 'Bebidas',
        servingGrams: 100,
        calories: 25,
        protein: 0,
        carbs: 6,
        fat: 0,
        fiber: 0,
        source: 'custom',
        servingUnitName: 'ml',
        servingUnitGrams: 1,
      });

      const logged = await repo.addDietLog({
        date: '2026-11-07',
        mealType: 'snack',
        foodId: drink.id,
        foodName: drink.name,
        servingGrams: 300,
        calories: 75,
        protein: 0,
        carbs: 18,
        fat: 0,
      });

      expect(logged.foodId?.startsWith('drink-')).toBe(true);
      expect(isBeverageEntry(logged)).toBe(true);
      const unit = isBeverageEntry(logged) ? 'ml' : 'g';
      expect(unit).toBe('ml');
    });

    it('strictly classifies solid foods with "cha", canned tuna in water, and dairy powders as "g"', () => {
      const challengingFoods = [
        'Bolacha',
        'Bolacha recheada',
        'Salsicha',
        'Salsicha de frango',
        'Champignon',
        'Chantilly',
        'Pão na chapa',
        'Picanha na chapa',
        'Atum sólido em água',
        'Atum em água',
        'Doce de leite',
        'Leite em pó',
      ];

      for (const name of challengingFoods) {
        const entry = { foodName: name, servingGrams: 100 };
        expect(isBeverageEntry(entry)).toBe(false);
        const unit = isBeverageEntry(entry) ? 'ml' : 'g';
        expect(unit).toBe('g');
      }
    });
  });
});

