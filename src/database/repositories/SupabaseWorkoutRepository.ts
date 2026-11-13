import { SupabaseClient } from '@supabase/supabase-js';
import { IWorkoutRepository, WorkoutSessionInput } from './interfaces';
import { supabase as defaultSupabase } from '../../services/supabaseClient';
import {
  WorkoutRoutine,
  RoutineExercise,
  WorkoutSession,
  SetLog,
  ExerciseHistoryPoint,
  CustomExercise,
} from '../../types/domain';

interface RoutineRow {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
}

interface RoutineExerciseRow {
  id: string;
  routine_id: string;
  name: string;
  muscle_group: string | null;
  target_sets: number;
  default_rest_seconds: number;
  sort_order: number;
  created_at: string;
}

interface WorkoutSessionRow {
  id: string;
  routine_id: string | null;
  routine_name: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number;
  total_volume_kg: number;
  notes: string | null;
  created_at: string;
}

interface SetLogRow {
  id: string;
  session_id: string;
  exercise_id: string | null;
  exercise_name: string;
  set_number: number;
  weight_kg: number;
  reps: number;
  completed: boolean;
  created_at: string;
}

interface CustomExerciseRow {
  id: string;
  name: string;
  category: string;
  default_sets: number;
  default_rest_seconds: number;
  created_at: string;
}

export class SupabaseWorkoutRepository implements IWorkoutRepository {
  constructor(private client: SupabaseClient = defaultSupabase) {}

  private mapSetLogRow(row: SetLogRow): SetLog {
    return {
      id: row.id,
      sessionId: row.session_id,
      exerciseId: row.exercise_id ?? undefined,
      exerciseName: row.exercise_name,
      setNumber: row.set_number,
      weightKg: row.weight_kg,
      reps: row.reps,
      completed: Boolean(row.completed),
      createdAt: row.created_at,
    };
  }

  private mapRoutineExerciseRow(ex: RoutineExerciseRow): RoutineExercise {
    return {
      id: ex.id,
      routineId: ex.routine_id,
      name: ex.name,
      muscleGroup: ex.muscle_group ?? undefined,
      targetSets: ex.target_sets,
      defaultRestSeconds: ex.default_rest_seconds,
      sortOrder: ex.sort_order,
    };
  }

  async getRoutines(): Promise<WorkoutRoutine[]> {
    const [routinesRes, exercisesRes] = await Promise.all([
      this.client
        .from('workout_routines')
        .select('id, name, description, sort_order, created_at')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })
        .returns<RoutineRow[]>(),
      this.client
        .from('routine_exercises')
        .select('id, routine_id, name, muscle_group, target_sets, default_rest_seconds, sort_order, created_at')
        .order('sort_order', { ascending: true })
        .returns<RoutineExerciseRow[]>(),
    ]);

    if (routinesRes.error) throw new Error(routinesRes.error.message);
    if (exercisesRes.error) throw new Error(exercisesRes.error.message);

    const exercisesByRoutine = new Map<string, RoutineExercise[]>();
    for (const ex of exercisesRes.data ?? []) {
      const list = exercisesByRoutine.get(ex.routine_id) ?? [];
      list.push(this.mapRoutineExerciseRow(ex));
      exercisesByRoutine.set(ex.routine_id, list);
    }

    return (routinesRes.data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description ?? undefined,
      sortOrder: r.sort_order,
      exercises: exercisesByRoutine.get(r.id) ?? [],
      createdAt: r.created_at,
    }));
  }

  async getRoutineById(id: string): Promise<WorkoutRoutine | null> {
    const [routineRes, exercisesRes] = await Promise.all([
      this.client
        .from('workout_routines')
        .select('id, name, description, sort_order, created_at')
        .eq('id', id)
        .maybeSingle<RoutineRow>(),
      this.client
        .from('routine_exercises')
        .select('id, routine_id, name, muscle_group, target_sets, default_rest_seconds, sort_order, created_at')
        .eq('routine_id', id)
        .order('sort_order', { ascending: true })
        .returns<RoutineExerciseRow[]>(),
    ]);

    if (routineRes.error) throw new Error(routineRes.error.message);
    if (!routineRes.data) return null;
    if (exercisesRes.error) throw new Error(exercisesRes.error.message);

    return {
      id: routineRes.data.id,
      name: routineRes.data.name,
      description: routineRes.data.description ?? undefined,
      sortOrder: routineRes.data.sort_order,
      exercises: (exercisesRes.data ?? []).map((ex) => this.mapRoutineExerciseRow(ex)),
      createdAt: routineRes.data.created_at,
    };
  }

  async createRoutine(
    routine: Omit<WorkoutRoutine, 'id' | 'createdAt'>,
    exercises: Omit<RoutineExercise, 'id' | 'routineId'>[] = []
  ): Promise<WorkoutRoutine> {
    const { data: createdRoutine, error: routineError } = await this.client
      .from('workout_routines')
      .insert({
        name: routine.name,
        description: routine.description ?? null,
        sort_order: routine.sortOrder ?? 0,
      })
      .select('id, name, description, sort_order, created_at')
      .single<RoutineRow>();

    if (routineError || !createdRoutine) {
      throw new Error(routineError?.message ?? 'Erro ao criar rotina.');
    }

    let createdExercises: RoutineExercise[] = [];
    if (exercises.length > 0) {
      const exercisePayload = exercises.map((ex, i) => ({
        routine_id: createdRoutine.id,
        name: ex.name,
        muscle_group: ex.muscleGroup ?? '',
        target_sets: ex.targetSets ?? 3,
        default_rest_seconds: ex.defaultRestSeconds ?? 60,
        sort_order: ex.sortOrder ?? i + 1,
      }));

      const { data: insertedExercises, error: exError } = await this.client
        .from('routine_exercises')
        .insert(exercisePayload)
        .select('id, routine_id, name, muscle_group, target_sets, default_rest_seconds, sort_order, created_at')
        .returns<RoutineExerciseRow[]>();

      if (exError) throw new Error(exError.message);
      createdExercises = (insertedExercises ?? []).map((ex) => this.mapRoutineExerciseRow(ex));
    }

    return {
      id: createdRoutine.id,
      name: createdRoutine.name,
      description: createdRoutine.description ?? undefined,
      sortOrder: createdRoutine.sort_order,
      exercises: createdExercises,
      createdAt: createdRoutine.created_at,
    };
  }

  async updateRoutine(
    id: string,
    routine: Partial<WorkoutRoutine>,
    exercises?: RoutineExercise[]
  ): Promise<void> {
    const payload: Record<string, unknown> = {};
    if (routine.name !== undefined) payload.name = routine.name;
    if (routine.description !== undefined) payload.description = routine.description ?? null;
    if (routine.sortOrder !== undefined) payload.sort_order = routine.sortOrder;

    if (Object.keys(payload).length > 0) {
      const { error } = await this.client
        .from('workout_routines')
        .update(payload)
        .eq('id', id);
      if (error) throw new Error(error.message);
    }

    if (exercises) {
      const { error: delError } = await this.client
        .from('routine_exercises')
        .delete()
        .eq('routine_id', id);
      if (delError) throw new Error(delError.message);

      if (exercises.length > 0) {
        const exercisePayload = exercises.map((ex, i) => ({
          routine_id: id,
          name: ex.name,
          muscle_group: ex.muscleGroup ?? '',
          target_sets: ex.targetSets,
          default_rest_seconds: ex.defaultRestSeconds,
          sort_order: ex.sortOrder ?? i + 1,
        }));

        const { error: insError } = await this.client
          .from('routine_exercises')
          .insert(exercisePayload);
        if (insError) throw new Error(insError.message);
      }
    }
  }

  async deleteRoutine(id: string): Promise<void> {
    const { error } = await this.client
      .from('workout_routines')
      .delete()
      .eq('id', id);
    if (error) throw new Error(error.message);
  }

  async getPreviousExerciseSets(exerciseName: string, targetSets = 10): Promise<SetLog[]> {
    const { data: latestSets, error: latestError } = await this.client
      .from('set_logs')
      .select('session_id, workout_sessions!inner(date, created_at)')
      .eq('exercise_name', exerciseName)
      .eq('completed', true)
      .order('date', { referencedTable: 'workout_sessions', ascending: false })
      .order('created_at', { referencedTable: 'workout_sessions', ascending: false })
      .limit(1);

    if (latestError) throw new Error(latestError.message);
    const latestSessionId = latestSets?.[0]?.session_id as string | undefined;
    if (!latestSessionId) return [];

    const { data: setRows, error: setsError } = await this.client
      .from('set_logs')
      .select('id, session_id, exercise_id, exercise_name, set_number, weight_kg, reps, completed, created_at')
      .eq('session_id', latestSessionId)
      .eq('exercise_name', exerciseName)
      .eq('completed', true)
      .order('set_number', { ascending: true })
      .limit(targetSets)
      .returns<SetLogRow[]>();

    if (setsError) throw new Error(setsError.message);
    return (setRows ?? []).map((r) => this.mapSetLogRow(r));
  }

  async saveWorkoutSession(
    session: WorkoutSessionInput,
    setsInput?: Omit<SetLog, 'id' | 'sessionId' | 'createdAt'>[]
  ): Promise<WorkoutSession> {
    const effectiveSets = setsInput ?? session.sets ?? [];

    let calculatedVolume = 0;
    for (const s of effectiveSets) {
      if (s.completed) {
        calculatedVolume += s.weightKg * s.reps;
      }
    }
    const totalVolumeKg =
      session.totalVolumeKg !== undefined ? session.totalVolumeKg : calculatedVolume;

    const { data: createdSession, error: sessionError } = await this.client
      .from('workout_sessions')
      .insert({
        routine_id: session.routineId ?? null,
        routine_name: session.routineName,
        date: session.date,
        start_time: session.startTime ?? null,
        end_time: session.endTime ?? null,
        duration_minutes: session.durationMinutes,
        total_volume_kg: totalVolumeKg,
        notes: session.notes ?? null,
      })
      .select('id, routine_id, routine_name, date, start_time, end_time, duration_minutes, total_volume_kg, notes, created_at')
      .single<WorkoutSessionRow>();

    if (sessionError || !createdSession) {
      throw new Error(sessionError?.message ?? 'Erro ao salvar sessão de treino.');
    }

    let savedSets: SetLog[] = [];
    if (effectiveSets.length > 0) {
      const setsPayload = effectiveSets.map((s) => ({
        session_id: createdSession.id,
        exercise_id: s.exerciseId ?? null,
        exercise_name: s.exerciseName,
        set_number: s.setNumber,
        weight_kg: s.weightKg,
        reps: s.reps,
        completed: Boolean(s.completed),
      }));

      const { data: insertedSets, error: setsError } = await this.client
        .from('set_logs')
        .insert(setsPayload)
        .select('id, session_id, exercise_id, exercise_name, set_number, weight_kg, reps, completed, created_at')
        .returns<SetLogRow[]>();

      if (setsError) throw new Error(setsError.message);
      savedSets = (insertedSets ?? []).map((r) => this.mapSetLogRow(r));
    }

    return {
      id: createdSession.id,
      routineId: createdSession.routine_id ?? undefined,
      routineName: createdSession.routine_name,
      date: createdSession.date,
      startTime: createdSession.start_time ?? undefined,
      endTime: createdSession.end_time ?? undefined,
      durationMinutes: createdSession.duration_minutes,
      totalVolumeKg: createdSession.total_volume_kg,
      notes: createdSession.notes ?? undefined,
      sets: savedSets,
      createdAt: createdSession.created_at,
    };
  }

  async getWorkoutSessions(limit = 20, offset = 0): Promise<WorkoutSession[]> {
    const { data: sessionsData, error: sessionsError } = await this.client
      .from('workout_sessions')
      .select('id, routine_id, routine_name, date, start_time, end_time, duration_minutes, total_volume_kg, notes, created_at')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
      .returns<WorkoutSessionRow[]>();

    if (sessionsError) throw new Error(sessionsError.message);
    const sessions = sessionsData ?? [];
    if (sessions.length === 0) return [];

    const sessionIds = sessions.map((s) => s.id);
    const { data: setsData, error: setsError } = await this.client
      .from('set_logs')
      .select('id, session_id, exercise_id, exercise_name, set_number, weight_kg, reps, completed, created_at')
      .in('session_id', sessionIds)
      .order('exercise_name', { ascending: true })
      .order('set_number', { ascending: true })
      .returns<SetLogRow[]>();

    if (setsError) throw new Error(setsError.message);

    const setsBySession = new Map<string, SetLog[]>();
    for (const s of setsData ?? []) {
      const list = setsBySession.get(s.session_id) ?? [];
      list.push(this.mapSetLogRow(s));
      setsBySession.set(s.session_id, list);
    }

    return sessions.map((row) => ({
      id: row.id,
      routineId: row.routine_id ?? undefined,
      routineName: row.routine_name,
      date: row.date,
      startTime: row.start_time ?? undefined,
      endTime: row.end_time ?? undefined,
      durationMinutes: row.duration_minutes,
      totalVolumeKg: row.total_volume_kg,
      notes: row.notes ?? undefined,
      sets: setsBySession.get(row.id) ?? [],
      createdAt: row.created_at,
    }));
  }

  async getSessionDetails(id: string): Promise<WorkoutSession | null> {
    const [sessionRes, setsRes] = await Promise.all([
      this.client
        .from('workout_sessions')
        .select('id, routine_id, routine_name, date, start_time, end_time, duration_minutes, total_volume_kg, notes, created_at')
        .eq('id', id)
        .maybeSingle<WorkoutSessionRow>(),
      this.client
        .from('set_logs')
        .select('id, session_id, exercise_id, exercise_name, set_number, weight_kg, reps, completed, created_at')
        .eq('session_id', id)
        .order('exercise_name', { ascending: true })
        .order('set_number', { ascending: true })
        .returns<SetLogRow[]>(),
    ]);

    if (sessionRes.error) throw new Error(sessionRes.error.message);
    if (!sessionRes.data) return null;
    if (setsRes.error) throw new Error(setsRes.error.message);

    const row = sessionRes.data;
    return {
      id: row.id,
      routineId: row.routine_id ?? undefined,
      routineName: row.routine_name,
      date: row.date,
      startTime: row.start_time ?? undefined,
      endTime: row.end_time ?? undefined,
      durationMinutes: row.duration_minutes,
      totalVolumeKg: row.total_volume_kg,
      notes: row.notes ?? undefined,
      sets: (setsRes.data ?? []).map((s) => this.mapSetLogRow(s)),
      createdAt: row.created_at,
    };
  }

  async getExerciseHistory(exerciseName: string): Promise<ExerciseHistoryPoint[]> {
    interface JoinedSetRow {
      session_id: string;
      weight_kg: number;
      reps: number;
      workout_sessions: { date: string } | { date: string }[] | null;
    }

    const { data, error } = await this.client
      .from('set_logs')
      .select('session_id, weight_kg, reps, workout_sessions!inner(date)')
      .eq('exercise_name', exerciseName)
      .eq('completed', true)
      .returns<JoinedSetRow[]>();

    if (error) throw new Error(error.message);

    const bySession = new Map<
      string,
      {
        date: string;
        maxWeightKg: number;
        totalVolumeKg: number;
        best1RM: number;
        bestSetReps: number;
      }
    >();

    for (const row of data ?? []) {
      const ws = Array.isArray(row.workout_sessions)
        ? row.workout_sessions[0]
        : row.workout_sessions;
      const date = ws?.date;
      if (!date) continue;

      const repsClamped = Math.min(Math.max(1, row.reps), 30);
      const set1RM =
        row.reps === 1
          ? row.weight_kg
          : Number((row.weight_kg * (36 / (37 - repsClamped))).toFixed(1));

      const existing = bySession.get(row.session_id);
      if (!existing) {
        bySession.set(row.session_id, {
          date,
          maxWeightKg: row.weight_kg,
          totalVolumeKg: row.weight_kg * row.reps,
          best1RM: set1RM,
          bestSetReps: row.reps,
        });
      } else {
        existing.maxWeightKg = Math.max(existing.maxWeightKg, row.weight_kg);
        existing.totalVolumeKg += row.weight_kg * row.reps;
        if (set1RM > existing.best1RM) {
          existing.best1RM = set1RM;
          existing.bestSetReps = row.reps;
        }
      }
    }

    return Array.from(bySession.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((item) => ({
        date: item.date,
        maxWeightKg: item.maxWeightKg,
        totalVolumeKg: Number(item.totalVolumeKg.toFixed(1)),
        estimated1RM: item.best1RM,
        bestSetReps: item.bestSetReps,
      }));
  }

  async getCustomExercises(): Promise<CustomExercise[]> {
    const { data, error } = await this.client
      .from('custom_exercises')
      .select('id, name, category, default_sets, default_rest_seconds, created_at')
      .order('name', { ascending: true })
      .returns<CustomExerciseRow[]>();

    if (error) throw new Error(error.message);

    return (data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      defaultSets: r.default_sets,
      defaultRestSeconds: r.default_rest_seconds,
      createdAt: r.created_at,
    }));
  }

  async createCustomExercise(
    data: Omit<CustomExercise, 'id' | 'createdAt'>
  ): Promise<CustomExercise> {
    const { data: inserted, error } = await this.client
      .from('custom_exercises')
      .insert({
        name: data.name.trim(),
        category: data.category.trim(),
        default_sets: data.defaultSets ?? 3,
        default_rest_seconds: data.defaultRestSeconds ?? 90,
      })
      .select('id, name, category, default_sets, default_rest_seconds, created_at')
      .single<CustomExerciseRow>();

    if (error || !inserted) throw new Error(error?.message ?? 'Erro ao criar exercício.');

    return {
      id: inserted.id,
      name: inserted.name,
      category: inserted.category,
      defaultSets: inserted.default_sets,
      defaultRestSeconds: inserted.default_rest_seconds,
      createdAt: inserted.created_at,
    };
  }
}
