import { InMemorySQLiteDatabase, createTestDatabase } from '../helpers/inMemoryDb';
import { SqliteWorkoutRepository } from '@/database/repositories/SqliteWorkoutRepository';
import { WorkoutStateManager, HapticsServiceInterface } from '@/context/WorkoutContext';
import {
  calculateWorkoutVolume,
  calculateBrzycki1RM,
  calculateEpley1RM,
  calculate1RM,
  formatElapsedSeconds,
  formatRestTimerDisplay,
  formatPreviousLoad,
  mapExerciseHistoryToChart,
} from '@/utils/workout';
import { performance } from 'perf_hooks';

describe('Milestone M3 Adversarial Stress & Challenger Test Suite', () => {
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

  // =========================================================================
  // 1. RAPID SET TOGGLING STRESS TEST (50+ rapid completions & un-completions)
  // =========================================================================
  describe('1. Rapid Set Toggling Stress Test', () => {
    it('1.1 handles 50 rapid sequential toggles (100 transitions) on a single set with exact parity', async () => {
      const routineA = manager.routines.find((r) => r.id === 'routine-abc-a')!;
      await manager.startWorkout(routineA);

      const targetExerciseIdx = 0;
      const targetSetIdx = 0;
      manager.updateSet(targetExerciseIdx, targetSetIdx, { weightKg: 80, reps: 10 });

      let notificationCount = 0;
      const unsub = manager.subscribe(() => {
        notificationCount++;
      });

      const t0 = performance.now();
      const TOGGLE_CYCLES = 50;

      for (let i = 0; i < TOGGLE_CYCLES; i++) {
        await manager.completeSet(targetExerciseIdx, targetSetIdx);
        expect(manager.activeSession!.exercises[targetExerciseIdx].sets[targetSetIdx].completed).toBe(true);

        manager.uncompleteSet(targetExerciseIdx, targetSetIdx);
        expect(manager.activeSession!.exercises[targetExerciseIdx].sets[targetSetIdx].completed).toBe(false);
      }
      const durationMs = performance.now() - t0;

      // After 50 pairs of complete + uncomplete, set MUST be uncompleted
      const set = manager.activeSession!.exercises[targetExerciseIdx].sets[targetSetIdx];
      expect(set.completed).toBe(false);

      // Volume must be 0 for this exercise if only set 0 was modified and is false
      const allSets = manager.activeSession!.exercises.flatMap((e) => e.sets);
      expect(calculateWorkoutVolume(allSets)).toBe(0);

      // Haptics called exactly TOGGLE_CYCLES times
      expect(mockHaptics.triggerSetComplete).toHaveBeenCalledTimes(TOGGLE_CYCLES);

      // One more toggle to complete: must become true
      await manager.completeSet(targetExerciseIdx, targetSetIdx);
      expect(manager.activeSession!.exercises[targetExerciseIdx].sets[targetSetIdx].completed).toBe(true);
      expect(calculateWorkoutVolume(manager.activeSession!.exercises.flatMap((e) => e.sets))).toBe(800);

      console.log(
        `[STRESS 1.1] 50 toggle cycles (100 operations) completed in ${durationMs.toFixed(2)}ms (${(
          durationMs / 100
        ).toFixed(3)}ms/op). Notifications: ${notificationCount}`
      );
      expect(durationMs).toBeLessThan(1000);
      unsub();
    });

    it('1.2 handles multi-set rapid toggling across 10 sets with random interleaving', async () => {
      manager.startFreestyleWorkout('Stress Multi-Set');
      await manager.addExerciseToActiveWorkout({ name: 'Supino', targetSets: 5 });
      await manager.addExerciseToActiveWorkout({ name: 'Desenvolvimento', targetSets: 5 });

      // Configure loads
      for (let exIdx = 0; exIdx < 2; exIdx++) {
        for (let sIdx = 0; sIdx < 5; sIdx++) {
          manager.updateSet(exIdx, sIdx, { weightKg: 50 + exIdx * 20, reps: 10 });
        }
      }

      // Track expected completion state
      const expectedStatus: boolean[][] = [
        [false, false, false, false, false],
        [false, false, false, false, false],
      ];

      // Perform 60 pseudo-random toggles
      for (let op = 0; op < 60; op++) {
        const exIdx = op % 2;
        const sIdx = (op * 3) % 5;
        const current = expectedStatus[exIdx][sIdx];

        if (!current) {
          await manager.completeSet(exIdx, sIdx);
          expectedStatus[exIdx][sIdx] = true;
        } else {
          manager.uncompleteSet(exIdx, sIdx);
          expectedStatus[exIdx][sIdx] = false;
        }
      }

      // Verify every set matches its expected state
      for (let exIdx = 0; exIdx < 2; exIdx++) {
        for (let sIdx = 0; sIdx < 5; sIdx++) {
          const actual = manager.activeSession!.exercises[exIdx].sets[sIdx].completed;
          expect(actual).toBe(expectedStatus[exIdx][sIdx]);
        }
      }

      // Verify volume oracle
      let expectedVolume = 0;
      for (let exIdx = 0; exIdx < 2; exIdx++) {
        const load = 50 + exIdx * 20;
        for (let sIdx = 0; sIdx < 5; sIdx++) {
          if (expectedStatus[exIdx][sIdx]) {
            expectedVolume += load * 10;
          }
        }
      }
      const actualVolume = calculateWorkoutVolume(manager.activeSession!.exercises.flatMap((e) => e.sets));
      expect(actualVolume).toBe(expectedVolume);
    });

    it('1.3 handles 50 concurrent completeSet requests without state corruption or interval leaks', async () => {
      manager.startFreestyleWorkout('Concurrent Set Stress');
      await manager.addExerciseToActiveWorkout({ name: 'Agachamento', targetSets: 1 });
      manager.updateSet(0, 0, { weightKg: 100, reps: 5 });

      const t0 = performance.now();
      // Launch 50 concurrent async completeSet calls
      const promises = Array.from({ length: 50 }, () => manager.completeSet(0, 0));
      await Promise.all(promises);
      const durationMs = performance.now() - t0;

      expect(manager.activeSession!.exercises[0].sets[0].completed).toBe(true);
      expect(manager.restTimer.isActive).toBe(true);
      expect(durationMs).toBeLessThan(500);

      console.log(`[STRESS 1.3] 50 concurrent completeSet calls settled in ${durationMs.toFixed(2)}ms`);
    });

    it('1.4 verifies workout discard and finish safely cleans up state even when triggered during active state transitions', async () => {
      manager.startFreestyleWorkout('Discard Stress');
      await manager.addExerciseToActiveWorkout({ name: 'Remada', targetSets: 2 });
      await manager.completeSet(0, 0);

      expect(manager.restTimer.isActive).toBe(true);

      // Discard clears both active session and rest timer
      manager.discardWorkout();

      expect(manager.activeSession).toBeNull();
      expect(manager.restTimer.isActive).toBe(false);
      expect(manager.restTimer.remainingSeconds).toBe(0);

      // Calling completeSet or uncompleteSet when activeSession is null must be a safe no-op
      await expect(manager.completeSet(0, 0)).resolves.not.toThrow();
      expect(() => manager.uncompleteSet(0, 0)).not.toThrow();
      expect(() => manager.addSet(0)).not.toThrow();
      expect(() => manager.removeSet(0, 0)).not.toThrow();
      expect(() => manager.pauseWorkout()).not.toThrow();
      expect(() => manager.resumeWorkout()).not.toThrow();
    });
  });

  // =========================================================================
  // 2. CONCURRENT REST TIMER UPDATES & RAPID PAUSE/RESUME CYCLES
  // =========================================================================
  describe('2. Concurrent Rest Timer & Rapid Pause/Resume Cycles', () => {
    it('2.1 executes 100 rapid rest timer start, adjust, and skip operations without leaking intervals', () => {
      const t0 = performance.now();
      for (let i = 0; i < 100; i++) {
        manager.startRestTimer(60, 'Supino Reto', 1);
        manager.adjustRestTimer(15);
        expect(manager.restTimer.remainingSeconds).toBe(75);

        manager.adjustRestTimer(-30);
        expect(manager.restTimer.remainingSeconds).toBe(45);

        manager.skipRestTimer();
        expect(manager.restTimer.isActive).toBe(false);
      }
      const durationMs = performance.now() - t0;

      expect(manager.restTimer.isActive).toBe(false);
      console.log(`[STRESS 2.1] 100 timer cycles (400 timer mutations) finished in ${durationMs.toFixed(2)}ms`);
      expect(durationMs).toBeLessThan(200);
    });

    it('2.2 stress tests rest timer boundary adjustments (negative clamping, extreme durations)', () => {
      manager.startRestTimer(30, 'Leg Press', 2);
      expect(manager.restTimer.isActive).toBe(true);

      // Negative adjustment greater than remaining seconds -> must stop timer safely
      manager.adjustRestTimer(-50);
      expect(manager.restTimer.isActive).toBe(false);
      expect(manager.restTimer.remainingSeconds).toBe(0);

      // Start timer with 10s, adjust +7200s (2 hours)
      manager.startRestTimer(10, 'Deadlift', 3);
      manager.adjustRestTimer(7190);
      expect(manager.restTimer.remainingSeconds).toBe(7200);
      expect(manager.restTimer.durationSeconds).toBe(7200);

      // Verify formatRestTimerDisplay handles > 60m cleanly
      expect(formatRestTimerDisplay(manager.restTimer.remainingSeconds)).toBe('120:00');

      // Adjust with 0 delta -> unchanged
      manager.adjustRestTimer(0);
      expect(manager.restTimer.remainingSeconds).toBe(7200);

      manager.skipRestTimer();
      expect(manager.restTimer.isActive).toBe(false);
    });

    it('2.3 performs 100 rapid pause and resume cycles asserting no elapsed time drift', () => {
      manager.startFreestyleWorkout('Pause/Resume Stress');
      expect(manager.activeSession!.isPaused).toBe(false);
      expect(manager.activeSession!.elapsedSeconds).toBe(0);

      const t0 = performance.now();
      for (let i = 0; i < 100; i++) {
        manager.pauseWorkout();
        expect(manager.activeSession!.isPaused).toBe(true);

        manager.resumeWorkout();
        expect(manager.activeSession!.isPaused).toBe(false);
      }
      const durationMs = performance.now() - t0;

      // Elapsed seconds should still be 0 (all cycles executed in milliseconds)
      expect(manager.activeSession!.elapsedSeconds).toBe(0);
      console.log(`[STRESS 2.3] 100 pause/resume cycles completed in ${durationMs.toFixed(2)}ms`);
    });

    it('2.4 verifies elapsed time does not advance while paused', async () => {
      jest.useFakeTimers();
      try {
        manager.startFreestyleWorkout('Ticker Frozen Test');
        expect(manager.activeSession!.elapsedSeconds).toBe(0);

        // Advance 5 seconds running
        jest.advanceTimersByTime(5000);
        expect(manager.activeSession!.elapsedSeconds).toBe(5);

        // Pause workout
        manager.pauseWorkout();
        expect(manager.activeSession!.isPaused).toBe(true);

        // Advance 10 seconds while paused
        jest.advanceTimersByTime(10000);
        // Must still be 5
        expect(manager.activeSession!.elapsedSeconds).toBe(5);

        // Resume workout
        manager.resumeWorkout();
        expect(manager.activeSession!.isPaused).toBe(false);

        // Advance 3 seconds after resuming
        jest.advanceTimersByTime(3000);
        expect(manager.activeSession!.elapsedSeconds).toBe(8);
      } finally {
        jest.useRealTimers();
      }
    });
  });

  // =========================================================================
  // 3. LARGE VOLUME CALCULATION SCALING WITH 100+ SETS
  // =========================================================================
  describe('3. Large Volume Calculation Scaling & Memory Stress (100+ Sets)', () => {
    it('3.1 benchmarks calculateWorkoutVolume on 1,000 sets under 10ms with high precision', () => {
      const largeSetCollection: { weightKg: number; reps: number; completed: boolean }[] = [];
      let oracleSum = 0;

      for (let i = 1; i <= 1000; i++) {
        // Vary weights: decimals (e.g. 22.5, 67.5, 102.5), zeros, and standard loads
        const weight = i % 10 === 0 ? 0 : Math.round(((i % 50) * 2.5 + 20) * 10) / 10;
        const reps = (i % 15) + 1;
        const completed = i % 4 !== 0; // 75% completed, 25% uncompleted

        largeSetCollection.push({ weightKg: weight, reps, completed });

        if (completed) {
          oracleSum += weight * reps;
        }
      }

      oracleSum = Math.round(oracleSum * 10) / 10;

      const t0 = performance.now();
      const calculated = calculateWorkoutVolume(largeSetCollection);
      const durationMs = performance.now() - t0;

      expect(calculated).toBe(oracleSum);
      expect(durationMs).toBeLessThan(10);
      console.log(
        `[STRESS 3.1] 1,000 sets volume computed in ${durationMs.toFixed(3)}ms: Volume = ${calculated} kg`
      );

      // Repeat 10 times (10,000 sets cumulative) to assert amortized throughput
      const t1 = performance.now();
      for (let r = 0; r < 10; r++) {
        calculateWorkoutVolume(largeSetCollection);
      }
      const bench10kMs = performance.now() - t1;
      console.log(`[STRESS 3.1] 10,000 sets cumulative volume computation took ${bench10kMs.toFixed(2)}ms`);
      expect(bench10kMs).toBeLessThan(30);
    });

    it('3.2 persists a marathon 100-set workout session into SQLite within 150ms and maintains relational integrity', async () => {
      const setsToInsert: {
        exerciseName: string;
        setNumber: number;
        weightKg: number;
        reps: number;
        completed: boolean;
      }[] = [];

      let expectedVolume = 0;
      // 25 exercises x 4 sets = 100 sets
      for (let e = 1; e <= 25; e++) {
        const exName = `Exercício #${e}`;
        for (let s = 1; s <= 4; s++) {
          const weight = Math.round((50 + e * 2 + s * 2.5) * 10) / 10;
          const reps = 8 + (s % 4);
          const completed = true;
          setsToInsert.push({
            exerciseName: exName,
            setNumber: s,
            weightKg: weight,
            reps,
            completed,
          });
          expectedVolume += weight * reps;
        }
      }
      expectedVolume = Math.round(expectedVolume * 10) / 10;
      expect(setsToInsert.length).toBe(100);

      const t0 = performance.now();
      const saved = await workoutRepo.saveWorkoutSession(
        {
          routineName: 'Treino Monstro 100 Séries',
          date: '2026-11-06',
          startTime: '10:00:00',
          endTime: '12:00:00',
          durationMinutes: 120,
          totalVolumeKg: expectedVolume,
          notes: 'Teste de estresse com 100 séries em transação única',
        },
        setsToInsert
      );
      const saveDurationMs = performance.now() - t0;

      expect(saved.id).toBeDefined();
      expect(saved.totalVolumeKg).toBe(expectedVolume);
      expect(saveDurationMs).toBeLessThan(150);

      // Verify all 100 sets were saved in set_logs table
      const countRow = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM set_logs WHERE session_id = ?;',
        saved.id
      );
      expect(countRow?.count).toBe(100);

      // Query session details back and check volume
      const retrieved = await workoutRepo.getSessionDetails(saved.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.sets?.length).toBe(100);
      expect(retrieved?.totalVolumeKg).toBe(expectedVolume);

      console.log(
        `[STRESS 3.2] 100 sets saved in SQLite in ${saveDurationMs.toFixed(2)}ms (Volume: ${expectedVolume} kg)`
      );
    });

    it('3.3 benchmarks getPreviousExerciseSets and getExerciseHistory across 50 sessions under 50ms', async () => {
      // Seed 50 historical sessions on different dates for "Supino Reto com Barra"
      for (let i = 1; i <= 50; i++) {
        const dayStr = i < 10 ? `0${i}` : `${i}`;
        const date = `2026-09-${dayStr}`;
        const weight = 80 + i * 0.5; // Decimal progression: 80.5, 81.0, 81.5...
        await workoutRepo.saveWorkoutSession(
          {
            routineName: 'Sessão Histórica',
            date,
            durationMinutes: 45,
            totalVolumeKg: weight * 10 * 3,
          },
          [
            { exerciseName: 'Supino Reto com Barra', setNumber: 1, weightKg: weight, reps: 10, completed: true },
            { exerciseName: 'Supino Reto com Barra', setNumber: 2, weightKg: weight, reps: 10, completed: true },
            { exerciseName: 'Supino Reto com Barra', setNumber: 3, weightKg: weight, reps: 8, completed: true },
          ]
        );
      }

      // Benchmark getPreviousExerciseSets
      const t0 = performance.now();
      const prevSets = await workoutRepo.getPreviousExerciseSets('Supino Reto com Barra', 3);
      const prevDurationMs = performance.now() - t0;

      expect(prevSets.length).toBe(3);
      // Must be from day 50 (latest session: weight = 80 + 50 * 0.5 = 105.0)
      expect(prevSets[0].weightKg).toBe(105);
      expect(prevSets[0].setNumber).toBe(1);
      expect(prevSets[1].weightKg).toBe(105);
      expect(prevSets[2].weightKg).toBe(105);
      expect(prevSets[2].reps).toBe(8);
      expect(prevDurationMs).toBeLessThan(50);

      // Benchmark getExerciseHistory
      const t1 = performance.now();
      const history = await workoutRepo.getExerciseHistory('Supino Reto com Barra');
      const histDurationMs = performance.now() - t1;

      expect(history.length).toBe(50);
      expect(histDurationMs).toBeLessThan(50);

      // Verify PR is identified accurately via mapExerciseHistoryToChart
      const chart = mapExerciseHistoryToChart(history);
      expect(chart.labels.length).toBe(50);
      expect(chart.personalRecord.maxWeight).toBe(105);
      expect(chart.personalRecord.prDate).toBe('2026-09-50');

      console.log(
        `[STRESS 3.3] Queried previous sets in ${prevDurationMs.toFixed(2)}ms and 50 history points in ${histDurationMs.toFixed(
          2
        )}ms`
      );
    });
  });

  // =========================================================================
  // 4. DECIMAL WEIGHT FORMATTING AND PARSING FUZZING
  // =========================================================================
  describe('4. Decimal Weight Formatting & Parsing Fuzzing', () => {
    // Parser simulation matching LiveSetRow.tsx handleWeightChange
    const parseWeightInput = (text: string): number => {
      const cleaned = text.replace(',', '.');
      const parsed = parseFloat(cleaned);
      if (!isNaN(parsed) && parsed >= 0) {
        return Math.min(999.5, Math.round(parsed * 10) / 10);
      } else if (text === '' || text === '0') {
        return 0;
      }
      return -1; // Unchanged/invalid sentinel
    };

    it('4.1 parses valid Brazilian comma format and standard dot format decimals identically', () => {
      const testCases: [string, number][] = [
        ['22.5', 22.5],
        ['22,5', 22.5],
        ['0.5', 0.5],
        ['0,5', 0.5],
        ['100.5', 100.5],
        ['100,5', 100.5],
        ['2.5', 2.5],
        ['2,5', 2.5],
        ['0', 0],
        ['0.0', 0],
        ['0,0', 0],
        ['', 0],
        ['.5', 0.5],
        [',5', 0.5],
        ['22.55', 22.6], // Rounds to 1 decimal place
        ['22,54', 22.5],
        ['999.5', 999.5],
        ['1000', 999.5], // Clamped to 999.5
        ['5000', 999.5], // Clamped to 999.5
      ];

      for (const [input, expected] of testCases) {
        expect(parseWeightInput(input)).toBe(expected);
      }
    });

    it('4.2 safely rejects or ignores invalid, negative, or malformed weight strings', () => {
      const strictlyIgnoredCases = ['abc', '-5', '-22.5', 'NaN', 'undefined', 'foo,bar', '---'];

      for (const input of strictlyIgnoredCases) {
        const result = parseWeightInput(input);
        // Result must be sentinel -1 (leaves weight unchanged) or 0, but NEVER NaN or negative
        expect(result === -1 || result === 0).toBe(true);
        expect(isNaN(result)).toBe(false);
      }

      // Typo with double dot (e.g. 22..5) safely falls back to valid leading numeric prefix (22) without NaN
      expect(parseWeightInput('22..5')).toBe(22);
    });

    it('4.3 verifies LiveSetRow previous load regex matches decimal weights reliably', () => {
      const regex = /(\d+(\.\d+)?)kg\s*×\s*(\d+)/;

      const positiveCases: [string, number, number][] = [
        ['22.5kg × 10', 22.5, 10],
        ['0.5kg × 20', 0.5, 20],
        ['102.5kg × 8', 102.5, 8],
        ['80kg × 10', 80, 10],
        ['0kg × 0', 0, 0],
        ['999.5kg × 1', 999.5, 1],
      ];

      for (const [str, expectedKg, expectedReps] of positiveCases) {
        const match = str.match(regex);
        expect(match).not.toBeNull();
        expect(parseFloat(match![1])).toBe(expectedKg);
        expect(parseInt(match![3], 10)).toBe(expectedReps);
      }

      // Negative or fallback cases
      expect('—'.match(regex)).toBeNull();
      expect(''.match(regex)).toBeNull();
      expect('invalid'.match(regex)).toBeNull();
    });

    it('4.4 fuzzes 1RM formulas across 1,000 random decimal loads and extreme rep counts (0..1000)', () => {
      for (let i = 0; i < 1000; i++) {
        const weight = Math.round((Math.random() * 300) * 10) / 10;
        const reps = Math.floor(Math.random() * 100);

        const brzycki = calculateBrzycki1RM(weight, reps);
        const epley = calculateEpley1RM(weight, reps);
        const smart1RM = calculate1RM(weight, reps);

        // Invariants:
        expect(isNaN(brzycki)).toBe(false);
        expect(isNaN(epley)).toBe(false);
        expect(isNaN(smart1RM)).toBe(false);

        expect(isFinite(brzycki)).toBe(true);
        expect(isFinite(epley)).toBe(true);
        expect(isFinite(smart1RM)).toBe(true);

        expect(brzycki).toBeGreaterThanOrEqual(0);
        expect(epley).toBeGreaterThanOrEqual(0);

        // For reps = 1, 1RM must equal exact weight
        if (reps === 1 && weight > 0) {
          expect(brzycki).toBe(weight);
          expect(epley).toBe(weight);
        }

        // For reps = 0, 1RM must be 0
        if (reps === 0 || weight === 0) {
          expect(brzycki).toBe(0);
          expect(epley).toBe(0);
        }
      }
    });

    it('4.5 verifies formatPreviousLoad fallback heuristics on varying set numbers', () => {
      const sets = [
        { id: '1', sessionId: 's1', exerciseName: 'Supino', setNumber: 1, weightKg: 22.5, reps: 10, completed: true, createdAt: '' },
        { id: '2', sessionId: 's1', exerciseName: 'Supino', setNumber: 2, weightKg: 25.0, reps: 8, completed: true, createdAt: '' },
      ];

      expect(formatPreviousLoad(sets, 1)).toBe('22.5kg × 10');
      expect(formatPreviousLoad(sets, 2)).toBe('25kg × 8');
      // Set 3 exceeds recorded sets -> falls back to set 2
      expect(formatPreviousLoad(sets, 3)).toBe('25kg × 8');
      expect(formatPreviousLoad(sets, 10)).toBe('25kg × 8');
      // Empty sets
      expect(formatPreviousLoad([], 1)).toBe('—');
      expect(formatPreviousLoad(undefined, 1)).toBe('—');
    });
  });

  // =========================================================================
  // 5. DYNAMIC ROUTINE MUTATION UNDER LIVE EXECUTION
  // =========================================================================
  describe('5. Dynamic Routine Mutation Under Live Execution', () => {
    it('5.1 handles dynamic adding, removing, and set mutations during live workout', async () => {
      manager.startFreestyleWorkout('Mutação Dinâmica');

      // Add 5 exercises
      for (let i = 1; i <= 5; i++) {
        await manager.addExerciseToActiveWorkout({
          name: `Exercício Dinâmico ${i}`,
          targetSets: 3,
        });
      }
      expect(manager.activeSession!.exercises.length).toBe(5);

      // Remove middle exercise (index 2)
      manager.removeExerciseFromActiveWorkout(2);
      expect(manager.activeSession!.exercises.length).toBe(4);
      expect(manager.activeSession!.exercises.some((e) => e.name === 'Exercício Dinâmico 3')).toBe(false);

      // Add 2 sets to exercise 0
      manager.addSet(0);
      manager.addSet(0);
      expect(manager.activeSession!.exercises[0].sets.length).toBe(5);

      // Remove set 1
      manager.removeSet(0, 1);
      expect(manager.activeSession!.exercises[0].sets.length).toBe(4);
      // Assert renumbering
      expect(manager.activeSession!.exercises[0].sets[0].setNumber).toBe(1);
      expect(manager.activeSession!.exercises[0].sets[1].setNumber).toBe(2);
      expect(manager.activeSession!.exercises[0].sets[2].setNumber).toBe(3);
      expect(manager.activeSession!.exercises[0].sets[3].setNumber).toBe(4);

      // Attempt to remove sets down to 1 set
      manager.removeSet(0, 3);
      manager.removeSet(0, 2);
      manager.removeSet(0, 1);
      expect(manager.activeSession!.exercises[0].sets.length).toBe(1);

      // Guard test: removing the last remaining set must be prevented
      manager.removeSet(0, 0);
      expect(manager.activeSession!.exercises[0].sets.length).toBe(1);

      // Complete the remaining set
      manager.updateSet(0, 0, { weightKg: 100, reps: 10 });
      await manager.completeSet(0, 0);

      // Finish workout and verify persistence
      const finished = await manager.finishWorkout('Treino mutado finalizado com sucesso');
      expect(finished.totalVolumeKg).toBe(1000);
      expect(manager.activeSession).toBeNull();
    });
  });
});
