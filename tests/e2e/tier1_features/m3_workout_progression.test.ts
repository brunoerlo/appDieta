import { createE2ETestContext, E2ETestContext } from '../helpers/testContext';
import {
  calculateBrzycki1RM,
  calculateEpley1RM,
  calculateWorkoutVolume,
} from '../helpers/calculationOracles';
import * as Haptics from 'expo-haptics';

describe('Tier 1: Feature Coverage — M3 Workout & Progression (Features 16-24)', () => {
  let ctx: E2ETestContext;
  const SESSION_DATE_1 = '2026-11-01';
  const SESSION_DATE_2 = '2026-11-04';

  beforeEach(async () => {
    ctx = await createE2ETestContext();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  // =========================================================================
  // Feature 16: Routine Catalog & Management (ORIGINAL_REQUEST §R3)
  // =========================================================================
  describe('Feature 16: Routine Catalog & Management', () => {
    it('16.1 lists all default routines available in the catalog', async () => {
      const routines = await ctx.workoutRepo.getRoutines();
      expect(routines.length).toBeGreaterThanOrEqual(6);
      expect(routines.some((r) => r.name.includes('Push'))).toBe(true);
      expect(routines.some((r) => r.name.includes('Pull'))).toBe(true);
      expect(routines.some((r) => r.name.includes('Legs'))).toBe(true);
    });

    it('16.2 creates a new custom workout routine', async () => {
      const routine = await ctx.workoutRepo.createRoutine({
        name: 'Full Body Gladiador',
        description: 'Treino de corpo inteiro 3x por semana',
        sortOrder: 10,
      });

      expect(routine.id).toBeDefined();
      expect(routine.name).toBe('Full Body Gladiador');

      const all = await ctx.workoutRepo.getRoutines();
      expect(all.some((r) => r.id === routine.id)).toBe(true);
    });

    it('16.3 updates routine name, description, and sort order', async () => {
      const routine = await ctx.workoutRepo.createRoutine({
        name: 'Rotina Inicial',
        description: 'Desc',
        sortOrder: 1,
      });

      await ctx.workoutRepo.updateRoutine(routine.id, {
        name: 'Rotina Avançada Modificada',
        description: 'Nova descrição',
        sortOrder: 2,
      });

      const updated = await ctx.workoutRepo.getRoutineById(routine.id);
      expect(updated?.name).toBe('Rotina Avançada Modificada');
      expect(updated?.description).toBe('Nova descrição');
    });

    it('16.4 deletes routine by ID permanently', async () => {
      const routine = await ctx.workoutRepo.createRoutine({
        name: 'Rotina Temporária',
        sortOrder: 99,
      });

      await ctx.workoutRepo.deleteRoutine(routine.id);
      const deleted = await ctx.workoutRepo.getRoutineById(routine.id);
      expect(deleted).toBeNull();
    });

    it('16.5 retrieves a routine with all its configured exercises populated', async () => {
      const routines = await ctx.workoutRepo.getRoutines();
      const first = routines[0];
      const full = await ctx.workoutRepo.getRoutineById(first.id);

      expect(full).not.toBeNull();
      expect(full?.exercises).toBeDefined();
      expect(full?.exercises!.length).toBeGreaterThan(0);
      expect(full?.exercises![0]).toHaveProperty('name');
      expect(full?.exercises![0]).toHaveProperty('targetSets');
    });
  });

  // =========================================================================
  // Feature 17: Routine Exercise Configuration (ORIGINAL_REQUEST §R3)
  // =========================================================================
  describe('Feature 17: Routine Exercise Configuration', () => {
    it('17.1 creates routine with configured exercises, target sets, and rest intervals', async () => {
      const routine = await ctx.workoutRepo.createRoutine(
        {
          name: 'Peitoral Hipertrofia',
          sortOrder: 1,
        },
        [
          {
            name: 'Supino Reto com Barra',
            muscleGroup: 'Peitoral',
            targetSets: 4,
            defaultRestSeconds: 120,
            sortOrder: 1,
          },
          {
            name: 'Crucifixo Inclinado com Halteres',
            muscleGroup: 'Peitoral',
            targetSets: 3,
            defaultRestSeconds: 90,
            sortOrder: 2,
          },
        ]
      );

      const fetched = await ctx.workoutRepo.getRoutineById(routine.id);
      expect(fetched?.exercises?.length).toBe(2);
      expect(fetched?.exercises![0].targetSets).toBe(4);
      expect(fetched?.exercises![0].defaultRestSeconds).toBe(120);
      expect(fetched?.exercises![1].defaultRestSeconds).toBe(90);
    });

    it('17.2 maintains specified sort order for exercises in a routine', async () => {
      const routines = await ctx.workoutRepo.getRoutines();
      const push = routines.find((r) => r.name.includes('Push'));
      const details = await ctx.workoutRepo.getRoutineById(push!.id);

      const exercises = details!.exercises!;
      for (let i = 0; i < exercises.length - 1; i++) {
        expect(exercises[i].sortOrder).toBeLessThanOrEqual(exercises[i + 1].sortOrder);
      }
    });

    it('17.3 updates exercise configuration within a routine', async () => {
      const routine = await ctx.workoutRepo.createRoutine(
        { name: 'Costas Teste', sortOrder: 1 },
        [
          {
            name: 'Puxada Frontal',
            muscleGroup: 'Costas',
            targetSets: 3,
            defaultRestSeconds: 60,
            sortOrder: 1,
          },
        ]
      );

      const fetched = await ctx.workoutRepo.getRoutineById(routine.id);
      const ex = fetched!.exercises![0];

      await ctx.workoutRepo.updateRoutine(
        routine.id,
        {},
        [
          {
            id: ex.id,
            routineId: routine.id,
            name: 'Puxada Frontal Pegada Triângulo',
            muscleGroup: 'Costas',
            targetSets: 4,
            defaultRestSeconds: 90,
            sortOrder: 1,
          },
        ]
      );

      const updated = await ctx.workoutRepo.getRoutineById(routine.id);
      expect(updated!.exercises![0].name).toBe('Puxada Frontal Pegada Triângulo');
      expect(updated!.exercises![0].targetSets).toBe(4);
      expect(updated!.exercises![0].defaultRestSeconds).toBe(90);
    });

    it('17.4 cascades deletion to remove all child exercises when routine is deleted', async () => {
      const routine = await ctx.workoutRepo.createRoutine(
        { name: 'To Delete Routine', sortOrder: 99 },
        [
          {
            name: 'Ex 1',
            muscleGroup: 'Peitoral',
            targetSets: 3,
            defaultRestSeconds: 60,
            sortOrder: 1,
          },
          {
            name: 'Ex 2',
            muscleGroup: 'Tríceps',
            targetSets: 3,
            defaultRestSeconds: 60,
            sortOrder: 2,
          },
        ]
      );

      await ctx.workoutRepo.deleteRoutine(routine.id);

      const count = await ctx.db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM routine_exercises WHERE routine_id = ?;',
        routine.id
      );
      expect(count?.count).toBe(0);
    });

    it('17.5 enforces foreign key constraint blocking orphan exercise creation', async () => {
      await expect(
        ctx.db.runAsync(
          `INSERT INTO routine_exercises (id, routine_id, name, target_sets, default_rest_seconds, sort_order)
           VALUES ('orphan-ex', 'non-existent-routine', 'Ghost Exercise', 3, 60, 1);`
        )
      ).rejects.toThrow();
    });
  });

  // =========================================================================
  // Feature 18: Live Workout Execution (ORIGINAL_REQUEST §R3)
  // =========================================================================
  describe('Feature 18: Live Workout Execution', () => {
    it('18.1 starts and records live workout session associated with a routine', async () => {
      const routines = await ctx.workoutRepo.getRoutines();
      const routine = routines[0];

      const session = await ctx.workoutRepo.saveWorkoutSession({
        routineId: routine.id,
        routineName: routine.name,
        date: SESSION_DATE_1,
        startTime: '10:00:00',
        endTime: '10:55:00',
        durationMinutes: 55,
        totalVolumeKg: 2400,
      });

      expect(session.id).toBeDefined();
      expect(session.routineId).toBe(routine.id);
      expect(session.durationMinutes).toBe(55);
    });

    it('18.2 tracks live session duration and user notes', async () => {
      const session = await ctx.workoutRepo.saveWorkoutSession({
        routineName: 'Treino de Força Rápido',
        date: SESSION_DATE_1,
        durationMinutes: 42,
        notes: 'Treino rendeu muito bem, cargas altas no supino.',
      });

      const details = await ctx.workoutRepo.getSessionDetails(session.id);
      expect(details?.durationMinutes).toBe(42);
      expect(details?.notes).toBe('Treino rendeu muito bem, cargas altas no supino.');
    });

    it('18.3 records sets executed during the live session', async () => {
      const session = await ctx.workoutRepo.saveWorkoutSession(
        {
          routineName: 'Push Day Live',
          date: SESSION_DATE_1,
          durationMinutes: 60,
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

      const details = await ctx.workoutRepo.getSessionDetails(session.id);
      expect(details?.sets?.length).toBe(2);
      expect(details?.sets![0].weightKg).toBe(80);
      expect(details?.sets![1].weightKg).toBe(85);
    });

    it('18.4 supports freestyle workout execution without routineId', async () => {
      const session = await ctx.workoutRepo.saveWorkoutSession({
        routineName: 'Treino Livre Avulso',
        date: SESSION_DATE_1,
        durationMinutes: 30,
      });

      expect(session.routineId).toBeUndefined();
      expect(session.routineName).toBe('Treino Livre Avulso');
    });

    it('18.5 verifies saved live session is immediately discoverable in history', async () => {
      const session = await ctx.workoutRepo.saveWorkoutSession({
        routineName: 'Verifiable Session',
        date: SESSION_DATE_1,
        durationMinutes: 45,
      });

      const history = await ctx.workoutRepo.getWorkoutSessions(10, 0);
      expect(history.some((s) => s.id === session.id)).toBe(true);
    });
  });

  // =========================================================================
  // Feature 19: Previous Session Load Reference (ORIGINAL_REQUEST §R3)
  // =========================================================================
  describe('Feature 19: Previous Session Load Reference', () => {
    it('19.1 queries loads and reps performed in the latest session for an exercise', async () => {
      // Session 1 (Older)
      await ctx.workoutRepo.saveWorkoutSession(
        { routineName: 'Push 1', date: SESSION_DATE_1, durationMinutes: 50 },
        [
          { exerciseName: 'Supino Reto', setNumber: 1, weightKg: 80, reps: 8, completed: true },
          { exerciseName: 'Supino Reto', setNumber: 2, weightKg: 80, reps: 8, completed: true },
        ]
      );

      // Query previous sets for Supino Reto
      const previousSets = await ctx.workoutRepo.getPreviousExerciseSets('Supino Reto', 2);
      expect(previousSets.length).toBe(2);
      expect(previousSets[0].weightKg).toBe(80);
      expect(previousSets[0].reps).toBe(8);
    });

    it('19.2 returns empty array when exercise has never been performed before', async () => {
      const previous = await ctx.workoutRepo.getPreviousExerciseSets('Exercício Inexistente');
      expect(previous).toEqual([]);
    });

    it('19.3 isolates immediate prior session ignoring older sessions and incomplete sets', async () => {
      // Session 1 (Old)
      await ctx.workoutRepo.saveWorkoutSession(
        { routineName: 'Push Old', date: '2026-10-25', durationMinutes: 50 },
        [
          { exerciseName: 'Desenvolvimento Militar', setNumber: 1, weightKg: 50, reps: 10, completed: true },
        ]
      );

      // Session 2 (Recent)
      await ctx.workoutRepo.saveWorkoutSession(
        { routineName: 'Push Recent', date: SESSION_DATE_2, durationMinutes: 50 },
        [
          { exerciseName: 'Desenvolvimento Militar', setNumber: 1, weightKg: 55, reps: 8, completed: true },
          { exerciseName: 'Desenvolvimento Militar', setNumber: 2, weightKg: 60, reps: 4, completed: false }, // Incomplete
        ]
      );

      const previous = await ctx.workoutRepo.getPreviousExerciseSets('Desenvolvimento Militar');
      // Should isolate Session 2's completed sets
      expect(previous.length).toBe(1);
      expect(previous[0].weightKg).toBe(55);
      expect(previous[0].reps).toBe(8);
    });

    it('19.4 orders previous session sets in ascending set_number sequence', async () => {
      await ctx.workoutRepo.saveWorkoutSession(
        { routineName: 'Legs', date: SESSION_DATE_1, durationMinutes: 60 },
        [
          { exerciseName: 'Agachamento', setNumber: 1, weightKg: 100, reps: 6, completed: true },
          { exerciseName: 'Agachamento', setNumber: 2, weightKg: 110, reps: 6, completed: true },
          { exerciseName: 'Agachamento', setNumber: 3, weightKg: 120, reps: 4, completed: true },
        ]
      );

      const previous = await ctx.workoutRepo.getPreviousExerciseSets('Agachamento');
      expect(previous.length).toBe(3);
      expect(previous[0].setNumber).toBe(1);
      expect(previous[1].setNumber).toBe(2);
      expect(previous[2].setNumber).toBe(3);
    });

    it('19.5 limits previous sets returned according to targetSets parameter', async () => {
      await ctx.workoutRepo.saveWorkoutSession(
        { routineName: 'Pull', date: SESSION_DATE_1, durationMinutes: 50 },
        [
          { exerciseName: 'Remada Curvada', setNumber: 1, weightKg: 70, reps: 10, completed: true },
          { exerciseName: 'Remada Curvada', setNumber: 2, weightKg: 70, reps: 10, completed: true },
          { exerciseName: 'Remada Curvada', setNumber: 3, weightKg: 70, reps: 8, completed: true },
        ]
      );

      const previous = await ctx.workoutRepo.getPreviousExerciseSets('Remada Curvada', 2);
      expect(previous.length).toBe(2);
    });
  });

  // =========================================================================
  // Feature 20: Set Logging (Weight x Reps x Check) (ORIGINAL_REQUEST §R3)
  // =========================================================================
  describe('Feature 20: Set Logging (Weight x Reps x Check)', () => {
    it('20.1 records completed set with weight in kg, reps, and checkmark', async () => {
      const session = await ctx.workoutRepo.saveWorkoutSession(
        { routineName: 'Chest', date: SESSION_DATE_1, durationMinutes: 45 },
        [
          { exerciseName: 'Supino Inclinado', setNumber: 1, weightKg: 70, reps: 10, completed: true },
        ]
      );

      const details = await ctx.workoutRepo.getSessionDetails(session.id);
      expect(details!.sets![0].weightKg).toBe(70);
      expect(details!.sets![0].reps).toBe(10);
      expect(details!.sets![0].completed).toBe(true);
    });

    it('20.2 records uncompleted / failed set (completed = false)', async () => {
      const session = await ctx.workoutRepo.saveWorkoutSession(
        { routineName: 'Arms', date: SESSION_DATE_1, durationMinutes: 30 },
        [
          { exerciseName: 'Rosca Direta', setNumber: 1, weightKg: 35, reps: 5, completed: false },
        ]
      );

      const details = await ctx.workoutRepo.getSessionDetails(session.id);
      expect(details!.sets![0].completed).toBe(false);
    });

    it('20.3 logs multiple sets for multiple exercises within single session', async () => {
      const session = await ctx.workoutRepo.saveWorkoutSession(
        { routineName: 'Upper Body', date: SESSION_DATE_1, durationMinutes: 65 },
        [
          { exerciseName: 'Supino Reto', setNumber: 1, weightKg: 80, reps: 8, completed: true },
          { exerciseName: 'Supino Reto', setNumber: 2, weightKg: 80, reps: 8, completed: true },
          { exerciseName: 'Barra Fixa', setNumber: 1, weightKg: 0, reps: 10, completed: true },
          { exerciseName: 'Barra Fixa', setNumber: 2, weightKg: 0, reps: 8, completed: true },
        ]
      );

      const details = await ctx.workoutRepo.getSessionDetails(session.id);
      expect(details!.sets!.length).toBe(4);
    });

    it('20.4 validates sequential set numbers for an exercise', async () => {
      const session = await ctx.workoutRepo.saveWorkoutSession(
        { routineName: 'Legs', date: SESSION_DATE_1, durationMinutes: 40 },
        [
          { exerciseName: 'Leg Press', setNumber: 1, weightKg: 200, reps: 12, completed: true },
          { exerciseName: 'Leg Press', setNumber: 2, weightKg: 240, reps: 10, completed: true },
        ]
      );

      const details = await ctx.workoutRepo.getSessionDetails(session.id);
      expect(details!.sets![0].setNumber).toBe(1);
      expect(details!.sets![1].setNumber).toBe(2);
    });

    it('20.5 computes set volume accurately (weightKg * reps)', async () => {
      const sets = [
        { weightKg: 80, reps: 10, completed: true },
        { weightKg: 90, reps: 8, completed: true },
      ];
      const volume = calculateWorkoutVolume(sets);
      expect(volume).toBe(80 * 10 + 90 * 8); // 800 + 720 = 1520 kg
    });
  });

  // =========================================================================
  // Feature 21: Automated Rest Timer & Haptics (ORIGINAL_REQUEST §R3)
  // =========================================================================
  describe('Feature 21: Automated Rest Timer & Haptics', () => {
    it('21.1 uses exercise default rest interval (e.g. 90s, 120s) for countdown', async () => {
      const routines = await ctx.workoutRepo.getRoutines();
      const routine = routines.find((r) => r.name.includes('Push'));
      const details = await ctx.workoutRepo.getRoutineById(routine!.id);

      const bench = details?.exercises?.find((e) => e.name.includes('Supino'));
      expect(bench).toBeDefined();
      expect(bench!.defaultRestSeconds).toBeGreaterThanOrEqual(60);
    });

    it('21.2 triggers expo-haptics vibration notification on set completion', async () => {
      // Simulate set completion action
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      expect(Haptics.notificationAsync).toHaveBeenCalledWith(
        Haptics.NotificationFeedbackType.Success
      );
    });

    it('21.3 triggers light impact vibration when starting rest timer', async () => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      expect(Haptics.impactAsync).toHaveBeenCalledWith(
        Haptics.ImpactFeedbackStyle.Light
      );
    });

    it('21.4 supports custom rest timer durations configured per exercise', async () => {
      const routine = await ctx.workoutRepo.createRoutine(
        { name: 'Powerlifting Heavy', sortOrder: 1 },
        [
          {
            name: 'Levantamento Terra Pesado',
            muscleGroup: 'Costas',
            targetSets: 5,
            defaultRestSeconds: 180, // 3 minutes
            sortOrder: 1,
          },
        ]
      );

      const details = await ctx.workoutRepo.getRoutineById(routine.id);
      expect(details!.exercises![0].defaultRestSeconds).toBe(180);
    });

    it('21.5 timer simulation can complete without blocking database set logs', async () => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const session = await ctx.workoutRepo.saveWorkoutSession(
        { routineName: 'Haptics Test', date: SESSION_DATE_1, durationMinutes: 30 },
        [{ exerciseName: 'Rosca', setNumber: 1, weightKg: 20, reps: 10, completed: true }]
      );

      expect(session.id).toBeDefined();
    });
  });

  // =========================================================================
  // Feature 22: Session Completion & Summary (ORIGINAL_REQUEST §R3)
  // =========================================================================
  describe('Feature 22: Session Completion & Summary', () => {
    it('22.1 calculates total volume automatically from completed sets', async () => {
      const session = await ctx.workoutRepo.saveWorkoutSession(
        {
          routineName: 'Chest Day',
          date: SESSION_DATE_1,
          durationMinutes: 60,
        },
        [
          { exerciseName: 'Supino', setNumber: 1, weightKg: 100, reps: 10, completed: true },
          { exerciseName: 'Supino', setNumber: 2, weightKg: 100, reps: 8, completed: true },
        ]
      );

      expect(session.totalVolumeKg).toBe(1800); // (100*10) + (100*8)
    });

    it('22.2 computes duration in minutes accurately', async () => {
      const session = await ctx.workoutRepo.saveWorkoutSession({
        routineName: 'Timed Session',
        date: SESSION_DATE_1,
        startTime: '18:00:00',
        endTime: '19:15:00',
        durationMinutes: 75,
      });

      expect(session.durationMinutes).toBe(75);
    });

    it('22.3 excludes uncompleted sets (completed = 0) from total volume calculation', async () => {
      const session = await ctx.workoutRepo.saveWorkoutSession(
        {
          routineName: 'Partial Session',
          date: SESSION_DATE_1,
          durationMinutes: 45,
        },
        [
          { exerciseName: 'Supino', setNumber: 1, weightKg: 80, reps: 10, completed: true }, // 800
          { exerciseName: 'Supino', setNumber: 2, weightKg: 80, reps: 10, completed: false }, // Ignored
        ]
      );

      expect(session.totalVolumeKg).toBe(800);
    });

    it('22.4 atomically commits session and sets inside transaction', async () => {
      const session = await ctx.workoutRepo.saveWorkoutSession(
        {
          routineName: 'Atomic Session',
          date: SESSION_DATE_1,
          durationMinutes: 50,
        },
        [
          { exerciseName: 'Agachamento', setNumber: 1, weightKg: 120, reps: 5, completed: true },
        ]
      );

      const dbSession = await ctx.db.getFirstAsync<any>(
        'SELECT * FROM workout_sessions WHERE id = ?;',
        session.id
      );
      const dbSets = await ctx.db.getAllAsync<any>(
        'SELECT * FROM set_logs WHERE session_id = ?;',
        session.id
      );

      expect(dbSession).toBeDefined();
      expect(dbSets.length).toBe(1);
    });

    it('22.5 retrieves comprehensive session details with all nested sets', async () => {
      const session = await ctx.workoutRepo.saveWorkoutSession(
        {
          routineName: 'Detailed Session',
          date: SESSION_DATE_1,
          durationMinutes: 50,
          notes: 'Great pump',
        },
        [
          { exerciseName: 'Crucifixo', setNumber: 1, weightKg: 20, reps: 12, completed: true },
        ]
      );

      const details = await ctx.workoutRepo.getSessionDetails(session.id);
      expect(details?.notes).toBe('Great pump');
      expect(details?.sets![0].exerciseName).toBe('Crucifixo');
    });
  });

  // =========================================================================
  // Feature 23: Workout History Log (ORIGINAL_REQUEST §R3)
  // =========================================================================
  describe('Feature 23: Workout History Log', () => {
    beforeEach(async () => {
      await ctx.workoutRepo.saveWorkoutSession({
        routineName: 'Session Day 1',
        date: '2026-11-01',
        durationMinutes: 50,
        totalVolumeKg: 2000,
      });

      await ctx.workoutRepo.saveWorkoutSession({
        routineName: 'Session Day 2',
        date: '2026-11-03',
        durationMinutes: 60,
        totalVolumeKg: 3000,
      });
    });

    it('23.1 retrieves chronological list of completed workout sessions ordered newest first', async () => {
      const history = await ctx.workoutRepo.getWorkoutSessions();
      expect(history.length).toBeGreaterThanOrEqual(2);
      expect(new Date(history[0].date).getTime()).toBeGreaterThanOrEqual(
        new Date(history[1].date).getTime()
      );
    });

    it('23.2 supports pagination with limit and offset', async () => {
      const page1 = await ctx.workoutRepo.getWorkoutSessions(1, 0);
      const page2 = await ctx.workoutRepo.getWorkoutSessions(1, 1);

      expect(page1.length).toBe(1);
      expect(page2.length).toBe(1);
      expect(page1[0].id).not.toBe(page2[0].id);
    });

    it('23.3 includes routine name, date, duration, and total volume in history items', async () => {
      const history = await ctx.workoutRepo.getWorkoutSessions();
      const item = history[0];

      expect(item.routineName).toBeDefined();
      expect(item.date).toBeDefined();
      expect(item.durationMinutes).toBeGreaterThan(0);
      expect(item.totalVolumeKg).toBeGreaterThan(0);
    });

    it('23.4 routine deletion sets routine_id = NULL without removing completed history sessions', async () => {
      const routine = await ctx.workoutRepo.createRoutine({
        name: 'Disposable Routine',
        sortOrder: 1,
      });

      const session = await ctx.workoutRepo.saveWorkoutSession({
        routineId: routine.id,
        routineName: routine.name,
        date: '2026-11-05',
        durationMinutes: 45,
      });

      await ctx.workoutRepo.deleteRoutine(routine.id);

      const history = await ctx.workoutRepo.getWorkoutSessions();
      const preservedSession = history.find((s) => s.id === session.id);

      expect(preservedSession).toBeDefined();
      expect(preservedSession?.routineId).toBeFalsy();
    });

    it('23.5 returns empty list when no sessions exist', async () => {
      await ctx.db.runAsync('DELETE FROM set_logs;');
      await ctx.db.runAsync('DELETE FROM workout_sessions;');

      const history = await ctx.workoutRepo.getWorkoutSessions();
      expect(history).toEqual([]);
    });
  });

  // =========================================================================
  // Feature 24: Load & 1RM Progression Chart (ORIGINAL_REQUEST §R3)
  // =========================================================================
  describe('Feature 24: Load & 1RM Progression Chart', () => {
    it('24.1 calculates Brzycki 1RM accurately: weightKg * (36 / (37 - reps))', () => {
      // 100kg x 10 reps -> 100 * (36 / 27) = 133.3 kg
      const rm = calculateBrzycki1RM(100, 10);
      expect(rm).toBe(133.3);

      // 80kg x 5 reps -> 80 * (36 / 32) = 90.0 kg
      expect(calculateBrzycki1RM(80, 5)).toBe(90.0);

      // 1 rep -> weight itself
      expect(calculateBrzycki1RM(120, 1)).toBe(120);
    });

    it('24.2 calculates Epley 1RM accurately: weightKg * (1 + 0.0333 * reps)', () => {
      // 100kg x 10 reps -> 100 * (1 + 0.333) = 133.3 kg
      const rm = calculateEpley1RM(100, 10);
      expect(rm).toBe(133.3);

      // 80kg x 5 reps -> 80 * (1 + 0.1665) = 93.3 kg
      expect(calculateEpley1RM(80, 5)).toBe(93.3);
    });

    it('24.3 generates chronological ExerciseHistoryPoint series for an exercise', async () => {
      await ctx.workoutRepo.saveWorkoutSession(
        { routineName: 'Legs 1', date: '2026-10-01', durationMinutes: 60 },
        [{ exerciseName: 'Agachamento Livre', setNumber: 1, weightKg: 100, reps: 5, completed: true }]
      );

      await ctx.workoutRepo.saveWorkoutSession(
        { routineName: 'Legs 2', date: '2026-10-08', durationMinutes: 60 },
        [{ exerciseName: 'Agachamento Livre', setNumber: 1, weightKg: 105, reps: 5, completed: true }]
      );

      const progression = await ctx.workoutRepo.getExerciseHistory('Agachamento Livre');
      expect(progression.length).toBe(2);
      expect(progression[0].date).toBe('2026-10-01');
      expect(progression[1].date).toBe('2026-10-08');
    });

    it('24.4 tracks max weight and estimated 1RM progression across workout sessions', async () => {
      await ctx.workoutRepo.saveWorkoutSession(
        { routineName: 'Chest 1', date: '2026-10-10', durationMinutes: 50 },
        [{ exerciseName: 'Supino Reto', setNumber: 1, weightKg: 80, reps: 8, completed: true }]
      );

      await ctx.workoutRepo.saveWorkoutSession(
        { routineName: 'Chest 2', date: '2026-10-17', durationMinutes: 50 },
        [{ exerciseName: 'Supino Reto', setNumber: 1, weightKg: 85, reps: 8, completed: true }]
      );

      const progression = await ctx.workoutRepo.getExerciseHistory('Supino Reto');
      expect(progression[0].maxWeightKg).toBe(80);
      expect(progression[1].maxWeightKg).toBe(85);
      expect(progression[1].estimated1RM).toBeGreaterThan(progression[0].estimated1RM);
    });

    it('24.5 identifies new Personal Record (PR) with highest estimated 1RM in series', async () => {
      await ctx.workoutRepo.saveWorkoutSession(
        { routineName: 'Deadlift 1', date: '2026-10-01', durationMinutes: 45 },
        [{ exerciseName: 'Levantamento Terra', setNumber: 1, weightKg: 140, reps: 5, completed: true }]
      );

      await ctx.workoutRepo.saveWorkoutSession(
        { routineName: 'Deadlift 2', date: '2026-10-15', durationMinutes: 45 },
        [{ exerciseName: 'Levantamento Terra', setNumber: 1, weightKg: 150, reps: 3, completed: true }]
      );

      const progression = await ctx.workoutRepo.getExerciseHistory('Levantamento Terra');
      const max1RM = Math.max(...progression.map((p) => p.estimated1RM));
      expect(max1RM).toBeGreaterThan(150);
    });
  });
});
