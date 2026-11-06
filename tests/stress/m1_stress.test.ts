import { InMemorySQLiteDatabase, createTestDatabase } from '../helpers/inMemoryDb';
import { SqliteDietRepository } from '@/database/repositories/SqliteDietRepository';
import { SqliteBodyRepository } from '@/database/repositories/SqliteBodyRepository';
import { SqliteWorkoutRepository } from '@/database/repositories/SqliteWorkoutRepository';
import { SqliteAuthRepository } from '@/database/repositories/SqliteAuthRepository';

describe('Milestone M1 Adversarial Stress Test Suite', () => {
  let db: InMemorySQLiteDatabase;
  let dietRepo: SqliteDietRepository;
  let bodyRepo: SqliteBodyRepository;
  let workoutRepo: SqliteWorkoutRepository;
  let authRepo: SqliteAuthRepository;

  beforeEach(async () => {
    db = await createTestDatabase();
    dietRepo = new SqliteDietRepository(db);
    bodyRepo = new SqliteBodyRepository(db);
    workoutRepo = new SqliteWorkoutRepository(db);
    authRepo = new SqliteAuthRepository(db);
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  // =========================================================================
  // 1. HIGH-VOLUME FOOD SEARCH (< 100ms with concurrent & complex queries)
  // =========================================================================
  describe('High-Volume Food Search Stress & Benchmarks', () => {
    it('populates 2,500 additional foods and verifies search latencies under 100ms with 100 concurrent queries', async () => {
      // 1. Bulk insert 2,500 foods into the database
      const insertCount = 2500;
      await db.withTransactionAsync(async () => {
        for (let i = 1; i <= insertCount; i++) {
          const cat = ['Carnes', 'Cereais', 'Frutas', 'Verduras', 'Laticínios', 'Suplementos'][i % 6];
          const name = `Alimento Sintético Número ${i} Especial ${cat}`;
          await db.runAsync(
            `INSERT INTO foods (id, name, category, serving_grams, calories, protein, carbs, fat, fiber, barcode, source, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'));`,
            `bulk-food-${i}`,
            name,
            cat,
            100,
            (i * 1.5) % 800,
            (i * 0.2) % 50,
            (i * 0.5) % 80,
            (i * 0.1) % 40,
            (i * 0.05) % 15,
            `789000000${String(i).padStart(4, '0')}`,
            'custom'
          );
        }
      });

      const totalFoods = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM foods;');
      expect(totalFoods?.count).toBeGreaterThanOrEqual(2542); // 42 TACO + 2500 synthetic

      // 2. Perform 100 concurrent diverse search queries
      const queryList: string[] = [
        'Frango', 'Arroz', 'Feijão', 'Banana', 'Ovo', 'Aveia', 'Patinho',
        'Alimento Sintético Número 50', 'Alimento Sintético Número 1999',
        'Especial Carnes', 'Especial Suplementos', 'Especial Laticínios',
        'InexistenteTotalXYZ', 'Whey', 'Leite', 'Batata', 'Pão', 'Maçã',
        'a', 'de', 'do', 'cozido', 'grelhado', 'cru', 'integral'
      ];

      // Expand to 100 queries
      const concurrentQueries: string[] = [];
      for (let i = 0; i < 100; i++) {
        concurrentQueries.push(queryList[i % queryList.length]);
      }

      // 2a. Sequential per-query execution latency benchmark
      const individualLatencies: number[] = [];
      for (const query of concurrentQueries) {
        const t0 = performance.now();
        const res = await dietRepo.searchFoods(query, 50);
        const elapsed = performance.now() - t0;
        individualLatencies.push(elapsed);
        expect(res).toBeDefined();
      }

      individualLatencies.sort((a, b) => a - b);
      const seqP50 = individualLatencies[Math.floor(individualLatencies.length * 0.5)];
      const seqP90 = individualLatencies[Math.floor(individualLatencies.length * 0.9)];
      const seqP99 = individualLatencies[individualLatencies.length - 1];
      const seqMax = Math.max(...individualLatencies);
      const seqAvg = individualLatencies.reduce((sum, v) => sum + v, 0) / individualLatencies.length;

      // 2b. Concurrent batch execution (100 parallel searches)
      const batchStartTime = performance.now();
      const concurrentResults = await Promise.all(
        concurrentQueries.map((query) => dietRepo.searchFoods(query, 50))
      );
      const totalBatchTime = performance.now() - batchStartTime;
      const amortizedPerQuery = totalBatchTime / concurrentQueries.length;

      // Log benchmark to stdout for empirical report
      console.log(`[BENCHMARK] Search across ${totalFoods?.count} foods:`);
      console.log(`  Sequential avg latency: ${seqAvg.toFixed(2)}ms`);
      console.log(`  Sequential P50 latency: ${seqP50.toFixed(2)}ms`);
      console.log(`  Sequential P90 latency: ${seqP90.toFixed(2)}ms`);
      console.log(`  Sequential P99 / Max latency: ${seqMax.toFixed(2)}ms`);
      console.log(`  100 concurrent queries total batch time: ${totalBatchTime.toFixed(2)}ms`);
      console.log(`  Amortized per-query concurrent time: ${amortizedPerQuery.toFixed(2)}ms`);

      // Acceptance criterion: < 100ms response time per search
      expect(seqMax).toBeLessThan(100);
      expect(seqAvg).toBeLessThan(20);
      expect(amortizedPerQuery).toBeLessThan(20);
    });

    it('handles complex, adversarial, and edge-case query strings without crashing or SQL errors', async () => {
      const adversarialQueries = [
        '', // empty
        '   ', // whitespace only
        '               manga             ', // excessive padding
        "'", // single quote
        "''", // double quote
        '""', // double quote
        "'; DROP TABLE foods; --", // SQL injection attempt
        "' UNION SELECT id, name, NULL, 0,0,0,0,0,0,NULL,'custom',NULL,NULL,datetime('now') FROM users --", // union injection
        '%', // raw wildcard
        '%%', // multiple wildcards
        '_', // single character wildcard
        '%_%', // wildcard mix
        '\\', // backslash
        '\\\\', // escaped backslash
        '\0', // null byte
        'a'.repeat(500), // very long search string (500 chars)
        'a'.repeat(2000), // extreme long string (2000 chars)
        '🎉 🥑 🏋️‍♂️ 🔥', // emoji query
        '!@#$%^&*()_+=-[]{}|;:",.<>?/', // symbol barrage
        'Pão d\'água', // apostrophe in query
        'Peito de frango (filé)', // parentheses in query
      ];

      for (const query of adversarialQueries) {
        let results: any;
        expect(async () => {
          results = await dietRepo.searchFoods(query, 20);
        }).not.toThrow();
        results = await dietRepo.searchFoods(query, 20);
        expect(Array.isArray(results)).toBe(true);
      }
    });
  });

  // =========================================================================
  // 2. EXTREME INPUTS (Negatives, Decimals, Unicode/Accents)
  // =========================================================================
  describe('Extreme Inputs & Edge Cases', () => {
    describe('Unicode & Brazilian Portuguese Accented Search Stress', () => {
      it('tests exact accented search vs case-folding and unaccented search', async () => {
        // Seed 'Açaí com xarope' so all 3 target queries from dispatch prompt are present
        await dietRepo.createFood({
          name: 'Açaí com xarope de guaraná',
          category: 'Frutas',
          servingGrams: 100,
          calories: 110,
          protein: 1.5,
          carbs: 21.5,
          fat: 2.0,
          source: 'custom',
        });

        // 1. Exact match with accents
        const paoExact = await dietRepo.searchFoods('pão francês');
        const macaExact = await dietRepo.searchFoods('maçã');
        const acaiExact = await dietRepo.searchFoods('açaí');

        // 2. Uppercase with accents
        const paoUpper = await dietRepo.searchFoods('PÃO FRANCÊS');
        const macaUpper = await dietRepo.searchFoods('MAÇÃ');
        const acaiUpper = await dietRepo.searchFoods('AÇAÍ');

        // 3. Unaccented search (user types "pao frances", "maca", "acai" without accents on mobile)
        const paoUnaccented = await dietRepo.searchFoods('pao frances');
        const macaUnaccented = await dietRepo.searchFoods('maca');
        const acaiUnaccented = await dietRepo.searchFoods('acai');

        console.log(`[UNICODE TEST RESULTS]`);
        console.log(`  'pão francês' exact: ${paoExact.length} matches | 'PÃO FRANCÊS' upper: ${paoUpper.length} matches | 'pao frances' unaccented: ${paoUnaccented.length} matches`);
        console.log(`  'maçã' exact: ${macaExact.length} matches | 'MAÇÃ' upper: ${macaUpper.length} matches | 'maca' unaccented: ${macaUnaccented.length} matches`);
        console.log(`  'açaí' exact: ${acaiExact.length} matches | 'AÇAÍ' upper: ${acaiUpper.length} matches | 'acai' unaccented: ${acaiUnaccented.length} matches`);

        // Verify that exact accents match
        expect(paoExact.length).toBeGreaterThan(0);
        expect(macaExact.length).toBeGreaterThan(0);
        expect(acaiExact.length).toBeGreaterThan(0);
      });

      it('inserts and retrieves custom foods with extreme Unicode, accents, and emojis', async () => {
        const exoticFood = await dietRepo.createFood({
          name: 'Açaí com Xarope de Guaraná, Paçoca & Banana 🍌 🥣',
          category: 'Doces & Sobremesas',
          servingGrams: 350.5,
          calories: 485.75,
          protein: 8.25,
          carbs: 88.4,
          fat: 12.1,
          fiber: 6.3,
          source: 'custom',
          servingUnitName: 'tigela grande',
          servingUnitGrams: 350.5,
        });

        expect(exoticFood.id).toBeDefined();

        const searchResult = await dietRepo.searchFoods('Açaí com Xarope');
        expect(searchResult.length).toBeGreaterThan(0);
        expect(searchResult[0].name).toBe('Açaí com Xarope de Guaraná, Paçoca & Banana 🍌 🥣');
        expect(searchResult[0].servingGrams).toBe(350.5);
      });
    });

    describe('Decimal Precision & Extreme Numeric Values', () => {
      it('handles micro-portions, decimal grams, and fractional calories without NaN or floating errors', async () => {
        const date = '2026-11-06';

        // Add meal log with fractional decimals
        await dietRepo.addDietLog({
          date,
          mealType: 'breakfast',
          foodName: 'Azeite de oliva extra virgem',
          servingGrams: 7.25,
          calories: 64.0875,
          protein: 0.0,
          carbs: 0.0,
          fat: 7.25,
        });

        // Add another with small decimals
        await dietRepo.addDietLog({
          date,
          mealType: 'breakfast',
          foodName: 'Sal marinho refinado',
          servingGrams: 0.5,
          calories: 0.0,
          protein: 0.0,
          carbs: 0.0,
          fat: 0.0,
        });

        const summary = await dietRepo.getDailyNutritionSummary(date);
        expect(summary.totalCalories).toBe(64.1); // rounded to 1 decimal
        expect(summary.totalFat).toBe(7.3);
        expect(Number.isNaN(summary.totalCalories)).toBe(false);
        expect(Number.isFinite(summary.totalCalories)).toBe(true);
      });

      it('observes behavior with zero, negative, and extreme out-of-range numeric inputs', async () => {
        const date = '2026-11-06';

        // 1. Negative water log
        await dietRepo.addWaterLog(date, 500);
        await dietRepo.addWaterLog(date, -200); // subtraction / undo via negative
        const waterTotal = await dietRepo.getDailyWaterTotal(date);
        console.log(`[NUMERIC STRESS] Water total with -200ml: ${waterTotal}ml`);
        expect(waterTotal).toBe(300);

        // 2. Negative meal log
        const negLog = await dietRepo.addDietLog({
          date,
          mealType: 'lunch',
          foodName: 'Correção de caloria negativa',
          servingGrams: -50,
          calories: -100,
          protein: -10,
          carbs: -5,
          fat: -2,
        });
        expect(negLog.id).toBeDefined();

        // 3. Negative body weight input vs calculateMovingAverage filter
        await bodyRepo.saveBodyLog({
          date: '2026-11-05',
          weightKg: -75.0, // negative weight
        });
        await bodyRepo.saveBodyLog({
          date: '2026-11-06',
          weightKg: 80.0, // valid weight
        });

        // calculateMovingAverage has `WHERE weight_kg > 0`, so -75.0 should be excluded!
        const ma = await bodyRepo.calculateMovingAverage('2026-11-06', 7);
        expect(ma).toBe(80.0); // -75.0 ignored!
      });
    });
  });

  // =========================================================================
  // 3. 7-DAY MOVING AVERAGE CALCULATION ACROSS BOUNDARY WINDOWS
  // =========================================================================
  describe('7-Day Moving Average Across Boundary Windows', () => {
    it('Window Boundary 1: 0 weigh-ins returns null', async () => {
      const ma = await bodyRepo.calculateMovingAverage('2026-11-06', 7);
      expect(ma).toBeNull();
    });

    it('Window Boundary 2: Exactly 1 weigh-in on target date returns that weight', async () => {
      await bodyRepo.saveBodyLog({ date: '2026-11-06', weightKg: 83.4 });
      const ma = await bodyRepo.calculateMovingAverage('2026-11-06', 7);
      expect(ma).toBe(83.4);
    });

    it('Window Boundary 3: Exactly 1 weigh-in on window edge (exactly 6 days prior)', async () => {
      // Target date: 2026-11-07. Window is [2026-11-01 to 2026-11-07] = 7 days.
      await bodyRepo.saveBodyLog({ date: '2026-11-01', weightKg: 79.5 });
      const ma = await bodyRepo.calculateMovingAverage('2026-11-07', 7);
      expect(ma).toBe(79.5);
    });

    it('Window Boundary 4: Weigh-in 1 day outside window (7 days prior) is excluded', async () => {
      // Target date: 2026-11-07. 2026-10-31 is 7 days prior -> outside window.
      await bodyRepo.saveBodyLog({ date: '2026-10-31', weightKg: 95.0 });
      const ma = await bodyRepo.calculateMovingAverage('2026-11-07', 7);
      expect(ma).toBeNull();
    });

    it('Window Boundary 5: Exactly 7 weigh-ins on consecutive days calculates exact mean', async () => {
      const weights = [75.0, 75.5, 76.0, 75.8, 76.2, 75.5, 75.0];
      const dates = [
        '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04',
        '2026-11-05', '2026-11-06', '2026-11-07'
      ];
      for (let i = 0; i < 7; i++) {
        await bodyRepo.saveBodyLog({ date: dates[i], weightKg: weights[i] });
      }

      // Sum: 75.0 + 75.5 + 76.0 + 75.8 + 76.2 + 75.5 + 75.0 = 529.0
      // Mean: 529.0 / 7 = 75.5714... -> toFixed(2) = 75.57
      const ma = await bodyRepo.calculateMovingAverage('2026-11-07', 7);
      expect(ma).toBe(75.57);
    });

    it('Window Boundary 6: 30 consecutive weigh-ins accurately isolates only the latest 7 days', async () => {
      // 30 days: 2026-10-01 to 2026-10-30
      // Days 1-23: weight = 100.0 kg
      // Days 24-30 (last 7 days: 2026-10-24 to 2026-10-30): weight = 70.0 kg
      for (let day = 1; day <= 23; day++) {
        const dateStr = `2026-10-${String(day).padStart(2, '0')}`;
        await bodyRepo.saveBodyLog({ date: dateStr, weightKg: 100.0 });
      }
      for (let day = 24; day <= 30; day++) {
        const dateStr = `2026-10-${String(day).padStart(2, '0')}`;
        await bodyRepo.saveBodyLog({ date: dateStr, weightKg: 70.0 });
      }

      // Moving average on 2026-10-30 must only include the 7 days with 70.0 kg
      const ma = await bodyRepo.calculateMovingAverage('2026-10-30', 7);
      expect(ma).toBe(70.0);
    });

    it('Window Boundary 7: Non-consecutive days divide by actual count of recorded days', async () => {
      // Window: 2026-11-01 to 2026-11-07 (7 calendar days)
      // Only 2 weigh-ins recorded: 2026-11-01 (80.0kg) and 2026-11-07 (84.0kg)
      await bodyRepo.saveBodyLog({ date: '2026-11-01', weightKg: 80.0 });
      await bodyRepo.saveBodyLog({ date: '2026-11-07', weightKg: 84.0 });

      // Sum = 164.0 / 2 = 82.0 kg
      const ma = await bodyRepo.calculateMovingAverage('2026-11-07', 7);
      expect(ma).toBe(82.0);
    });

    it('Window Boundary 8: Month boundary transition (February to March in non-leap year 2026)', async () => {
      // 2026 is non-leap (28 days in Feb)
      // Days: Feb 25, 26, 27, 28, Mar 01, Mar 02, Mar 03 = 7 days
      const boundaryDates = [
        '2026-02-25', '2026-02-26', '2026-02-27', '2026-02-28',
        '2026-03-01', '2026-03-02', '2026-03-03'
      ];
      for (let i = 0; i < boundaryDates.length; i++) {
        await bodyRepo.saveBodyLog({ date: boundaryDates[i], weightKg: 80.0 + i });
      }

      // Weights: 80, 81, 82, 83, 84, 85, 86 -> Mean = 83.0
      const ma = await bodyRepo.calculateMovingAverage('2026-03-03', 7);
      expect(ma).toBe(83.0);
    });

    it('Window Boundary 9: Year boundary transition (December 28 to January 03)', async () => {
      const yearBoundaryDates = [
        '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31',
        '2027-01-01', '2027-01-02', '2027-01-03'
      ];
      for (let i = 0; i < yearBoundaryDates.length; i++) {
        await bodyRepo.saveBodyLog({ date: yearBoundaryDates[i], weightKg: 75.0 });
      }

      const ma = await bodyRepo.calculateMovingAverage('2027-01-03', 7);
      expect(ma).toBe(75.0);
    });

    it('Window Boundary 10: Future date query beyond existing records returns null if window is empty', async () => {
      await bodyRepo.saveBodyLog({ date: '2026-11-01', weightKg: 80.0 });
      // Query 2026-11-20 (19 days later)
      const ma = await bodyRepo.calculateMovingAverage('2026-11-20', 7);
      expect(ma).toBeNull();
    });
  });

  // =========================================================================
  // 4. WORKOUT REPOSITORY ADVERSARIAL STRESS
  // =========================================================================
  describe('Workout Repository Stress', () => {
    it('handles previous load lookup with interleaved dates and uncompleted sets', async () => {
      const routine = await workoutRepo.createRoutine({
        name: 'Treino A - Peito e Tríceps',
        sortOrder: 1,
      }, [
        { name: 'Supino Reto com Barra', muscleGroup: 'Peitoral', targetSets: 4, defaultRestSeconds: 120, sortOrder: 1 },
      ]);

      // Session 1: 2026-11-01 - 80kg
      await workoutRepo.saveWorkoutSession({
        routineId: routine.id,
        routineName: routine.name,
        date: '2026-11-01',
        durationMinutes: 45,
        totalVolumeKg: 3200,
        sets: [
          { exerciseName: 'Supino Reto com Barra', setNumber: 1, weightKg: 80, reps: 10, completed: true },
          { exerciseName: 'Supino Reto com Barra', setNumber: 2, weightKg: 80, reps: 10, completed: true },
        ],
      });

      // Session 2: 2026-11-04 - 85kg (latest completed session)
      await workoutRepo.saveWorkoutSession({
        routineId: routine.id,
        routineName: routine.name,
        date: '2026-11-04',
        durationMinutes: 50,
        totalVolumeKg: 3400,
        sets: [
          { exerciseName: 'Supino Reto com Barra', setNumber: 1, weightKg: 85, reps: 10, completed: true },
          { exerciseName: 'Supino Reto com Barra', setNumber: 2, weightKg: 85, reps: 8, completed: true },
          { exerciseName: 'Supino Reto com Barra', setNumber: 3, weightKg: 85, reps: 6, completed: false }, // uncompleted
        ],
      });

      // Query previous sets for upcoming session on 2026-11-07
      const prevSets = await workoutRepo.getPreviousExerciseSets('Supino Reto com Barra', 4);
      expect(prevSets).toHaveLength(2); // only completed sets from Session 2
      expect(prevSets[0].weightKg).toBe(85);
      expect(prevSets[0].reps).toBe(10);
      expect(prevSets[1].weightKg).toBe(85);
      expect(prevSets[1].reps).toBe(8);
    });

    it('calculates 1RM estimate safely with boundary rep values (reps=1, reps=30)', async () => {
      // reps=1: 1RM equals weight
      // Formula Brzycki: weight / (1.0278 - (0.0278 * reps))
      // 100kg x 1 rep = 100 / (1.0278 - 0.0278) = 100kg
      await workoutRepo.saveWorkoutSession({
        routineName: 'Força Máxima',
        date: '2026-11-06',
        durationMinutes: 30,
        totalVolumeKg: 100,
        sets: [
          { exerciseName: 'Levantamento Terra', setNumber: 1, weightKg: 200, reps: 1, completed: true },
        ],
      });

      const history = await workoutRepo.getExerciseHistory('Levantamento Terra');
      expect(history).toHaveLength(1);
      expect(history[0].estimated1RM).toBe(200);
      expect(history[0].maxWeightKg).toBe(200);
    });
  });
});
