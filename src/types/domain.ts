export type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner' | 'supper';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  isLoggedIn?: boolean;
  onboardingCompleted?: boolean;
  targetCalories: number;
  targetProtein: number;
  targetCarbs: number;
  targetFat: number;
  targetWaterMl: number;
  theme: 'dark' | 'light';
  targetWeightKg?: number;
  heightCm?: number;
  trainingGoal?: string;
  activityLevel?: string;
  createdAt: string;
  updatedAt?: string;
}


export interface FoodItem {
  id: string;
  name: string;
  nameNormalized?: string;
  category?: string;
  servingGrams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  barcode?: string;
  source: 'taco' | 'openfoodfacts' | 'custom' | 'recipe';
  servingUnitName?: string;
  servingUnitGrams?: number;
  createdAt?: string;
}

export interface DietLogEntry {
  id: string;
  date: string; // Format: YYYY-MM-DD
  mealType: MealType;
  foodId?: string;
  foodName: string;
  servingGrams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  createdAt: string;
}

export interface WaterLogEntry {
  id: string;
  date: string; // Format: YYYY-MM-DD
  amountMl: number;
  createdAt: string;
}

export interface DailyNutritionSummary {
  date: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalWaterMl: number;
  meals: {
    breakfast: DietLogEntry[];
    lunch: DietLogEntry[];
    snack: DietLogEntry[];
    dinner: DietLogEntry[];
    supper: DietLogEntry[];
  };
}

export interface CustomExercise {
  id: string;
  name: string;
  category: string;
  defaultSets: number;
  defaultRestSeconds: number;
  createdAt: string;
}

export interface RoutineExercise {
  id: string;
  routineId: string;
  name: string;
  muscleGroup?: string;
  targetSets: number;
  defaultRestSeconds: number;
  sortOrder: number;
}

export interface WorkoutRoutine {
  id: string;
  name: string;
  description?: string;
  sortOrder: number;
  exercises?: RoutineExercise[];
  createdAt: string;
}

export interface SetLog {
  id: string;
  sessionId: string;
  exerciseId?: string;
  exerciseName: string;
  setNumber: number;
  weightKg: number;
  reps: number;
  completed: boolean;
  createdAt: string;
}

export interface WorkoutSession {
  id: string;
  routineId?: string;
  routineName: string;
  date: string; // Format: YYYY-MM-DD
  startTime?: string;
  endTime?: string;
  durationMinutes: number;
  totalVolumeKg?: number;
  notes?: string;
  sets?: SetLog[];
  createdAt: string;
}

export interface ExerciseHistoryPoint {
  date: string;
  maxWeightKg: number;
  totalVolumeKg: number;
  estimated1RM: number;
  bestSetReps: number;
}

export interface BodyLog {
  id: string;
  date: string; // Format: YYYY-MM-DD
  weightKg: number;
  bodyFatPct?: number;
  waistCm?: number;
  chestCm?: number;
  armsCm?: number;
  legsCm?: number;
  photoUris?: string[];
  createdAt: string;
}

export interface WeightHistoryPoint {
  date: string;
  weightKg: number;
  movingAverage?: number | null;
}

export type PhotoPose = 'front' | 'side' | 'back' | 'other';

export interface ProgressPhotoItem {
  date: string;
  uri: string;
  pose?: PhotoPose;
  weightKg?: number;
  bodyFatPct?: number;
}

export interface PhotoDeltaMetrics {
  daysBetween: number;
  weightDeltaKg: number | null;
  bodyFatDeltaPct: number | null;
  waistDeltaCm: number | null;
}
