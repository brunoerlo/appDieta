import fs from 'fs';
import path from 'path';
import os from 'os';
import Database from 'better-sqlite3';
import { InMemorySQLiteDatabase, createTestDatabase } from '../helpers/inMemoryDb';
import { SqliteDietRepository } from '@/database/repositories/SqliteDietRepository';
import { SqliteWorkoutRepository } from '@/database/repositories/SqliteWorkoutRepository';
import { ISqliteDatabase } from '@/database/repositories/interfaces';
import { configurePragmas, runMigrations } from '@/database/connection';
import { SCHEMA_DDL } from '@/database/schema';

describe('Relational Integrity, Atomic Transactions & WAL Concurrency Tests', () => {
  let db: InMemorySQLiteDatabase;
  let workoutRepo: SqliteWorkoutRepository;
  let dietRepo: SqliteDietRepository;

  beforeEach(async () => {
    db = await createTestDatabase();
    workoutRepo = new SqliteWorkoutRepository(db);
    dietRepo = new SqliteDietRepository(db);
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  // =========================================================================
  // 1. FOREIGN KEY CASCADING & REFERENTIAL INTEGRITY
  // =========================================================================
  describe('1. Foreign Key Cascades & Constraints', () => {
    it('cascades deletion of workout_routine to routine_exercises (ON DELETE CASCADE)', async () => {
      // Create routine with 3 exercises
      const routine = await workoutRepo.createRoutine(
        {
          name: 'Rotina Teste Cascade',
          description: 'Teste de deleção em cascata',
          sortOrder: 1,
        },
        [
          { name: 'Exercicio 1', muscleGroup: 'Peito', targetSets: 3, defaultRestSeconds: 60, sortOrder: 1 },
          { name: 'Exercicio 2', muscleGroup: 'Tríceps', targetSets: 3, defaultRestSeconds: 60, sortOrder: 2 },
          { name: 'Exercicio 3', muscleGroup: 'Ombros', targetSets: 3, defaultRestSeconds: 60, sortOrder: 3 },
        ]
      );

      // Verify routine and exercises exist in database
      const routineRow = await db.getFirstAsync<{ id: string }>('SELECT id FROM workout_routines WHERE id = ?;', routine.id);
      expect(routineRow).not.toBeNull();

      const exerciseCountBefore = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM routine_exercises WHERE routine_id = ?;',
        routine.id
      );
      expect(exerciseCountBefore?.count).toBe(3);

      // Verify other seeded routines exist
      const totalRoutinesBefore = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM workout_routines;');
      const totalExercisesBefore = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM routine_exercises;');

      // Delete the routine via repository
      await workoutRepo.deleteRoutine(routine.id);

      // Verify routine is deleted
      const routineRowAfter = await db.getFirstAsync<{ id: string }>('SELECT id FROM workout_routines WHERE id = ?;', routine.id);
      expect(routineRowAfter).toBeNull();

      // EMPIRICAL VERIFICATION: routine_exercises rows must be 0 for this routine
      const exerciseCountAfter = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM routine_exercises WHERE routine_id = ?;',
        routine.id
      );
      expect(exerciseCountAfter?.count).toBe(0);

      // Verify other routines and exercises were unaffected
      const totalRoutinesAfter = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM workout_routines;');
      const totalExercisesAfter = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM routine_exercises;');
      expect(totalRoutinesAfter?.count).toBe(totalRoutinesBefore!.count - 1);
      expect(totalExercisesAfter?.count).toBe(totalExercisesBefore!.count - 3);
    });

    it('cascades deletion of workout_sessions to set_logs (ON DELETE CASCADE)', async () => {
      // Save a workout session with 4 sets
      const session = await workoutRepo.saveWorkoutSession({
        routineName: 'Treino Teste Sets Cascade',
        date: '2026-11-06',
        durationMinutes: 45,
        sets: [
          { exerciseName: 'Agachamento', setNumber: 1, weightKg: 100, reps: 8, completed: true },
          { exerciseName: 'Agachamento', setNumber: 2, weightKg: 105, reps: 8, completed: true },
          { exerciseName: 'Leg Press', setNumber: 1, weightKg: 200, reps: 10, completed: true },
          { exerciseName: 'Leg Press', setNumber: 2, weightKg: 220, reps: 10, completed: true },
        ],
      });

      // Verify session exists
      const sessionRow = await db.getFirstAsync<{ id: string }>('SELECT id FROM workout_sessions WHERE id = ?;', session.id);
      expect(sessionRow).not.toBeNull();

      // Verify 4 sets exist in set_logs
      const setCountBefore = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM set_logs WHERE session_id = ?;',
        session.id
      );
      expect(setCountBefore?.count).toBe(4);

      // Create a second independent session to guarantee isolation
      const otherSession = await workoutRepo.saveWorkoutSession({
        routineName: 'Outro Treino',
        date: '2026-11-06',
        durationMinutes: 30,
        sets: [{ exerciseName: 'Rosca Direta', setNumber: 1, weightKg: 20, reps: 12, completed: true }],
      });

      // Delete the first workout session
      await db.runAsync('DELETE FROM workout_sessions WHERE id = ?;', session.id);

      // Verify session is deleted
      const sessionRowAfter = await db.getFirstAsync<{ id: string }>('SELECT id FROM workout_sessions WHERE id = ?;', session.id);
      expect(sessionRowAfter).toBeNull();

      // EMPIRICAL VERIFICATION: set_logs rows for this session must be 0
      const setCountAfter = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM set_logs WHERE session_id = ?;',
        session.id
      );
      expect(setCountAfter?.count).toBe(0);

      // Verify other session's set_logs were NOT deleted
      const otherSetCount = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM set_logs WHERE session_id = ?;',
        otherSession.id
      );
      expect(otherSetCount?.count).toBe(1);
    });

    it('sets workout_sessions.routine_id to NULL when routine is deleted (ON DELETE SET NULL)', async () => {
      // Create routine
      const routine = await workoutRepo.createRoutine({
        name: 'Rotina Vinculada',
        sortOrder: 2,
      });

      // Save session linked to this routine
      const session = await workoutRepo.saveWorkoutSession({
        routineId: routine.id,
        routineName: routine.name,
        date: '2026-11-06',
        durationMinutes: 50,
        sets: [{ exerciseName: 'Supino Inclinado', setNumber: 1, weightKg: 70, reps: 10, completed: true }],
      });

      // Verify routine_id is set
      const sessionRowBefore = await db.getFirstAsync<{ routine_id: string; routine_name: string }>(
        'SELECT routine_id, routine_name FROM workout_sessions WHERE id = ?;',
        session.id
      );
      expect(sessionRowBefore?.routine_id).toBe(routine.id);
      expect(sessionRowBefore?.routine_name).toBe('Rotina Vinculada');

      // Delete routine
      await workoutRepo.deleteRoutine(routine.id);

      // EMPIRICAL VERIFICATION: session is preserved, routine_id is set to NULL, routine_name is preserved
      const sessionRowAfter = await db.getFirstAsync<{ routine_id: string | null; routine_name: string }>(
        'SELECT routine_id, routine_name FROM workout_sessions WHERE id = ?;',
        session.id
      );
      expect(sessionRowAfter).not.toBeNull();
      expect(sessionRowAfter?.routine_id).toBeNull();
      expect(sessionRowAfter?.routine_name).toBe('Rotina Vinculada');

      // Verify sets of that session are still intact
      const setsCount = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM set_logs WHERE session_id = ?;',
        session.id
      );
      expect(setsCount?.count).toBe(1);
    });

    it('rejects insertion of child rows with non-existent foreign keys', async () => {
      // Attempt to insert routine_exercise with invalid routine_id
      await expect(
        db.runAsync(
          `INSERT INTO routine_exercises (id, routine_id, name, muscle_group, target_sets, default_rest_seconds, sort_order, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
          'invalid-ex-id',
          'non-existent-routine-id',
          'Exercicio Fantasma',
          'Peito',
          3,
          60,
          1,
          new Date().toISOString()
        )
      ).rejects.toThrow(/FOREIGN KEY constraint failed/);

      // Attempt to insert set_log with invalid session_id
      await expect(
        db.runAsync(
          `INSERT INTO set_logs (id, session_id, exercise_name, set_number, weight_kg, reps, completed, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
          'invalid-set-id',
          'non-existent-session-id',
          'Supino Fantasma',
          1,
          50,
          10,
          1,
          new Date().toISOString()
        )
      ).rejects.toThrow(/FOREIGN KEY constraint failed/);
    });
  });

  // =========================================================================
  // 2. FOOD DELETION AND DIET_LOGS PRESERVATION
  // =========================================================================
  describe('2. Food Deletion & Historical Diet Logs Preservation', () => {
    it('preserves existing diet_logs and nutrition summaries when a food item is deleted from foods table', async () => {
      // 1. Create a custom food item
      const customFood = await dietRepo.createFood({
        name: 'Pastel de Frango com Catupiry',
        category: 'Salgados',
        servingGrams: 150,
        calories: 380,
        protein: 18,
        carbs: 42,
        fat: 16,
        fiber: 2,
        source: 'custom',
        servingUnitName: 'unidade',
        servingUnitGrams: 150,
      });

      expect(customFood.id).toBeDefined();

      // 2. Log this food in breakfast
      const date = '2026-11-06';
      const logEntry = await dietRepo.addDietLog({
        date,
        mealType: 'breakfast',
        foodId: customFood.id,
        foodName: customFood.name,
        servingGrams: 150,
        calories: 380,
        protein: 18,
        carbs: 42,
        fat: 16,
      });

      expect(logEntry.id).toBeDefined();

      // Verify daily nutrition summary before deletion
      const summaryBefore = await dietRepo.getDailyNutritionSummary(date);
      expect(summaryBefore.totalCalories).toBe(380);
      expect(summaryBefore.totalProtein).toBe(18);
      expect(summaryBefore.totalCarbs).toBe(42);
      expect(summaryBefore.totalFat).toBe(16);
      expect(summaryBefore.meals.breakfast).toHaveLength(1);

      // 3. Delete the food from foods catalog
      const deleteResult = await db.runAsync('DELETE FROM foods WHERE id = ?;', customFood.id);
      expect(deleteResult.changes).toBe(1);

      // Verify food is gone from catalog
      const foodInDb = await db.getFirstAsync('SELECT id FROM foods WHERE id = ?;', customFood.id);
      expect(foodInDb).toBeNull();

      // 4. EMPIRICAL VERIFICATION: diet_logs record is STILL INTACT
      const logsAfter = await dietRepo.getDailyLogs(date);
      expect(logsAfter).toHaveLength(1);
      expect(logsAfter[0].id).toBe(logEntry.id);
      expect(logsAfter[0].foodName).toBe('Pastel de Frango com Catupiry');
      expect(logsAfter[0].foodId).toBe(customFood.id);
      expect(logsAfter[0].calories).toBe(380);
      expect(logsAfter[0].protein).toBe(18);
      expect(logsAfter[0].carbs).toBe(42);
      expect(logsAfter[0].fat).toBe(16);

      // 5. EMPIRICAL VERIFICATION: daily summary still sums historical nutrition accurately
      const summaryAfter = await dietRepo.getDailyNutritionSummary(date);
      expect(summaryAfter.totalCalories).toBe(380);
      expect(summaryAfter.totalProtein).toBe(18);
      expect(summaryAfter.totalCarbs).toBe(42);
      expect(summaryAfter.totalFat).toBe(16);
      expect(summaryAfter.meals.breakfast).toHaveLength(1);
      expect(summaryAfter.meals.breakfast[0].foodName).toBe('Pastel de Frango com Catupiry');
    });
  });

  // =========================================================================
  // 3. ATOMIC TRANSACTION ROLLBACK
  // =========================================================================
  describe('3. Atomic Rollback on Failed Transactions', () => {
    it('rolls back all records in a bulk insert transaction when a mid-batch error occurs', async () => {
      const initialCount = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM diet_logs;');
      expect(initialCount?.count).toBe(0);

      // Attempt transaction inserting 10 valid records and then failing on the 11th record
      await expect(
        db.withTransactionAsync(async () => {
          for (let i = 1; i <= 10; i++) {
            await db.runAsync(
              `INSERT INTO diet_logs (id, date, meal_type, food_name, serving_grams, calories, protein, carbs, fat, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
              `log-batch-${i}`,
              '2026-11-06',
              'lunch',
              `Item ${i}`,
              100,
              100,
              10,
              10,
              2,
              new Date().toISOString()
            );
          }

          // 11th operation deliberately triggers an error (violating CHECK constraint on meal_type)
          await db.runAsync(
            `INSERT INTO diet_logs (id, date, meal_type, food_name, serving_grams, calories, protein, carbs, fat, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            `log-batch-11`,
            '2026-11-06',
            'INVALID_MEAL_TYPE', // CHECK(meal_type IN ('breakfast', 'lunch', 'snack', 'dinner', 'supper'))
            'Item 11',
            100,
            100,
            10,
            10,
            2,
            new Date().toISOString()
          );
        })
      ).rejects.toThrow();

      // EMPIRICAL VERIFICATION: Zero of the 10 prior items exist in the database
      const finalCount = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM diet_logs;');
      expect(finalCount?.count).toBe(0);

      const itemsInDb = await db.getAllAsync('SELECT id FROM diet_logs WHERE id LIKE ?;', 'log-batch-%');
      expect(itemsInDb).toEqual([]);
    });

    it('rolls back parent workout_session when set insertion fails midway in saveWorkoutSession', async () => {
      const sessionCountBefore = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM workout_sessions;');
      const setCountBefore = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM set_logs;');

      // Attempt saveWorkoutSession with invalid set data that violates NOT NULL constraint
      await expect(
        workoutRepo.saveWorkoutSession({
          routineName: 'Treino Que Falha',
          date: '2026-11-06',
          durationMinutes: 30,
          sets: [
            { exerciseName: 'Supino', setNumber: 1, weightKg: 80, reps: 10, completed: true },
            {
              exerciseName: 'Supino',
              setNumber: 2,
              weightKg: (null as unknown) as number, // triggers NOT NULL constraint violation
              reps: 10,
              completed: true,
            },
          ],
        })
      ).rejects.toThrow();

      // EMPIRICAL VERIFICATION: No orphaned session row or set_logs rows exist
      const sessionCountAfter = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM workout_sessions;');
      const setCountAfter = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM set_logs;');

      expect(sessionCountAfter?.count).toBe(sessionCountBefore?.count);
      expect(setCountAfter?.count).toBe(setCountBefore?.count);
    });

    it('rolls back parent workout_routine when exercise insertion fails in createRoutine', async () => {
      const routineCountBefore = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM workout_routines;');
      const exCountBefore = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM routine_exercises;');

      // Attempt createRoutine with exercise that violates NOT NULL constraint on muscle_group
      await expect(
        workoutRepo.createRoutine(
          { name: 'Rotina Falha Atomica', sortOrder: 99 },
          [
            { name: 'Exercicio 1', muscleGroup: 'Costas', targetSets: 3, defaultRestSeconds: 60, sortOrder: 1 },
            {
              name: (null as unknown) as string, // triggers NOT NULL constraint on name
              muscleGroup: 'Costas',
              targetSets: 3,
              defaultRestSeconds: 60,
              sortOrder: 2,
            },
          ]
        )
      ).rejects.toThrow();

      // EMPIRICAL VERIFICATION: No orphaned routine or exercise exists
      const routineCountAfter = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM workout_routines;');
      const exCountAfter = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM routine_exercises;');

      expect(routineCountAfter?.count).toBe(routineCountBefore?.count);
      expect(exCountAfter?.count).toBe(exCountBefore?.count);
    });

    it('rolls back schema and version on failed migration transaction', async () => {
      // Test simulated migration failure
      const initialVersion = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
      expect(initialVersion?.user_version).toBe(1);

      // Attempt a transactional migration that fails halfway
      await expect(
        db.withTransactionAsync(async () => {
          await db.execAsync('CREATE TABLE temp_migration_test (id TEXT PRIMARY KEY, value TEXT);');
          await db.runAsync('INSERT INTO temp_migration_test (id, value) VALUES (?, ?);', '1', 'ok');
          // Deliberate error before bumping user_version
          throw new Error('Migration step failed mid-execution');
        })
      ).rejects.toThrow('Migration step failed mid-execution');

      // EMPIRICAL VERIFICATION: Table temp_migration_test was rolled back and does not exist
      const tableCheck = await db.getFirstAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='temp_migration_test';"
      );
      expect(tableCheck).toBeNull();

      // Version remains 1
      const finalVersion = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
      expect(finalVersion?.user_version).toBe(1);
    });
  });

  // =========================================================================
  // 4. RACE CONDITIONS & CONCURRENCY UNDER WAL MODE
  // =========================================================================
  describe('4. Concurrency & Race Conditions', () => {
    it('handles high-concurrency parallel writes on a single connection without race conditions', async () => {
      const date = '2026-11-06';
      const numOperations = 50;
      const amountPerOp = 250;

      // Launch 50 concurrent water log additions
      const promises = Array.from({ length: numOperations }, () =>
        dietRepo.addWaterLog(date, amountPerOp)
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(numOperations);

      // EMPIRICAL VERIFICATION: Exact sum matches 50 * 250 = 12,500 ml
      const totalWater = await dietRepo.getDailyWaterTotal(date);
      expect(totalWater).toBe(numOperations * amountPerOp);

      const waterLogs = await dietRepo.getWaterLogs(date);
      expect(waterLogs).toHaveLength(numOperations);
    });

    it('handles simultaneous concurrent reads and writes without deadlocks or corruption', async () => {
      const date = '2026-11-06';

      // 20 concurrent writes and 20 concurrent reads fired in parallel
      const writes = Array.from({ length: 20 }, (_, i) =>
        dietRepo.addDietLog({
          date,
          mealType: 'snack',
          foodName: `Snack ${i}`,
          servingGrams: 50,
          calories: 100,
          protein: 5,
          carbs: 10,
          fat: 2,
        })
      );

      const reads = Array.from({ length: 20 }, () =>
        dietRepo.getDailyNutritionSummary(date)
      );

      // Await all mixed operations
      const allResults = await Promise.all([...writes, ...reads]);
      expect(allResults).toHaveLength(40);

      // Verify all 20 writes completed cleanly
      const finalLogs = await dietRepo.getDailyLogs(date);
      expect(finalLogs).toHaveLength(20);

      const finalSummary = await dietRepo.getDailyNutritionSummary(date);
      expect(finalSummary.totalCalories).toBe(20 * 100);
      expect(finalSummary.totalProtein).toBe(20 * 5);
      expect(finalSummary.meals.snack).toHaveLength(20);
    });

    it('verifies WAL mode concurrency with multiple connections on disk (non-blocking readers during writes)', async () => {
      const tmpDir = os.tmpdir();
      const dbPath = path.join(tmpDir, `irontrack-wal-test-${Date.now()}-${Math.random().toString(36).substring(2, 6)}.db`);

      try {
        // Connection 1: Open and configure WAL mode + busy timeout
        const rawDb1 = new Database(dbPath);
        rawDb1.pragma('journal_mode = WAL');
        rawDb1.pragma('foreign_keys = ON');
        rawDb1.pragma('busy_timeout = 5000');

        // Confirm WAL mode is active
        const journalMode = rawDb1.pragma('journal_mode', { simple: true });
        expect(journalMode).toBe('wal');

        // Execute schema on Connection 1
        rawDb1.exec(SCHEMA_DDL);

        // Connection 2: Open independent connection to same file
        const rawDb2 = new Database(dbPath);
        rawDb2.pragma('journal_mode = WAL');
        rawDb2.pragma('foreign_keys = ON');
        rawDb2.pragma('busy_timeout = 5000');

        // 1. Connection 1 begins an explicit IMMEDIATE transaction and inserts records
        rawDb1.exec('BEGIN IMMEDIATE;');
        rawDb1.prepare(
          `INSERT INTO users (id, name, email) VALUES (?, ?, ?);`
        ).run('user_conn1', 'Usuario Conexao 1', 'u1@test.com');

        // 2. WHILE Connection 1 transaction is STILL UNCOMMITTED:
        // Connection 2 reads from users table. Under WAL mode, Connection 2 DOES NOT BLOCK!
        const rowsConn2BeforeCommit = rawDb2.prepare('SELECT id FROM users;').all();

        // Connection 2 sees snapshot before Connection 1 committed (isolation)
        expect(rowsConn2BeforeCommit).toEqual([]);

        // 3. Connection 1 commits
        rawDb1.exec('COMMIT;');

        // 4. Connection 2 immediately sees the committed row
        const rowsConn2AfterCommit = rawDb2.prepare('SELECT id FROM users;').all();
        expect(rowsConn2AfterCommit).toHaveLength(1);
        expect((rowsConn2AfterCommit[0] as { id: string }).id).toBe('user_conn1');

        // 5. Concurrent interleaved writes from both connections
        const insertStmt1 = rawDb1.prepare('INSERT INTO water_logs (id, date, amount_ml) VALUES (?, ?, ?);');
        const insertStmt2 = rawDb2.prepare('INSERT INTO water_logs (id, date, amount_ml) VALUES (?, ?, ?);');

        for (let i = 0; i < 10; i++) {
          insertStmt1.run(`w1-${i}`, '2026-11-06', 250);
          insertStmt2.run(`w2-${i}`, '2026-11-06', 500);
        }

        // Both connections verify 20 total records exist
        const total1 = rawDb1.prepare('SELECT COUNT(*) as count, SUM(amount_ml) as total FROM water_logs;').get() as { count: number; total: number };
        const total2 = rawDb2.prepare('SELECT COUNT(*) as count, SUM(amount_ml) as total FROM water_logs;').get() as { count: number; total: number };

        expect(total1.count).toBe(20);
        expect(total2.count).toBe(20);
        expect(total1.total).toBe(10 * 250 + 10 * 500); // 2500 + 5000 = 7500
        expect(total2.total).toBe(7500);

        // Close connections
        rawDb1.close();
        rawDb2.close();
      } finally {
        // Clean up temporary files (.db, .db-wal, .db-shm)
        try {
          if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
          if (fs.existsSync(`${dbPath}-wal`)) fs.unlinkSync(`${dbPath}-wal`);
          if (fs.existsSync(`${dbPath}-shm`)) fs.unlinkSync(`${dbPath}-shm`);
        } catch {
          // ignore cleanup errors
        }
      }
    });
  });
});
