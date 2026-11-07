import { InMemorySQLiteDatabase, createTestDatabase } from '../helpers/inMemoryDb';
import { SqliteDietRepository } from '@/database/repositories/SqliteDietRepository';
import {
  scaleMacros,
  calculateAtwaterCalories,
  isAtwaterConsistent,
  summarizeDietLogs,
} from '@/utils/nutrition';
import { normalizeFoodText } from '@/utils/text';

describe('Tier 5 Adversarial Stress Testing: Milestone M2 Integrity', () => {
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

  // =========================================================================
  // 1. SQL Injection Attempts in searchFoods
  // =========================================================================
  describe('1. SQL Injection Hardening in searchFoods', () => {
    const SQLI_PAYLOADS = [
      // Classic Boolean-based blind & tautology payloads
      "' OR 1=1 --",
      "' OR '1'='1",
      "' OR ''='",
      "1' OR '1' = '1' --",
      "' OR 1=1#",
      "' OR 1=1/*",

      // Stacked queries / DDL destruction payloads
      "'; DROP TABLE foods; --",
      "'; DROP TABLE users; --",
      "'; DROP TABLE diet_logs; --",
      "'; DELETE FROM foods; --",
      "'; UPDATE users SET target_calories = 99999; --",

      // UNION SELECT data extraction payloads
      "' UNION SELECT NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL --",
      "' UNION SELECT id, email, name, 'hacked', target_calories, target_protein, target_carbs, target_fat, 0, NULL, 'custom', 'users', 'g', 1, created_at FROM users --",
      "' UNION ALL SELECT 1, 'Injected', 'injected', 'Cat', 100, 999, 99, 99, 99, 0, '123', 'custom', 'g', 1, '2026-01-01' --",

      // Quote & Syntax boundary fuzzing
      "'",
      "''",
      "'''",
      "''''",
      "\"",
      "\"\"",
      "`",
      "\\",
      "\\'",
      "\\\"",
      ";",
      ";;",
      "--",
      "/*",
      "*/",

      // Wildcard & metacharacter attacks
      "%",
      "%%",
      "%%%",
      "_",
      "___",
      "_%_%_",
      "[a-z]",
      "?",
      "*",

      // Subquery & SQLite function execution payloads
      "' AND (SELECT count(*) FROM sqlite_master) > 0 --",
      "' AND (SELECT length(sqlite_version())) > 0 --",
      "char(65)||char(66)||char(67)",
      "RANDOMBLOB(100000)",

      // Whitespace and control character variations
      "' OR\t1=1\n--",
      "'\r\nOR 1=1 --",
      "\0' OR 1=1 --",
      "   '   OR   1=1   --   ",
    ];

    it('executes all 40+ SQLi payloads safely without throwing syntax errors or crashing SQLite', async () => {
      for (const payload of SQLI_PAYLOADS) {
        await expect(repo.searchFoods(payload)).resolves.not.toThrow();
      }
    });

    it('guarantees no table dropping, data modification, or data corruption after SQLi attempts', async () => {
      // 1. Record food count before attack
      const beforeFoods = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM foods;'
      );
      expect(beforeFoods?.count).toBeGreaterThanOrEqual(42);

      // 2. Fire all destructive payloads
      for (const payload of SQLI_PAYLOADS) {
        await repo.searchFoods(payload);
      }

      // 3. Verify food count is strictly unchanged
      const afterFoods = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM foods;'
      );
      expect(afterFoods?.count).toBe(beforeFoods?.count);

      // 4. Verify users table is completely untouched
      const user = await db.getFirstAsync<{ target_calories: number }>(
        'SELECT target_calories FROM users LIMIT 1;'
      );
      expect(user?.target_calories).toBe(2000); // default untouched
    });

    it('never leaks user table data via UNION SELECT in searchFoods results', async () => {
      const results = await repo.searchFoods(
        "' UNION SELECT id, email, name, 'leak', target_calories, target_protein, target_carbs, target_fat, 0, NULL, 'custom', 'users', 'g', 1, created_at FROM users --"
      );
      // Because query uses parameterized binding, the UNION SELECT is interpreted as literal text
      expect(results.length).toBe(0);
      expect(results.some((r) => r.source === 'users' as any)).toBe(false);
    });

    it('correctly handles limit edge cases (0, negative, extremely large)', async () => {
      const zeroLimit = await repo.searchFoods('frango', 0);
      expect(zeroLimit.length).toBe(0);

      const largeLimit = await repo.searchFoods('frango', 100000);
      expect(largeLimit.length).toBeGreaterThan(0);

      const negativeLimit = await repo.searchFoods('frango', -1);
      // SQLite interprets LIMIT -1 as "no limit"
      expect(Array.isArray(negativeLimit)).toBe(true);
    });
  });

  // =========================================================================
  // 2. Negative Water Balance Exploits
  // =========================================================================
  describe('2. Negative Water Balance Hardening & Integrity', () => {
    it('calling decrementWaterLog repeatedly from 0ml returns null and keeps total strictly 0ml', async () => {
      const initialTotal = await repo.getDailyWaterTotal(TEST_DATE);
      expect(initialTotal).toBe(0);

      for (let i = 0; i < 15; i++) {
        const result = await repo.decrementWaterLog(TEST_DATE, 250);
        expect(result).toBeNull();
      }

      const finalTotal = await repo.getDailyWaterTotal(TEST_DATE);
      expect(finalTotal).toBe(0);

      const logs = await repo.getWaterLogs(TEST_DATE);
      expect(logs.length).toBe(0);
    });

    it('calling decrementWaterLog with negative amountMl decrements safely by absolute value', async () => {
      await repo.addWaterLog(TEST_DATE, 500);

      // Decrementing with -250ml
      const dec = await repo.decrementWaterLog(TEST_DATE, -250);
      expect(dec).not.toBeNull();
      expect(dec?.amountMl).toBe(-250);

      const total = await repo.getDailyWaterTotal(TEST_DATE);
      expect(total).toBe(250);
    });

    it('calling decrementWaterLog with amount exceeding current balance clamps to exact 0ml', async () => {
      await repo.addWaterLog(TEST_DATE, 150);

      // Decrementing 500ml from 150ml balance
      const dec = await repo.decrementWaterLog(TEST_DATE, 500);
      expect(dec).not.toBeNull();
      expect(dec?.amountMl).toBe(-150); // delta is Math.min(500, 150) = 150

      const total = await repo.getDailyWaterTotal(TEST_DATE);
      expect(total).toBe(0);

      // Subsequent decrement is blocked
      const nextDec = await repo.decrementWaterLog(TEST_DATE, 500);
      expect(nextDec).toBeNull();
      expect(await repo.getDailyWaterTotal(TEST_DATE)).toBe(0);
    });

    it('handles negative values in addWaterLog with non-negative total guarantee', async () => {
      // Direct negative injection
      await repo.addWaterLog(TEST_DATE, -500);

      // Total must be clamped to >= 0
      const total = await repo.getDailyWaterTotal(TEST_DATE);
      expect(total).toBe(0);

      // Nutrition summary must also reflect 0ml
      const summary = await repo.getDailyNutritionSummary(TEST_DATE);
      expect(summary.totalWaterMl).toBe(0);

      // decrementWaterLog checks getDailyWaterTotal <= 0, so it returns null
      const dec = await repo.decrementWaterLog(TEST_DATE, 250);
      expect(dec).toBeNull();

      // Reset cleanses all rows
      await repo.resetWaterLogs(TEST_DATE);
      const afterReset = await repo.getDailyWaterTotal(TEST_DATE);
      expect(afterReset).toBe(0);
      const afterLogs = await repo.getWaterLogs(TEST_DATE);
      expect(afterLogs.length).toBe(0);
    });

    it('calling decrementWaterLog with 0ml does not alter balance', async () => {
      await repo.addWaterLog(TEST_DATE, 500);
      const dec = await repo.decrementWaterLog(TEST_DATE, 0);
      expect(dec).not.toBeNull();
      expect(dec?.amountMl).toBe(-0);

      const total = await repo.getDailyWaterTotal(TEST_DATE);
      expect(total).toBe(500);
    });

    it('rapid concurrent decrement calls do not breach zero floor', async () => {
      await repo.addWaterLog(TEST_DATE, 250);

      // 10 concurrent decrements of 250ml
      await Promise.all([
        repo.decrementWaterLog(TEST_DATE, 250),
        repo.decrementWaterLog(TEST_DATE, 250),
        repo.decrementWaterLog(TEST_DATE, 250),
        repo.decrementWaterLog(TEST_DATE, 250),
        repo.decrementWaterLog(TEST_DATE, 250),
      ]);

      const total = await repo.getDailyWaterTotal(TEST_DATE);
      expect(total).toBe(0);
    });
  });

  // =========================================================================
  // 3. Atwater Discrepancy Attacks
  // =========================================================================
  describe('3. Atwater Discrepancy Hardening', () => {
    it('detects custom food with 0 macros but 1000 kcal as inconsistent', () => {
      const atwater = calculateAtwaterCalories(0, 0, 0);
      expect(atwater).toBe(0);

      const consistent = isAtwaterConsistent(1000, 0, 0, 0);
      expect(consistent).toBe(false);
    });

    it('detects custom food with massive macros but 0 kcal as inconsistent', () => {
      // 100g Protein (400) + 100g Carbs (400) + 50g Fat (450) = 1250 kcal vs 0 kcal reported
      const atwater = calculateAtwaterCalories(100, 100, 50);
      expect(atwater).toBe(1250);

      const consistent = isAtwaterConsistent(0, 100, 100, 50);
      expect(consistent).toBe(false);
    });

    it('correctly flags tolerance boundaries (exact, 15% boundary, >15% boundary)', () => {
      // Baseline: 100 kcal. 25g protein = 100 kcal Atwater (0% diff) -> Consistent
      expect(isAtwaterConsistent(100, 25, 0, 0)).toBe(true);

      // 100 kcal reported, 21.25g protein = 85 kcal Atwater (15.0% diff) -> Consistent
      expect(isAtwaterConsistent(100, 21.25, 0, 0)).toBe(true);

      // 100 kcal reported, 28.75g protein = 115 kcal Atwater (15.0% diff) -> Consistent
      expect(isAtwaterConsistent(100, 28.75, 0, 0)).toBe(true);

      // 100 kcal reported, 20g protein = 80 kcal Atwater (20% diff) -> Inconsistent
      expect(isAtwaterConsistent(100, 20, 0, 0)).toBe(false);

      // 100 kcal reported, 30g protein = 120 kcal Atwater (20% diff) -> Inconsistent
      expect(isAtwaterConsistent(100, 30, 0, 0)).toBe(false);
    });

    it('safely stores and queries custom food with extreme Atwater discrepancy in SQLite', async () => {
      const phantomFood = await repo.createFood({
        name: 'Energético Fantasma Zero Macros 1000kcal',
        category: 'Suplementos',
        servingGrams: 100,
        calories: 1000,
        protein: 0,
        carbs: 0,
        fat: 0,
        source: 'custom',
      });

      expect(phantomFood.id).toBeDefined();
      expect(phantomFood.calories).toBe(1000);

      // Search finds it
      const found = await repo.searchFoods('Fantasma');
      expect(found.length).toBe(1);
      expect(found[0].calories).toBe(1000);
      expect(found[0].protein).toBe(0);

      // Log it into meal diary
      await repo.addDietLog({
        date: TEST_DATE,
        mealType: 'snack',
        foodId: phantomFood.id,
        foodName: phantomFood.name,
        servingGrams: 100,
        calories: phantomFood.calories,
        protein: phantomFood.protein,
        carbs: phantomFood.carbs,
        fat: phantomFood.fat,
      });

      const summary = await repo.getDailyNutritionSummary(TEST_DATE);
      expect(summary.totalCalories).toBe(1000);
      expect(summary.totalProtein).toBe(0);
      expect(summary.totalCarbs).toBe(0);
      expect(summary.totalFat).toBe(0);
      expect(Number.isNaN(summary.totalCalories)).toBe(false);
    });

    it('handles negative macros in scaleMacros and calculation functions without NaN', () => {
      const atwater = calculateAtwaterCalories(-20, -50, -10);
      expect(atwater).toBe(-370);
      expect(Number.isNaN(atwater)).toBe(false);

      // scaleMacros with negative target or base grams clamps to 0
      const scaledNegative = scaleMacros(100, -100, {
        calories: 200,
        protein: 20,
        carbs: 20,
        fat: 5,
      });
      expect(scaledNegative.calories).toBe(0);
      expect(scaledNegative.protein).toBe(0);
      expect(Number.isNaN(scaledNegative.calories)).toBe(false);
    });
  });

  // =========================================================================
  // 4. Extreme Strings, Unicode, & Emojis
  // =========================================================================
  describe('4. Extreme Strings, Unicode & Emojis Hardening', () => {
    it('handles extreme long strings (10,000 chars) in food name and category', async () => {
      const longName = 'Proteína ' + 'A'.repeat(5000) + ' Whey';
      const longCategory = 'Cat ' + 'C'.repeat(500);

      const created = await repo.createFood({
        name: longName,
        category: longCategory,
        servingGrams: 100,
        calories: 120,
        protein: 24,
        carbs: 2,
        fat: 1.5,
        source: 'custom',
      });

      expect(created.id).toBeDefined();
      expect(created.name.length).toBe(longName.length);

      // Search prefix
      const hits = await repo.searchFoods('Proteina');
      expect(hits.length).toBeGreaterThan(0);
      expect(hits.some((h) => h.id === created.id)).toBe(true);
    });

    it('handles full Unicode emoji sequences and zero-width joiners in food names and search', async () => {
      const emojiFoodName = 'Banquete Fit 🥩🍗🥞🥑🥦🚀💪🍧👨‍🍳🏳️‍🌈';
      const created = await repo.createFood({
        name: emojiFoodName,
        category: 'Refeições',
        servingGrams: 500,
        calories: 850,
        protein: 70,
        carbs: 60,
        fat: 25,
        source: 'custom',
      });

      expect(created.name).toBe(emojiFoodName);

      // Search by single emoji
      const searchSingleEmoji = await repo.searchFoods('🥞');
      expect(searchSingleEmoji.length).toBe(1);
      expect(searchSingleEmoji[0].name).toBe(emojiFoodName);

      // Search by zero-width joiner emoji
      const searchZwjEmoji = await repo.searchFoods('👨‍🍳');
      expect(searchZwjEmoji.length).toBe(1);
      expect(searchZwjEmoji[0].name).toBe(emojiFoodName);

      // Search by regular text within emoji name
      const searchText = await repo.searchFoods('banquete fit');
      expect(searchText.length).toBe(1);
      expect(searchText[0].name).toBe(emojiFoodName);
    });

    it('handles multilingual Unicode scripts (CJK, Arabic, Cyrillic, Hebrew) gracefully', async () => {
      const multilingualFoods = [
        { name: '寿司 (Sushi de Salmão)', cat: 'Japonesa' },
        { name: '김치 (Kimchi Coreano)', cat: 'Coreana' },
        { name: 'Борщ (Borscht tradicional)', cat: 'Eslava' },
        { name: 'حمص (Húmus clássico)', cat: 'Árabe' },
        { name: 'שקשוקה (Shakshuka)', cat: 'Israelense' },
      ];

      for (const item of multilingualFoods) {
        await repo.createFood({
          name: item.name,
          category: item.cat,
          servingGrams: 100,
          calories: 150,
          protein: 10,
          carbs: 15,
          fat: 5,
          source: 'custom',
        });
      }

      // Search for CJK
      const hitsCjk = await repo.searchFoods('寿司');
      expect(hitsCjk.length).toBe(1);
      expect(hitsCjk[0].name).toContain('寿司');

      // Search for Arabic
      const hitsArabic = await repo.searchFoods('حمص');
      expect(hitsArabic.length).toBe(1);

      // Search for Cyrillic
      const hitsCyrillic = await repo.searchFoods('Борщ');
      expect(hitsCyrillic.length).toBe(1);
    });

    it('safely handles Zalgo corrupted text and combining diacritical marks', async () => {
      const zalgoText = 'A̶̧ç̵a̴í̶ ̵T̷u̶r̷b̸i̴n̴a̶d̷o̵';
      const created = await repo.createFood({
        name: zalgoText,
        category: 'Sobremesa',
        servingGrams: 200,
        calories: 300,
        protein: 4,
        carbs: 50,
        fat: 8,
        source: 'custom',
      });

      expect(created.id).toBeDefined();

      // Normalization of Zalgo text strips combining diacritical marks without throwing
      expect(() => normalizeFoodText(zalgoText)).not.toThrow();

      // Search query should not throw
      await expect(repo.searchFoods(zalgoText)).resolves.not.toThrow();
    });

    it('safely handles XSS scripts, HTML tags, and JSON string payloads in food names', async () => {
      const xssPayload = '<script>alert("PWNED")</script>';
      const jsonPayload = '{"action":"DROP_ALL","tokens":["xyz"]}';

      const xssFood = await repo.createFood({
        name: xssPayload,
        category: 'Payloads',
        servingGrams: 100,
        calories: 50,
        protein: 1,
        carbs: 10,
        fat: 0.5,
        source: 'custom',
      });

      const jsonFood = await repo.createFood({
        name: jsonPayload,
        category: 'Payloads',
        servingGrams: 100,
        calories: 50,
        protein: 1,
        carbs: 10,
        fat: 0.5,
        source: 'custom',
      });

      expect(xssFood.name).toBe(xssPayload);
      expect(jsonFood.name).toBe(jsonPayload);

      const foundXss = await repo.searchFoods('<script>');
      expect(foundXss.length).toBe(1);
      expect(foundXss[0].name).toBe(xssPayload);

      const foundJson = await repo.searchFoods('DROP_ALL');
      expect(foundJson.length).toBe(1);
      expect(foundJson[0].name).toBe(jsonPayload);
    });

    it('handles whitespace-only, empty, and symbol-only queries in searchFoods', async () => {
      const emptyRes = await repo.searchFoods('');
      expect(emptyRes.length).toBeGreaterThan(0);
      expect(emptyRes.length).toBeLessThanOrEqual(30);
      expect(emptyRes[0].category).toBe('Refeições');

      const whitespaceRes = await repo.searchFoods('   ');
      expect(whitespaceRes.length).toBeGreaterThan(0);
      expect(whitespaceRes.length).toBeLessThanOrEqual(30);
      expect(whitespaceRes[0].category).toBe('Refeições');

      const tabRes = await repo.searchFoods('\t\n\r');
      expect(tabRes.length).toBeGreaterThan(0);
      expect(tabRes.length).toBeLessThanOrEqual(30);
      expect(tabRes[0].category).toBe('Refeições');
    });
  });
});
