import { InMemorySQLiteDatabase, createTestDatabase } from '../helpers/inMemoryDb';
import { SqliteWorkoutRepository } from '@/database/repositories/SqliteWorkoutRepository';

describe('Unit: WorkoutRepositoryM3 (Repository Integrity & Queries)', () => {
  let db: InMemorySQLiteDatabase;
  let workoutRepo: SqliteWorkoutRepository;

  beforeEach(async () => {
    db = await createTestDatabase();
    workoutRepo = new SqliteWorkoutRepository(db);
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  describe('getPreviousExerciseSets', () => {
    it('isolates strictly the latest session across multiple historical sessions', async () => {
      // Session 1 (Older: 2026-10-15)
      await workoutRepo.saveWorkoutSession(
        {
          routineName: 'Treino Antigo',
          date: '2026-10-15',
          durationMinutes: 40,
        },
        [
          { exerciseName: 'Supino Reto', setNumber: 1, weightKg: 70, reps: 10, completed: true },
          { exerciseName: 'Supino Reto', setNumber: 2, weightKg: 75, reps: 8, completed: true },
        ]
      );

      // Session 2 (Newer: 2026-11-01)
      await workoutRepo.saveWorkoutSession(
        {
          routineName: 'Treino Intermediário',
          date: '2026-11-01',
          durationMinutes: 45,
        },
        [
          { exerciseName: 'Supino Reto', setNumber: 1, weightKg: 80, reps: 10, completed: true },
          { exerciseName: 'Supino Reto', setNumber: 2, weightKg: 85, reps: 8, completed: true },
          { exerciseName: 'Supino Reto', setNumber: 3, weightKg: 90, reps: 6, completed: true },
        ]
      );

      // Query previous sets for Supino Reto
      const previousSets = await workoutRepo.getPreviousExerciseSets('Supino Reto', 3);

      expect(previousSets.length).toBe(3);
      // Values must match the newer session (Session 2), not Session 1
      expect(previousSets[0].weightKg).toBe(80);
      expect(previousSets[1].weightKg).toBe(85);
      expect(previousSets[2].weightKg).toBe(90);
    });

    it('disregards uncompleted sets from previous session', async () => {
      await workoutRepo.saveWorkoutSession(
        {
          routineName: 'Treino Parcial',
          date: '2026-11-02',
          durationMinutes: 30,
        },
        [
          { exerciseName: 'Agachamento', setNumber: 1, weightKg: 100, reps: 5, completed: true },
          { exerciseName: 'Agachamento', setNumber: 2, weightKg: 105, reps: 5, completed: false }, // uncompleted
          { exerciseName: 'Agachamento', setNumber: 3, weightKg: 105, reps: 5, completed: true },
        ]
      );

      const previousSets = await workoutRepo.getPreviousExerciseSets('Agachamento', 5);
      expect(previousSets.length).toBe(2);
      expect(previousSets.map((s) => s.setNumber)).toEqual([1, 3]);
    });

    it('does not leak sets from different exercises performed in the same session', async () => {
      await workoutRepo.saveWorkoutSession(
        {
          routineName: 'Treino Misto',
          date: '2026-11-03',
          durationMinutes: 45,
        },
        [
          { exerciseName: 'Puxada Alta', setNumber: 1, weightKg: 60, reps: 10, completed: true },
          { exerciseName: 'Remada Curvada', setNumber: 1, weightKg: 70, reps: 10, completed: true },
        ]
      );

      const puxadaSets = await workoutRepo.getPreviousExerciseSets('Puxada Alta', 5);
      expect(puxadaSets.length).toBe(1);
      expect(puxadaSets[0].exerciseName).toBe('Puxada Alta');
    });

    it('returns empty array when exercise has no historical logs', async () => {
      const sets = await workoutRepo.getPreviousExerciseSets('Exercício Nunca Feito', 3);
      expect(sets).toEqual([]);
    });

    it('respects targetSets limit', async () => {
      await workoutRepo.saveWorkoutSession(
        {
          routineName: 'Treino Volume',
          date: '2026-11-04',
          durationMinutes: 60,
        },
        [
          { exerciseName: 'Elevação Lateral', setNumber: 1, weightKg: 12, reps: 15, completed: true },
          { exerciseName: 'Elevação Lateral', setNumber: 2, weightKg: 12, reps: 15, completed: true },
          { exerciseName: 'Elevação Lateral', setNumber: 3, weightKg: 12, reps: 15, completed: true },
          { exerciseName: 'Elevação Lateral', setNumber: 4, weightKg: 12, reps: 15, completed: true },
        ]
      );

      const limited = await workoutRepo.getPreviousExerciseSets('Elevação Lateral', 2);
      expect(limited.length).toBe(2);
    });
  });

  describe('saveWorkoutSession and volume calculation', () => {
    it('automatically calculates total volume if totalVolumeKg is omitted', async () => {
      const session = await workoutRepo.saveWorkoutSession(
        {
          routineName: 'Push Day',
          date: '2026-11-05',
          durationMinutes: 50,
        },
        [
          { exerciseName: 'Supino', setNumber: 1, weightKg: 100, reps: 10, completed: true }, // 1000
          { exerciseName: 'Supino', setNumber: 2, weightKg: 100, reps: 8, completed: true }, // 800
          { exerciseName: 'Supino', setNumber: 3, weightKg: 100, reps: 6, completed: false }, // ignored
        ]
      );

      expect(session.id).toBeDefined();
      expect(session.totalVolumeKg).toBe(1800);
      expect(session.sets?.length).toBe(3);
    });

    it('preserves explicitly passed totalVolumeKg', async () => {
      const session = await workoutRepo.saveWorkoutSession(
        {
          routineName: 'Push Day Custom Vol',
          date: '2026-11-05',
          durationMinutes: 50,
          totalVolumeKg: 2500,
        },
        [{ exerciseName: 'Supino', setNumber: 1, weightKg: 100, reps: 10, completed: true }]
      );

      expect(session.totalVolumeKg).toBe(2500);
    });
  });

  describe('cascade integrity', () => {
    it('deleting a routine preserves completed workout sessions with routine_id SET NULL', async () => {
      const routine = await workoutRepo.createRoutine(
        { name: 'Rotina Temporária', sortOrder: 99 },
        [{ name: 'Rosca Direta', muscleGroup: 'Bíceps', targetSets: 3, defaultRestSeconds: 60, sortOrder: 1 }]
      );

      const session = await workoutRepo.saveWorkoutSession(
        {
          routineId: routine.id,
          routineName: routine.name,
          date: '2026-11-05',
          durationMinutes: 30,
          totalVolumeKg: 500,
        },
        [{ exerciseName: 'Rosca Direta', setNumber: 1, weightKg: 20, reps: 10, completed: true }]
      );

      expect(session.routineId).toBe(routine.id);

      // Delete routine
      await workoutRepo.deleteRoutine(routine.id);

      // Session must still exist
      const retrievedSession = await workoutRepo.getSessionDetails(session.id);
      expect(retrievedSession).not.toBeNull();
      expect(retrievedSession?.routineId).toBeUndefined();
      expect(retrievedSession?.routineName).toBe('Rotina Temporária');
    });

    it('deleting a routine cascades to routine_exercises', async () => {
      const routine = await workoutRepo.createRoutine(
        { name: 'Rotina Para Exclusão', sortOrder: 99 },
        [
          { name: 'Ex 1', muscleGroup: 'Peito', targetSets: 3, defaultRestSeconds: 60, sortOrder: 1 },
          { name: 'Ex 2', muscleGroup: 'Costas', targetSets: 3, defaultRestSeconds: 60, sortOrder: 2 },
        ]
      );

      await workoutRepo.deleteRoutine(routine.id);

      const exercises = await db.getAllAsync(
        'SELECT * FROM routine_exercises WHERE routine_id = ?',
        [routine.id]
      );
      expect(exercises.length).toBe(0);
    });
  });

  describe('getWorkoutSessions and pagination', () => {
    it('returns sessions ordered by date DESC, created_at DESC with limit/offset', async () => {
      for (let i = 1; i <= 5; i++) {
        await workoutRepo.saveWorkoutSession({
          routineName: `Sessão ${i}`,
          date: `2026-11-0${i}`,
          durationMinutes: 30,
          totalVolumeKg: i * 500,
        });
      }

      const page1 = await workoutRepo.getWorkoutSessions(2, 0);
      expect(page1.length).toBe(2);
      expect(page1[0].routineName).toBe('Sessão 5');
      expect(page1[1].routineName).toBe('Sessão 4');

      const page2 = await workoutRepo.getWorkoutSessions(2, 2);
      expect(page2.length).toBe(2);
      expect(page2[0].routineName).toBe('Sessão 3');
      expect(page2[1].routineName).toBe('Sessão 2');
    });
  });

  describe('getExerciseHistory', () => {
    it('aggregates progression data grouped by session date in chronological order', async () => {
      await workoutRepo.saveWorkoutSession(
        { routineName: 'Dia 1', date: '2026-11-01', durationMinutes: 40 },
        [
          { exerciseName: 'Agachamento', setNumber: 1, weightKg: 100, reps: 10, completed: true },
          { exerciseName: 'Agachamento', setNumber: 2, weightKg: 110, reps: 8, completed: true },
        ]
      );

      await workoutRepo.saveWorkoutSession(
        { routineName: 'Dia 2', date: '2026-11-04', durationMinutes: 40 },
        [
          { exerciseName: 'Agachamento', setNumber: 1, weightKg: 120, reps: 5, completed: true },
        ]
      );

      const history = await workoutRepo.getExerciseHistory('Agachamento');
      expect(history.length).toBe(2);
      expect(history[0].date).toBe('2026-11-01');
      expect(history[0].maxWeightKg).toBe(110);
      expect(history[1].date).toBe('2026-11-04');
      expect(history[1].maxWeightKg).toBe(120);
    });
  });
});
