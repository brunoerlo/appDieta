import { InMemorySQLiteDatabase, createTestDatabase } from '../helpers/inMemoryDb';
import { SqliteWorkoutRepository } from '@/database/repositories/SqliteWorkoutRepository';
import {
  calculateBrzycki1RM,
  calculateEpley1RM,
  calculate1RM,
  calculateWorkoutVolume,
  formatElapsedSeconds,
  formatDurationMinutes,
  formatRestTimerDisplay,
  formatPreviousLoad,
  mapExerciseHistoryToChart,
} from '@/utils/workout';
import { WorkoutStateManager } from '@/context/WorkoutContext';
import { SetLog, ExerciseHistoryPoint } from '@/types/domain';

describe('Adversarial Boundary & Math Challenger (Milestone M3)', () => {
  let db: InMemorySQLiteDatabase;
  let workoutRepo: SqliteWorkoutRepository;

  beforeEach(async () => {
    db = await createTestDatabase();
    workoutRepo = new SqliteWorkoutRepository(db);
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  // =========================================================================
  // 1. 1RM FORMULA ADVERSARIAL BOUNDARIES & ASYMPTOTES
  // =========================================================================
  describe('1. 1RM Formula Boundaries (Brzycki & Epley)', () => {
    describe('Brzycki 1RM Asymptotes & Clamping', () => {
      it('returns 0 for zero or negative reps', () => {
        expect(calculateBrzycki1RM(100, 0)).toBe(0);
        expect(calculateBrzycki1RM(100, -1)).toBe(0);
        expect(calculateBrzycki1RM(100, -5)).toBe(0);
        expect(calculateBrzycki1RM(100, -999)).toBe(0);
      });

      it('returns 0 for zero or negative weight', () => {
        expect(calculateBrzycki1RM(0, 10)).toBe(0);
        expect(calculateBrzycki1RM(-0.1, 10)).toBe(0);
        expect(calculateBrzycki1RM(-50, 10)).toBe(0);
        expect(calculateBrzycki1RM(-1000, 10)).toBe(0);
      });

      it('returns 0 when both weight and reps are zero or negative', () => {
        expect(calculateBrzycki1RM(0, 0)).toBe(0);
        expect(calculateBrzycki1RM(-50, -5)).toBe(0);
      });

      it('returns exact weight for 1 rep regardless of load magnitude', () => {
        expect(calculateBrzycki1RM(100, 1)).toBe(100.0);
        expect(calculateBrzycki1RM(62.5, 1)).toBe(62.5);
        expect(calculateBrzycki1RM(1.2, 1)).toBe(1.2);
        expect(calculateBrzycki1RM(500, 1)).toBe(500.0);
        expect(calculateBrzycki1RM(1000, 1)).toBe(1000.0);
      });

      it('safely handles reps = 36 without negative results', () => {
        // Unclamped Brzycki at 36 reps: 100 * (36 / (37 - 36)) = 100 * 36 = 3600
        // Clamped to 30: 100 * (36 / 7) = 514.3
        const result = calculateBrzycki1RM(100, 36);
        expect(result).toBe(514.3);
        expect(Number.isFinite(result)).toBe(true);
        expect(result).toBeGreaterThan(0);
      });

      it('probes the reps = 37 division-by-zero asymptote', () => {
        // Standard unclamped Brzycki: denominator = (37 - 37) = 0 -> Infinity!
        // Clamping to 30 reps ensures stable numeric evaluation
        const result = calculateBrzycki1RM(100, 37);
        expect(result).toBe(514.3);
        expect(Number.isFinite(result)).toBe(true);
        expect(Number.isNaN(result)).toBe(false);
      });

      it('probes high rep extremes (reps = 38, 50, 100, 1000)', () => {
        // Unclamped Brzycki with reps > 37 would produce NEGATIVE 1RM numbers!
        // (37 - 38 = -1, 37 - 50 = -13, etc.)
        const r38 = calculateBrzycki1RM(100, 38);
        const r50 = calculateBrzycki1RM(100, 50);
        const r100 = calculateBrzycki1RM(100, 100);
        const r1000 = calculateBrzycki1RM(100, 1000);

        expect(r38).toBe(514.3);
        expect(r50).toBe(514.3);
        expect(r100).toBe(514.3);
        expect(r1000).toBe(514.3);
        // None should ever be negative or NaN
        expect(r38).toBeGreaterThan(0);
        expect(r50).toBeGreaterThan(0);
        expect(r100).toBeGreaterThan(0);
        expect(r1000).toBeGreaterThan(0);
      });

      it('handles massive weight (1000kg) without numeric overflow', () => {
        const result = calculateBrzycki1RM(1000, 10);
        // 1000 * (36 / 27) = 1333.333... -> 1333.3
        expect(result).toBe(1333.3);
        expect(Number.isFinite(result)).toBe(true);
      });
    });

    describe('Epley 1RM Boundaries', () => {
      it('returns 0 for zero or negative inputs', () => {
        expect(calculateEpley1RM(100, 0)).toBe(0);
        expect(calculateEpley1RM(100, -5)).toBe(0);
        expect(calculateEpley1RM(0, 10)).toBe(0);
        expect(calculateEpley1RM(-50, 10)).toBe(0);
      });

      it('returns exact weight for 1 rep', () => {
        expect(calculateEpley1RM(100, 1)).toBe(100.0);
        expect(calculateEpley1RM(75.5, 1)).toBe(75.5);
      });

      it('calculates linear progression for high reps without division asymptotes', () => {
        // 100 * (1 + 0.0333 * 36) = 100 * 2.1988 = 219.88 -> 219.9
        expect(calculateEpley1RM(100, 36)).toBe(219.9);
        // 100 * (1 + 0.0333 * 37) = 100 * 2.2321 = 223.21 -> 223.2
        expect(calculateEpley1RM(100, 37)).toBe(223.2);
        // 100 * (1 + 0.0333 * 100) = 100 * 4.33 = 433.0
        expect(calculateEpley1RM(100, 100)).toBe(433.0);
      });

      it('handles massive load (1000kg) accurately', () => {
        // 1000 * (1 + 0.0333 * 10) = 1000 * 1.333 = 1333.0
        expect(calculateEpley1RM(1000, 10)).toBe(1333.0);
      });
    });

    describe('calculate1RM Formula Switcher', () => {
      it('defaults to Brzycki when formula is omitted', () => {
        expect(calculate1RM(100, 10)).toBe(calculateBrzycki1RM(100, 10));
      });

      it('uses Brzycki when explicitly specified', () => {
        expect(calculate1RM(100, 10, 'brzycki')).toBe(calculateBrzycki1RM(100, 10));
      });

      it('uses Epley when explicitly specified', () => {
        expect(calculate1RM(100, 10, 'epley')).toBe(calculateEpley1RM(100, 10));
      });
    });
  });

  // =========================================================================
  // 2. VOLUME MATH & AGGREGATION ADVERSARIAL STRESS
  // =========================================================================
  describe('2. Volume Math & Aggregation Integrity', () => {
    it('strictly excludes uncompleted sets (completed: false)', () => {
      const sets = [
        { weightKg: 100, reps: 10, completed: true },  // 1000
        { weightKg: 150, reps: 5, completed: false },  // 0 (excluded)
        { weightKg: 80, reps: 12, completed: true },   // 960
        { weightKg: 200, reps: 1, completed: false },  // 0 (excluded)
      ];
      expect(calculateWorkoutVolume(sets)).toBe(1960);
    });

    it('treats 0-weight sets (bodyweight exercises) as 0 volume without corrupting total', () => {
      const sets = [
        { weightKg: 0, reps: 20, completed: true },    // 0
        { weightKg: 80, reps: 10, completed: true },   // 800
        { weightKg: 0, reps: 15, completed: true },    // 0
      ];
      expect(calculateWorkoutVolume(sets)).toBe(800);
    });

    it('treats 0-reps sets as 0 volume', () => {
      const sets = [
        { weightKg: 100, reps: 0, completed: true },   // 0
        { weightKg: 50, reps: 10, completed: true },   // 500
      ];
      expect(calculateWorkoutVolume(sets)).toBe(500);
    });

    it('clamps negative weight and negative reps to 0 (never subtracts from volume)', () => {
      const sets = [
        { weightKg: -100, reps: 10, completed: true }, // clamped to 0
        { weightKg: 80, reps: -5, completed: true },   // clamped to 0
        { weightKg: -50, reps: -10, completed: true }, // clamped to 0
        { weightKg: 70, reps: 10, completed: true },   // 700
      ];
      expect(calculateWorkoutVolume(sets)).toBe(700);
    });

    it('handles empty or malformed sets arrays without crashing', () => {
      expect(calculateWorkoutVolume([])).toBe(0);
      expect(calculateWorkoutVolume(null as any)).toBe(0);
      expect(calculateWorkoutVolume(undefined as any)).toBe(0);
    });

    it('handles decimal precision and rounding to 1 decimal place', () => {
      const sets = [
        { weightKg: 12.5, reps: 7, completed: true }, // 87.5
        { weightKg: 17.5, reps: 5, completed: true }, // 87.5
      ];
      // 87.5 + 87.5 = 175.0
      expect(calculateWorkoutVolume(sets)).toBe(175);
    });

    it('computes massive training volumes accurately', () => {
      const heavySets: Array<{ weightKg: number; reps: number; completed: boolean }> = [];
      for (let i = 0; i < 50; i++) {
        heavySets.push({ weightKg: 200, reps: 10, completed: true }); // 2000 each * 50 = 100,000
      }
      expect(calculateWorkoutVolume(heavySets)).toBe(100000);
    });

    it('probes repository auto-calculated volume when sets have negative weight or reps', async () => {
      const session = await workoutRepo.saveWorkoutSession(
        {
          routineName: 'Treino Negativo',
          date: '2026-11-06',
          durationMinutes: 20,
        },
        [
          { exerciseName: 'Rosca', setNumber: 1, weightKg: -20, reps: 10, completed: true },
          { exerciseName: 'Rosca', setNumber: 2, weightKg: 20, reps: 10, completed: true },
        ]
      );
      // In SqliteWorkoutRepository line 290: calculatedVolume += s.weightKg * s.reps -> (-20*10) + (20*10) = 0
      expect(session.totalVolumeKg).toBe(0);
    });
  });

  // =========================================================================
  // 3. FORMATTER BOUNDARY & CORNER CASES
  // =========================================================================
  describe('3. Formatter Functions Edge Cases', () => {
    describe('formatElapsedSeconds', () => {
      it('formats 0 and negative seconds to 00:00', () => {
        expect(formatElapsedSeconds(0)).toBe('00:00');
        expect(formatElapsedSeconds(-1)).toBe('00:00');
        expect(formatElapsedSeconds(-9999)).toBe('00:00');
      });

      it('formats durations under 1 hour in MM:SS', () => {
        expect(formatElapsedSeconds(5)).toBe('00:05');
        expect(formatElapsedSeconds(59)).toBe('00:59');
        expect(formatElapsedSeconds(60)).toBe('01:00');
        expect(formatElapsedSeconds(61)).toBe('01:01');
        expect(formatElapsedSeconds(3599)).toBe('59:59');
      });

      it('formats durations at and over 1 hour in HH:MM:SS', () => {
        expect(formatElapsedSeconds(3600)).toBe('01:00:00');
        expect(formatElapsedSeconds(3665)).toBe('01:01:05');
        expect(formatElapsedSeconds(7200)).toBe('02:00:00');
        expect(formatElapsedSeconds(86399)).toBe('23:59:59');
        expect(formatElapsedSeconds(86400)).toBe('24:00:00');
        expect(formatElapsedSeconds(360000)).toBe('100:00:00'); // 100 hours
      });

      it('floors fractional seconds', () => {
        expect(formatElapsedSeconds(45.9)).toBe('00:45');
      });
    });

    describe('formatRestTimerDisplay', () => {
      it('formats 0 and negative seconds to 00:00', () => {
        expect(formatRestTimerDisplay(0)).toBe('00:00');
        expect(formatRestTimerDisplay(-5)).toBe('00:00');
      });

      it('ceils fractional seconds so lifter sees full remaining second', () => {
        expect(formatRestTimerDisplay(0.1)).toBe('00:01');
        expect(formatRestTimerDisplay(14.2)).toBe('00:15');
        expect(formatRestTimerDisplay(59.1)).toBe('01:00');
        expect(formatRestTimerDisplay(60.0)).toBe('01:00');
      });

      it('formats long rest durations accurately', () => {
        expect(formatRestTimerDisplay(90)).toBe('01:30');
        expect(formatRestTimerDisplay(180)).toBe('03:00');
        expect(formatRestTimerDisplay(300)).toBe('05:00');
      });
    });

    describe('formatDurationMinutes', () => {
      it('handles zero and negative minutes', () => {
        expect(formatDurationMinutes(0)).toBe('0 min');
        expect(formatDurationMinutes(-10)).toBe('0 min');
      });

      it('formats minutes below 60', () => {
        expect(formatDurationMinutes(1)).toBe('1 min');
        expect(formatDurationMinutes(45)).toBe('45 min');
        expect(formatDurationMinutes(59)).toBe('59 min');
      });

      it('formats exact hours', () => {
        expect(formatDurationMinutes(60)).toBe('1h');
        expect(formatDurationMinutes(120)).toBe('2h');
        expect(formatDurationMinutes(180)).toBe('3h');
      });

      it('formats hours with remaining minutes', () => {
        expect(formatDurationMinutes(61)).toBe('1h 1m');
        expect(formatDurationMinutes(75)).toBe('1h 15m');
        expect(formatDurationMinutes(145)).toBe('2h 25m');
      });
    });

    describe('formatPreviousLoad', () => {
      it('returns dash when previous sets is undefined or empty', () => {
        expect(formatPreviousLoad(undefined, 1)).toBe('—');
        expect(formatPreviousLoad([], 1)).toBe('—');
      });

      it('returns exact match for existing set number', () => {
        const sets: SetLog[] = [
          { id: '1', sessionId: 's', exerciseName: 'E', setNumber: 1, weightKg: 80, reps: 10, completed: true, createdAt: '' },
          { id: '2', sessionId: 's', exerciseName: 'E', setNumber: 2, weightKg: 85, reps: 8, completed: true, createdAt: '' },
        ];
        expect(formatPreviousLoad(sets, 1)).toBe('80kg × 10');
        expect(formatPreviousLoad(sets, 2)).toBe('85kg × 8');
      });

      it('falls back to last recorded set if current set index exceeds previous count', () => {
        const sets: SetLog[] = [
          { id: '1', sessionId: 's', exerciseName: 'E', setNumber: 1, weightKg: 80, reps: 10, completed: true, createdAt: '' },
        ];
        expect(formatPreviousLoad(sets, 2)).toBe('80kg × 10');
        expect(formatPreviousLoad(sets, 5)).toBe('80kg × 10');
      });

      it('formats bodyweight set (0kg)', () => {
        const sets: SetLog[] = [
          { id: '1', sessionId: 's', exerciseName: 'Barra Fixa', setNumber: 1, weightKg: 0, reps: 12, completed: true, createdAt: '' },
        ];
        expect(formatPreviousLoad(sets, 1)).toBe('0kg × 12');
      });
    });
  });

  // =========================================================================
  // 4. SQL INJECTION ATTACKS & ESCAPING VERIFICATION
  // =========================================================================
  describe('4. SQL Injection Attacks on Workout Repository', () => {
    it('survives classic DROP TABLE injection in routine name', async () => {
      const maliciousName = "Treino A'); DROP TABLE workout_routines;--";
      const routine = await workoutRepo.createRoutine(
        { name: maliciousName, description: 'Safe description', sortOrder: 1 },
        [{ name: 'Supino', muscleGroup: 'Peito', targetSets: 3, defaultRestSeconds: 60, sortOrder: 1 }]
      );

      expect(routine.id).toBeDefined();
      expect(routine.name).toBe(maliciousName);

      // Verify table was NOT dropped
      const routines = await workoutRepo.getRoutines();
      expect(routines.length).toBeGreaterThan(0);
      const found = routines.find((r) => r.id === routine.id);
      expect(found).toBeDefined();
      expect(found?.name).toBe(maliciousName);
    });

    it('survives boolean-based and tautology SQL injection in routine description', async () => {
      const maliciousDesc = "Normal' OR '1'='1' UNION SELECT id, name, NULL, 0, '' FROM users;--";
      const routine = await workoutRepo.createRoutine({
        name: 'Rotina Blindada',
        description: maliciousDesc,
        sortOrder: 1,
      });

      const retrieved = await workoutRepo.getRoutineById(routine.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.description).toBe(maliciousDesc);
    });

    it('survives SQL injection payload in updateRoutine name and description', async () => {
      const routine = await workoutRepo.createRoutine({ name: 'Original', sortOrder: 1 });

      const attackPayload = "Hacked'); UPDATE users SET name = 'Attacker';--";
      await workoutRepo.updateRoutine(routine.id, { name: attackPayload });

      const updated = await workoutRepo.getRoutineById(routine.id);
      expect(updated?.name).toBe(attackPayload);

      // Verify users table was NOT modified
      const user = await db.getFirstAsync<{ name: string }>('SELECT name FROM users WHERE id = ?', 'default_user');
      expect(user?.name).toBe('Atleta');
    });

    it('survives deleteRoutine with malicious ID payload', async () => {
      const countBefore = (await workoutRepo.getRoutines()).length;
      const maliciousId = "' OR '1'='1'; DELETE FROM workout_routines; --";

      // Should attempt to delete routine with that literal string id, deleting 0 routines
      await workoutRepo.deleteRoutine(maliciousId);

      const countAfter = (await workoutRepo.getRoutines()).length;
      expect(countAfter).toBe(countBefore);
    });

    it('survives SQL injection in exercise names during routine creation and lookup', async () => {
      const maliciousExName = "Desenvolvimento'); DROP TABLE routine_exercises;--";
      const routine = await workoutRepo.createRoutine(
        { name: 'Ombros', sortOrder: 1 },
        [{ name: maliciousExName, muscleGroup: 'Ombros', targetSets: 4, defaultRestSeconds: 90, sortOrder: 1 }]
      );

      expect(routine.exercises?.length).toBe(1);
      expect(routine.exercises?.[0].name).toBe(maliciousExName);

      // Verify routine_exercises table was NOT dropped
      const retrieved = await workoutRepo.getRoutineById(routine.id);
      expect(retrieved?.exercises?.[0].name).toBe(maliciousExName);

      // Verify getPreviousExerciseSets handles injection payload safely
      const prevSets = await workoutRepo.getPreviousExerciseSets(maliciousExName, 5);
      expect(prevSets).toEqual([]);
    });

    it('survives SQL injection in getExerciseHistory query parameter', async () => {
      const injectionName = "Leg Press' UNION SELECT '2026-11-01', 9999, 9999, 99, 999; --";
      const history = await workoutRepo.getExerciseHistory(injectionName);
      expect(history).toEqual([]);
    });

    it('survives SQL injection in saveWorkoutSession (routineName and notes)', async () => {
      const injectionRoutineName = "Treino'); DROP TABLE workout_sessions;--";
      const injectionNotes = "Nota'); DROP TABLE set_logs;--";

      const session = await workoutRepo.saveWorkoutSession(
        {
          routineName: injectionRoutineName,
          date: '2026-11-06',
          durationMinutes: 45,
          notes: injectionNotes,
        },
        [
          {
            exerciseName: "Rosca'); DROP TABLE users;--",
            setNumber: 1,
            weightKg: 20,
            reps: 10,
            completed: true,
          },
        ]
      );

      expect(session.id).toBeDefined();
      expect(session.routineName).toBe(injectionRoutineName);
      expect(session.notes).toBe(injectionNotes);

      // Verify all tables still exist and are healthy
      const sessCheck = await workoutRepo.getSessionDetails(session.id);
      expect(sessCheck).not.toBeNull();
      expect(sessCheck?.routineName).toBe(injectionRoutineName);
      expect(sessCheck?.sets?.[0].exerciseName).toBe("Rosca'); DROP TABLE users;--");

      // Verify users table is intact
      const userCount = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM users;');
      expect(userCount?.c).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // 5. DATABASE CONSTRAINTS, FOREIGN KEYS & ISOLATION
  // =========================================================================
  describe('5. Database Constraints, Foreign Keys & Cascade Isolation', () => {
    it('enforces CASCADE delete from workout_routines to routine_exercises', async () => {
      const routine = await workoutRepo.createRoutine(
        { name: 'Rotina Cascata', sortOrder: 50 },
        [
          { name: 'Ex A', muscleGroup: 'Peito', targetSets: 3, defaultRestSeconds: 60, sortOrder: 1 },
          { name: 'Ex B', muscleGroup: 'Tríceps', targetSets: 3, defaultRestSeconds: 60, sortOrder: 2 },
        ]
      );

      const exercisesBefore = await db.getAllAsync(
        'SELECT id FROM routine_exercises WHERE routine_id = ?',
        routine.id
      );
      expect(exercisesBefore.length).toBe(2);

      await workoutRepo.deleteRoutine(routine.id);

      const exercisesAfter = await db.getAllAsync(
        'SELECT id FROM routine_exercises WHERE routine_id = ?',
        routine.id
      );
      expect(exercisesAfter.length).toBe(0);
    });

    it('enforces SET NULL on workout_sessions.routine_id when routine is deleted', async () => {
      const routine = await workoutRepo.createRoutine(
        { name: 'Rotina com Histórico', sortOrder: 51 },
        [{ name: 'Crucifixo', muscleGroup: 'Peito', targetSets: 3, defaultRestSeconds: 60, sortOrder: 1 }]
      );

      const session = await workoutRepo.saveWorkoutSession(
        {
          routineId: routine.id,
          routineName: routine.name,
          date: '2026-11-06',
          durationMinutes: 40,
        },
        [{ exerciseName: 'Crucifixo', setNumber: 1, weightKg: 16, reps: 12, completed: true }]
      );

      expect(session.routineId).toBe(routine.id);

      // Delete the routine
      await workoutRepo.deleteRoutine(routine.id);

      // Verify the session still exists in the database
      const dbSession = await db.getFirstAsync<{ routine_id: string | null; routine_name: string }>(
        'SELECT routine_id, routine_name FROM workout_sessions WHERE id = ?',
        session.id
      );
      expect(dbSession).not.toBeNull();
      expect(dbSession?.routine_id).toBeNull();
      expect(dbSession?.routine_name).toBe('Rotina com Histórico');

      // Verify repository mapper handles routine_id null as undefined cleanly
      const repoSession = await workoutRepo.getSessionDetails(session.id);
      expect(repoSession).not.toBeNull();
      expect(repoSession?.routineId).toBeUndefined();
      expect(repoSession?.routineName).toBe('Rotina com Histórico');
    });

    it('enforces CASCADE delete on set_logs when a workout_session is deleted', async () => {
      const session = await workoutRepo.saveWorkoutSession(
        {
          routineName: 'Sessão Deletável',
          date: '2026-11-06',
          durationMinutes: 30,
        },
        [
          { exerciseName: 'Barra Fixa', setNumber: 1, weightKg: 0, reps: 10, completed: true },
          { exerciseName: 'Barra Fixa', setNumber: 2, weightKg: 0, reps: 8, completed: true },
        ]
      );

      const setsBefore = await db.getAllAsync('SELECT id FROM set_logs WHERE session_id = ?', session.id);
      expect(setsBefore.length).toBe(2);

      // Delete the session directly from workout_sessions
      await db.runAsync('DELETE FROM workout_sessions WHERE id = ?', session.id);

      const setsAfter = await db.getAllAsync('SELECT id FROM set_logs WHERE session_id = ?', session.id);
      expect(setsAfter.length).toBe(0);
    });

    it('rejects inserting routine_exercises with a non-existent routine_id (FK violation)', async () => {
      await expect(
        db.runAsync(
          `INSERT INTO routine_exercises (id, routine_id, name, muscle_group, target_sets, default_rest_seconds, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?);`,
          'bad-ex-1',
          'non-existent-routine-999',
          'Exercício Órfão',
          'Peito',
          3,
          60,
          1
        )
      ).rejects.toThrow(/FOREIGN KEY constraint failed/i);
    });

    it('rejects inserting set_logs with a non-existent session_id (FK violation)', async () => {
      await expect(
        db.runAsync(
          `INSERT INTO set_logs (id, session_id, exercise_name, set_number, weight_kg, reps, completed)
           VALUES (?, ?, ?, ?, ?, ?, ?);`,
          'bad-set-1',
          'non-existent-session-999',
          'Série Órfã',
          1,
          50,
          10,
          1
        )
      ).rejects.toThrow(/FOREIGN KEY constraint failed/i);
    });

    it('enforces CHECK constraint on set_logs.completed (must be 0 or 1)', async () => {
      const session = await workoutRepo.saveWorkoutSession({
        routineName: 'Sessão Check Test',
        date: '2026-11-06',
        durationMinutes: 15,
      });

      await expect(
        db.runAsync(
          `INSERT INTO set_logs (id, session_id, exercise_name, set_number, weight_kg, reps, completed)
           VALUES (?, ?, ?, ?, ?, ?, ?);`,
          'invalid-check-set',
          session.id,
          'Supino Inclinado',
          1,
          70,
          10,
          2 // Invalid: CHECK(completed IN (0, 1))
        )
      ).rejects.toThrow(/CHECK constraint failed/i);
    });

    it('enforces NOT NULL constraint on routine_exercises.muscle_group', async () => {
      const routine = await workoutRepo.createRoutine({ name: 'Rotina Sem Grupo', sortOrder: 1 });
      await expect(
        workoutRepo.createRoutine(
          { name: 'Rotina Falha', sortOrder: 2 },
          [{ name: 'Exercício Sem Grupo' } as any]
        )
      ).rejects.toThrow(/NOT NULL constraint failed: routine_exercises\.muscle_group/i);
    });
  });

  // =========================================================================
  // 6. EXERCISE HISTORY & PROGRESSION CHART MAPPING EDGE CASES
  // =========================================================================
  describe('6. Exercise History & Chart Mapping Edge Cases', () => {
    it('correctly aggregates multiple sets within the same session', async () => {
      await workoutRepo.saveWorkoutSession(
        { routineName: 'Costas Pesado', date: '2026-11-01', durationMinutes: 50 },
        [
          { exerciseName: 'Remada Curvada', setNumber: 1, weightKg: 60, reps: 12, completed: true }, // 720
          { exerciseName: 'Remada Curvada', setNumber: 2, weightKg: 80, reps: 10, completed: true }, // 800
          { exerciseName: 'Remada Curvada', setNumber: 3, weightKg: 100, reps: 6, completed: true }, // 600
          { exerciseName: 'Remada Curvada', setNumber: 4, weightKg: 110, reps: 3, completed: false }, // uncompleted
        ]
      );

      const history = await workoutRepo.getExerciseHistory('Remada Curvada');
      expect(history.length).toBe(1);
      expect(history[0].date).toBe('2026-11-01');
      // Max weight should be 100 (from completed sets)
      expect(history[0].maxWeightKg).toBe(100);
      // Volume = 720 + 800 + 600 = 2120
      expect(history[0].totalVolumeKg).toBe(2120);
    });

    it('maps chart progression with single session point', () => {
      const point: ExerciseHistoryPoint = {
        date: '2026-11-06',
        maxWeightKg: 90,
        totalVolumeKg: 1800,
        estimated1RM: 112.5,
        bestSetReps: 8,
      };

      const chart = mapExerciseHistoryToChart([point]);
      expect(chart.labels).toEqual(['06/11']);
      expect(chart.maxWeights).toEqual([90]);
      expect(chart.estimated1RMs).toEqual([112.5]);
      expect(chart.volumes).toEqual([1800]);
      expect(chart.personalRecord).toEqual({
        maxWeight: 90,
        max1RM: 112.5,
        prDate: '2026-11-06',
      });
    });

    it('sorts non-chronological points into chronological order and identifies all-time PR', () => {
      const points: ExerciseHistoryPoint[] = [
        { date: '2026-11-05', maxWeightKg: 95, totalVolumeKg: 2000, estimated1RM: 115.0, bestSetReps: 7 },
        { date: '2026-10-15', maxWeightKg: 80, totalVolumeKg: 1600, estimated1RM: 100.0, bestSetReps: 8 },
        { date: '2026-10-25', maxWeightKg: 100, totalVolumeKg: 1900, estimated1RM: 120.0, bestSetReps: 6 }, // PR here!
        { date: '2026-11-02', maxWeightKg: 90, totalVolumeKg: 1700, estimated1RM: 110.0, bestSetReps: 8 },
      ];

      const chart = mapExerciseHistoryToChart(points);

      // Verify sorted chronological dates
      expect(chart.labels).toEqual(['15/10', '25/10', '02/11', '05/11']);
      expect(chart.maxWeights).toEqual([80, 100, 90, 95]);
      expect(chart.estimated1RMs).toEqual([100.0, 120.0, 110.0, 115.0]);
      // Personal record must be the peak 1RM on 2026-10-25
      expect(chart.personalRecord).toEqual({
        maxWeight: 100,
        max1RM: 120.0,
        prDate: '2026-10-25',
      });
    });
  });

  // =========================================================================
  // 7. STATE MACHINE BOUNDARIES (WorkoutStateManager)
  // =========================================================================
  describe('7. WorkoutStateManager Live Session Boundaries', () => {
    it('handles empty routine with 0 exercises without crashing', async () => {
      const stateManager = new WorkoutStateManager(workoutRepo);
      const emptyRoutine = await workoutRepo.createRoutine({ name: 'Vazia', sortOrder: 99 }, []);

      await stateManager.startWorkout(emptyRoutine);
      expect(stateManager.activeSession).not.toBeNull();
      expect(stateManager.activeSession?.routineName).toBe('Vazia');
      expect(stateManager.activeSession?.exercises.length).toBe(0);

      // Finishing empty session should complete with 0 volume and 0 sets
      const finished = await stateManager.finishWorkout();
      expect(finished.totalVolumeKg).toBe(0);
      expect(finished.sets?.length).toBe(0);

      stateManager.cleanup();
    });

    it('re-indexes set numbers sequentially when intermediate set is removed', async () => {
      const stateManager = new WorkoutStateManager(workoutRepo);
      stateManager.startFreestyleWorkout('Treino Teste Sets');

      await stateManager.addExerciseToActiveWorkout({ name: 'Agachamento', targetSets: 4 });
      expect(stateManager.activeSession?.exercises[0].sets.length).toBe(4);
      expect(stateManager.activeSession?.exercises[0].sets.map((s) => s.setNumber)).toEqual([1, 2, 3, 4]);

      // Remove set 2 (index 1)
      stateManager.removeSet(0, 1);

      // Should have 3 sets renumbered 1, 2, 3
      expect(stateManager.activeSession?.exercises[0].sets.length).toBe(3);
      expect(stateManager.activeSession?.exercises[0].sets.map((s) => s.setNumber)).toEqual([1, 2, 3]);

      stateManager.cleanup();
    });

    it('prevents removing set if only 1 set remains', async () => {
      const stateManager = new WorkoutStateManager(workoutRepo);
      stateManager.startFreestyleWorkout();
      await stateManager.addExerciseToActiveWorkout({ name: 'Rosca', targetSets: 1 });

      expect(stateManager.activeSession?.exercises[0].sets.length).toBe(1);
      // Attempt to remove the only set
      stateManager.removeSet(0, 0);
      // Still 1 set remains
      expect(stateManager.activeSession?.exercises[0].sets.length).toBe(1);

      stateManager.cleanup();
    });

    it('pausing and resuming workout preserves elapsed wall-clock accuracy', async () => {
      const stateManager = new WorkoutStateManager(workoutRepo);
      stateManager.startFreestyleWorkout();

      expect(stateManager.activeSession?.isPaused).toBe(false);
      stateManager.pauseWorkout();
      expect(stateManager.activeSession?.isPaused).toBe(true);

      stateManager.resumeWorkout();
      expect(stateManager.activeSession?.isPaused).toBe(false);

      stateManager.cleanup();
    });
  });
});
