import { InMemorySQLiteDatabase, createTestDatabase } from '../helpers/inMemoryDb';
import { SqliteWorkoutRepository } from '@/database/repositories/SqliteWorkoutRepository';
import { WorkoutStateManager, HapticsServiceInterface } from '@/context/WorkoutContext';

describe('Unit: Custom Exercises & WorkoutContext Reactivity', () => {
  let db: InMemorySQLiteDatabase;
  let workoutRepo: SqliteWorkoutRepository;
  let mockHaptics: HapticsServiceInterface;
  let manager: WorkoutStateManager;

  beforeEach(async () => {
    db = await createTestDatabase();
    workoutRepo = new SqliteWorkoutRepository(db);
    mockHaptics = {
      triggerSetComplete: jest.fn().mockResolvedValue(undefined),
      triggerTimerFinished: jest.fn().mockResolvedValue(undefined),
    };
    manager = new WorkoutStateManager(workoutRepo, mockHaptics);
    await manager.loadRoutines();
    await manager.loadCustomExercises();
  });

  afterEach(async () => {
    manager.cleanup();
    await db.closeAsync();
  });

  it('creates and persists a custom exercise in SQLite', async () => {
    const created = await workoutRepo.createCustomExercise({
      name: 'Elevação Pélvica',
      category: 'Glúteos',
      defaultSets: 4,
      defaultRestSeconds: 90,
    });

    expect(created.id).toBeDefined();
    expect(created.name).toBe('Elevação Pélvica');
    expect(created.category).toBe('Glúteos');
    expect(created.defaultSets).toBe(4);
    expect(created.defaultRestSeconds).toBe(90);

    const list = await workoutRepo.getCustomExercises();
    expect(list.length).toBe(1);
    expect(list[0].name).toBe('Elevação Pélvica');
    expect(list[0].category).toBe('Glúteos');
  });

  it('manages custom exercises through WorkoutStateManager and triggers notifications', async () => {
    let notifyCallCount = 0;
    const unsubscribe = manager.subscribe(() => {
      notifyCallCount++;
    });

    expect(manager.customExercises).toEqual([]);

    const created = await manager.createCustomExercise({
      name: 'Burpee com Salto',
      category: 'Cardio / Funcional',
      defaultSets: 3,
      defaultRestSeconds: 60,
    });

    expect(created.name).toBe('Burpee com Salto');
    expect(manager.customExercises.length).toBe(1);
    expect(manager.customExercises[0].category).toBe('Cardio / Funcional');
    expect(notifyCallCount).toBeGreaterThan(0);

    unsubscribe();
  });

  it('verifies WorkoutStateManager notifies listeners on routine creation for UI re-rendering', async () => {
    let listenerTriggered = false;
    let versionCounter = 0;

    // Simulate WorkoutProvider subscription
    const unsubscribe = manager.subscribe(() => {
      listenerTriggered = true;
      versionCounter++;
    });

    const initialRoutineCount = manager.routines.length;

    await manager.createRoutine(
      {
        name: 'Treino Funcional Rápido',
        description: 'HIIT e Mobilidade',
        sortOrder: 99,
      },
      [
        {
          name: 'Polichinelos',
          muscleGroup: 'Cardio / Funcional',
          targetSets: 3,
          defaultRestSeconds: 30,
          sortOrder: 1,
        },
      ]
    );

    expect(listenerTriggered).toBe(true);
    expect(versionCounter).toBeGreaterThan(0);
    expect(manager.routines.length).toBe(initialRoutineCount + 1);
    expect(manager.routines.some((r) => r.name === 'Treino Funcional Rápido')).toBe(true);

    unsubscribe();
  });
});
