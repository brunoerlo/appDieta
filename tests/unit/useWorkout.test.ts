import { InMemorySQLiteDatabase, createTestDatabase } from '../helpers/inMemoryDb';
import { SqliteWorkoutRepository } from '@/database/repositories/SqliteWorkoutRepository';
import { WorkoutStateManager, HapticsServiceInterface } from '@/context/WorkoutContext';

describe('Unit: WorkoutStateManager & Workout Progression Logic', () => {
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
  });

  afterEach(async () => {
    manager.cleanup();
    await db.closeAsync();
  });

  it('1. initializes and loads pre-seeded routines', () => {
    expect(manager.routines.length).toBeGreaterThanOrEqual(6);
    const routineA = manager.routines.find((r) => r.id === 'routine-abc-a');
    expect(routineA).toBeDefined();
    expect(routineA?.exercises?.length).toBeGreaterThan(0);
    expect(manager.activeSession).toBeNull();
    expect(manager.restTimer.isActive).toBe(false);
  });

  it('2. creates, updates, and deletes a custom routine', async () => {
    const created = await manager.createRoutine(
      {
        name: 'Ombros e Trapézio',
        description: 'Foco em deltoides',
        sortOrder: 10,
      },
      [
        {
          name: 'Desenvolvimento Militar',
          muscleGroup: 'Ombros',
          targetSets: 4,
          defaultRestSeconds: 90,
          sortOrder: 1,
        },
        {
          name: 'Elevação Lateral',
          muscleGroup: 'Ombros',
          targetSets: 3,
          defaultRestSeconds: 60,
          sortOrder: 2,
        },
      ]
    );

    expect(created.id).toBeDefined();
    expect(created.name).toBe('Ombros e Trapézio');

    const loaded = await manager.getRoutineById(created.id);
    expect(loaded?.exercises?.length).toBe(2);

    await manager.updateRoutine(created.id, { name: 'Ombros e Trapézio Hipertrofia' });
    const updated = await manager.getRoutineById(created.id);
    expect(updated?.name).toBe('Ombros e Trapézio Hipertrofia');

    await manager.deleteRoutine(created.id);
    const deleted = await manager.getRoutineById(created.id);
    expect(deleted).toBeNull();
  });

  it('3. startWorkout initializes active session with exercises and pre-fills sets', async () => {
    const routineA = manager.routines.find((r) => r.id === 'routine-abc-a')!;
    await manager.startWorkout(routineA);

    expect(manager.activeSession).not.toBeNull();
    expect(manager.activeSession?.routineId).toBe('routine-abc-a');
    expect(manager.activeSession?.exercises.length).toBe(routineA.exercises!.length);

    const firstEx = manager.activeSession!.exercises[0];
    expect(firstEx.sets.length).toBe(firstEx.targetSets);
    expect(firstEx.sets[0].completed).toBe(false);
    expect(firstEx.sets[0].previousLoadDisplay).toBe('—');
  });

  it('4. startWorkout loads previous session loads if available', async () => {
    // First save a session for Supino Reto com Barra
    await workoutRepo.saveWorkoutSession(
      {
        routineName: 'Treino Teste',
        date: '2026-11-01',
        durationMinutes: 45,
        totalVolumeKg: 2400,
      },
      [
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
          weightKg: 85,
          reps: 8,
          completed: true,
        },
      ]
    );

    const routineA = manager.routines.find((r) => r.id === 'routine-abc-a')!;
    await manager.startWorkout(routineA);

    const supino = manager.activeSession!.exercises.find((e) => e.name === 'Supino Reto com Barra')!;
    expect(supino).toBeDefined();
    expect(supino.sets[0].weightKg).toBe(80);
    expect(supino.sets[0].reps).toBe(10);
    expect(supino.sets[0].previousLoadDisplay).toBe('80kg × 10');
    expect(supino.sets[1].weightKg).toBe(85);
    expect(supino.sets[1].reps).toBe(8);
    expect(supino.sets[1].previousLoadDisplay).toBe('85kg × 8');
  });

  it('5. startFreestyleWorkout creates empty session and allows dynamic exercises', async () => {
    manager.startFreestyleWorkout('Treino de Sábado');
    expect(manager.activeSession?.routineName).toBe('Treino de Sábado');
    expect(manager.activeSession?.exercises.length).toBe(0);

    await manager.addExerciseToActiveWorkout({
      name: 'Barra Fixa',
      muscleGroup: 'Costas',
      targetSets: 3,
      defaultRestSeconds: 90,
    });

    expect(manager.activeSession?.exercises.length).toBe(1);
    expect(manager.activeSession?.exercises[0].name).toBe('Barra Fixa');
    expect(manager.activeSession?.exercises[0].sets.length).toBe(3);
  });

  it('6. updateSet, addSet, and removeSet manage set collection accurately', async () => {
    manager.startFreestyleWorkout();
    await manager.addExerciseToActiveWorkout({ name: 'Agachamento Livre', targetSets: 2 });

    // Update first set
    manager.updateSet(0, 0, { weightKg: 100, reps: 5 });
    expect(manager.activeSession!.exercises[0].sets[0].weightKg).toBe(100);
    expect(manager.activeSession!.exercises[0].sets[0].reps).toBe(5);

    // Add set
    manager.addSet(0);
    expect(manager.activeSession!.exercises[0].sets.length).toBe(3);
    const addedSet = manager.activeSession!.exercises[0].sets[2];
    expect(addedSet.setNumber).toBe(3);
    // Carried over from set 2
    expect(addedSet.weightKg).toBe(manager.activeSession!.exercises[0].sets[1].weightKg);

    // Remove set 1
    manager.removeSet(0, 1);
    expect(manager.activeSession!.exercises[0].sets.length).toBe(2);
    // Renumbered
    expect(manager.activeSession!.exercises[0].sets[0].setNumber).toBe(1);
    expect(manager.activeSession!.exercises[0].sets[1].setNumber).toBe(2);
  });

  it('7. completeSet marks completed, invokes haptics and starts rest timer', async () => {
    manager.startFreestyleWorkout();
    await manager.addExerciseToActiveWorkout({
      name: 'Supino Reto',
      targetSets: 2,
      defaultRestSeconds: 90,
    });

    manager.updateSet(0, 0, { weightKg: 80, reps: 10 });
    await manager.completeSet(0, 0);

    expect(manager.activeSession!.exercises[0].sets[0].completed).toBe(true);
    expect(mockHaptics.triggerSetComplete).toHaveBeenCalledTimes(1);

    expect(manager.restTimer.isActive).toBe(true);
    expect(manager.restTimer.remainingSeconds).toBe(90);
    expect(manager.restTimer.exerciseName).toBe('Supino Reto');
  });

  it('8. adjustRestTimer and skipRestTimer manipulate countdown', async () => {
    manager.startRestTimer(60, 'Supino');
    expect(manager.restTimer.remainingSeconds).toBe(60);

    manager.adjustRestTimer(30);
    expect(manager.restTimer.remainingSeconds).toBe(90);

    manager.adjustRestTimer(-45);
    expect(manager.restTimer.remainingSeconds).toBe(45);

    manager.adjustRestTimer(-50); // Clamped to 0 -> stops timer
    expect(manager.restTimer.isActive).toBe(false);

    manager.startRestTimer(60);
    manager.skipRestTimer();
    expect(manager.restTimer.isActive).toBe(false);
  });

  it('9. uncompleteSet toggles completed back to false', async () => {
    manager.startFreestyleWorkout();
    await manager.addExerciseToActiveWorkout({ name: 'Leg Press', targetSets: 1 });
    await manager.completeSet(0, 0);
    expect(manager.activeSession!.exercises[0].sets[0].completed).toBe(true);

    manager.uncompleteSet(0, 0);
    expect(manager.activeSession!.exercises[0].sets[0].completed).toBe(false);
  });

  it('10. pauseWorkout and resumeWorkout toggle pause state', () => {
    manager.startFreestyleWorkout();
    expect(manager.activeSession?.isPaused).toBe(false);

    manager.pauseWorkout();
    expect(manager.activeSession?.isPaused).toBe(true);

    manager.resumeWorkout();
    expect(manager.activeSession?.isPaused).toBe(false);
  });

  it('11. discardWorkout clears active session and stops timers', () => {
    manager.startFreestyleWorkout();
    manager.startRestTimer(90);

    manager.discardWorkout();

    expect(manager.activeSession).toBeNull();
    expect(manager.restTimer.isActive).toBe(false);
  });

  it('12. finishWorkout persists session and sets, clears active session, reloads history', async () => {
    manager.startFreestyleWorkout('Treino de Peito Finalizado');
    await manager.addExerciseToActiveWorkout({ name: 'Supino Reto', targetSets: 2 });

    manager.updateSet(0, 0, { weightKg: 100, reps: 8 });
    await manager.completeSet(0, 0); // 800 volume

    manager.updateSet(0, 1, { weightKg: 100, reps: 6 });
    await manager.completeSet(0, 1); // 600 volume -> 1400 total

    const saved = await manager.finishWorkout('Treino muito intenso');

    expect(saved.id).toBeDefined();
    expect(saved.totalVolumeKg).toBe(1400);
    expect(saved.notes).toBe('Treino muito intenso');
    expect(manager.activeSession).toBeNull();

    expect(manager.historySessions.length).toBeGreaterThanOrEqual(1);
    expect(manager.historySessions[0].id).toBe(saved.id);
  });

  it('13. loadExerciseHistory fetches progression points for specific exercise', async () => {
    await workoutRepo.saveWorkoutSession(
      {
        routineName: 'Treino A',
        date: '2026-11-01',
        durationMinutes: 50,
        totalVolumeKg: 1500,
      },
      [{ exerciseName: 'Terra', setNumber: 1, weightKg: 140, reps: 5, completed: true }]
    );

    const history = await manager.loadExerciseHistory('Terra');
    expect(history.length).toBe(1);
    expect(history[0].maxWeightKg).toBe(140);
    expect(manager.selectedExerciseHistory.length).toBe(1);
  });

  it('14. subscribe notifies on state change and unsubscribe cleans up', async () => {
    const listener = jest.fn();
    const unsub = manager.subscribe(listener);

    manager.startFreestyleWorkout();
    expect(listener).toHaveBeenCalled();

    unsub();
    listener.mockClear();
    manager.discardWorkout();
    expect(listener).not.toHaveBeenCalled();
  });

  it('15. error handling records failure message safely', async () => {
    const failingRepo: any = {
      getRoutines: jest.fn().mockRejectedValue(new Error('Falha no banco')),
    };
    const failManager = new WorkoutStateManager(failingRepo);
    await failManager.loadRoutines();

    expect(failManager.error).toBe('Falha no banco');
    expect(failManager.isLoading).toBe(false);
  });
});
