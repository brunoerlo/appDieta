import { InMemorySQLiteDatabase, createTestDatabase } from '../helpers/inMemoryDb';
import { SqliteWorkoutRepository } from '@/database/repositories/SqliteWorkoutRepository';
import { SqliteBodyRepository } from '@/database/repositories/SqliteBodyRepository';
import { SqliteAuthRepository } from '@/database/repositories/SqliteAuthRepository';
import { WorkoutStateManager, HapticsServiceInterface } from '@/context/WorkoutContext';
import { BodyStateManager } from '@/context/BodyContext';
import { ThemeStateManager } from '@/context/ThemeContext';
import { PhotoStorageService } from '@/services/PhotoStorageService';
import * as FileSystem from 'expo-file-system/legacy';
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
import {
  shiftDateString,
  calculateMovingAverageForDate,
  calculateBodyComposition,
  mapWeightHistoryToChart,
} from '@/utils/body';
import {
  calculatePhotoDeltaMetrics,
  extractPoseFromUri,
  getInitialComparisonIndices,
  resolvePhotoUri,
} from '@/utils/photoComparison';
import { performance } from 'perf_hooks';

describe('Tier 5 Adversarial & White-Box Hardening: Workout, Body, Storage & Theme', () => {
  let db: InMemorySQLiteDatabase;
  let workoutRepo: SqliteWorkoutRepository;
  let bodyRepo: SqliteBodyRepository;
  let authRepo: SqliteAuthRepository;
  let mockHaptics: HapticsServiceInterface;

  beforeEach(async () => {
    db = await createTestDatabase();
    workoutRepo = new SqliteWorkoutRepository(db);
    bodyRepo = new SqliteBodyRepository(db);
    authRepo = new SqliteAuthRepository(db);

    mockHaptics = {
      triggerSetComplete: jest.fn().mockResolvedValue(undefined),
      triggerTimerFinished: jest.fn().mockResolvedValue(undefined),
    };

    jest.clearAllMocks();
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  // =========================================================================
  // 1. 1RM MATHEMATICAL BOUNDARY EXTREMES & ASYMPTOTES
  // =========================================================================
  describe('1. 1RM Mathematical Boundary Extremes & Formula Invariants', () => {
    describe('1.1 Brzycki Formula Boundary Matrix (reps = 0, 1, 36, 37 singularity, 100, weight = 0)', () => {
      it('returns 0 when reps = 0 regardless of load', () => {
        expect(calculateBrzycki1RM(100, 0)).toBe(0);
        expect(calculateBrzycki1RM(250, 0)).toBe(0);
        expect(calculateBrzycki1RM(0, 0)).toBe(0);
      });

      it('returns 0 when weight = 0 regardless of reps', () => {
        expect(calculateBrzycki1RM(0, 1)).toBe(0);
        expect(calculateBrzycki1RM(0, 10)).toBe(0);
        expect(calculateBrzycki1RM(0, 37)).toBe(0);
      });

      it('returns 0 for negative inputs (negative weight or negative reps)', () => {
        expect(calculateBrzycki1RM(-50, 10)).toBe(0);
        expect(calculateBrzycki1RM(100, -5)).toBe(0);
        expect(calculateBrzycki1RM(-100, -10)).toBe(0);
      });

      it('returns exact weight without arithmetic distortion when reps = 1', () => {
        expect(calculateBrzycki1RM(100, 1)).toBe(100);
        expect(calculateBrzycki1RM(72.5, 1)).toBe(72.5);
        expect(calculateBrzycki1RM(495.25, 1)).toBe(495.3); // rounded to 1 decimal place
      });

      it('safely evaluates reps = 36 (safe clamp at reps=30 prevents negative denominator)', () => {
        // Brzycki clamps safeReps = Math.min(reps, 30)
        // 100 * (36 / (37 - 30)) = 100 * (36 / 7) = 514.2857... -> 514.3
        const val = calculateBrzycki1RM(100, 36);
        expect(val).toBe(514.3);
        expect(Number.isFinite(val)).toBe(true);
        expect(val).toBeGreaterThan(0);
      });

      it('safely handles Brzycki singularity at reps = 37 (denominator 37 - 37 = 0 avoided)', () => {
        // Classical Brzycki 36 / (37 - 37) is division by zero (Infinity).
        // Implementation guards by clamping reps to 30.
        const val = calculateBrzycki1RM(100, 37);
        expect(val).toBe(514.3);
        expect(Number.isFinite(val)).toBe(true);
        expect(val).not.toBe(Infinity);
        expect(val).not.toBeNaN();
      });

      it('safely handles extreme rep count (reps = 100) without negative 1RM or overflow', () => {
        const val = calculateBrzycki1RM(100, 100);
        expect(val).toBe(514.3);
        expect(Number.isFinite(val)).toBe(true);
        expect(val).toBeGreaterThan(0);
      });
    });

    describe('1.2 Epley Formula Boundary Matrix', () => {
      it('returns 0 when reps = 0 or weight = 0', () => {
        expect(calculateEpley1RM(100, 0)).toBe(0);
        expect(calculateEpley1RM(0, 10)).toBe(0);
        expect(calculateEpley1RM(-50, 10)).toBe(0);
        expect(calculateEpley1RM(100, -5)).toBe(0);
      });

      it('returns exact weight when reps = 1', () => {
        expect(calculateEpley1RM(100, 1)).toBe(100);
        expect(calculateEpley1RM(85.5, 1)).toBe(85.5);
      });

      it('scales linearly for high rep counts (reps = 37 and reps = 100)', () => {
        // 100 * (1 + 0.0333 * 37) = 100 * 2.2321 = 223.2
        expect(calculateEpley1RM(100, 37)).toBe(223.2);
        // 100 * (1 + 0.0333 * 100) = 100 * 4.33 = 433.0
        expect(calculateEpley1RM(100, 100)).toBe(433.0);
      });
    });

    describe('1.3 calculate1RM Dispatcher & Monotonicity Properties', () => {
      it('dispatches to chosen formula correctly across boundaries', () => {
        expect(calculate1RM(100, 1, 'brzycki')).toBe(100);
        expect(calculate1RM(100, 1, 'epley')).toBe(100);
        expect(calculate1RM(100, 10, 'brzycki')).toBe(133.3);
        expect(calculate1RM(100, 10, 'epley')).toBe(133.3);
      });

      it('preserves strict monotonic non-decreasing ordering as reps increase for both formulas', () => {
        const weight = 80;
        let prevBrzycki = 0;
        for (let reps = 1; reps <= 30; reps++) {
          const b = calculateBrzycki1RM(weight, reps);
          expect(b).toBeGreaterThanOrEqual(prevBrzycki);
          prevBrzycki = b;
        }

        let prevEpley = 0;
        for (let reps = 1; reps <= 50; reps++) {
          const e = calculateEpley1RM(weight, reps);
          expect(e).toBeGreaterThanOrEqual(prevEpley);
          prevEpley = e;
        }
      });
    });

    describe('1.4 Database Exercise History 1RM Calculation at Rep Boundaries', () => {
      it('calculates finite estimated1RM from database session with reps = 1, 37, and 100', async () => {
        const exerciseName = 'Adversarial Bench';

        // Session 1: 1 rep @ 120kg
        await workoutRepo.saveWorkoutSession({
          routineName: 'Boundary Session 1',
          date: '2026-11-01',
          durationMinutes: 30,
          sets: [
            {
              exerciseName,
              setNumber: 1,
              weightKg: 120,
              reps: 1,
              completed: true,
            },
          ],
        });

        // Session 2: 37 reps @ 60kg (singularity candidate)
        await workoutRepo.saveWorkoutSession({
          routineName: 'Boundary Session 2',
          date: '2026-11-02',
          durationMinutes: 40,
          sets: [
            {
              exerciseName,
              setNumber: 1,
              weightKg: 60,
              reps: 37,
              completed: true,
            },
          ],
        });

        // Session 3: 100 reps @ 20kg (ultra-high endurance)
        await workoutRepo.saveWorkoutSession({
          routineName: 'Boundary Session 3',
          date: '2026-11-03',
          durationMinutes: 45,
          sets: [
            {
              exerciseName,
              setNumber: 1,
              weightKg: 20,
              reps: 100,
              completed: true,
            },
          ],
        });

        const history = await workoutRepo.getExerciseHistory(exerciseName);
        expect(history.length).toBe(3);

        // Point 1: 1 rep -> estimated1RM equals best_weight = 120
        expect(history[0].estimated1RM).toBe(120);

        // Point 2: 37 reps clamped to 30 -> 60 * (36 / 7) = 308.6
        expect(history[1].estimated1RM).toBe(308.6);
        expect(Number.isFinite(history[1].estimated1RM)).toBe(true);

        // Point 3: 100 reps clamped to 30 -> 20 * (36 / 7) = 102.9
        expect(history[2].estimated1RM).toBe(102.9);
        expect(Number.isFinite(history[2].estimated1RM)).toBe(true);
      });
    });
  });

  // =========================================================================
  // 2. WORKOUT SESSIONS WITH ZERO SETS & DELETED ENTITIES
  // =========================================================================
  describe('2. Workout Sessions with Zero Sets & Deleted Routine/Exercise Entities', () => {
    it('2.1 successfully saves and retrieves a workout session with zero sets (sets = [])', async () => {
      const emptySession = await workoutRepo.saveWorkoutSession({
        routineName: 'Zero Sets Session',
        date: '2026-11-06',
        durationMinutes: 25,
        totalVolumeKg: 0,
        notes: 'Session ended early before any sets were performed',
        sets: [],
      });

      expect(emptySession.id).toBeDefined();
      expect(emptySession.totalVolumeKg).toBe(0);
      expect(emptySession.sets).toEqual([]);

      // Retrieve from list
      const sessions = await workoutRepo.getWorkoutSessions(10, 0);
      const retrieved = sessions.find((s) => s.id === emptySession.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.totalVolumeKg).toBe(0);
      expect(retrieved?.sets).toEqual([]);

      // Retrieve via getSessionDetails
      const details = await workoutRepo.getSessionDetails(emptySession.id);
      expect(details).not.toBeNull();
      expect(details?.sets).toEqual([]);
      expect(details?.durationMinutes).toBe(25);
    });

    it('2.2 maintains session history and sets when parent workout routine is deleted (ON DELETE SET NULL)', async () => {
      // 1. Create a custom routine
      const routine = await workoutRepo.createRoutine(
        { name: 'Rotina Temporária', description: 'Para ser deletada', sortOrder: 99 },
        [
          { name: 'Exercício Temp 1', muscleGroup: 'Costas', targetSets: 3, defaultRestSeconds: 60, sortOrder: 1 },
        ]
      );

      // 2. Execute a workout session referencing this routine
      const session = await workoutRepo.saveWorkoutSession({
        routineId: routine.id,
        routineName: routine.name,
        date: '2026-11-06',
        durationMinutes: 45,
        sets: [
          {
            exerciseId: routine.exercises![0].id,
            exerciseName: 'Exercício Temp 1',
            setNumber: 1,
            weightKg: 70,
            reps: 10,
            completed: true,
          },
          {
            exerciseId: routine.exercises![0].id,
            exerciseName: 'Exercício Temp 1',
            setNumber: 2,
            weightKg: 75,
            reps: 8,
            completed: true,
          },
        ],
      });

      expect(session.totalVolumeKg).toBe(70 * 10 + 75 * 8);

      // 3. Delete the routine
      await workoutRepo.deleteRoutine(routine.id);

      // Routine is gone from routines
      const deletedRoutine = await workoutRepo.getRoutineById(routine.id);
      expect(deletedRoutine).toBeNull();

      // 4. Verify session is preserved: routine_id is set to null, routine_name preserved, sets intact
      const savedSession = await workoutRepo.getSessionDetails(session.id);
      expect(savedSession).not.toBeNull();
      expect(savedSession?.routineId).toBeUndefined(); // mapped from null to undefined
      expect(savedSession?.routineName).toBe('Rotina Temporária');
      expect(savedSession?.sets?.length).toBe(2);
      expect(savedSession?.totalVolumeKg).toBe(1300);

      // 5. Verify exercise history remains accessible even after routine deletion
      const history = await workoutRepo.getExerciseHistory('Exercício Temp 1');
      expect(history.length).toBe(1);
      expect(history[0].maxWeightKg).toBe(75);
      expect(history[0].totalVolumeKg).toBe(1300);
    });

    it('2.3 preserves previous exercise set references after exercise is removed from routine definition', async () => {
      // Create routine with 2 exercises
      const routine = await workoutRepo.createRoutine(
        { name: 'Rotina Editável', sortOrder: 1 },
        [
          { name: 'Remada Curvada', muscleGroup: 'Costas', targetSets: 3, defaultRestSeconds: 60, sortOrder: 1 },
          { name: 'Barra Fixa', muscleGroup: 'Costas', targetSets: 3, defaultRestSeconds: 60, sortOrder: 2 },
        ]
      );

      // Complete session 1
      await workoutRepo.saveWorkoutSession({
        routineId: routine.id,
        routineName: routine.name,
        date: '2026-11-05',
        durationMinutes: 40,
        sets: [
          { exerciseName: 'Remada Curvada', setNumber: 1, weightKg: 60, reps: 10, completed: true },
          { exerciseName: 'Barra Fixa', setNumber: 1, weightKg: 0, reps: 12, completed: true },
        ],
      });

      // Update routine to REMOVE 'Barra Fixa'
      await workoutRepo.updateRoutine(
        routine.id,
        { name: 'Rotina Editável v2' },
        [
          {
            id: routine.exercises![0].id,
            routineId: routine.id,
            name: 'Remada Curvada',
            muscleGroup: 'Costas',
            targetSets: 4,
            defaultRestSeconds: 90,
            sortOrder: 1,
          },
        ]
      );

      // Query previous sets for 'Barra Fixa' (which is no longer in the routine)
      const prevSets = await workoutRepo.getPreviousExerciseSets('Barra Fixa', 3);
      expect(prevSets.length).toBe(1);
      expect(prevSets[0].exerciseName).toBe('Barra Fixa');
      expect(prevSets[0].reps).toBe(12);

      const formatted = formatPreviousLoad(prevSets, 1);
      expect(formatted).toBe('0kg × 12');
    });
  });

  // =========================================================================
  // 3. LIVE WORKOUT RAPID PAUSE/RESUME TIMER CYCLES & STATE RESTORATION
  // =========================================================================
  describe('3. Live Workout Rapid Pause/Resume Timer Cycles & State Restoration', () => {
    let manager: WorkoutStateManager;

    beforeEach(async () => {
      manager = new WorkoutStateManager(workoutRepo, mockHaptics);
      await manager.loadRoutines();
    });

    afterEach(() => {
      manager.cleanup();
    });

    it('3.1 executes 100 rapid pause/resume cycles without timestamp drift or state corruption', () => {
      manager.startFreestyleWorkout('Pause/Resume Stress');
      expect(manager.activeSession).not.toBeNull();
      expect(manager.activeSession?.isPaused).toBe(false);

      // Advance elapsed simulated clock
      manager.activeSession!.elapsedSeconds = 120;
      const initialElapsed = manager.activeSession!.elapsedSeconds;

      const t0 = performance.now();
      const CYCLES = 100;

      for (let i = 0; i < CYCLES; i++) {
        manager.pauseWorkout();
        expect(manager.activeSession?.isPaused).toBe(true);

        manager.resumeWorkout();
        expect(manager.activeSession?.isPaused).toBe(false);
      }
      const durationMs = performance.now() - t0;

      // Elapsed seconds must be preserved
      expect(manager.activeSession?.elapsedSeconds).toBe(initialElapsed);
      expect(manager.activeSession?.isPaused).toBe(false);

      // Start timestamp should be approximately Date.now() - 120 * 1000
      const expectedStart = Date.now() - 120 * 1000;
      expect(Math.abs(manager.activeSession!.startTimestamp - expectedStart)).toBeLessThan(500);

      expect(durationMs).toBeLessThan(500);
    });

    it('3.2 pause and resume operations are strictly idempotent', () => {
      manager.startFreestyleWorkout('Idempotency Test');
      manager.activeSession!.elapsedSeconds = 45;

      // Double pause
      manager.pauseWorkout();
      expect(manager.activeSession?.isPaused).toBe(true);
      manager.pauseWorkout();
      expect(manager.activeSession?.isPaused).toBe(true);
      expect(manager.activeSession?.elapsedSeconds).toBe(45);

      // Double resume
      manager.resumeWorkout();
      expect(manager.activeSession?.isPaused).toBe(false);
      const start1 = manager.activeSession!.startTimestamp;
      manager.resumeWorkout();
      expect(manager.activeSession?.isPaused).toBe(false);
      // Calling resume again while not paused should NOT modify startTimestamp
      expect(manager.activeSession!.startTimestamp).toBe(start1);

      // Pause/resume when activeSession is null does not throw
      manager.discardWorkout();
      expect(manager.activeSession).toBeNull();
      expect(() => manager.pauseWorkout()).not.toThrow();
      expect(() => manager.resumeWorkout()).not.toThrow();
    });

    it('3.3 allows completing, uncompleting and modifying sets while workout is paused', async () => {
      manager.startFreestyleWorkout('Paused Modifications');
      await manager.addExerciseToActiveWorkout({ name: 'Leg Press', targetSets: 2 });

      manager.pauseWorkout();
      expect(manager.activeSession?.isPaused).toBe(true);

      // Complete set 0 while paused
      manager.updateSet(0, 0, { weightKg: 200, reps: 12 });
      await manager.completeSet(0, 0);

      expect(manager.activeSession!.exercises[0].sets[0].completed).toBe(true);
      expect(mockHaptics.triggerSetComplete).toHaveBeenCalledTimes(1);
      // Rest timer started even while paused
      expect(manager.restTimer.isActive).toBe(true);
      expect(manager.restTimer.remainingSeconds).toBe(60);

      // Adjust rest timer while paused
      manager.adjustRestTimer(-30);
      expect(manager.restTimer.remainingSeconds).toBe(30);

      // Skip rest timer
      manager.skipRestTimer();
      expect(manager.restTimer.isActive).toBe(false);

      // Uncomplete set 0 while paused
      manager.uncompleteSet(0, 0);
      expect(manager.activeSession!.exercises[0].sets[0].completed).toBe(false);
    });

    it('3.4 completes and persists workout session accurately after pause/resume cycles', async () => {
      manager.startFreestyleWorkout('Finish After Pauses');
      await manager.addExerciseToActiveWorkout({ name: 'Agachamento', targetSets: 2 });

      manager.updateSet(0, 0, { weightKg: 100, reps: 5 });
      await manager.completeSet(0, 0);

      manager.pauseWorkout();
      // Simulate 10 minutes of elapsed workout time
      manager.activeSession!.elapsedSeconds = 600;
      manager.resumeWorkout();

      manager.updateSet(0, 1, { weightKg: 110, reps: 5 });
      await manager.completeSet(0, 1);

      const saved = await manager.finishWorkout('Treino pesado com pausas');
      expect(saved.id).toBeDefined();
      expect(saved.durationMinutes).toBe(10);
      expect(saved.totalVolumeKg).toBe(100 * 5 + 110 * 5); // 1050
      expect(saved.sets?.length).toBe(2);
      expect(manager.activeSession).toBeNull();
    });
  });

  // =========================================================================
  // 4. PHOTO STORAGE SERVICE FILE SYSTEM RESILIENCE
  // =========================================================================
  describe('4. PhotoStorageService File System Resilience & URI Parsing', () => {
    it('4.1 creates directory when directory does not exist', async () => {
      const getInfoSpy = jest.spyOn(FileSystem, 'getInfoAsync').mockResolvedValueOnce({
        exists: false,
        isDirectory: false,
      } as any);

      const makeDirSpy = jest.spyOn(FileSystem, 'makeDirectoryAsync').mockResolvedValueOnce(undefined as any);

      await PhotoStorageService.ensureDirectory();

      expect(getInfoSpy).toHaveBeenCalled();
      expect(makeDirSpy).toHaveBeenCalledWith(expect.stringContaining('body_photos/'), {
        intermediates: true,
      });

      getInfoSpy.mockRestore();
      makeDirSpy.mockRestore();
    });

    it('4.2 absorbs directory creation errors gracefully without throwing', async () => {
      const getInfoSpy = jest.spyOn(FileSystem, 'getInfoAsync').mockResolvedValueOnce({
        exists: false,
        isDirectory: false,
      } as any);

      const makeDirSpy = jest.spyOn(FileSystem, 'makeDirectoryAsync').mockRejectedValueOnce(
        new Error('EACCES: permission denied')
      );

      await expect(PhotoStorageService.ensureDirectory()).resolves.not.toThrow();

      getInfoSpy.mockRestore();
      makeDirSpy.mockRestore();
    });

    it('4.3 falls back to source URI if copyAsync fails during photo persistence', async () => {
      const copySpy = jest.spyOn(FileSystem, 'copyAsync').mockRejectedValueOnce(
        new Error('ENOSPC: disk full')
      );

      const sourceUri = 'file:///data/cache/temp_captured.jpg';
      const result = await PhotoStorageService.persistCapturedPhoto(sourceUri, '2026-11-06', 'front');

      // Must return fallback sourceUri instead of crashing
      expect(result).toBe(sourceUri);

      copySpy.mockRestore();
    });

    it('4.4 handles empty, null or invalid source URIs without file operations', async () => {
      const copySpy = jest.spyOn(FileSystem, 'copyAsync');

      const result1 = await PhotoStorageService.persistCapturedPhoto('', '2026-11-06');
      expect(result1).toBe('');

      const result2 = await PhotoStorageService.persistCapturedPhoto(null as any, '2026-11-06');
      expect(result2).toBeNull();

      expect(copySpy).not.toHaveBeenCalled();
      copySpy.mockRestore();
    });

    it('4.5 does not attempt deletion if file does not exist (idempotent delete)', async () => {
      const getInfoSpy = jest.spyOn(FileSystem, 'getInfoAsync').mockResolvedValueOnce({
        exists: false,
        isDirectory: false,
      } as any);

      const deleteSpy = jest.spyOn(FileSystem, 'deleteAsync');

      await PhotoStorageService.deletePhotoFile('file:///data/photos/non_existent.jpg');

      expect(getInfoSpy).toHaveBeenCalled();
      expect(deleteSpy).not.toHaveBeenCalled();

      getInfoSpy.mockRestore();
      deleteSpy.mockRestore();
    });

    it('4.6 absorbs file deletion errors gracefully without throwing', async () => {
      const getInfoSpy = jest.spyOn(FileSystem, 'getInfoAsync').mockResolvedValueOnce({
        exists: true,
        isDirectory: false,
      } as any);

      const deleteSpy = jest.spyOn(FileSystem, 'deleteAsync').mockRejectedValueOnce(
        new Error('EBUSY: resource busy or locked')
      );

      await expect(
        PhotoStorageService.deletePhotoFile('file:///data/photos/locked.jpg')
      ).resolves.not.toThrow();

      getInfoSpy.mockRestore();
      deleteSpy.mockRestore();
    });

    it('4.7 resolveUri handles various schemes and relative paths correctly', () => {
      expect(PhotoStorageService.resolveUri('')).toBe('');
      expect(PhotoStorageService.resolveUri('file:///data/photo.jpg')).toBe('file:///data/photo.jpg');
      expect(PhotoStorageService.resolveUri('https://example.com/p.jpg')).toBe('https://example.com/p.jpg');
      expect(PhotoStorageService.resolveUri('http://example.com/p.jpg')).toBe('http://example.com/p.jpg');
      expect(PhotoStorageService.resolveUri('data:image/jpeg;base64,ABC')).toBe('data:image/jpeg;base64,ABC');

      const relative = 'body_photos/2026-11-06_front.jpg';
      const resolved = PhotoStorageService.resolveUri(relative);
      expect(resolved).toContain('body_photos/2026-11-06_front.jpg');
      expect(resolved.startsWith('file:///')).toBe(true);
    });

    it('4.8 extracts pose orientation accurately from complex or localized filenames', () => {
      expect(extractPoseFromUri('file:///photos/front_2026.jpg')).toBe('front');
      expect(extractPoseFromUri('file:///photos/FRENTE_poses.jpg')).toBe('front');
      expect(extractPoseFromUri('file:///photos/side_profile.jpg')).toBe('side');
      expect(extractPoseFromUri('file:///photos/lateral_esquerda.jpg')).toBe('side');
      expect(extractPoseFromUri('file:///photos/lado_direito.jpg')).toBe('side');
      expect(extractPoseFromUri('file:///photos/perfil_duplo.jpg')).toBe('side');
      expect(extractPoseFromUri('file:///photos/back_lat.jpg')).toBe('back');
      expect(extractPoseFromUri('file:///photos/costas_expansao.jpg')).toBe('back');
      expect(extractPoseFromUri('file:///photos/selfie_espelho.jpg')).toBe('other');
      expect(extractPoseFromUri('')).toBe('other');
    });
  });

  // =========================================================================
  // 5. 7-DAY MOVING AVERAGE ACROSS DATES, TIMEZONES & LEAP YEARS
  // =========================================================================
  describe('5. 7-Day Moving Average Across Dates, Timezones, Leap Years & Non-Contiguous Data', () => {
    describe('5.1 Calendar Arithmetic & Leap Year Traversal', () => {
      it('correctly shifts dates across February 28 -> 29 -> March 1 in leap year (2024)', () => {
        expect(shiftDateString('2024-02-28', 1)).toBe('2024-02-29');
        expect(shiftDateString('2024-02-29', 1)).toBe('2024-03-01');
        expect(shiftDateString('2024-03-01', -1)).toBe('2024-02-29');
        expect(shiftDateString('2024-03-01', -2)).toBe('2024-02-28');
      });

      it('correctly shifts dates across February 28 -> March 1 in non-leap year (2025)', () => {
        expect(shiftDateString('2025-02-28', 1)).toBe('2025-03-01');
        expect(shiftDateString('2025-03-01', -1)).toBe('2025-02-28');
      });

      it('correctly shifts dates across Year End / New Year boundary', () => {
        expect(shiftDateString('2025-12-31', 1)).toBe('2026-01-01');
        expect(shiftDateString('2026-01-01', -1)).toBe('2025-12-31');
        expect(shiftDateString('2026-01-05', -6)).toBe('2025-12-30');
      });

      it('returns original input when date string does not follow YYYY-MM-DD pattern', () => {
        expect(shiftDateString('invalid-date', 1)).toBe('invalid-date');
        expect(shiftDateString('2026/11/06', 1)).toBe('2026/11/06');
        expect(shiftDateString('', 1)).toBe('');
      });
    });

    describe('5.2 Non-Contiguous Historical Data & Zero-Weight Filtering', () => {
      it('calculates average dividing by actual logged weigh-in count, not window size (7)', () => {
        // Only 2 weigh-ins in the 7-day window [2026-11-01 to 2026-11-07]
        const logs = [
          { date: '2026-11-01', weightKg: 80.0 },
          { date: '2026-11-07', weightKg: 83.0 },
        ];

        const ma = calculateMovingAverageForDate('2026-11-07', logs, 7);
        // (80.0 + 83.0) / 2 = 81.5
        expect(ma).toBe(81.5);
      });

      it('strictly ignores placeholder logs with weightKg <= 0 (photo-only logs)', () => {
        const logs = [
          { date: '2026-11-01', weightKg: 80.0 },
          { date: '2026-11-03', weightKg: 0 }, // photo-only placeholder
          { date: '2026-11-05', weightKg: -5 }, // corrupted entry
          { date: '2026-11-07', weightKg: 82.0 },
        ];

        const ma = calculateMovingAverageForDate('2026-11-07', logs, 7);
        // Only 80.0 and 82.0 are valid -> (80.0 + 82.0) / 2 = 81.0
        expect(ma).toBe(81.0);
      });

      it('returns null if all logs in window have weightKg <= 0', () => {
        const logs = [
          { date: '2026-11-05', weightKg: 0 },
          { date: '2026-11-07', weightKg: 0 },
        ];
        expect(calculateMovingAverageForDate('2026-11-07', logs, 7)).toBeNull();
      });
    });

    describe('5.3 Parity Between SQLite Engine and JS Utility Across Leap Year', () => {
      it('yields identical moving averages in SQLite and TypeScript across Leap Day (2024-02-29)', async () => {
        // Window ending 2024-03-02 spans 2024-02-25 to 2024-03-02 (7 days in leap year: 25, 26, 27, 28, 29, 01, 02)
        const entries = [
          { date: '2024-02-26', weightKg: 85.0 },
          { date: '2024-02-28', weightKg: 84.6 },
          { date: '2024-02-29', weightKg: 84.4 }, // Leap day
          { date: '2024-03-01', weightKg: 84.2 },
          { date: '2024-03-02', weightKg: 84.0 },
        ];

        for (const e of entries) {
          await bodyRepo.saveBodyLog({ date: e.date, weightKg: e.weightKg });
        }

        const jsAvg = calculateMovingAverageForDate('2024-03-02', entries, 7);
        const sqliteAvg = await bodyRepo.calculateMovingAverage('2024-03-02', 7);

        // Expected: (85 + 84.6 + 84.4 + 84.2 + 84.0) / 5 = 422.2 / 5 = 84.44
        expect(jsAvg).toBe(84.44);
        expect(sqliteAvg).toBe(84.44);
        expect(sqliteAvg).toBe(jsAvg);
      });
    });
  });

  // =========================================================================
  // 6. BODY COMPOSITION EXTREMES & UNREALISTIC INPUTS
  // =========================================================================
  describe('6. Body Composition with Extreme/Unrealistic Inputs', () => {
    it('6.1 handles bodyFatPct = 0% (pure lean mass)', () => {
      const result = calculateBodyComposition(80.0, 0);
      expect(result).not.toBeNull();
      expect(result?.fatMassKg).toBe(0.0);
      expect(result?.leanMassKg).toBe(80.0);
    });

    it('6.2 handles bodyFatPct = 100% (pure fat mass boundary)', () => {
      const result = calculateBodyComposition(80.0, 100);
      expect(result).not.toBeNull();
      expect(result?.fatMassKg).toBe(80.0);
      expect(result?.leanMassKg).toBe(0.0);
    });

    it('6.3 rejects negative body fat percentage (returns null)', () => {
      expect(calculateBodyComposition(80.0, -0.1)).toBeNull();
      expect(calculateBodyComposition(80.0, -15)).toBeNull();
    });

    it('6.4 rejects zero or negative body weight (returns null)', () => {
      expect(calculateBodyComposition(0, 15)).toBeNull();
      expect(calculateBodyComposition(-80, 15)).toBeNull();
    });

    it('6.5 returns null for undefined or null body fat percentage', () => {
      expect(calculateBodyComposition(80.0, undefined)).toBeNull();
      expect(calculateBodyComposition(80.0, null)).toBeNull();
    });

    it('6.6 evaluates unrealistic > 100% body fat percentage consistently', () => {
      // 80kg at 120% body fat: Fat Mass = 96.0kg, Lean Mass = -16.0kg
      const result = calculateBodyComposition(80.0, 120);
      expect(result).not.toBeNull();
      expect(result?.fatMassKg).toBe(96.0);
      expect(result?.leanMassKg).toBe(-16.0);
    });

    it('6.7 photo comparison delta metrics handles identical dates and inverted dates safely', () => {
      const log1 = { id: '1', date: '2026-11-01', weightKg: 85.0, bodyFatPct: 18.0, waistCm: 88.0, createdAt: '' };
      const log2 = { id: '2', date: '2026-11-01', weightKg: 85.0, bodyFatPct: 18.0, waistCm: 88.0, createdAt: '' };

      // Same date: daysBetween = 0, deltas = 0
      const sameDay = calculatePhotoDeltaMetrics(log1, log2, '2026-11-01', '2026-11-01');
      expect(sameDay.daysBetween).toBe(0);
      expect(sameDay.weightDeltaKg).toBe(0.0);
      expect(sameDay.bodyFatDeltaPct).toBe(0.0);
      expect(sameDay.waistDeltaCm).toBe(0.0);

      // Inverted dates: beforeDate is after afterDate
      const inverted = calculatePhotoDeltaMetrics(log1, log2, '2026-11-10', '2026-11-01');
      expect(inverted.daysBetween).toBe(9); // Math.abs preserves positive distance

      // Missing logs handled safely without exception
      const nullLogs = calculatePhotoDeltaMetrics(null, null, '2026-11-01', '2026-11-10');
      expect(nullLogs.daysBetween).toBe(9);
      expect(nullLogs.weightDeltaKg).toBeNull();
      expect(nullLogs.bodyFatDeltaPct).toBeNull();
      expect(nullLogs.waistDeltaCm).toBeNull();
    });
  });

  // =========================================================================
  // 7. MERGE-ON-SAVE CONCURRENCY & PARTIAL UPDATES
  // =========================================================================
  describe('7. Merge-on-Save Concurrency & Partial Updates in Body Logs', () => {
    let bodyManager: BodyStateManager;

    beforeEach(() => {
      bodyManager = new BodyStateManager(bodyRepo, '2026-11-06');
    });

    it('7.1 preserves prior measurements when partial measurement updates are saved', async () => {
      const DATE = '2026-11-06';

      // 1. Initial complete weigh-in and circumferences
      await bodyManager.saveWeighIn(84.0, DATE);
      await bodyManager.saveMeasurements(
        {
          bodyFatPct: 16.0,
          waistCm: 84.0,
          chestCm: 106.0,
          armsCm: 39.5,
          legsCm: 60.0,
        },
        DATE
      );

      // 2. Partial update: user only updates waistCm (e.g. from 84.0 to 82.5)
      await bodyManager.saveMeasurements({ waistCm: 82.5 }, DATE);

      const log = await bodyRepo.getBodyLog(DATE);
      expect(log).not.toBeNull();
      expect(log?.weightKg).toBe(84.0); // preserved
      expect(log?.waistCm).toBe(82.5); // updated
      expect(log?.chestCm).toBe(106.0); // preserved
      expect(log?.armsCm).toBe(39.5); // preserved
      expect(log?.legsCm).toBe(60.0); // preserved
      expect(log?.bodyFatPct).toBe(16.0); // preserved
    });

    it('7.2 preserves circumferences and photos when weigh-in is updated repeatedly', async () => {
      const DATE = '2026-11-06';

      await bodyManager.saveMeasurements({ waistCm: 80.0, chestCm: 100.0 }, DATE);
      await bodyManager.savePhoto('file:///photos/front.jpg', DATE);

      // Perform 20 sequential weigh-in modifications
      for (let w = 80; w <= 82; w += 0.1) {
        const rounded = Math.round(w * 10) / 10;
        await bodyManager.saveWeighIn(rounded, DATE);
      }

      const finalLog = await bodyRepo.getBodyLog(DATE);
      expect(finalLog?.weightKg).toBe(82.0);
      expect(finalLog?.waistCm).toBe(80.0);
      expect(finalLog?.chestCm).toBe(100.0);
      expect(finalLog?.photoUris).toEqual(['file:///photos/front.jpg']);
    });

    it('7.3 handles concurrent weigh-in and photo saves without database corruption', async () => {
      const DATE = '2026-11-06';

      // Execute concurrent operations on the same date
      await Promise.all([
        bodyRepo.saveBodyLog({ date: DATE, weightKg: 81.5, waistCm: 82.0 }),
        bodyRepo.savePhoto(DATE, 'file:///photos/photo_a.jpg'),
        bodyRepo.savePhoto(DATE, 'file:///photos/photo_b.jpg'),
      ]);

      const log = await bodyRepo.getBodyLog(DATE);
      expect(log).not.toBeNull();
      // Verify SQLite ON CONFLICT did not crash and left a valid row
      expect(typeof log?.weightKg).toBe('number');
      expect(Array.isArray(log?.photoUris)).toBe(true);
    });
  });

  // =========================================================================
  // 8. THEME SWITCHING CONCURRENCY WITH ACTIVE WORKOUT & WEIGH-IN
  // =========================================================================
  describe('8. Theme Switching Concurrency with Active Workout & Weigh-In', () => {
    let workoutManager: WorkoutStateManager;
    let themeManager: ThemeStateManager;
    let bodyManager: BodyStateManager;

    beforeEach(async () => {
      workoutManager = new WorkoutStateManager(workoutRepo, mockHaptics);
      themeManager = new ThemeStateManager(authRepo, 'dark');
      bodyManager = new BodyStateManager(bodyRepo, '2026-11-06');
      await workoutManager.loadRoutines();
    });

    afterEach(() => {
      workoutManager.cleanup();
    });

    it('8.1 maintains active workout session and timer integrity across 50 rapid theme flips', async () => {
      workoutManager.startFreestyleWorkout('Theme Flip Resistance');
      await workoutManager.addExerciseToActiveWorkout({ name: 'Supino Reto', targetSets: 3 });

      workoutManager.updateSet(0, 0, { weightKg: 90, reps: 8 });
      await workoutManager.completeSet(0, 0);

      expect(workoutManager.activeSession).not.toBeNull();
      expect(workoutManager.activeSession?.exercises[0].sets[0].completed).toBe(true);
      expect(workoutManager.restTimer.isActive).toBe(true);

      // Perform 50 rapid theme flips (dark <-> light)
      const t0 = performance.now();
      for (let i = 0; i < 50; i++) {
        await themeManager.toggleTheme();
        expect(themeManager.themeMode).toBe(i % 2 === 0 ? 'light' : 'dark');
      }
      const durationMs = performance.now() - t0;

      // Assert complete isolation: workout session must remain 100% intact
      expect(workoutManager.activeSession).not.toBeNull();
      expect(workoutManager.activeSession?.routineName).toBe('Theme Flip Resistance');
      expect(workoutManager.activeSession?.exercises[0].sets[0].completed).toBe(true);
      expect(workoutManager.activeSession?.exercises[0].sets[0].weightKg).toBe(90);
      expect(workoutManager.restTimer.isActive).toBe(true);

      // Finish workout to confirm integrity
      const finished = await workoutManager.finishWorkout('Completed despite theme flips');
      expect(finished.totalVolumeKg).toBe(720);

      expect(durationMs).toBeLessThan(1000);
    });

    it('8.2 maintains weigh-in persistence integrity during simultaneous theme changes', async () => {
      const DATE = '2026-11-06';

      // Interleave weigh-in saves with theme toggling
      const operations: Promise<any>[] = [];
      for (let i = 0; i < 10; i++) {
        operations.push(themeManager.toggleTheme());
        operations.push(bodyManager.saveWeighIn(75 + i * 0.5, DATE));
      }

      await Promise.all(operations);

      // Both repositories must have settled safely
      const finalTheme = await authRepo.getTheme();
      expect(['dark', 'light']).toContain(finalTheme);

      const finalLog = await bodyRepo.getBodyLog(DATE);
      expect(finalLog).not.toBeNull();
      expect(finalLog?.weightKg).toBeGreaterThanOrEqual(75);
      expect(finalLog?.weightKg).toBeLessThanOrEqual(80);
    });
  });
});
