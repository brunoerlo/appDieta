import { InMemorySQLiteDatabase, createTestDatabase } from '../helpers/inMemoryDb';
import { SqliteWorkoutRepository } from '@/database/repositories/SqliteWorkoutRepository';

describe('WorkoutRepository Unit Tests', () => {
  let db: InMemorySQLiteDatabase;
  let repo: SqliteWorkoutRepository;

  beforeEach(async () => {
    db = await createTestDatabase();
    repo = new SqliteWorkoutRepository(db);
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  describe('Routines Management', () => {
    it('retrieves default seeded workout routines with exercises', async () => {
      const routines = await repo.getRoutines();
      expect(routines.length).toBeGreaterThanOrEqual(3);

      const treinoA = routines.find((r) => r.id === 'routine-abc-a');
      expect(treinoA).toBeDefined();
      expect(treinoA!.name).toBe('Treino A - Peito, Tríceps e Ombros');
      expect(treinoA!.exercises).toBeDefined();
      expect(treinoA!.exercises!.length).toBe(7);
      expect(treinoA!.exercises![0].name).toBe('Supino Reto com Barra');
    });

    it('retrieves routine by id with exercises', async () => {
      const routine = await repo.getRoutineById('routine-abc-b');
      expect(routine).not.toBeNull();
      expect(routine!.name).toBe('Treino B - Costas, Bíceps e Trapézio');
      expect(routine!.exercises!.length).toBe(7);
    });

    it('creates, updates, and deletes a custom routine with cascading exercises', async () => {
      const created = await repo.createRoutine(
        {
          name: 'Treino Especial Ombros',
          description: 'Foco em hipertrofia de deltoides',
          sortOrder: 10,
        },
        [
          {
            name: 'Desenvolvimento Halteres',
            muscleGroup: 'Ombros',
            targetSets: 4,
            defaultRestSeconds: 90,
            sortOrder: 1,
          },
          {
            name: 'Elevação Lateral',
            muscleGroup: 'Ombros',
            targetSets: 4,
            defaultRestSeconds: 60,
            sortOrder: 2,
          },
        ]
      );

      expect(created.id).toBeDefined();
      expect(created.exercises).toHaveLength(2);

      // Update routine
      await repo.updateRoutine(
        created.id,
        { name: 'Treino Ombros e Trapézio' },
        [
          {
            id: '',
            routineId: created.id,
            name: 'Desenvolvimento Barra',
            muscleGroup: 'Ombros',
            targetSets: 5,
            defaultRestSeconds: 90,
            sortOrder: 1,
          },
        ]
      );

      const updated = await repo.getRoutineById(created.id);
      expect(updated!.name).toBe('Treino Ombros e Trapézio');
      expect(updated!.exercises).toHaveLength(1);
      expect(updated!.exercises![0].name).toBe('Desenvolvimento Barra');

      // Delete routine
      await repo.deleteRoutine(created.id);
      expect(await repo.getRoutineById(created.id)).toBeNull();
    });
  });

  describe('Live Session Execution & Previous Load Reference', () => {
    it('retrieves previous load and reps from the most recent completed session only', async () => {
      // Session 1 (Older - 2026-11-01)
      await repo.saveWorkoutSession({
        routineName: 'Treino A',
        date: '2026-11-01',
        startTime: '10:00:00',
        endTime: '11:00:00',
        durationMinutes: 60,
        sets: [
          {
            exerciseName: 'Supino Reto com Barra',
            setNumber: 1,
            weightKg: 80,
            reps: 10,
            completed: true,
          },
          {
            exerciseName: 'Supino Reto com Barra',
            setNumber: 2,
            weightKg: 80,
            reps: 10,
            completed: true,
          },
        ],
      });

      // Session 2 (Newer - 2026-11-04)
      await repo.saveWorkoutSession({
        routineName: 'Treino A',
        date: '2026-11-04',
        startTime: '10:00:00',
        endTime: '11:00:00',
        durationMinutes: 60,
        sets: [
          {
            exerciseName: 'Supino Reto com Barra',
            setNumber: 1,
            weightKg: 85,
            reps: 10,
            completed: true,
          },
          {
            exerciseName: 'Supino Reto com Barra',
            setNumber: 2,
            weightKg: 85,
            reps: 9,
            completed: true,
          },
          {
            exerciseName: 'Supino Reto com Barra',
            setNumber: 3,
            weightKg: 85,
            reps: 8,
            completed: false, // uncompleted set should be ignored
          },
        ],
      });

      // Query reference for live workout session
      const prevSets = await repo.getPreviousExerciseSets('Supino Reto com Barra', 10);
      expect(prevSets).toHaveLength(2);
      expect(prevSets[0].weightKg).toBe(85);
      expect(prevSets[0].reps).toBe(10);
      expect(prevSets[1].weightKg).toBe(85);
      expect(prevSets[1].reps).toBe(9);
    });

    it('returns empty array when exercise was never performed before', async () => {
      const prevSets = await repo.getPreviousExerciseSets('ExercicioSemHistorico');
      expect(prevSets).toEqual([]);
    });

    it('saves completed session with sets and computes total volume', async () => {
      const session = await repo.saveWorkoutSession({
        routineName: 'Treino C - Pernas',
        date: '2026-11-05',
        startTime: '18:00:00',
        endTime: '19:15:00',
        durationMinutes: 75,
        notes: 'Treino muito intenso',
        sets: [
          {
            exerciseName: 'Agachamento Livre com Barra',
            setNumber: 1,
            weightKg: 100,
            reps: 10,
            completed: true,
          },
          {
            exerciseName: 'Agachamento Livre com Barra',
            setNumber: 2,
            weightKg: 100,
            reps: 10,
            completed: true,
          },
          {
            exerciseName: 'Leg Press 45°',
            setNumber: 1,
            weightKg: 200,
            reps: 12,
            completed: true,
          },
        ],
      });

      expect(session.id).toBeDefined();
      // Total volume: (100 * 10) + (100 * 10) + (200 * 12) = 1000 + 1000 + 2400 = 4400 kg
      expect(session.totalVolumeKg).toBe(4400);

      const history = await repo.getWorkoutSessions(10);
      expect(history.length).toBeGreaterThanOrEqual(1);
      expect(history[0].id).toBe(session.id);

      const details = await repo.getSessionDetails(session.id);
      expect(details).not.toBeNull();
      expect(details!.sets).toHaveLength(3);
    });

    it('calculates exercise progression history and 1RM estimate', async () => {
      await repo.saveWorkoutSession({
        routineName: 'Treino A',
        date: '2026-10-20',
        durationMinutes: 50,
        sets: [
          {
            exerciseName: 'Supino Reto com Barra',
            setNumber: 1,
            weightKg: 80,
            reps: 10,
            completed: true,
          },
        ],
      });

      await repo.saveWorkoutSession({
        routineName: 'Treino A',
        date: '2026-10-27',
        durationMinutes: 50,
        sets: [
          {
            exerciseName: 'Supino Reto com Barra',
            setNumber: 1,
            weightKg: 85,
            reps: 10,
            completed: true,
          },
        ],
      });

      const prog = await repo.getExerciseHistory('Supino Reto com Barra');
      expect(prog).toHaveLength(2);
      expect(prog[0].date).toBe('2026-10-20');
      expect(prog[0].maxWeightKg).toBe(80);
      expect(prog[1].date).toBe('2026-10-27');
      expect(prog[1].maxWeightKg).toBe(85);
      expect(prog[1].estimated1RM).toBeGreaterThan(85);
    });
  });
});
