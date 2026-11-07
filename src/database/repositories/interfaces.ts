import {
  UserProfile,
  FoodItem,
  DietLogEntry,
  WaterLogEntry,
  DailyNutritionSummary,
  WorkoutRoutine,
  RoutineExercise,
  WorkoutSession,
  SetLog,
  ExerciseHistoryPoint,
  BodyLog,
  WeightHistoryPoint,
  CustomExercise,
} from '../../types/domain';

export interface ISqliteDatabase {
  runAsync(sql: string, ...params: any[]): Promise<{ lastInsertRowId: number; changes: number }>;
  getFirstAsync<T>(sql: string, ...params: any[]): Promise<T | null>;
  getAllAsync<T>(sql: string, ...params: any[]): Promise<T[]>;
  execAsync(sql: string): Promise<void>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

export interface RegisterUserInput {
  name: string;
  email: string;
  password?: string;
}

export interface LoginUserInput {
  email: string;
  password?: string;
}

export type TrainingGoal = 'hypertrophy' | 'cutting' | 'maintenance' | string;
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'intense' | 'very_active' | string;

export interface OnboardingData {
  heightCm: number;
  targetWeightKg: number;
  currentWeightKg?: number;
  trainingGoal: TrainingGoal;
  activityLevel: ActivityLevel;
  targetCalories?: number;
  targetProtein?: number;
  targetCarbs?: number;
  targetFat?: number;
  targetWaterMl?: number;
}

export interface IAuthRepository {
  getProfile(): Promise<UserProfile>;
  updateProfile(profile: Partial<UserProfile>): Promise<UserProfile>;
  setTheme(theme: 'dark' | 'light'): Promise<void>;
  getTheme(): Promise<'dark' | 'light'>;
  registerUser(input: RegisterUserInput): Promise<UserProfile>;
  loginUser(input: LoginUserInput): Promise<UserProfile>;
  logoutUser(): Promise<void>;
  completeOnboarding(data: OnboardingData): Promise<UserProfile>;
}

export interface IDietRepository {
  getDailyLogs(date: string): Promise<DietLogEntry[]>;
  addDietLog(entry: Omit<DietLogEntry, 'id' | 'createdAt'>): Promise<DietLogEntry>;
  updateDietLog(id: string, entry: Partial<DietLogEntry>): Promise<void>;
  deleteDietLog(id: string): Promise<void>;
  searchFoods(query: string, limit?: number): Promise<FoodItem[]>;
  getFoodByBarcode(barcode: string): Promise<FoodItem | null>;
  createFood(food: Omit<FoodItem, 'id' | 'createdAt'>): Promise<FoodItem>;
  getWaterLogs(date: string): Promise<WaterLogEntry[]>;
  addWaterLog(date: string, amountMl: number): Promise<WaterLogEntry>;
  deleteWaterLog(id: string): Promise<void>;
  resetWaterLogs(date: string): Promise<void>;
  getDailyWaterTotal(date: string): Promise<number>;
  decrementWaterLog(date: string, amountMl: number): Promise<WaterLogEntry | null>;
  getDailyNutritionSummary(date: string): Promise<DailyNutritionSummary>;
}

export interface WorkoutSessionInput {
  routineId?: string;
  routineName: string;
  date: string;
  startTime?: string;
  endTime?: string;
  durationMinutes: number;
  totalVolumeKg?: number;
  notes?: string;
  sets?: Omit<SetLog, 'id' | 'sessionId' | 'createdAt'>[];
}

export interface IWorkoutRepository {
  getRoutines(): Promise<WorkoutRoutine[]>;
  getRoutineById(id: string): Promise<WorkoutRoutine | null>;
  createRoutine(
    routine: Omit<WorkoutRoutine, 'id' | 'createdAt'>,
    exercises?: Omit<RoutineExercise, 'id' | 'routineId'>[]
  ): Promise<WorkoutRoutine>;
  updateRoutine(
    id: string,
    routine: Partial<WorkoutRoutine>,
    exercises?: RoutineExercise[]
  ): Promise<void>;
  deleteRoutine(id: string): Promise<void>;
  getPreviousExerciseSets(exerciseName: string, targetSets?: number): Promise<SetLog[]>;
  saveWorkoutSession(
    session: WorkoutSessionInput,
    sets?: Omit<SetLog, 'id' | 'sessionId' | 'createdAt'>[]
  ): Promise<WorkoutSession>;
  getWorkoutSessions(limit?: number, offset?: number): Promise<WorkoutSession[]>;
  getSessionDetails(id: string): Promise<WorkoutSession | null>;
  getExerciseHistory(exerciseName: string): Promise<ExerciseHistoryPoint[]>;
  getCustomExercises(): Promise<CustomExercise[]>;
  createCustomExercise(
    data: Omit<CustomExercise, 'id' | 'createdAt'>
  ): Promise<CustomExercise>;
}

export interface IBodyRepository {
  getBodyLog(date: string): Promise<BodyLog | null>;
  saveBodyLog(log: Omit<BodyLog, 'id' | 'createdAt'>): Promise<BodyLog>;
  getWeightHistory(startDate?: string, endDate?: string): Promise<WeightHistoryPoint[]>;
  calculateMovingAverage(date: string, windowDays?: number): Promise<number | null>;
  savePhoto(date: string, photoUri: string): Promise<string[]>;
  getPhotos(): Promise<{ date: string; uri: string }[]>;
  deletePhoto(date: string, photoUri: string): Promise<string[]>;
}

