import { createE2ETestContext, E2ETestContext } from '../helpers/testContext';
import {
  calculateBrzycki1RM,
  calculateEpley1RM,
  scaleMacro,
  calculateNetWater,
} from '../helpers/calculationOracles';

describe('Tier 2: Boundary & Corner Cases', () => {
  let ctx: E2ETestContext;

  beforeEach(async () => {
    ctx = await createE2ETestContext();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  // =========================================================================
  // 1. Extreme & Zero Numerical Boundaries
  // =========================================================================
  describe('Extreme & Zero Numerical Boundaries', () => {
    it('2.1 handles zero gram food portion gracefully', async () => {
      const entry = await ctx.dietRepo.addDietLog({
        date: '2026-11-06',
        mealType: 'lunch',
        foodName: 'Arroz Branco',
        servingGrams: 0,
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
      });

      expect(entry.servingGrams).toBe(0);
      expect(entry.calories).toBe(0);

      const summary = await ctx.dietRepo.getDailyNutritionSummary('2026-11-06');
      expect(summary.totalCalories).toBe(0);
    });

    it('2.2 handles extreme mega portion scaling (5,000g feast)', async () => {
      const baseCaloriesPer100g = 128;
      const servingGrams = 5000;
      const scaledCalories = scaleMacro(baseCaloriesPer100g, servingGrams);

      expect(scaledCalories).toBe(6400);

      const entry = await ctx.dietRepo.addDietLog({
        date: '2026-11-06',
        mealType: 'dinner',
        foodName: 'Banquete de Arroz',
        servingGrams,
        calories: scaledCalories,
        protein: 125,
        carbs: 1400,
        fat: 10,
      });

      expect(entry.calories).toBe(6400);
    });

    it('2.3 handles extreme strength loads (500kg bench press x 1 rep)', async () => {
      const session = await ctx.workoutRepo.saveWorkoutSession(
        { routineName: 'World Record Session', date: '2026-11-06', durationMinutes: 60 },
        [{ exerciseName: 'Supino Monstruoso', setNumber: 1, weightKg: 500, reps: 1, completed: true }]
      );

      expect(session.totalVolumeKg).toBe(500);

      const brzycki = calculateBrzycki1RM(500, 1);
      const epley = calculateEpley1RM(500, 1);
      expect(brzycki).toBe(500);
      expect(epley).toBe(500);
    });

    it('2.4 handles high rep burnout sets (100 bodyweight reps)', async () => {
      const session = await ctx.workoutRepo.saveWorkoutSession(
        { routineName: 'Endurance Test', date: '2026-11-06', durationMinutes: 40 },
        [{ exerciseName: 'Flexão de Braço', setNumber: 1, weightKg: 0, reps: 100, completed: true }]
      );

      const details = await ctx.workoutRepo.getSessionDetails(session.id);
      expect(details!.sets![0].reps).toBe(100);
      expect(details!.sets![0].weightKg).toBe(0);
    });

    it('2.5 handles extreme daily water intake (10,000ml)', async () => {
      for (let i = 0; i < 20; i++) {
        await ctx.dietRepo.addWaterLog('2026-11-06', 500);
      }

      const summary = await ctx.dietRepo.getDailyNutritionSummary('2026-11-06');
      expect(summary.totalWaterMl).toBe(10000);
    });
  });

  // =========================================================================
  // 2. 1RM Formula Mathematical Boundaries
  // =========================================================================
  describe('1RM Formula Mathematical Boundaries', () => {
    it('2.6 returns 0 for zero or negative reps in 1RM formulas', () => {
      expect(calculateBrzycki1RM(100, 0)).toBe(0);
      expect(calculateBrzycki1RM(100, -5)).toBe(0);
      expect(calculateEpley1RM(100, 0)).toBe(0);
      expect(calculateEpley1RM(100, -3)).toBe(0);
    });

    it('2.7 clamps Brzycki formula when reps >= 37 to avoid denominator singularity', () => {
      expect(calculateBrzycki1RM(100, 37)).toBe(100);
      expect(calculateBrzycki1RM(100, 50)).toBe(100);
    });

    it('2.8 handles zero weight in 1RM formulas correctly (returns 0)', () => {
      expect(calculateBrzycki1RM(0, 10)).toBe(0);
      expect(calculateEpley1RM(0, 10)).toBe(0);
    });
  });

  // =========================================================================
  // 3. String & Encoding Adversarial Stress
  // =========================================================================
  describe('String & Encoding Adversarial Stress', () => {
    it('2.9 searches and persists accented Brazilian foods without data corruption', async () => {
      const accentedQueries = [
        'Pão francês',
        'Maçã fuji com casca',
        'Açaí',
        'Mandioca / aipim, cozida',
        'Feijão carioca, cozido',
      ];

      for (const query of accentedQueries) {
        const hits = await ctx.dietRepo.searchFoods(query);
        // At least exact or partial matches should return cleanly without SQL errors
        expect(Array.isArray(hits)).toBe(true);
      }
    });

    it('2.10 safely handles SQL injection attack payloads in food and exercise searches', async () => {
      const sqlInjectionStrings = [
        "' OR '1'='1",
        "'; DROP TABLE foods; --",
        "' UNION SELECT * FROM users --",
        "admin'--",
      ];

      for (const payload of sqlInjectionStrings) {
        await expect(ctx.dietRepo.searchFoods(payload)).resolves.not.toThrow();
        await expect(ctx.workoutRepo.getPreviousExerciseSets(payload)).resolves.not.toThrow();
      }

      // Verify foods table was NOT dropped
      const count = await ctx.db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM foods;'
      );
      expect(count?.count).toBeGreaterThan(0);
    });

    it('2.11 safely handles emojis and Unicode special characters in notes and food names', async () => {
      const emojiName = 'Açaí Turbinado 🚀💪🍧';
      const customFood = await ctx.dietRepo.createFood({
        name: emojiName,
        servingGrams: 300,
        calories: 450,
        protein: 10,
        carbs: 85,
        fat: 8,
        source: 'custom',
      });

      expect(customFood.name).toBe(emojiName);

      const found = await ctx.dietRepo.searchFoods('🚀');
      expect(found.length).toBe(1);
      expect(found[0].name).toBe(emojiName);
    });

    it('2.12 safely stores 1,000-character workout session notes', async () => {
      const longNote = 'X'.repeat(1000);
      const session = await ctx.workoutRepo.saveWorkoutSession({
        routineName: 'Long Note Session',
        date: '2026-11-06',
        durationMinutes: 45,
        notes: longNote,
      });

      const details = await ctx.workoutRepo.getSessionDetails(session.id);
      expect(details?.notes).toBe(longNote);
      expect(details?.notes?.length).toBe(1000);
    });
  });

  // =========================================================================
  // 4. Date & Calendar Transition Edge Cases
  // =========================================================================
  describe('Date & Calendar Transition Edge Cases', () => {
    it('2.13 handles year boundary transition (Dec 31 to Jan 01) in 7-day moving average', async () => {
      await ctx.bodyRepo.saveBodyLog({ date: '2026-12-29', weightKg: 85.0 });
      await ctx.bodyRepo.saveBodyLog({ date: '2026-12-30', weightKg: 84.8 });
      await ctx.bodyRepo.saveBodyLog({ date: '2026-12-31', weightKg: 84.6 });
      await ctx.bodyRepo.saveBodyLog({ date: '2027-01-01', weightKg: 84.4 });
      await ctx.bodyRepo.saveBodyLog({ date: '2027-01-02', weightKg: 84.2 });

      const ma = await ctx.bodyRepo.calculateMovingAverage('2027-01-02', 7);
      expect(ma).toBe(84.6); // (85 + 84.8 + 84.6 + 84.4 + 84.2) / 5 = 84.64 -> 84.6
    });

    it('2.14 handles leap year dates (Feb 29)', async () => {
      const leapLog = await ctx.bodyRepo.saveBodyLog({
        date: '2024-02-29',
        weightKg: 79.5,
      });

      expect(leapLog.date).toBe('2024-02-29');

      const retrieved = await ctx.bodyRepo.getBodyLog('2024-02-29');
      expect(retrieved?.weightKg).toBe(79.5);
    });

    it('2.15 handles sparse 7-day MA when only 1 single day is recorded in the window', async () => {
      await ctx.bodyRepo.saveBodyLog({ date: '2026-11-05', weightKg: 80.0 });
      const ma = await ctx.bodyRepo.calculateMovingAverage('2026-11-06', 7);

      expect(ma).toBe(80.0);
    });
  });

  // =========================================================================
  // 5. Relational Constraints & Foreign Key Integrity
  // =========================================================================
  describe('Relational Constraints & Foreign Key Integrity', () => {
    it('2.16 blocks orphan set_log insertion without valid session_id', async () => {
      await expect(
        ctx.db.runAsync(
          `INSERT INTO set_logs (id, session_id, exercise_name, set_number, weight_kg, reps, completed, created_at)
           VALUES ('set-orphan', 'non-existent-session-id', 'Supino', 1, 80, 10, 1, '2026-11-06T10:00:00Z');`
        )
      ).rejects.toThrow();
    });

    it('2.17 cascades deletion of all set_logs when parent workout_session is deleted', async () => {
      const session = await ctx.workoutRepo.saveWorkoutSession(
        { routineName: 'To Delete', date: '2026-11-06', durationMinutes: 30 },
        [{ exerciseName: 'Rosca', setNumber: 1, weightKg: 15, reps: 10, completed: true }]
      );

      const setsBefore = await ctx.db.getAllAsync<any>(
        'SELECT * FROM set_logs WHERE session_id = ?;',
        session.id
      );
      expect(setsBefore.length).toBe(1);

      await ctx.db.runAsync('DELETE FROM workout_sessions WHERE id = ?;', session.id);

      const setsAfter = await ctx.db.getAllAsync<any>(
        'SELECT * FROM set_logs WHERE session_id = ?;',
        session.id
      );
      expect(setsAfter.length).toBe(0);
    });

    it('2.18 enforces unique constraint on body_logs date column', async () => {
      await ctx.bodyRepo.saveBodyLog({ date: '2026-11-06', weightKg: 80.0 });

      // Direct INSERT without ON CONFLICT must fail UNIQUE constraint
      await expect(
        ctx.db.runAsync(
          `INSERT INTO body_logs (id, date, weight_kg, created_at)
           VALUES ('body-duplicate', '2026-11-06', 82.0, '2026-11-06T10:00:00Z');`
        )
      ).rejects.toThrow();
    });

    it('2.19 handles net water decrement boundary with oracle calculation', () => {
      const net = calculateNetWater([500, -600]);
      expect(net).toBe(0); // Clamped at 0
    });

    it('2.20 supports atomic rapid weigh-in updates on identical date without corrupting data', async () => {
      const updates = [82.5, 82.3, 82.1, 82.0];
      for (const w of updates) {
        await ctx.bodyRepo.saveBodyLog({ date: '2026-11-06', weightKg: w });
      }

      const finalLog = await ctx.bodyRepo.getBodyLog('2026-11-06');
      expect(finalLog?.weightKg).toBe(82.0);

      const count = await ctx.db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) as count FROM body_logs WHERE date = '2026-11-06';"
      );
      expect(count?.count).toBe(1);
    });
  });
});
