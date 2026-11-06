import {
  IWorkoutRepository,
  ISqliteDatabase,
  WorkoutSessionInput,
} from './interfaces';
import {
  WorkoutRoutine,
  RoutineExercise,
  WorkoutSession,
  SetLog,
  ExerciseHistoryPoint,
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
  completed: number; // 0 or 1
  created_at: string;
}

export class SqliteWorkoutRepository implements IWorkoutRepository {
  constructor(private db: ISqliteDatabase) {}

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

  async getRoutines(): Promise<WorkoutRoutine[]> {
    const routineRows = await this.db.getAllAsync<RoutineRow>(
      `SELECT id, name, description, sort_order, created_at
       FROM workout_routines
       ORDER BY sort_order ASC, name ASC;`
    );

    const exerciseRows = await this.db.getAllAsync<RoutineExerciseRow>(
      `SELECT id, routine_id, name, muscle_group, target_sets, default_rest_seconds, sort_order, created_at
       FROM routine_exercises
       ORDER BY sort_order ASC;`
    );

    const exercisesByRoutine = new Map<string, RoutineExercise[]>();
    for (const ex of exerciseRows) {
      const list = exercisesByRoutine.get(ex.routine_id) ?? [];
      list.push({
        id: ex.id,
        routineId: ex.routine_id,
        name: ex.name,
        muscleGroup: ex.muscle_group ?? undefined,
        targetSets: ex.target_sets,
        defaultRestSeconds: ex.default_rest_seconds,
        sortOrder: ex.sort_order,
      });
      exercisesByRoutine.set(ex.routine_id, list);
    }

    return routineRows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description ?? undefined,
      sortOrder: r.sort_order,
      exercises: exercisesByRoutine.get(r.id) ?? [],
      createdAt: r.created_at,
    }));
  }

  async getRoutineById(id: string): Promise<WorkoutRoutine | null> {
    const r = await this.db.getFirstAsync<RoutineRow>(
      `SELECT id, name, description, sort_order, created_at
       FROM workout_routines
       WHERE id = ?;`,
      id
    );
    if (!r) return null;

    const exerciseRows = await this.db.getAllAsync<RoutineExerciseRow>(
      `SELECT id, routine_id, name, muscle_group, target_sets, default_rest_seconds, sort_order, created_at
       FROM routine_exercises
       WHERE routine_id = ?
       ORDER BY sort_order ASC;`,
      id
    );

    return {
      id: r.id,
      name: r.name,
      description: r.description ?? undefined,
      sortOrder: r.sort_order,
      exercises: exerciseRows.map((ex) => ({
        id: ex.id,
        routineId: ex.routine_id,
        name: ex.name,
        muscleGroup: ex.muscle_group ?? undefined,
        targetSets: ex.target_sets,
        defaultRestSeconds: ex.default_rest_seconds,
        sortOrder: ex.sort_order,
      })),
      createdAt: r.created_at,
    };
  }

  async createRoutine(
    routine: Omit<WorkoutRoutine, 'id' | 'createdAt'>,
    exercises: Omit<RoutineExercise, 'id' | 'routineId'>[] = []
  ): Promise<WorkoutRoutine> {
    const routineId = `routine-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const createdAt = new Date().toISOString();

    let createdRoutine: WorkoutRoutine;
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(
        `INSERT INTO workout_routines (id, name, description, sort_order, created_at)
         VALUES (?, ?, ?, ?, ?);`,
        routineId,
        routine.name,
        routine.description ?? null,
        routine.sortOrder ?? 0,
        createdAt
      );

      const createdExercises: RoutineExercise[] = [];
      for (let i = 0; i < exercises.length; i++) {
        const ex = exercises[i];
        const exId = `exercise-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 8)}`;
        await this.db.runAsync(
          `INSERT INTO routine_exercises (id, routine_id, name, muscle_group, target_sets, default_rest_seconds, sort_order, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
          exId,
          routineId,
          ex.name,
          ex.muscleGroup ?? null,
          ex.targetSets ?? 3,
          ex.defaultRestSeconds ?? 60,
          ex.sortOrder ?? i + 1,
          createdAt
        );
        createdExercises.push({
          id: exId,
          routineId,
          name: ex.name,
          muscleGroup: ex.muscleGroup,
          targetSets: ex.targetSets ?? 3,
          defaultRestSeconds: ex.defaultRestSeconds ?? 60,
          sortOrder: ex.sortOrder ?? i + 1,
        });
      }

      createdRoutine = {
        id: routineId,
        name: routine.name,
        description: routine.description,
        sortOrder: routine.sortOrder ?? 0,
        exercises: createdExercises,
        createdAt,
      };
    });

    return createdRoutine!;
  }

  async updateRoutine(
    id: string,
    routine: Partial<WorkoutRoutine>,
    exercises?: RoutineExercise[]
  ): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      const existing = await this.getRoutineById(id);
      if (!existing) return;

      await this.db.runAsync(
        `UPDATE workout_routines SET
           name = ?,
           description = ?,
           sort_order = ?
         WHERE id = ?;`,
        routine.name !== undefined ? routine.name : existing.name,
        routine.description !== undefined ? routine.description : existing.description ?? null,
        routine.sortOrder !== undefined ? routine.sortOrder : existing.sortOrder,
        id
      );

      if (exercises) {
        await this.db.runAsync(`DELETE FROM routine_exercises WHERE routine_id = ?;`, id);
        const now = new Date().toISOString();
        for (let i = 0; i < exercises.length; i++) {
          const ex = exercises[i];
          const exId = ex.id || `exercise-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 8)}`;
          await this.db.runAsync(
            `INSERT INTO routine_exercises (id, routine_id, name, muscle_group, target_sets, default_rest_seconds, sort_order, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
            exId,
            id,
            ex.name,
            ex.muscleGroup ?? null,
            ex.targetSets,
            ex.defaultRestSeconds,
            ex.sortOrder ?? i + 1,
            now
          );
        }
      }
    });
  }

  async deleteRoutine(id: string): Promise<void> {
    await this.db.runAsync(`DELETE FROM workout_routines WHERE id = ?;`, id);
  }

  async getPreviousExerciseSets(exerciseName: string, targetSets = 10): Promise<SetLog[]> {
    const rows = await this.db.getAllAsync<SetLogRow>(
      `SELECT s.id, s.session_id, s.exercise_id, s.exercise_name, s.set_number, s.weight_kg, s.reps, s.completed, s.created_at
       FROM set_logs s
       JOIN workout_sessions ws ON s.session_id = ws.id
       WHERE s.exercise_name = ? AND s.completed = 1
         AND ws.id = (
           SELECT ws2.id
           FROM workout_sessions ws2
           JOIN set_logs s2 ON ws2.id = s2.session_id
           WHERE s2.exercise_name = ? AND s2.completed = 1
           ORDER BY ws2.date DESC, ws2.created_at DESC
           LIMIT 1
         )
       ORDER BY s.set_number ASC
       LIMIT ?;`,
      exerciseName,
      exerciseName,
      targetSets
    );

    return rows.map((r) => this.mapSetLogRow(r));
  }

  async saveWorkoutSession(
    session: WorkoutSessionInput,
    setsInput?: Omit<SetLog, 'id' | 'sessionId' | 'createdAt'>[]
  ): Promise<WorkoutSession> {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const createdAt = new Date().toISOString();
    const effectiveSets = setsInput ?? session.sets ?? [];

    let calculatedVolume = 0;
    for (const s of effectiveSets) {
      if (s.completed) {
        calculatedVolume += s.weightKg * s.reps;
      }
    }
    const totalVolumeKg = session.totalVolumeKg !== undefined ? session.totalVolumeKg : calculatedVolume;

    let savedSession: WorkoutSession;
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(
        `INSERT INTO workout_sessions (id, routine_id, routine_name, date, start_time, end_time, duration_minutes, total_volume_kg, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        sessionId,
        session.routineId ?? null,
        session.routineName,
        session.date,
        session.startTime ?? null,
        session.endTime ?? null,
        session.durationMinutes,
        totalVolumeKg,
        session.notes ?? null,
        createdAt
      );

      const savedSets: SetLog[] = [];
      for (let i = 0; i < effectiveSets.length; i++) {
        const set = effectiveSets[i];
        const setId = `set-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 8)}`;
        const setCreatedAt = new Date().toISOString();
        const completedInt = set.completed ? 1 : 0;

        await this.db.runAsync(
          `INSERT INTO set_logs (id, session_id, exercise_id, exercise_name, set_number, weight_kg, reps, completed, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          setId,
          sessionId,
          set.exerciseId ?? null,
          set.exerciseName,
          set.setNumber,
          set.weightKg,
          set.reps,
          completedInt,
          setCreatedAt
        );

        savedSets.push({
          id: setId,
          sessionId,
          exerciseId: set.exerciseId,
          exerciseName: set.exerciseName,
          setNumber: set.setNumber,
          weightKg: set.weightKg,
          reps: set.reps,
          completed: set.completed,
          createdAt: setCreatedAt,
        });
      }

      savedSession = {
        id: sessionId,
        routineId: session.routineId,
        routineName: session.routineName,
        date: session.date,
        startTime: session.startTime,
        endTime: session.endTime,
        durationMinutes: session.durationMinutes,
        totalVolumeKg,
        notes: session.notes,
        sets: savedSets,
        createdAt,
      };
    });

    return savedSession!;
  }

  async getWorkoutSessions(limit = 20, offset = 0): Promise<WorkoutSession[]> {
    const rows = await this.db.getAllAsync<WorkoutSessionRow>(
      `SELECT id, routine_id, routine_name, date, start_time, end_time, duration_minutes, total_volume_kg, notes, created_at
       FROM workout_sessions
       ORDER BY date DESC, created_at DESC
       LIMIT ? OFFSET ?;`,
      limit,
      offset
    );

    const sessions: WorkoutSession[] = [];
    for (const row of rows) {
      const setRows = await this.db.getAllAsync<SetLogRow>(
        `SELECT id, session_id, exercise_id, exercise_name, set_number, weight_kg, reps, completed, created_at
         FROM set_logs
         WHERE session_id = ?
         ORDER BY exercise_name ASC, set_number ASC;`,
        row.id
      );

      sessions.push({
        id: row.id,
        routineId: row.routine_id ?? undefined,
        routineName: row.routine_name,
        date: row.date,
        startTime: row.start_time ?? undefined,
        endTime: row.end_time ?? undefined,
        durationMinutes: row.duration_minutes,
        totalVolumeKg: row.total_volume_kg,
        notes: row.notes ?? undefined,
        sets: setRows.map((s) => this.mapSetLogRow(s)),
        createdAt: row.created_at,
      });
    }

    return sessions;
  }

  async getSessionDetails(id: string): Promise<WorkoutSession | null> {
    const row = await this.db.getFirstAsync<WorkoutSessionRow>(
      `SELECT id, routine_id, routine_name, date, start_time, end_time, duration_minutes, total_volume_kg, notes, created_at
       FROM workout_sessions
       WHERE id = ?;`,
      id
    );
    if (!row) return null;

    const setRows = await this.db.getAllAsync<SetLogRow>(
      `SELECT id, session_id, exercise_id, exercise_name, set_number, weight_kg, reps, completed, created_at
       FROM set_logs
       WHERE session_id = ?
       ORDER BY exercise_name ASC, set_number ASC;`,
      id
    );

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
      sets: setRows.map((s) => this.mapSetLogRow(s)),
      createdAt: row.created_at,
    };
  }

  async getExerciseHistory(exerciseName: string): Promise<ExerciseHistoryPoint[]> {
    interface HistoryRow {
      date: string;
      max_weight: number;
      total_volume: number;
      best_reps: number;
      best_weight: number;
    }

    const rows = await this.db.getAllAsync<HistoryRow>(
      `SELECT 
         ws.date,
         MAX(s.weight_kg) as max_weight,
         SUM(s.weight_kg * s.reps) as total_volume,
         s.reps as best_reps,
         s.weight_kg as best_weight
       FROM set_logs s
       JOIN workout_sessions ws ON s.session_id = ws.id
       WHERE s.exercise_name = ? AND s.completed = 1
       GROUP BY ws.id, ws.date
       ORDER BY ws.date ASC;`,
      exerciseName
    );

    return rows.map((r) => {
      // Brzycki 1RM formula: weight * (36 / (37 - min(reps, 30)))
      const repsClamped = Math.min(Math.max(1, r.best_reps), 30);
      const estimated1RM =
        r.best_reps === 1
          ? r.best_weight
          : Number((r.best_weight * (36 / (37 - repsClamped))).toFixed(1));

      return {
        date: r.date,
        maxWeightKg: r.max_weight,
        totalVolumeKg: Number(r.total_volume.toFixed(1)),
        estimated1RM,
        bestSetReps: r.best_reps,
      };
    });
  }
}
