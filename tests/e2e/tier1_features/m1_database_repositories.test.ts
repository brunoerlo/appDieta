import { createE2ETestContext, E2ETestContext } from '../helpers/testContext';
import { runMigrations } from '@/database/connection';
import { calculateAtwaterCalories } from '../helpers/calculationOracles';

describe('Tier 1: Feature Coverage — M1 Database, Schemas, Seeds & Repositories (Features 1-4)', () => {
  let ctx: E2ETestContext;

  beforeEach(async () => {
    ctx = await createE2ETestContext();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  // =========================================================================
  // Feature 1: SQLite Database Init & Migration (ORIGINAL_REQUEST §R1)
  // =========================================================================
  describe('Feature 1: SQLite Database Init & Migration', () => {
    it('1.1 verifies foreign keys and WAL mode pragmas are enabled', async () => {
      const fk = await ctx.db.getFirstAsync<{ foreign_keys: number }>('PRAGMA foreign_keys;');
      expect(fk?.foreign_keys).toBe(1);

      const journal = await ctx.db.getFirstAsync<{ journal_mode: string }>('PRAGMA journal_mode;');
      expect(['wal', 'memory']).toContain(journal?.journal_mode.toLowerCase());
    });

    it('1.2 verifies all 9 specified relational tables exist in SQLite schema', async () => {
      const requiredTables = [
        'users',
        'foods',
        'diet_logs',
        'water_logs',
        'workout_routines',
        'routine_exercises',
        'workout_sessions',
        'set_logs',
        'body_logs',
        'custom_exercises',
      ];

      const tables = await ctx.db.getAllAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';"
      );
      const tableNames = tables.map((t) => t.name);

      for (const table of requiredTables) {
        expect(tableNames).toContain(table);
      }
    });

    it('1.3 verifies user_version pragma reflects executed migrations', async () => {
      const ver = await ctx.db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
      expect(ver?.user_version).toBeGreaterThanOrEqual(1);
    });

    it('1.4 verifies B-tree indexes are created for query optimization', async () => {
      const indexes = await ctx.db.getAllAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%';"
      );
      const indexNames = indexes.map((i) => i.name);

      expect(indexNames).toContain('idx_foods_name');
      expect(indexNames).toContain('idx_diet_logs_date');
      expect(indexNames).toContain('idx_water_logs_date');
      expect(indexNames).toContain('idx_workout_sessions_date');
      expect(indexNames).toContain('idx_body_logs_date');
    });

    it('1.5 verifies migration runner is idempotent and safe against repeated calls', async () => {
      await expect(runMigrations(ctx.db)).resolves.not.toThrow();

      // Check table count remains exactly 10 user tables
      const tables = await ctx.db.getAllAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';"
      );
      expect(tables.length).toBe(10);
    });
  });

  // =========================================================================
  // Feature 2: TACO/IBGE Seed Data Injection (ORIGINAL_REQUEST §R1)
  // =========================================================================
  describe('Feature 2: TACO/IBGE Seed Data Injection', () => {
    it('2.1 verifies exactly 42 TACO foods are seeded initially', async () => {
      const countResult = await ctx.db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) as count FROM foods WHERE source = 'taco';"
      );
      expect(countResult?.count).toBe(42);
    });

    it('2.2 verifies presence of iconic Brazilian nutritional staples with realistic macros', async () => {
      const staples = [
        'Arroz branco, cozido',
        'Feijão carioca, cozido',
        'Peito de frango, grelhado',
        'Carne bovina, patinho moído',
        'Ovo de galinha, inteiro, cozido',
        'Banana prata, crua',
      ];

      for (const staple of staples) {
        const food = await ctx.db.getFirstAsync<any>(
          'SELECT * FROM foods WHERE name = ?;',
          staple
        );
        expect(food).toBeDefined();
        expect(food.calories).toBeGreaterThan(0);
        expect(food.protein).toBeGreaterThanOrEqual(0);
        expect(food.carbs).toBeGreaterThanOrEqual(0);
        expect(food.fat).toBeGreaterThanOrEqual(0);
      }
    });

    it('2.3 verifies TACO food calories are consistent with Atwater macro calculation', async () => {
      const chicken = await ctx.db.getFirstAsync<any>(
        "SELECT * FROM foods WHERE name LIKE '%Peito de frango%';"
      );
      expect(chicken).toBeDefined();

      const expectedKcal = calculateAtwaterCalories(chicken.protein, chicken.carbs, chicken.fat);
      // TACO standard published values are close to Atwater formula within +/- 15 kcal variance
      expect(Math.abs(chicken.calories - expectedKcal)).toBeLessThanOrEqual(15);
    });

    it('2.4 verifies standard Brazilian household serving units are populated', async () => {
      const foodsWithUnits = await ctx.db.getAllAsync<any>(
        'SELECT name, serving_unit_name, serving_unit_grams FROM foods WHERE serving_unit_name IS NOT NULL;'
      );
      expect(foodsWithUnits.length).toBeGreaterThan(20);

      const rice = foodsWithUnits.find((f) => f.name.includes('Arroz'));
      expect(rice).toBeDefined();
      expect(rice.serving_unit_name).toBeDefined();
      expect(rice.serving_unit_grams).toBeGreaterThan(0);
    });

    it('2.5 verifies seed injection is idempotent and does not create duplicate food rows', async () => {
      await runMigrations(ctx.db);
      const countResult = await ctx.db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) as count FROM foods WHERE source = 'taco';"
      );
      expect(countResult?.count).toBe(42);
    });
  });

  // =========================================================================
  // Feature 3: Standard Workout Routines Seed (ORIGINAL_REQUEST §R1)
  // =========================================================================
  describe('Feature 3: Standard Workout Routines Seed', () => {
    it('3.1 verifies exactly 6 default workout routine splits are seeded', async () => {
      const routines = await ctx.workoutRepo.getRoutines();
      expect(routines.length).toBe(6);

      const routineNames = routines.map((r) => r.name);
      expect(routineNames).toContain('Treino A - Peito, Tríceps e Ombros');
      expect(routineNames).toContain('Treino B - Costas, Bíceps e Trapézio');
      expect(routineNames).toContain('Treino C - Pernas Completo e Abdômen');
      expect(routineNames).toContain('Push (Empurrar)');
      expect(routineNames).toContain('Pull (Puxar)');
      expect(routineNames).toContain('Legs (Pernas & Core)');
    });

    it('3.2 verifies routine exercises include target sets, rest seconds, and muscle groups', async () => {
      const routines = await ctx.workoutRepo.getRoutines();
      const pushRoutine = routines.find((r) => r.name.includes('Push'));
      expect(pushRoutine).toBeDefined();

      const routineDetails = await ctx.workoutRepo.getRoutineById(pushRoutine!.id);
      expect(routineDetails?.exercises).toBeDefined();
      expect(routineDetails!.exercises!.length).toBeGreaterThan(3);

      for (const ex of routineDetails!.exercises!) {
        expect(ex.targetSets).toBeGreaterThanOrEqual(3);
        expect(ex.defaultRestSeconds).toBeGreaterThanOrEqual(60);
        expect(ex.muscleGroup).toBeDefined();
      }
    });

    it('3.3 verifies exactly 39 total exercises are seeded across all default routines', async () => {
      const totalExercises = await ctx.db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM routine_exercises;'
      );
      expect(totalExercises?.count).toBe(39);
    });

    it('3.4 verifies routine sort orders are ordered monotonically', async () => {
      const routines = await ctx.workoutRepo.getRoutines();
      for (let i = 0; i < routines.length - 1; i++) {
        expect(routines[i].sortOrder).toBeLessThanOrEqual(routines[i + 1].sortOrder);
      }
    });

    it('3.5 verifies re-running migrations does not duplicate default routines or exercises', async () => {
      await runMigrations(ctx.db);
      const routines = await ctx.workoutRepo.getRoutines();
      expect(routines.length).toBe(6);

      const totalExercises = await ctx.db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM routine_exercises;'
      );
      expect(totalExercises?.count).toBe(39);
    });
  });

  // =========================================================================
  // Feature 4: Repository Pattern Abstraction (ORIGINAL_REQUEST §R1)
  // =========================================================================
  describe('Feature 4: Repository Pattern Abstraction', () => {
    it('4.1 verifies IDietRepository decouples business operations from raw SQL', async () => {
      const results = await ctx.dietRepo.searchFoods('Frango');
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toContain('frango');
    });

    it('4.2 verifies IWorkoutRepository manages workout aggregates safely', async () => {
      const routines = await ctx.workoutRepo.getRoutines();
      expect(Array.isArray(routines)).toBe(true);
      expect(routines[0]).toHaveProperty('id');
      expect(routines[0]).toHaveProperty('name');
    });

    it('4.3 verifies IBodyRepository encapsulates body metrics history', async () => {
      const log = await ctx.bodyRepo.saveBodyLog({
        date: '2026-11-06',
        weightKg: 80.5,
        bodyFatPct: 15.0,
      });
      expect(log.date).toBe('2026-11-06');
      expect(log.weightKg).toBe(80.5);

      const fetched = await ctx.bodyRepo.getBodyLog('2026-11-06');
      expect(fetched?.weightKg).toBe(80.5);
    });

    it('4.4 verifies IAuthRepository encapsulates user profile and preference state', async () => {
      const profile = await ctx.authRepo.getProfile();
      expect(profile).toBeDefined();
      expect(profile.theme).toBe('dark');

      await ctx.authRepo.setTheme('light');
      expect(await ctx.authRepo.getTheme()).toBe('light');
    });

    it('4.5 verifies all repositories operate concurrently on shared database state', async () => {
      const [profile, routines, foods, waterLogs] = await Promise.all([
        ctx.authRepo.getProfile(),
        ctx.workoutRepo.getRoutines(),
        ctx.dietRepo.searchFoods('Ovo'),
        ctx.dietRepo.getWaterLogs('2026-11-06'),
      ]);

      expect(profile).toBeDefined();
      expect(routines.length).toBe(6);
      expect(foods.length).toBeGreaterThan(0);
      expect(waterLogs).toEqual([]);
    });
  });
});
