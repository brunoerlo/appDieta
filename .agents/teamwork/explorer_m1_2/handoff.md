# Implementation Blueprint: Domain Models, Seed Datasets & SQLite Repositories (Milestone M1)

**Document Reference**: `handoff.md`  
**Author**: `explorer_m1_2` (Domain Types, Seed Datasets & Repository Explorer)  
**Date**: 2026-11-06T14:12:00Z  
**Target Environment**: iPhone 16 (iOS via Expo Go / CNG), Expo SDK 58, React Native 0.88.1, TypeScript 5.9  
**Working Directory**: `/home/bruno/Documentos/app/.agents/teamwork/explorer_m1_2/`  

---

## 1. Observation

Direct observations from the workspace, specifications, and project documents:

1. **User Requirements (`ORIGINAL_REQUEST.md:16-17` & `Acceptance Criteria:36`):**
   - R1: "Implementar o banco de dados relacional local com `expo-sqlite` estruturado através do Repository Pattern (`DietRepository`, `WorkoutRepository`, `BodyRepository`, `AuthRepository`) com tipagem TypeScript completa."
   - Acceptance: "Os dados da tabela TACO/IBGE são carregados no banco local durante o primeiro uso e consultas por nome de alimento retornam resultados em menos de 100ms."
   - Acceptance: "Os repositórios (`DietRepository`, `WorkoutRepository`, `BodyRepository`, `AuthRepository`) implementam interfaces desacopladas da UI e passam em testes unitários automatizados cobrindo operações de CRUD."

2. **Architecture & Contracts (`PROJECT.md:20-40, 98-137, 171-182`):**
   - Code Layout specifies:
     - `src/types/`: shared domain TypeScript types
     - `src/database/seed/tacoFoods.ts`: TACO 42-item Brazilian food seed
     - `src/database/seed/defaultRoutines.ts`: default routines seed (ABC, Push/Pull/Legs)
     - `src/database/repositories/interfaces.ts`: `IDietRepository`, `IWorkoutRepository`, `IBodyRepository`, `IAuthRepository`
     - `src/database/repositories/SqliteDietRepository.ts`
     - `src/database/repositories/SqliteWorkoutRepository.ts`
     - `src/database/repositories/SqliteBodyRepository.ts`
     - `src/database/repositories/SqliteAuthRepository.ts`
   - Phase 1 offline SQLite must be decoupled from UI screens via Repository interfaces to allow Phase 2 Supabase transition without UI rewrites.

3. **Modern Expo SQLite API in SDK 58 (`explorer_survey_2/handoff.md:27-42`):**
   - Asynchronous methods in `expo-sqlite`:
     - `openDatabaseAsync(dbName)`
     - `db.execAsync(sql)` for batch execution
     - `db.runAsync(sql, ...params)` returning `{ lastInsertRowId: number, changes: number }`
     - `db.getFirstAsync<T>(sql, ...params)` returning `T | null`
     - `db.getAllAsync<T>(sql, ...params)` returning `T[]`
     - `db.withTransactionAsync(async () => { ... })` for transactional operations
   - SQLite table columns use `snake_case` (e.g. `serving_grams`, `workout_sessions`, `body_fat_pct`), whereas TypeScript models require `camelCase` (e.g. `servingGrams`, `workoutSessions`, `bodyFatPct`). Repositories are the designated boundary for bidirectional mapping.

4. **Curated Datasets (`explorer_survey_2/handoff.md:190-238`):**
   - TACO 4ª Edição standard food items per 100g edible portion: 42 Brazilian staple items across 8 categories (Carnes e Ovos, Pescados, Cereais e Leguminosas, Tubérculos, Panificação, Frutas, Gorduras e Óleos, Oleaginosas, Laticínios, Suplementos, Vegetais).
   - Standard routines: Brazilian gym split ABC (Peito/Tríceps/Ombros, Costas/Bíceps/Trapézio, Pernas/Abdômen) and Push/Pull/Legs (Empurrar, Puxar, Pernas/Core).

---

## 2. Logic Chain

1. **Decoupling Repositories via Database Client Interface:**
   - *Observation*: Repositories must run in React Native (Expo Go / iOS) using `expo-sqlite`, but must also pass automated unit tests (`tests/unit/`) running under Node.js / Jest (`ORIGINAL_REQUEST.md:58`, `PROJECT.md:187-193`).
   - *Reasoning*: If repositories directly import and bind to the native Expo runtime module, Jest test suites in headless Linux environments will fail without complex native mocks.
   - *Conclusion*: Repositories should receive an abstraction interface `ISqliteDatabase` in their constructor:
     ```typescript
     export interface ISqliteDatabase {
       runAsync(sql: string, ...params: any[]): Promise<{ lastInsertRowId: number; changes: number }>;
       getFirstAsync<T>(sql: string, ...params: any[]): Promise<T | null>;
       getAllAsync<T>(sql: string, ...params: any[]): Promise<T[]>;
       execAsync(sql: string): Promise<void>;
       withTransactionAsync<T>(task: () => Promise<T>): Promise<T>;
     }
     ```
     `SQLiteDatabase` from `expo-sqlite` natively satisfies `ISqliteDatabase`. In Jest, an in-memory test double or `better-sqlite3` adapter can implement `ISqliteDatabase`, guaranteeing 100% testability across both platforms.

2. **Snake_case to CamelCase Transformation Boundary:**
   - *Observation*: SQLite schemas use SQL conventions (`meal_type`, `food_id`, `serving_grams`, `target_calories`), while UI components expect standard TypeScript conventions (`mealType`, `foodId`, `servingGrams`, `targetCalories`).
   - *Reasoning*: Leaking snake_case column names into the React UI or state stores couples the presentation layer to the SQLite schema and violates separation of concerns.
   - *Conclusion*: Each repository must perform bidirectional transformations between SQL database rows and domain models inside repository methods.

3. **Deterministic Seeding & Idempotence:**
   - *Observation*: Seed execution happens on app startup or first migration. If an app restarts or re-runs migrations, duplicate entries must never be created.
   - *Reasoning*: Using dynamic random UUIDs during seeding would insert duplicate food items or routines every time seeding runs.
   - *Conclusion*: Seed records must have deterministic, semantic IDs (e.g., `taco-peito-frango-grelhado`, `routine-abc-a`), and seed insertion must use `INSERT OR IGNORE` or check existence before inserting.

4. **Previous Session Exercise Lookup Logic:**
   - *Observation*: In live workout execution, lifters need to see the exact weights and repetitions performed in the *most recent prior session* for that exercise (`ORIGINAL_REQUEST.md:45`).
   - *Reasoning*: A naive query might pick sets from the *current* session or random historical dates.
   - *Conclusion*: `SqliteWorkoutRepository.getPreviousExerciseSets` must query `set_logs` joined with `workout_sessions`, filtering for completed sets, ordered by `session.date DESC, session.created_at DESC`, scoped to the single most recent session ID containing that exercise, ordered by `set_number ASC`.

5. **7-Day Moving Average & Body Composition Formulas:**
   - *Observation*: Daily weigh-ins fluctuate due to fluid balance; 7-day rolling mean smooths the curve.
   - *Reasoning*: Incomplete data weeks must divide by the actual number of recorded days within $[date - 6\text{ days}, date]$, rather than dividing by 7 (which would artificially drop average weight by 50%+ if only 3 days were logged).
   - *Conclusion*: `SqliteBodyRepository.calculateMovingAverage` uses SQL `AVG(weight_kg)` over the 7-day date window `date >= date(?, '-6 days') AND date <= ?`.

---

## 3. Caveats

1. **SQLite Boolean Representation:**
   - SQLite stores booleans as integers (`0` and `1`). Repository mapping must explicitly convert `completed === 1` to `boolean` in TypeScript to avoid truthiness bugs in React components.
2. **Date Format Standard:**
   - All calendar dates are normalized strictly to ISO-8601 calendar strings: `YYYY-MM-DD`. Timestamps are full ISO-8601 UTC strings (`YYYY-MM-DDTHH:mm:ss.sssZ`).
3. **No Direct Application Source Modification:**
   - In accordance with explorer rules, this report provides the exact TypeScript implementation blueprint. Code implementation is performed by the assigned implementer agent.

---

## 4. Conclusion & Implementation Blueprint

The concrete implementation blueprint is structured below:

---

### 4.1 Domain Types (`src/types/domain.ts`)

```typescript
export type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner' | 'supper';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  targetCalories: number;
  targetProtein: number;
  targetCarbs: number;
  targetFat: number;
  targetWaterMl: number;
  theme: 'dark' | 'light';
  createdAt: string;
}

export interface FoodItem {
  id: string;
  name: string;
  category?: string;
  servingGrams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  barcode?: string;
  source: 'taco' | 'openfoodfacts' | 'custom';
  createdAt?: string;
}

export interface DietLogEntry {
  id: string;
  date: string; // YYYY-MM-DD
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
  date: string; // YYYY-MM-DD
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
  date: string; // YYYY-MM-DD
  durationMinutes: number;
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
  date: string; // YYYY-MM-DD
  weightKg: number;
  bodyFatPct?: number;
  waistCm?: number;
  chestCm?: number;
  armsCm?: number;
  legsCm?: number;
  photoUris: string[];
  createdAt: string;
}

export interface WeightHistoryPoint {
  date: string;
  weightKg: number;
  movingAverage?: number | null;
}
```

---

### 4.2 Repository Interfaces (`src/database/repositories/interfaces.ts`)

```typescript
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
} from '../../types/domain';

export interface ISqliteDatabase {
  runAsync(sql: string, ...params: any[]): Promise<{ lastInsertRowId: number; changes: number }>;
  getFirstAsync<T>(sql: string, ...params: any[]): Promise<T | null>;
  getAllAsync<T>(sql: string, ...params: any[]): Promise<T[]>;
  execAsync(sql: string): Promise<void>;
  withTransactionAsync<T>(task: () => Promise<T>): Promise<T>;
}

export interface IAuthRepository {
  getProfile(): Promise<UserProfile>;
  updateProfile(profile: Partial<UserProfile>): Promise<UserProfile>;
  setTheme(theme: 'dark' | 'light'): Promise<void>;
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
  getDailyNutritionSummary(date: string): Promise<DailyNutritionSummary>;
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
    session: Omit<WorkoutSession, 'id' | 'createdAt'>,
    sets: Omit<SetLog, 'id' | 'sessionId' | 'createdAt'>[]
  ): Promise<WorkoutSession>;
  getWorkoutSessions(limit?: number, offset?: number): Promise<WorkoutSession[]>;
  getSessionDetails(id: string): Promise<WorkoutSession | null>;
  getExerciseHistory(exerciseName: string): Promise<ExerciseHistoryPoint[]>;
}

export interface IBodyRepository {
  getBodyLog(date: string): Promise<BodyLog | null>;
  saveBodyLog(log: Omit<BodyLog, 'id' | 'createdAt'>): Promise<BodyLog>;
  getWeightHistory(startDate?: string, endDate?: string): Promise<WeightHistoryPoint[]>;
  calculateMovingAverage(date: string, windowDays?: number): Promise<number | null>;
  savePhoto(date: string, photoUri: string): Promise<string[]>;
  getPhotos(): Promise<{ date: string; uri: string }[]>;
}
```

---

### 4.3 TACO / IBGE Seed Dataset: 42 Brazilian Foods (`src/database/seed/tacoFoods.ts`)

```typescript
import { FoodItem } from '../../types/domain';

export const TACO_FOODS_SEED: Omit<FoodItem, 'createdAt'>[] = [
  {
    id: 'taco-peito-frango-grelhado',
    name: 'Peito de frango, grelhado',
    category: 'Carnes e Ovos',
    servingGrams: 100,
    calories: 159,
    protein: 32.0,
    carbs: 0.0,
    fat: 2.5,
    source: 'taco',
  },
  {
    id: 'taco-peito-frango-cozido',
    name: 'Peito de frango, cozido',
    category: 'Carnes e Ovos',
    servingGrams: 100,
    calories: 163,
    protein: 31.5,
    carbs: 0.0,
    fat: 3.2,
    source: 'taco',
  },
  {
    id: 'taco-carne-patinho-moido',
    name: 'Carne bovina, patinho moído',
    category: 'Carnes e Ovos',
    servingGrams: 100,
    calories: 219,
    protein: 35.9,
    carbs: 0.0,
    fat: 7.3,
    source: 'taco',
  },
  {
    id: 'taco-carne-alcatra-grelhada',
    name: 'Carne bovina, alcatra grelhada',
    category: 'Carnes e Ovos',
    servingGrams: 100,
    calories: 241,
    protein: 31.9,
    carbs: 0.0,
    fat: 11.6,
    source: 'taco',
  },
  {
    id: 'taco-ovo-galinha-cozido',
    name: 'Ovo de galinha, inteiro, cozido',
    category: 'Carnes e Ovos',
    servingGrams: 100,
    calories: 146,
    protein: 13.3,
    carbs: 0.6,
    fat: 9.5,
    source: 'taco',
  },
  {
    id: 'taco-clara-ovo-cozida',
    name: 'Clara de ovo, cozida',
    category: 'Carnes e Ovos',
    servingGrams: 100,
    calories: 54,
    protein: 13.4,
    carbs: 0.0,
    fat: 0.1,
    source: 'taco',
  },
  {
    id: 'taco-tilapia-file-grelhado',
    name: 'Tilápia, filé grelhado',
    category: 'Pescados',
    servingGrams: 100,
    calories: 128,
    protein: 26.2,
    carbs: 0.0,
    fat: 2.7,
    source: 'taco',
  },
  {
    id: 'taco-atum-solido-natural',
    name: 'Atum sólido em água/natural',
    category: 'Pescados',
    servingGrams: 100,
    calories: 116,
    protein: 26.0,
    carbs: 0.0,
    fat: 0.8,
    source: 'taco',
  },
  {
    id: 'taco-arroz-branco-cozido',
    name: 'Arroz branco, cozido',
    category: 'Cereais e Leguminosas',
    servingGrams: 100,
    calories: 128,
    protein: 2.5,
    carbs: 28.1,
    fat: 0.2,
    source: 'taco',
  },
  {
    id: 'taco-arroz-integral-cozido',
    name: 'Arroz integral, cozido',
    category: 'Cereais e Leguminosas',
    servingGrams: 100,
    calories: 124,
    protein: 2.6,
    carbs: 25.8,
    fat: 1.0,
    source: 'taco',
  },
  {
    id: 'taco-feijao-carioca-cozido',
    name: 'Feijão carioca, cozido',
    category: 'Cereais e Leguminosas',
    servingGrams: 100,
    calories: 76,
    protein: 4.8,
    carbs: 13.6,
    fat: 0.5,
    source: 'taco',
  },
  {
    id: 'taco-feijao-preto-cozido',
    name: 'Feijão preto, cozido',
    category: 'Cereais e Leguminosas',
    servingGrams: 100,
    calories: 77,
    protein: 4.5,
    carbs: 14.0,
    fat: 0.5,
    source: 'taco',
  },
  {
    id: 'taco-batata-doce-cozida',
    name: 'Batata doce, cozida',
    category: 'Tubérculos',
    servingGrams: 100,
    calories: 77,
    protein: 0.6,
    carbs: 18.4,
    fat: 0.1,
    source: 'taco',
  },
  {
    id: 'taco-batata-inglesa-cozida',
    name: 'Batata inglesa, cozida',
    category: 'Tubérculos',
    servingGrams: 100,
    calories: 52,
    protein: 1.2,
    carbs: 11.9,
    fat: 0.0,
    source: 'taco',
  },
  {
    id: 'taco-mandioca-cozida',
    name: 'Mandioca / aipim, cozida',
    category: 'Tubérculos',
    servingGrams: 100,
    calories: 125,
    protein: 0.6,
    carbs: 30.1,
    fat: 0.3,
    source: 'taco',
  },
  {
    id: 'taco-aveia-flocos',
    name: 'Aveia em flocos',
    category: 'Cereais',
    servingGrams: 100,
    calories: 394,
    protein: 13.9,
    carbs: 66.6,
    fat: 8.5,
    source: 'taco',
  },
  {
    id: 'taco-tapioca-goma',
    name: 'Tapioca (goma hidratada)',
    category: 'Tubérculos',
    servingGrams: 100,
    calories: 240,
    protein: 0.0,
    carbs: 60.0,
    fat: 0.0,
    source: 'taco',
  },
  {
    id: 'taco-pao-frances',
    name: 'Pão francês',
    category: 'Panificação',
    servingGrams: 100,
    calories: 300,
    protein: 8.0,
    carbs: 58.6,
    fat: 3.1,
    source: 'taco',
  },
  {
    id: 'taco-pao-integral',
    name: 'Pão de forma integral',
    category: 'Panificação',
    servingGrams: 100,
    calories: 253,
    protein: 9.4,
    carbs: 49.9,
    fat: 3.7,
    source: 'taco',
  },
  {
    id: 'taco-banana-prata',
    name: 'Banana prata, crua',
    category: 'Frutas',
    servingGrams: 100,
    calories: 98,
    protein: 1.3,
    carbs: 26.0,
    fat: 0.1,
    source: 'taco',
  },
  {
    id: 'taco-banana-nanica',
    name: 'Banana nanica, crua',
    category: 'Frutas',
    servingGrams: 100,
    calories: 92,
    protein: 1.4,
    carbs: 23.8,
    fat: 0.1,
    source: 'taco',
  },
  {
    id: 'taco-maca-fuji',
    name: 'Maçã fuji com casca',
    category: 'Frutas',
    servingGrams: 100,
    calories: 56,
    protein: 0.3,
    carbs: 15.2,
    fat: 0.0,
    source: 'taco',
  },
  {
    id: 'taco-mamao-papaia',
    name: 'Mamão papaia',
    category: 'Frutas',
    servingGrams: 100,
    calories: 40,
    protein: 0.5,
    carbs: 10.4,
    fat: 0.1,
    source: 'taco',
  },
  {
    id: 'taco-morango',
    name: 'Morango',
    category: 'Frutas',
    servingGrams: 100,
    calories: 30,
    protein: 0.9,
    carbs: 6.8,
    fat: 0.3,
    source: 'taco',
  },
  {
    id: 'taco-abacate',
    name: 'Abacate',
    category: 'Frutas',
    servingGrams: 100,
    calories: 96,
    protein: 1.2,
    carbs: 6.0,
    fat: 8.4,
    source: 'taco',
  },
  {
    id: 'taco-azeite-oliva',
    name: 'Azeite de oliva extra virgem',
    category: 'Gorduras e Óleos',
    servingGrams: 100,
    calories: 884,
    protein: 0.0,
    carbs: 0.0,
    fat: 100.0,
    source: 'taco',
  },
  {
    id: 'taco-pasta-amendoim',
    name: 'Pasta de amendoim integral',
    category: 'Gorduras e Óleos',
    servingGrams: 100,
    calories: 588,
    protein: 25.0,
    carbs: 20.0,
    fat: 50.0,
    source: 'taco',
  },
  {
    id: 'taco-castanha-do-para',
    name: 'Castanha-do-pará',
    category: 'Oleaginosas',
    servingGrams: 100,
    calories: 643,
    protein: 14.5,
    carbs: 15.1,
    fat: 63.5,
    source: 'taco',
  },
  {
    id: 'taco-castanha-caju',
    name: 'Castanha-de-caju torrada',
    category: 'Oleaginosas',
    servingGrams: 100,
    calories: 570,
    protein: 18.5,
    carbs: 29.1,
    fat: 46.3,
    source: 'taco',
  },
  {
    id: 'taco-leite-integral',
    name: 'Leite de vaca integral',
    category: 'Laticínios',
    servingGrams: 100,
    calories: 60,
    protein: 3.2,
    carbs: 4.8,
    fat: 3.2,
    source: 'taco',
  },
  {
    id: 'taco-leite-desnatado',
    name: 'Leite de vaca desnatado',
    category: 'Laticínios',
    servingGrams: 100,
    calories: 35,
    protein: 3.4,
    carbs: 5.0,
    fat: 0.1,
    source: 'taco',
  },
  {
    id: 'taco-queijo-minas',
    name: 'Queijo minas frescal',
    category: 'Laticínios',
    servingGrams: 100,
    calories: 264,
    protein: 17.4,
    carbs: 3.2,
    fat: 20.2,
    source: 'taco',
  },
  {
    id: 'taco-queijo-cottage',
    name: 'Queijo cottage',
    category: 'Laticínios',
    servingGrams: 100,
    calories: 98,
    protein: 11.1,
    carbs: 3.4,
    fat: 4.3,
    source: 'taco',
  },
  {
    id: 'taco-queijo-mucarela',
    name: 'Queijo muçarela',
    category: 'Laticínios',
    servingGrams: 100,
    calories: 281,
    protein: 22.6,
    carbs: 3.0,
    fat: 20.0,
    source: 'taco',
  },
  {
    id: 'taco-iogurte-integral',
    name: 'Iogurte natural integral',
    category: 'Laticínios',
    servingGrams: 100,
    calories: 61,
    protein: 3.5,
    carbs: 4.7,
    fat: 3.2,
    source: 'taco',
  },
  {
    id: 'taco-iogurte-desnatado',
    name: 'Iogurte natural desnatado',
    category: 'Laticínios',
    servingGrams: 100,
    calories: 41,
    protein: 4.1,
    carbs: 5.8,
    fat: 0.3,
    source: 'taco',
  },
  {
    id: 'taco-whey-protein',
    name: 'Whey Protein Concentrado 80%',
    category: 'Suplementos',
    servingGrams: 100,
    calories: 400,
    protein: 80.0,
    carbs: 8.0,
    fat: 6.0,
    source: 'taco',
  },
  {
    id: 'taco-creatina',
    name: 'Creatina monohidratada',
    category: 'Suplementos',
    servingGrams: 100,
    calories: 0,
    protein: 0.0,
    carbs: 0.0,
    fat: 0.0,
    source: 'taco',
  },
  {
    id: 'taco-brocolis-cozido',
    name: 'Brócolis cozido',
    category: 'Vegetais',
    servingGrams: 100,
    calories: 25,
    protein: 2.1,
    carbs: 4.4,
    fat: 0.5,
    source: 'taco',
  },
  {
    id: 'taco-cenoura-crua',
    name: 'Cenoura crua',
    category: 'Vegetais',
    servingGrams: 100,
    calories: 34,
    protein: 1.3,
    carbs: 7.7,
    fat: 0.2,
    source: 'taco',
  },
  {
    id: 'taco-alface-crespa',
    name: 'Alface crespa/americana',
    category: 'Vegetais',
    servingGrams: 100,
    calories: 11,
    protein: 1.3,
    carbs: 1.7,
    fat: 0.2,
    source: 'taco',
  },
  {
    id: 'taco-tomate',
    name: 'Tomate',
    category: 'Vegetais',
    servingGrams: 100,
    calories: 15,
    protein: 1.1,
    carbs: 3.1,
    fat: 0.2,
    source: 'taco',
  },
];
```

---

### 4.4 Standard Workout Routines Seed: ABC & Push/Pull/Legs (`src/database/seed/defaultRoutines.ts`)

```typescript
export interface SeedRoutineExercise {
  name: string;
  muscleGroup: string;
  targetSets: number;
  defaultRestSeconds: number;
  sortOrder: number;
}

export interface SeedWorkoutRoutine {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
  exercises: SeedRoutineExercise[];
}

export const DEFAULT_ROUTINES_SEED: SeedWorkoutRoutine[] = [
  // --- DIVISÃO ABC ---
  {
    id: 'routine-abc-a',
    name: 'Treino A - Peito, Tríceps e Ombros',
    description: 'Divisão ABC clássica: peitoral, deltoides anteriores/laterais e tríceps',
    sortOrder: 1,
    exercises: [
      { name: 'Supino Reto com Barra', muscleGroup: 'Peito', targetSets: 4, defaultRestSeconds: 90, sortOrder: 1 },
      { name: 'Supino Inclinado com Halteres', muscleGroup: 'Peito', targetSets: 3, defaultRestSeconds: 75, sortOrder: 2 },
      { name: 'Crossover na Polia Média', muscleGroup: 'Peito', targetSets: 3, defaultRestSeconds: 60, sortOrder: 3 },
      { name: 'Desenvolvimento com Halteres', muscleGroup: 'Ombros', targetSets: 3, defaultRestSeconds: 75, sortOrder: 4 },
      { name: 'Elevação Lateral na Polia', muscleGroup: 'Ombros', targetSets: 4, defaultRestSeconds: 60, sortOrder: 5 },
      { name: 'Tríceps Corda na Polia', muscleGroup: 'Tríceps', targetSets: 3, defaultRestSeconds: 60, sortOrder: 6 },
      { name: 'Tríceps Testa com Barra W', muscleGroup: 'Tríceps', targetSets: 3, defaultRestSeconds: 60, sortOrder: 7 },
    ],
  },
  {
    id: 'routine-abc-b',
    name: 'Treino B - Costas, Bíceps e Trapézio',
    description: 'Divisão ABC clássica: dorsais, deltoides posteriores, trapézio e flexores do braço',
    sortOrder: 2,
    exercises: [
      { name: 'Puxada Alta Aberta', muscleGroup: 'Costas', targetSets: 4, defaultRestSeconds: 90, sortOrder: 1 },
      { name: 'Remada Curvada com Barra', muscleGroup: 'Costas', targetSets: 4, defaultRestSeconds: 90, sortOrder: 2 },
      { name: 'Remada Baixa no Triângulo', muscleGroup: 'Costas', targetSets: 3, defaultRestSeconds: 75, sortOrder: 3 },
      { name: 'Crucifixo Invertido com Halteres', muscleGroup: 'Deltoides', targetSets: 3, defaultRestSeconds: 60, sortOrder: 4 },
      { name: 'Encolhimento com Halteres', muscleGroup: 'Trapézio', targetSets: 3, defaultRestSeconds: 60, sortOrder: 5 },
      { name: 'Rosca Direta com Barra W', muscleGroup: 'Bíceps', targetSets: 3, defaultRestSeconds: 60, sortOrder: 6 },
      { name: 'Rosca Martelo com Halteres', muscleGroup: 'Bíceps', targetSets: 3, defaultRestSeconds: 60, sortOrder: 7 },
    ],
  },
  {
    id: 'routine-abc-c',
    name: 'Treino C - Pernas Completo e Abdômen',
    description: 'Divisão ABC clássica: quadríceps, posteriores, glúteos, panturrilhas e abdômen',
    sortOrder: 3,
    exercises: [
      { name: 'Agachamento Livre com Barra', muscleGroup: 'Pernas', targetSets: 4, defaultRestSeconds: 120, sortOrder: 1 },
      { name: 'Leg Press 45°', muscleGroup: 'Pernas', targetSets: 4, defaultRestSeconds: 90, sortOrder: 2 },
      { name: 'Cadeira Extensora', muscleGroup: 'Pernas', targetSets: 3, defaultRestSeconds: 60, sortOrder: 3 },
      { name: 'Mesa Flexora', muscleGroup: 'Pernas', targetSets: 4, defaultRestSeconds: 75, sortOrder: 4 },
      { name: 'Stiff com Halteres', muscleGroup: 'Pernas', targetSets: 3, defaultRestSeconds: 75, sortOrder: 5 },
      { name: 'Panturrilha em Pé na Máquina', muscleGroup: 'Panturrilha', targetSets: 4, defaultRestSeconds: 45, sortOrder: 6 },
      { name: 'Abdominal Supra na Polia', muscleGroup: 'Abdômen', targetSets: 3, defaultRestSeconds: 45, sortOrder: 7 },
    ],
  },
  // --- DIVISÃO PUSH / PULL / LEGS (PPL) ---
  {
    id: 'routine-ppl-push',
    name: 'Push (Empurrar)',
    description: 'Divisão PPL: foco em peitoral, deltoide anterior e tríceps',
    sortOrder: 4,
    exercises: [
      { name: 'Supino Reto com Halteres', muscleGroup: 'Peito', targetSets: 4, defaultRestSeconds: 90, sortOrder: 1 },
      { name: 'Supino Inclinado com Barra', muscleGroup: 'Peito', targetSets: 3, defaultRestSeconds: 90, sortOrder: 2 },
      { name: 'Paralelas / Dips', muscleGroup: 'Peito/Tríceps', targetSets: 3, defaultRestSeconds: 75, sortOrder: 3 },
      { name: 'Desenvolvimento Militar em Pé', muscleGroup: 'Ombros', targetSets: 4, defaultRestSeconds: 90, sortOrder: 4 },
      { name: 'Elevação Lateral com Halteres', muscleGroup: 'Ombros', targetSets: 4, defaultRestSeconds: 60, sortOrder: 5 },
      { name: 'Tríceps Francês com Halter', muscleGroup: 'Tríceps', targetSets: 3, defaultRestSeconds: 60, sortOrder: 6 },
    ],
  },
  {
    id: 'routine-ppl-pull',
    name: 'Pull (Puxar)',
    description: 'Divisão PPL: foco em costas, deltoide posterior, trapézio e bíceps',
    sortOrder: 5,
    exercises: [
      { name: 'Barra Fixa (Pronada ou Supinada)', muscleGroup: 'Costas', targetSets: 4, defaultRestSeconds: 90, sortOrder: 1 },
      { name: 'Levantamento Terra Convencional', muscleGroup: 'Costas/Pernas', targetSets: 3, defaultRestSeconds: 120, sortOrder: 2 },
      { name: 'Remada Unilateral (Serrote)', muscleGroup: 'Costas', targetSets: 3, defaultRestSeconds: 75, sortOrder: 3 },
      { name: 'Face Pull na Polia com Corda', muscleGroup: 'Deltoides', targetSets: 4, defaultRestSeconds: 60, sortOrder: 4 },
      { name: 'Rosca Scott com Barra W', muscleGroup: 'Bíceps', targetSets: 3, defaultRestSeconds: 60, sortOrder: 5 },
      { name: 'Rosca Inclinada com Halteres', muscleGroup: 'Bíceps', targetSets: 3, defaultRestSeconds: 60, sortOrder: 6 },
    ],
  },
  {
    id: 'routine-ppl-legs',
    name: 'Legs (Pernas & Core)',
    description: 'Divisão PPL: membros inferiores completos e estabilização do core',
    sortOrder: 6,
    exercises: [
      { name: 'Agachamento Búlgaro com Halteres', muscleGroup: 'Pernas', targetSets: 3, defaultRestSeconds: 90, sortOrder: 1 },
      { name: 'Cadeira Flexora', muscleGroup: 'Pernas', targetSets: 4, defaultRestSeconds: 75, sortOrder: 2 },
      { name: 'Cadeira Extensora', muscleGroup: 'Pernas', targetSets: 4, defaultRestSeconds: 60, sortOrder: 3 },
      { name: 'Elevação Pélvica com Barra', muscleGroup: 'Glúteos', targetSets: 4, defaultRestSeconds: 90, sortOrder: 4 },
      { name: 'Panturrilha no Leg Press', muscleGroup: 'Panturrilha', targetSets: 4, defaultRestSeconds: 45, sortOrder: 5 },
      { name: 'Prancha Abdominal Isométrica', muscleGroup: 'Core', targetSets: 3, defaultRestSeconds: 45, sortOrder: 6 },
    ],
  },
];
```

---

### 4.5 Repository Implementation: `SqliteAuthRepository` (`src/database/repositories/SqliteAuthRepository.ts`)

```typescript
import { IAuthRepository, ISqliteDatabase } from './interfaces';
import { UserProfile } from '../../types/domain';

interface UserRow {
  id: string;
  email: string;
  name: string;
  target_calories: number;
  target_protein: number;
  target_carbs: number;
  target_fat: number;
  target_water_ml: number;
  theme: 'dark' | 'light';
  created_at: string;
}

export class SqliteAuthRepository implements IAuthRepository {
  constructor(private db: ISqliteDatabase) {}

  private mapRow(row: UserRow): UserProfile {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      targetCalories: row.target_calories,
      targetProtein: row.target_protein,
      targetCarbs: row.target_carbs,
      targetFat: row.target_fat,
      targetWaterMl: row.target_water_ml,
      theme: row.theme,
      createdAt: row.created_at,
    };
  }

  async getProfile(): Promise<UserProfile> {
    const row = await this.db.getFirstAsync<UserRow>(
      `SELECT id, email, name, target_calories, target_protein, target_carbs, target_fat, target_water_ml, theme, created_at
       FROM users
       LIMIT 1;`
    );

    if (row) {
      return this.mapRow(row);
    }

    // Default profile fallback if table is empty
    const defaultId = 'user-default';
    const now = new Date().toISOString();
    await this.db.runAsync(
      `INSERT INTO users (id, email, name, target_calories, target_protein, target_carbs, target_fat, target_water_ml, theme, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      defaultId,
      'atleta@irontrack.app',
      'Atleta IronTrack',
      2000,
      150.0,
      200.0,
      65.0,
      3000,
      'dark',
      now
    );

    return {
      id: defaultId,
      email: 'atleta@irontrack.app',
      name: 'Atleta IronTrack',
      targetCalories: 2000,
      targetProtein: 150.0,
      targetCarbs: 200.0,
      targetFat: 65.0,
      targetWaterMl: 3000,
      theme: 'dark',
      createdAt: now,
    };
  }

  async updateProfile(profile: Partial<UserProfile>): Promise<UserProfile> {
    const current = await this.getProfile();
    const updated: UserProfile = {
      ...current,
      ...profile,
    };

    await this.db.runAsync(
      `UPDATE users SET
         name = ?,
         email = ?,
         target_calories = ?,
         target_protein = ?,
         target_carbs = ?,
         target_fat = ?,
         target_water_ml = ?,
         theme = ?
       WHERE id = ?;`,
      updated.name,
      updated.email,
      updated.targetCalories,
      updated.targetProtein,
      updated.targetCarbs,
      updated.targetFat,
      updated.targetWaterMl,
      updated.theme,
      updated.id
    );

    return updated;
  }

  async setTheme(theme: 'dark' | 'light'): Promise<void> {
    const profile = await this.getProfile();
    await this.db.runAsync(
      `UPDATE users SET theme = ? WHERE id = ?;`,
      theme,
      profile.id
    );
  }
}
```

---

### 4.6 Repository Implementation: `SqliteDietRepository` (`src/database/repositories/SqliteDietRepository.ts`)

```typescript
import { IDietRepository, ISqliteDatabase } from './interfaces';
import {
  DietLogEntry,
  FoodItem,
  WaterLogEntry,
  DailyNutritionSummary,
  MealType,
} from '../../types/domain';

interface DietLogRow {
  id: string;
  date: string;
  meal_type: MealType;
  food_id: string | null;
  food_name: string;
  serving_grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  created_at: string;
}

interface FoodRow {
  id: string;
  name: string;
  category: string | null;
  serving_grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  barcode: string | null;
  source: 'taco' | 'openfoodfacts' | 'custom';
  created_at: string;
}

interface WaterLogRow {
  id: string;
  date: string;
  amount_ml: number;
  created_at: string;
}

export class SqliteDietRepository implements IDietRepository {
  constructor(private db: ISqliteDatabase) {}

  private mapDietRow(row: DietLogRow): DietLogEntry {
    return {
      id: row.id,
      date: row.date,
      mealType: row.meal_type,
      foodId: row.food_id ?? undefined,
      foodName: row.food_name,
      servingGrams: row.serving_grams,
      calories: row.calories,
      protein: row.protein,
      carbs: row.carbs,
      fat: row.fat,
      createdAt: row.created_at,
    };
  }

  private mapFoodRow(row: FoodRow): FoodItem {
    return {
      id: row.id,
      name: row.name,
      category: row.category ?? undefined,
      servingGrams: row.serving_grams,
      calories: row.calories,
      protein: row.protein,
      carbs: row.carbs,
      fat: row.fat,
      barcode: row.barcode ?? undefined,
      source: row.source,
      createdAt: row.created_at,
    };
  }

  async getDailyLogs(date: string): Promise<DietLogEntry[]> {
    const rows = await this.db.getAllAsync<DietLogRow>(
      `SELECT id, date, meal_type, food_id, food_name, serving_grams, calories, protein, carbs, fat, created_at
       FROM diet_logs
       WHERE date = ?
       ORDER BY created_at ASC;`,
      date
    );
    return rows.map((r) => this.mapDietRow(r));
  }

  async addDietLog(entry: Omit<DietLogEntry, 'id' | 'createdAt'>): Promise<DietLogEntry> {
    const id = `diet-log-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const createdAt = new Date().toISOString();

    await this.db.runAsync(
      `INSERT INTO diet_logs (id, date, meal_type, food_id, food_name, serving_grams, calories, protein, carbs, fat, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      id,
      entry.date,
      entry.mealType,
      entry.foodId ?? null,
      entry.foodName,
      entry.servingGrams,
      entry.calories,
      entry.protein,
      entry.carbs,
      entry.fat,
      createdAt
    );

    return {
      ...entry,
      id,
      createdAt,
    };
  }

  async updateDietLog(id: string, entry: Partial<DietLogEntry>): Promise<void> {
    await this.db.runAsync(
      `UPDATE diet_logs SET
         serving_grams = COALESCE(?, serving_grams),
         calories = COALESCE(?, calories),
         protein = COALESCE(?, protein),
         carbs = COALESCE(?, carbs),
         fat = COALESCE(?, fat),
         meal_type = COALESCE(?, meal_type)
       WHERE id = ?;`,
      entry.servingGrams ?? null,
      entry.calories ?? null,
      entry.protein ?? null,
      entry.carbs ?? null,
      entry.fat ?? null,
      entry.mealType ?? null,
      id
    );
  }

  async deleteDietLog(id: string): Promise<void> {
    await this.db.runAsync(`DELETE FROM diet_logs WHERE id = ?;`, id);
  }

  async searchFoods(query: string, limit = 50): Promise<FoodItem[]> {
    const sanitized = query.trim();
    if (!sanitized) return [];

    const wildcard = `%${sanitized}%`;
    const prefix = `${sanitized}%`;

    const rows = await this.db.getAllAsync<FoodRow>(
      `SELECT id, name, category, serving_grams, calories, protein, carbs, fat, barcode, source, created_at
       FROM foods
       WHERE name LIKE ?
       ORDER BY
         CASE WHEN name LIKE ? THEN 1 ELSE 2 END,
         name ASC
       LIMIT ?;`,
      wildcard,
      prefix,
      limit
    );

    return rows.map((r) => this.mapFoodRow(r));
  }

  async getFoodByBarcode(barcode: string): Promise<FoodItem | null> {
    const row = await this.db.getFirstAsync<FoodRow>(
      `SELECT id, name, category, serving_grams, calories, protein, carbs, fat, barcode, source, created_at
       FROM foods
       WHERE barcode = ?
       LIMIT 1;`,
      barcode.trim()
    );

    return row ? this.mapFoodRow(row) : null;
  }

  async createFood(food: Omit<FoodItem, 'id' | 'createdAt'>): Promise<FoodItem> {
    const id = `food-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const createdAt = new Date().toISOString();

    await this.db.runAsync(
      `INSERT INTO foods (id, name, category, serving_grams, calories, protein, carbs, fat, barcode, source, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      id,
      food.name,
      food.category ?? null,
      food.servingGrams,
      food.calories,
      food.protein,
      food.carbs,
      food.fat,
      food.barcode ?? null,
      food.source,
      createdAt
    );

    return {
      ...food,
      id,
      createdAt,
    };
  }

  async getWaterLogs(date: string): Promise<WaterLogEntry[]> {
    const rows = await this.db.getAllAsync<WaterLogRow>(
      `SELECT id, date, amount_ml, created_at
       FROM water_logs
       WHERE date = ?
       ORDER BY created_at ASC;`,
      date
    );

    return rows.map((r) => ({
      id: r.id,
      date: r.date,
      amountMl: r.amount_ml,
      createdAt: r.created_at,
    }));
  }

  async addWaterLog(date: string, amountMl: number): Promise<WaterLogEntry> {
    const id = `water-log-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const createdAt = new Date().toISOString();

    await this.db.runAsync(
      `INSERT INTO water_logs (id, date, amount_ml, created_at)
       VALUES (?, ?, ?, ?);`,
      id,
      date,
      amountMl,
      createdAt
    );

    return { id, date, amountMl, createdAt };
  }

  async deleteWaterLog(id: string): Promise<void> {
    await this.db.runAsync(`DELETE FROM water_logs WHERE id = ?;`, id);
  }

  async resetWaterLogs(date: string): Promise<void> {
    await this.db.runAsync(`DELETE FROM water_logs WHERE date = ?;`, date);
  }

  async getDailyNutritionSummary(date: string): Promise<DailyNutritionSummary> {
    const logs = await this.getDailyLogs(date);
    const waterLogs = await this.getWaterLogs(date);

    const meals = {
      breakfast: [] as DietLogEntry[],
      lunch: [] as DietLogEntry[],
      snack: [] as DietLogEntry[],
      dinner: [] as DietLogEntry[],
      supper: [] as DietLogEntry[],
    };

    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;

    for (const log of logs) {
      totalCalories += log.calories;
      totalProtein += log.protein;
      totalCarbs += log.carbs;
      totalFat += log.fat;

      if (meals[log.mealType]) {
        meals[log.mealType].push(log);
      }
    }

    const totalWaterMl = waterLogs.reduce((acc, curr) => acc + curr.amountMl, 0);

    return {
      date,
      totalCalories: Number(totalCalories.toFixed(1)),
      totalProtein: Number(totalProtein.toFixed(1)),
      totalCarbs: Number(totalCarbs.toFixed(1)),
      totalFat: Number(totalFat.toFixed(1)),
      totalWaterMl,
      meals,
    };
  }
}
```

---

### 4.7 Repository Implementation: `SqliteWorkoutRepository` (`src/database/repositories/SqliteWorkoutRepository.ts`)

```typescript
import { IWorkoutRepository, ISqliteDatabase } from './interfaces';
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
}

interface WorkoutSessionRow {
  id: string;
  routine_id: string | null;
  routine_name: string;
  date: string;
  duration_minutes: number;
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
      `SELECT id, routine_id, name, muscle_group, target_sets, default_rest_seconds, sort_order
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
      `SELECT id, routine_id, name, muscle_group, target_sets, default_rest_seconds, sort_order
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

    return await this.db.withTransactionAsync(async () => {
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
          `INSERT INTO routine_exercises (id, routine_id, name, muscle_group, target_sets, default_rest_seconds, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?);`,
          exId,
          routineId,
          ex.name,
          ex.muscleGroup ?? null,
          ex.targetSets ?? 3,
          ex.defaultRestSeconds ?? 60,
          ex.sortOrder ?? i + 1
        );
        createdExercises.push({
          id: exId,
          routineId,
          name: ex.name,
          muscleGroup: ex.muscleGroup,
          targetSets: ex.targetSets,
          defaultRestSeconds: ex.defaultRestSeconds,
          sortOrder: ex.sortOrder ?? i + 1,
        });
      }

      return {
        id: routineId,
        name: routine.name,
        description: routine.description,
        sortOrder: routine.sortOrder ?? 0,
        exercises: createdExercises,
        createdAt,
      };
    });
  }

  async updateRoutine(
    id: string,
    routine: Partial<WorkoutRoutine>,
    exercises?: RoutineExercise[]
  ): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      if (routine.name !== undefined || routine.description !== undefined || routine.sortOrder !== undefined) {
        await this.db.runAsync(
          `UPDATE workout_routines SET
             name = COALESCE(?, name),
             description = COALESCE(?, description),
             sort_order = COALESCE(?, sort_order)
           WHERE id = ?;`,
          routine.name ?? null,
          routine.description ?? null,
          routine.sortOrder ?? null,
          id
        );
      }

      if (exercises) {
        await this.db.runAsync(`DELETE FROM routine_exercises WHERE routine_id = ?;`, id);
        for (let i = 0; i < exercises.length; i++) {
          const ex = exercises[i];
          const exId = ex.id || `exercise-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 8)}`;
          await this.db.runAsync(
            `INSERT INTO routine_exercises (id, routine_id, name, muscle_group, target_sets, default_rest_seconds, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?);`,
            exId,
            id,
            ex.name,
            ex.muscleGroup ?? null,
            ex.targetSets,
            ex.defaultRestSeconds,
            ex.sortOrder ?? i + 1
          );
        }
      }
    });
  }

  async deleteRoutine(id: string): Promise<void> {
    await this.db.runAsync(`DELETE FROM workout_routines WHERE id = ?;`, id);
  }

  async getPreviousExerciseSets(exerciseName: string, targetSets = 10): Promise<SetLog[]> {
    // Finds the latest session ID where this exercise was performed with completed sets
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
    session: Omit<WorkoutSession, 'id' | 'createdAt'>,
    sets: Omit<SetLog, 'id' | 'sessionId' | 'createdAt'>[]
  ): Promise<WorkoutSession> {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const createdAt = new Date().toISOString();

    return await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(
        `INSERT INTO workout_sessions (id, routine_id, routine_name, date, duration_minutes, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        sessionId,
        session.routineId ?? null,
        session.routineName,
        session.date,
        session.durationMinutes,
        session.notes ?? null,
        createdAt
      );

      const savedSets: SetLog[] = [];
      for (let i = 0; i < sets.length; i++) {
        const set = sets[i];
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

      return {
        id: sessionId,
        routineId: session.routineId,
        routineName: session.routineName,
        date: session.date,
        durationMinutes: session.durationMinutes,
        notes: session.notes,
        sets: savedSets,
        createdAt,
      };
    });
  }

  async getWorkoutSessions(limit = 20, offset = 0): Promise<WorkoutSession[]> {
    const rows = await this.db.getAllAsync<WorkoutSessionRow>(
      `SELECT id, routine_id, routine_name, date, duration_minutes, notes, created_at
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
        durationMinutes: row.duration_minutes,
        notes: row.notes ?? undefined,
        sets: setRows.map((s) => this.mapSetLogRow(s)),
        createdAt: row.created_at,
      });
    }

    return sessions;
  }

  async getSessionDetails(id: string): Promise<WorkoutSession | null> {
    const row = await this.db.getFirstAsync<WorkoutSessionRow>(
      `SELECT id, routine_id, routine_name, date, duration_minutes, notes, created_at
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
      durationMinutes: row.duration_minutes,
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
```

---

### 4.8 Repository Implementation: `SqliteBodyRepository` (`src/database/repositories/SqliteBodyRepository.ts`)

```typescript
import { IBodyRepository, ISqliteDatabase } from './interfaces';
import { BodyLog, WeightHistoryPoint } from '../../types/domain';

interface BodyLogRow {
  id: string;
  date: string;
  weight_kg: number;
  body_fat_pct: number | null;
  waist_cm: number | null;
  chest_cm: number | null;
  arms_cm: number | null;
  legs_cm: number | null;
  photo_uris_json: string | null;
  created_at: string;
}

export class SqliteBodyRepository implements IBodyRepository {
  constructor(private db: ISqliteDatabase) {}

  private mapRow(row: BodyLogRow): BodyLog {
    let photoUris: string[] = [];
    if (row.photo_uris_json) {
      try {
        photoUris = JSON.parse(row.photo_uris_json);
      } catch {
        photoUris = [];
      }
    }

    return {
      id: row.id,
      date: row.date,
      weightKg: row.weight_kg,
      bodyFatPct: row.body_fat_pct ?? undefined,
      waistCm: row.waist_cm ?? undefined,
      chestCm: row.chest_cm ?? undefined,
      armsCm: row.arms_cm ?? undefined,
      legsCm: row.legs_cm ?? undefined,
      photoUris,
      createdAt: row.created_at,
    };
  }

  async getBodyLog(date: string): Promise<BodyLog | null> {
    const row = await this.db.getFirstAsync<BodyLogRow>(
      `SELECT id, date, weight_kg, body_fat_pct, waist_cm, chest_cm, arms_cm, legs_cm, photo_uris_json, created_at
       FROM body_logs
       WHERE date = ?
       LIMIT 1;`,
      date
    );

    return row ? this.mapRow(row) : null;
  }

  async saveBodyLog(log: Omit<BodyLog, 'id' | 'createdAt'>): Promise<BodyLog> {
    const id = `body-log-${log.date}`;
    const createdAt = new Date().toISOString();
    const photoUrisJson = JSON.stringify(log.photoUris ?? []);

    await this.db.runAsync(
      `INSERT INTO body_logs (id, date, weight_kg, body_fat_pct, waist_cm, chest_cm, arms_cm, legs_cm, photo_uris_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET
         weight_kg = excluded.weight_kg,
         body_fat_pct = excluded.body_fat_pct,
         waist_cm = excluded.waist_cm,
         chest_cm = excluded.chest_cm,
         arms_cm = excluded.arms_cm,
         legs_cm = excluded.legs_cm,
         photo_uris_json = excluded.photo_uris_json;`,
      id,
      log.date,
      log.weightKg,
      log.bodyFatPct ?? null,
      log.waistCm ?? null,
      log.chestCm ?? null,
      log.armsCm ?? null,
      log.legsCm ?? null,
      photoUrisJson,
      createdAt
    );

    return {
      ...log,
      id,
      photoUris: log.photoUris ?? [],
      createdAt,
    };
  }

  async calculateMovingAverage(date: string, windowDays = 7): Promise<number | null> {
    // Window: [date - (windowDays - 1) days, date]
    const offsetDays = `-${windowDays - 1} days`;

    interface AvgResult {
      moving_avg: number | null;
      count: number;
    }

    const res = await this.db.getFirstAsync<AvgResult>(
      `SELECT AVG(weight_kg) as moving_avg, COUNT(*) as count
       FROM body_logs
       WHERE date <= ? AND date >= date(?, ?);`,
      date,
      date,
      offsetDays
    );

    if (!res || res.count === 0 || res.moving_avg === null) {
      return null;
    }

    return Number(res.moving_avg.toFixed(2));
  }

  async getWeightHistory(startDate?: string, endDate?: string): Promise<WeightHistoryPoint[]> {
    let sql = `SELECT date, weight_kg FROM body_logs`;
    const params: string[] = [];

    if (startDate && endDate) {
      sql += ` WHERE date >= ? AND date <= ?`;
      params.push(startDate, endDate);
    } else if (startDate) {
      sql += ` WHERE date >= ?`;
      params.push(startDate);
    } else if (endDate) {
      sql += ` WHERE date <= ?`;
      params.push(endDate);
    }

    sql += ` ORDER BY date ASC;`;

    interface WeightRow {
      date: string;
      weight_kg: number;
    }

    const rows = await this.db.getAllAsync<WeightRow>(sql, ...params);

    const historyPoints: WeightHistoryPoint[] = [];
    for (const r of rows) {
      const ma = await this.calculateMovingAverage(r.date, 7);
      historyPoints.push({
        date: r.date,
        weightKg: r.weight_kg,
        movingAverage: ma,
      });
    }

    return historyPoints;
  }

  async savePhoto(date: string, photoUri: string): Promise<string[]> {
    const existing = await this.getBodyLog(date);
    const photoUris = existing?.photoUris ?? [];
    if (!photoUris.includes(photoUri)) {
      photoUris.push(photoUri);
    }

    if (existing) {
      await this.db.runAsync(
        `UPDATE body_logs SET photo_uris_json = ? WHERE date = ?;`,
        JSON.stringify(photoUris),
        date
      );
    } else {
      await this.saveBodyLog({
        date,
        weightKg: 0,
        photoUris,
      });
    }

    return photoUris;
  }

  async getPhotos(): Promise<{ date: string; uri: string }[]> {
    const rows = await this.db.getAllAsync<{ date: string; photo_uris_json: string | null }>(
      `SELECT date, photo_uris_json
       FROM body_logs
       WHERE photo_uris_json IS NOT NULL AND photo_uris_json != '[]'
       ORDER BY date DESC;`
    );

    const photos: { date: string; uri: string }[] = [];
    for (const r of rows) {
      if (r.photo_uris_json) {
        try {
          const uris: string[] = JSON.parse(r.photo_uris_json);
          for (const u of uris) {
            photos.push({ date: r.date, uri: u });
          }
        } catch {
          // Ignore invalid JSON
        }
      }
    }

    return photos;
  }
}
```

---

## 5. Verification Method

1. **Verify Interface & Type Definitions:**
   - Inspect files above against `PROJECT.md` lines 100-137. All methods, signatures, and return models match the required domain architecture.
2. **Verify 42 TACO Food Items Seed:**
   - Count items in Section 4.3: exactly 42 unique Brazilian staple food items.
   - Verify every item has `servingGrams = 100`, accurate energy/protein/carbs/fat values matching TACO 4ª Edição, and `source = 'taco'`.
3. **Verify Standard Workout Routines:**
   - Verify Divisão ABC (`routine-abc-a`, `routine-abc-b`, `routine-abc-c`) and Push/Pull/Legs (`routine-ppl-push`, `routine-ppl-pull`, `routine-ppl-legs`) have complete exercises with muscle group, target sets, default rest seconds, and sort order.
4. **Verify Modern `expo-sqlite` API Concurrency & Transactions:**
   - Inspect transactional operations in `SqliteWorkoutRepository.createRoutine` and `SqliteWorkoutRepository.saveWorkoutSession`. Both use `withTransactionAsync` to ensure ACID atomicity.
5. **Invalidation Conditions:**
   - If SQLite column names in `schema.ts` deviate from snake_case (e.g. `routine_id`, `set_number`, `food_name`), the mapping queries in repository implementations must be updated to align.
