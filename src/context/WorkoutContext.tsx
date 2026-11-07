import React, { createContext, useState, useEffect, useMemo } from 'react';
import * as Haptics from 'expo-haptics';
import {
  WorkoutRoutine,
  RoutineExercise,
  WorkoutSession,
  SetLog,
  ExerciseHistoryPoint,
  CustomExercise,
} from '../types/domain';
import { IWorkoutRepository } from '../database/repositories/interfaces';
import { calculateWorkoutVolume, formatPreviousLoad } from '../utils/workout';

export interface ActiveLiveSet {
  id: string;
  exerciseId?: string;
  exerciseName: string;
  setNumber: number;
  weightKg: number;
  reps: number;
  completed: boolean;
  previousLoadDisplay?: string;
}

export interface ActiveLiveExercise {
  id: string;
  name: string;
  muscleGroup?: string;
  targetSets: number;
  defaultRestSeconds: number;
  sets: ActiveLiveSet[];
}

export interface ActiveWorkoutSession {
  routineId?: string;
  routineName: string;
  date: string;
  startTime: string;
  startTimestamp: number;
  elapsedSeconds: number;
  isPaused: boolean;
  exercises: ActiveLiveExercise[];
  notes?: string;
}

export interface RestTimerState {
  isActive: boolean;
  durationSeconds: number;
  remainingSeconds: number;
  exerciseName?: string;
  setNumber?: number;
}

export interface HapticsServiceInterface {
  triggerSetComplete: () => Promise<void>;
  triggerTimerFinished: () => Promise<void>;
}

export const defaultHapticsService: HapticsServiceInterface = {
  triggerSetComplete: async () => {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Ignore haptic failures in non-supported environments
    }
  },
  triggerTimerFinished: async () => {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch {
      // Ignore haptic failures in non-supported environments
    }
  },
};

export class WorkoutStateManager {
  public routines: WorkoutRoutine[] = [];
  public selectedRoutine: WorkoutRoutine | null = null;
  public activeSession: ActiveWorkoutSession | null = null;
  public restTimer: RestTimerState = {
    isActive: false,
    durationSeconds: 0,
    remainingSeconds: 0,
  };
  public historySessions: WorkoutSession[] = [];
  public selectedExerciseHistory: ExerciseHistoryPoint[] = [];
  public customExercises: CustomExercise[] = [];
  public isLoading = false;
  public error: string | null = null;

  private listeners: (() => void)[] = [];
  private tickerInterval: any = null;
  private restTimerInterval: any = null;

  constructor(
    private workoutRepo: IWorkoutRepository,
    private hapticsService?: HapticsServiceInterface
  ) {}

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  // --- Routine Catalog Actions ---
  public async loadRoutines(): Promise<void> {
    this.isLoading = true;
    this.error = null;
    this.notify();
    try {
      this.routines = await this.workoutRepo.getRoutines();
    } catch (err: any) {
      this.error = err?.message || 'Falha ao carregar rotinas';
    } finally {
      this.isLoading = false;
      this.notify();
    }
  }

  // --- Custom Exercises Actions ---
  public async loadCustomExercises(): Promise<void> {
    try {
      this.customExercises = await this.workoutRepo.getCustomExercises();
      this.notify();
    } catch (err: any) {
      this.error = err?.message || 'Falha ao carregar exercícios personalizados';
      this.notify();
    }
  }

  public async createCustomExercise(
    data: Omit<CustomExercise, 'id' | 'createdAt'>
  ): Promise<CustomExercise> {
    const created = await this.workoutRepo.createCustomExercise(data);
    await this.loadCustomExercises();
    return created;
  }

  public async getRoutineById(id: string): Promise<WorkoutRoutine | null> {
    return this.workoutRepo.getRoutineById(id);
  }

  public async createRoutine(
    routine: Omit<WorkoutRoutine, 'id' | 'createdAt'>,
    exercises?: Omit<RoutineExercise, 'id' | 'routineId'>[]
  ): Promise<WorkoutRoutine> {
    const created = await this.workoutRepo.createRoutine(routine, exercises);
    await this.loadRoutines();
    return created;
  }

  public async updateRoutine(
    id: string,
    routine: Partial<WorkoutRoutine>,
    exercises?: RoutineExercise[]
  ): Promise<void> {
    await this.workoutRepo.updateRoutine(id, routine, exercises);
    await this.loadRoutines();
  }

  public async deleteRoutine(id: string): Promise<void> {
    await this.workoutRepo.deleteRoutine(id);
    await this.loadRoutines();
  }

  // --- Live Workout Session Lifecycle ---
  public async startWorkout(routine?: WorkoutRoutine): Promise<void> {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0];

    const activeExercises: ActiveLiveExercise[] = [];

    if (routine && routine.exercises) {
      const prevLoads = await Promise.all(
        routine.exercises.map((ex) => this.workoutRepo.getPreviousExerciseSets(ex.name, ex.targetSets))
      );

      for (let i = 0; i < routine.exercises.length; i++) {
        const ex = routine.exercises[i];
        const prevSets = prevLoads[i] || [];
        const sets: ActiveLiveSet[] = [];

        for (let s = 1; s <= ex.targetSets; s++) {
          const prevSet = prevSets.find((p) => p.setNumber === s);
          sets.push({
            id: `set-live-${Date.now()}-${i}-${s}`,
            exerciseId: ex.id,
            exerciseName: ex.name,
            setNumber: s,
            weightKg: prevSet ? prevSet.weightKg : 0,
            reps: prevSet ? prevSet.reps : 10,
            completed: false,
            previousLoadDisplay: formatPreviousLoad(prevSets, s),
          });
        }

        activeExercises.push({
          id: ex.id,
          name: ex.name,
          muscleGroup: ex.muscleGroup,
          targetSets: ex.targetSets,
          defaultRestSeconds: ex.defaultRestSeconds || 60,
          sets,
        });
      }
    }

    this.activeSession = {
      routineId: routine?.id,
      routineName: routine?.name || 'Treino Livre',
      date: dateStr,
      startTime: timeStr,
      startTimestamp: Date.now(),
      elapsedSeconds: 0,
      isPaused: false,
      exercises: activeExercises,
    };

    this.startElapsedTicker();
    this.notify();
  }

  public startFreestyleWorkout(name = 'Treino Livre'): void {
    const now = new Date();
    this.activeSession = {
      routineName: name,
      date: now.toISOString().split('T')[0],
      startTime: now.toTimeString().split(' ')[0],
      startTimestamp: Date.now(),
      elapsedSeconds: 0,
      isPaused: false,
      exercises: [],
    };
    this.startElapsedTicker();
    this.notify();
  }

  public async addExerciseToActiveWorkout(exercise: {
    name: string;
    muscleGroup?: string;
    targetSets?: number;
    defaultRestSeconds?: number;
  }): Promise<void> {
    if (!this.activeSession) return;
    const targetSets = exercise.targetSets || 3;
    const defaultRestSeconds = exercise.defaultRestSeconds || 60;
    const prevSets = await this.workoutRepo.getPreviousExerciseSets(exercise.name, targetSets);

    const sets: ActiveLiveSet[] = [];
    for (let s = 1; s <= targetSets; s++) {
      const prev = prevSets.find((p) => p.setNumber === s);
      sets.push({
        id: `set-live-${Date.now()}-${this.activeSession.exercises.length}-${s}`,
        exerciseName: exercise.name,
        setNumber: s,
        weightKg: prev ? prev.weightKg : 0,
        reps: prev ? prev.reps : 10,
        completed: false,
        previousLoadDisplay: formatPreviousLoad(prevSets, s),
      });
    }

    this.activeSession.exercises.push({
      id: `ex-${Date.now()}`,
      name: exercise.name,
      muscleGroup: exercise.muscleGroup,
      targetSets,
      defaultRestSeconds,
      sets,
    });
    this.notify();
  }

  public removeExerciseFromActiveWorkout(exerciseIndex: number): void {
    if (!this.activeSession) return;
    if (exerciseIndex >= 0 && exerciseIndex < this.activeSession.exercises.length) {
      this.activeSession.exercises.splice(exerciseIndex, 1);
      this.notify();
    }
  }

  public updateSet(
    exerciseIndex: number,
    setIndex: number,
    updates: Partial<ActiveLiveSet>
  ): void {
    if (!this.activeSession) return;
    const ex = this.activeSession.exercises[exerciseIndex];
    if (!ex) return;
    const set = ex.sets[setIndex];
    if (!set) return;

    Object.assign(set, updates);
    this.notify();
  }

  public addSet(exerciseIndex: number): void {
    if (!this.activeSession) return;
    const ex = this.activeSession.exercises[exerciseIndex];
    if (!ex) return;

    const lastSet = ex.sets[ex.sets.length - 1];
    const newSetNumber = ex.sets.length + 1;
    ex.sets.push({
      id: `set-live-${Date.now()}-${exerciseIndex}-${newSetNumber}`,
      exerciseId: ex.id,
      exerciseName: ex.name,
      setNumber: newSetNumber,
      weightKg: lastSet ? lastSet.weightKg : 0,
      reps: lastSet ? lastSet.reps : 10,
      completed: false,
      previousLoadDisplay: '—',
    });
    this.notify();
  }

  public removeSet(exerciseIndex: number, setIndex: number): void {
    if (!this.activeSession) return;
    const ex = this.activeSession.exercises[exerciseIndex];
    if (!ex || ex.sets.length <= 1) return;

    ex.sets.splice(setIndex, 1);
    ex.sets.forEach((s, idx) => {
      s.setNumber = idx + 1;
    });
    this.notify();
  }

  public async completeSet(exerciseIndex: number, setIndex: number): Promise<void> {
    if (!this.activeSession) return;
    const ex = this.activeSession.exercises[exerciseIndex];
    if (!ex) return;
    const set = ex.sets[setIndex];
    if (!set) return;

    set.completed = true;
    if (this.hapticsService) {
      await this.hapticsService.triggerSetComplete();
    }

    this.startRestTimer(ex.defaultRestSeconds || 60, ex.name, set.setNumber);
    this.notify();
  }

  public uncompleteSet(exerciseIndex: number, setIndex: number): void {
    if (!this.activeSession) return;
    const ex = this.activeSession.exercises[exerciseIndex];
    if (!ex) return;
    const set = ex.sets[setIndex];
    if (!set) return;

    set.completed = false;
    this.notify();
  }

  // --- Rest Timer State Machine ---
  public startRestTimer(seconds: number, exerciseName?: string, setNumber?: number): void {
    this.stopRestTimer();
    this.restTimer = {
      isActive: true,
      durationSeconds: seconds,
      remainingSeconds: seconds,
      exerciseName,
      setNumber,
    };
    this.notify();

    this.restTimerInterval = setInterval(() => {
      if (this.restTimer.remainingSeconds <= 1) {
        this.stopRestTimer();
        if (this.hapticsService) {
          this.hapticsService.triggerTimerFinished();
        }
      } else {
        this.restTimer.remainingSeconds -= 1;
        this.notify();
      }
    }, 1000);
  }

  public adjustRestTimer(deltaSeconds: number): void {
    if (!this.restTimer.isActive) return;
    const updated = Math.max(0, this.restTimer.remainingSeconds + deltaSeconds);
    if (updated === 0) {
      this.stopRestTimer();
    } else {
      this.restTimer.remainingSeconds = updated;
      this.restTimer.durationSeconds = Math.max(this.restTimer.durationSeconds, updated);
      this.notify();
    }
  }

  public skipRestTimer(): void {
    this.stopRestTimer();
  }

  private stopRestTimer(): void {
    if (this.restTimerInterval) {
      clearInterval(this.restTimerInterval);
      this.restTimerInterval = null;
    }
    this.restTimer = {
      isActive: false,
      durationSeconds: 0,
      remainingSeconds: 0,
    };
    this.notify();
  }

  // --- Elapsed Clock Controls ---
  private startElapsedTicker(): void {
    this.stopElapsedTicker();
    this.tickerInterval = setInterval(() => {
      if (this.activeSession && !this.activeSession.isPaused) {
        this.activeSession.elapsedSeconds = Math.floor(
          (Date.now() - this.activeSession.startTimestamp) / 1000
        );
        this.notify();
      }
    }, 1000);
  }

  private stopElapsedTicker(): void {
    if (this.tickerInterval) {
      clearInterval(this.tickerInterval);
      this.tickerInterval = null;
    }
  }

  public pauseWorkout(): void {
    if (!this.activeSession || this.activeSession.isPaused) return;
    this.activeSession.isPaused = true;
    this.notify();
  }

  public resumeWorkout(): void {
    if (!this.activeSession || !this.activeSession.isPaused) return;
    this.activeSession.startTimestamp = Date.now() - this.activeSession.elapsedSeconds * 1000;
    this.activeSession.isPaused = false;
    this.notify();
  }

  public discardWorkout(): void {
    this.stopElapsedTicker();
    this.stopRestTimer();
    this.activeSession = null;
    this.notify();
  }

  public async finishWorkout(notes?: string): Promise<WorkoutSession> {
    if (!this.activeSession) {
      throw new Error('Nenhuma sessão de treino ativa para finalizar.');
    }

    const endTime = new Date().toTimeString().split(' ')[0];
    const durationMinutes = Math.max(1, Math.round(this.activeSession.elapsedSeconds / 60));

    const allSets: Omit<SetLog, 'id' | 'sessionId' | 'createdAt'>[] = [];
    for (const ex of this.activeSession.exercises) {
      for (const s of ex.sets) {
        allSets.push({
          exerciseId: s.exerciseId,
          exerciseName: s.exerciseName,
          setNumber: s.setNumber,
          weightKg: Number(s.weightKg) || 0,
          reps: Number(s.reps) || 0,
          completed: s.completed,
        });
      }
    }

    const totalVolumeKg = calculateWorkoutVolume(allSets);

    const saved = await this.workoutRepo.saveWorkoutSession(
      {
        routineId: this.activeSession.routineId,
        routineName: this.activeSession.routineName,
        date: this.activeSession.date,
        startTime: this.activeSession.startTime,
        endTime,
        durationMinutes,
        totalVolumeKg,
        notes: notes || this.activeSession.notes,
        sets: allSets,
      },
      allSets
    );

    this.discardWorkout();
    await this.loadHistory();
    return saved;
  }

  // --- History & Progression Actions ---
  public async loadHistory(limit = 20, offset = 0): Promise<void> {
    this.isLoading = true;
    this.error = null;
    this.notify();
    try {
      this.historySessions = await this.workoutRepo.getWorkoutSessions(limit, offset);
    } catch (err: any) {
      this.error = err?.message || 'Falha ao carregar histórico';
    } finally {
      this.isLoading = false;
      this.notify();
    }
  }

  public async loadExerciseHistory(exerciseName: string): Promise<ExerciseHistoryPoint[]> {
    try {
      const history = await this.workoutRepo.getExerciseHistory(exerciseName);
      this.selectedExerciseHistory = history;
      this.notify();
      return history;
    } catch (err: any) {
      this.error = err?.message || 'Falha ao carregar histórico do exercício';
      return [];
    }
  }

  public cleanup(): void {
    this.stopElapsedTicker();
    this.stopRestTimer();
    this.listeners = [];
  }
}

export interface WorkoutContextValue {
  routines: WorkoutRoutine[];
  isLoadingRoutines: boolean;
  refreshRoutines: () => Promise<void>;
  createRoutine: (
    routine: Omit<WorkoutRoutine, 'id' | 'createdAt'>,
    exercises?: Omit<RoutineExercise, 'id' | 'routineId'>[]
  ) => Promise<WorkoutRoutine>;
  updateRoutine: (
    id: string,
    routine: Partial<WorkoutRoutine>,
    exercises?: RoutineExercise[]
  ) => Promise<void>;
  deleteRoutine: (id: string) => Promise<void>;
  getRoutineById: (id: string) => Promise<WorkoutRoutine | null>;

  // Custom Exercises
  customExercises: CustomExercise[];
  loadCustomExercises: () => Promise<void>;
  createCustomExercise: (
    data: Omit<CustomExercise, 'id' | 'createdAt'>
  ) => Promise<CustomExercise>;

  // Active Live Workout Session
  activeSession: ActiveWorkoutSession | null;
  startWorkout: (routine?: WorkoutRoutine) => Promise<void>;
  startFreestyleWorkout: (name?: string) => void;
  addExerciseToActiveWorkout: (exercise: {
    name: string;
    muscleGroup?: string;
    targetSets?: number;
    defaultRestSeconds?: number;
  }) => Promise<void>;
  removeExerciseFromActiveWorkout: (exerciseIndex: number) => void;
  updateSet: (
    exerciseIndex: number,
    setIndex: number,
    updates: Partial<ActiveLiveSet>
  ) => void;
  addSet: (exerciseIndex: number) => void;
  removeSet: (exerciseIndex: number, setIndex: number) => void;
  completeSet: (exerciseIndex: number, setIndex: number) => Promise<void>;
  uncompleteSet: (exerciseIndex: number, setIndex: number) => void;
  pauseWorkout: () => void;
  resumeWorkout: () => void;
  discardWorkout: () => void;
  finishWorkout: (notes?: string) => Promise<WorkoutSession>;

  // Rest Timer
  restTimer: RestTimerState;
  startRestTimer: (seconds: number, exerciseName?: string, setNumber?: number) => void;
  adjustRestTimer: (deltaSeconds: number) => void;
  skipRestTimer: () => void;

  // History & Progression
  historySessions: WorkoutSession[];
  selectedExerciseHistory: ExerciseHistoryPoint[];
  loadHistory: (limit?: number, offset?: number) => Promise<void>;
  loadExerciseHistory: (exerciseName: string) => Promise<ExerciseHistoryPoint[]>;

  // General State
  isLoading: boolean;
  error: string | null;
}

export const WorkoutContext = createContext<WorkoutContextValue | null>(null);

export interface WorkoutProviderProps {
  children: React.ReactNode;
  workoutRepo: IWorkoutRepository;
  hapticsService?: HapticsServiceInterface;
}

export const WorkoutProvider: React.FC<WorkoutProviderProps> = ({
  children,
  workoutRepo,
  hapticsService = defaultHapticsService,
}) => {
  const manager = useMemo(
    () => new WorkoutStateManager(workoutRepo, hapticsService),
    [workoutRepo, hapticsService]
  );

  const [version, setVersion] = useState(0);

  useEffect(() => {
    const unsubscribe = manager.subscribe(() => {
      setVersion((v) => v + 1);
    });

    manager.loadRoutines();
    manager.loadCustomExercises();

    return () => {
      unsubscribe();
      manager.cleanup();
    };
  }, [manager]);

  const value = useMemo<WorkoutContextValue>(
    () => {
      void version;
      return {
        routines: manager.routines,
      isLoadingRoutines: manager.isLoading,
      refreshRoutines: () => manager.loadRoutines(),
      createRoutine: (routine, exercises) => manager.createRoutine(routine, exercises),
      updateRoutine: (id, routine, exercises) => manager.updateRoutine(id, routine, exercises),
      deleteRoutine: (id) => manager.deleteRoutine(id),
      getRoutineById: (id) => manager.getRoutineById(id),

      // Custom Exercises
      customExercises: manager.customExercises,
      loadCustomExercises: () => manager.loadCustomExercises(),
      createCustomExercise: (data) => manager.createCustomExercise(data),

      activeSession: manager.activeSession,
      startWorkout: (routine) => manager.startWorkout(routine),
      startFreestyleWorkout: (name) => manager.startFreestyleWorkout(name),
      addExerciseToActiveWorkout: (ex) => manager.addExerciseToActiveWorkout(ex),
      removeExerciseFromActiveWorkout: (idx) => manager.removeExerciseFromActiveWorkout(idx),
      updateSet: (exIdx, setIdx, updates) => manager.updateSet(exIdx, setIdx, updates),
      addSet: (exIdx) => manager.addSet(exIdx),
      removeSet: (exIdx, setIdx) => manager.removeSet(exIdx, setIdx),
      completeSet: (exIdx, setIdx) => manager.completeSet(exIdx, setIdx),
      uncompleteSet: (exIdx, setIdx) => manager.uncompleteSet(exIdx, setIdx),
      pauseWorkout: () => manager.pauseWorkout(),
      resumeWorkout: () => manager.resumeWorkout(),
      discardWorkout: () => manager.discardWorkout(),
      finishWorkout: (notes) => manager.finishWorkout(notes),

      restTimer: manager.restTimer,
      startRestTimer: (s, name, num) => manager.startRestTimer(s, name, num),
      adjustRestTimer: (delta) => manager.adjustRestTimer(delta),
      skipRestTimer: () => manager.skipRestTimer(),

      historySessions: manager.historySessions,
      selectedExerciseHistory: manager.selectedExerciseHistory,
      loadHistory: (lim, off) => manager.loadHistory(lim, off),
      loadExerciseHistory: (name) => manager.loadExerciseHistory(name),

      isLoading: manager.isLoading,
      error: manager.error,
    };
  },
    [manager, version]
  );

  return <WorkoutContext.Provider value={value}>{children}</WorkoutContext.Provider>;
};
