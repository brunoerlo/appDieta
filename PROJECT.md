# Project: IronTrack MVP (React Native / Expo iOS Fitness App)

## Architecture

IronTrack is a mobile application built on React Native and Expo SDK 58 (TypeScript, Expo Router) optimized for iPhone 16 running Dark Mode by default.
It follows an offline-first architecture powered by local SQLite (`expo-sqlite`) through a decoupled Repository Pattern (`IDietRepository`, `IWorkoutRepository`, `IBodyRepository`, `IAuthRepository`), enabling full functionality with sub-100ms queries without mandatory network access, and providing a clean transition path to Supabase in future releases.

```
                           +----------------------------------------+
                           |     Expo Router UI (src/app/)          |
                           |  Tabs: Dieta, Treino, Evolução, Perfil |
                           +----------------------------------------+
                                       |                 |
                         Zustand Stores / Context        |
                                       |                 |
                           +----------------------------------------+
                           |        Domain Service / Hooks          |
                           +----------------------------------------+
                                       |
                           +----------------------------------------+
                           |  Repository Contracts (src/database/)  |
                           |   IDietRepo, IWorkoutRepo, IBodyRepo   |
                           +----------------------------------------+
                                  |                     |
                     [Phase 1 Implementation]   [Future Phase 2]
                                  |                     |
                        Sqlite Repositories       Supabase Repositories
                                  |
                           +----------------------------------------+
                           |  Local SQLite Engine (expo-sqlite)     |
                           |  fitness.db (WAL mode, FKs, Indexes)   |
                           |  TACO Foods Seed + Workout Seed        |
                           +----------------------------------------+
                                       |
                 (Remote fallback only for barcode catalog)
                                       v
                           +----------------------------------------+
                           |      Open Food Facts API v2 (HTTPS)    |
                           +----------------------------------------+
```

---

## Feature Inventory

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | SQLite Database Init & Migration | Initializes `fitness.db`, WAL mode, foreign keys, schema migrations | M1 | ORIGINAL_REQUEST §R1 |
| 2 | TACO/IBGE Seed Data Injection | Seeds Brazilian food composition dataset into `foods` table | M1 | ORIGINAL_REQUEST §R1, Acceptance |
| 3 | Standard Workout Routines Seed | Seeds default routine templates (ABC, Push/Pull/Legs) | M1 | ORIGINAL_REQUEST §R1 |
| 4 | Repository Pattern Abstraction | Type-safe interfaces (`IDietRepository`, `IWorkoutRepository`, `IBodyRepository`, `IAuthRepository`) | M1 | ORIGINAL_REQUEST §R1, Acceptance |
| 5 | Categorized Meal Diary | Displays food entries grouped by Café da Manhã, Almoço, Lanche, Jantar, Ceia | M2 | ORIGINAL_REQUEST §R2 |
| 6 | Daily Calorie & Macro Target Progress | Aggregates daily kcal, protein, carbs, fat vs target goals | M2 | ORIGINAL_REQUEST §R2, Acceptance |
| 7 | Indexed TACO Food Search | Sub-100ms local B-tree indexed food lookup | M2 | ORIGINAL_REQUEST §R2, Acceptance |
| 8 | Open Food Facts Search | Remote HTTP lookup for industrial products with local caching | M2 | ORIGINAL_REQUEST §R2, Acceptance |
| 9 | Barcode Scanner Search | Scans EAN/UPC barcode with camera, searches local + Open Food Facts | M2 | ORIGINAL_REQUEST §R2, Acceptance |
| 10 | Custom Food Creation | Manual food creation modal with custom grams and macros | M2 | ORIGINAL_REQUEST §R2 |
| 11 | Food Portion Scaling & Logging | Recalculates macros based on serving grams and adds to meal | M2 | ORIGINAL_REQUEST §R2, Acceptance |
| 12 | Food Log Deletion & Edit | Modifies or deletes logged food items from daily meal | M2 | ORIGINAL_REQUEST §R2 |
| 13 | Daily Water Intake Tracker | Tracks consumed water vs daily target (ml) with visual progress bar | M2 | ORIGINAL_REQUEST §R2, Acceptance |
| 14 | Quick Water Increment Shortcuts | Fast buttons (+250ml, +500ml) persisting immediately to DB | M2 | ORIGINAL_REQUEST §R2, Acceptance |
| 15 | Water Intake Reset / Undo | Decrements or resets erroneous water entries | M2 | Domain Survey |
| 16 | Routine Catalog & Management | List, create, and manage workout routines (ABC, PPL) | M3 | ORIGINAL_REQUEST §R3 |
| 17 | Routine Exercise Configuration | Configure exercises, target sets, default rest seconds, order | M3 | ORIGINAL_REQUEST §R3 |
| 18 | Live Workout Execution | Real-time workout session tracking with live elapsed timer | M3 | ORIGINAL_REQUEST §R3, Acceptance |
| 19 | Previous Session Load Reference | Displays weight and reps performed in the latest session for each set | M3 | ORIGINAL_REQUEST §R3, Acceptance |
| 20 | Set Logging (Weight x Reps x Check) | Records completed sets with weight in kg and rep counts | M3 | ORIGINAL_REQUEST §R3, Acceptance |
| 21 | Automated Rest Timer & Haptics | Auto-triggers rest countdown with `expo-haptics` vibration on set finish | M3 | ORIGINAL_REQUEST §R3, Acceptance |
| 22 | Session Completion & Summary | Finalizes session, computes total volume, elapsed time, saves to DB | M3 | ORIGINAL_REQUEST §R3, Acceptance |
| 23 | Workout History Log | Chronological list of completed workout sessions with metrics | M3 | ORIGINAL_REQUEST §R3, Acceptance |
| 24 | Load & 1RM Progression Chart | Time-series chart tracking load progression and 1RM (Brzycki/Epley) | M3 | ORIGINAL_REQUEST §R3 |
| 25 | Daily Morning Weigh-in | Logs morning body weight in kg with date | M4 | ORIGINAL_REQUEST §R4, Acceptance |
| 26 | 7-Day Moving Average Calculation | Calculates 7-day rolling moving average of body weight | M4 | ORIGINAL_REQUEST §R4, Acceptance |
| 27 | Weight Trend Chart | Dual-series chart rendering daily raw weigh-ins vs 7-day moving average | M4 | ORIGINAL_REQUEST §R4 |
| 28 | Body Composition Metrics | Records % Body Fat and computes estimated Lean Mass and Fat Mass | M4 | ORIGINAL_REQUEST §R4, Acceptance |
| 29 | Body Circumference Tracking | Records tape measurements: waist, chest, arms, thighs in cm | M4 | ORIGINAL_REQUEST §R4 |
| 30 | Progress Photo Logging | Stores progress photos with date tags in permanent document storage | M4 | ORIGINAL_REQUEST §R4 |
| 31 | Before vs. After Photo Comparison | Side-by-side comparative viewer for photos across dates | M4 | ORIGINAL_REQUEST §R4 |
| 32 | User Profile & Goal Configuration | Configures user name, target calories, macros, water goal, theme | M4 | ORIGINAL_REQUEST §R4 |
| 33 | OLED Dark Mode & Light Mode Theme | High-contrast sports OLED dark mode (`#0A0A0C`) with light mode toggle | M4 | ORIGINAL_REQUEST §R4, Acceptance |
| 34 | Tab Navigation (Expo Router) | Root layouts and 4-tab bar navigation in `src/app/` | M4 | ORIGINAL_REQUEST §R5, AGENTS.md |
| 35 | E2E Test Suite Validation & Adversarial Hardening | 100% pass on Tiers 1-4 tests, plus Tier 5 adversarial verification | M5 | Project Pattern, Acceptance |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Database, Schemas, TACO Seed & Repositories | Initialize SQLite, create 9 tables, seed TACO & routines, implement `IDietRepository`, `IWorkoutRepository`, `IBodyRepository`, `IAuthRepository`, and setup `npm test` test suite with 100% pass | None | DONE |
| M2 | Nutrition & Hydration Module | Meal diary (5 meals), macro calculations, TACO indexed search, Open Food Facts API & barcode scan, custom foods, water tracker with +250/+500ml shortcuts | M1 | PLANNED |
| M3 | Workout & Progression Module | Workout routines, Live Workout execution screen, previous session reference, set checklist, auto rest countdown timer with `expo-haptics`, workout history, 1RM & volume progression charts | M1 | PLANNED |
| M4 | Body Evolution, Photos & UI Theme | Daily weigh-in, 7-day moving average, trend chart, body fat / lean mass / circumferences, progress photos with before/after comparison, profile settings, OLED dark theme & light mode toggle, Expo Router tabs | M1 | PLANNED |
| M5 | Final E2E Integration & Adversarial Hardening | Pass 100% of E2E Test Suite (Tiers 1-4 published in `TEST_READY.md`) + Tier 5 adversarial stress testing, zero lint errors, zero typescript errors | M1, M2, M3, M4, TEST_READY | PLANNED |

---

## Interface Contracts

### M1 (Database/Repositories) ↔ M2 (Nutrition & Hydration)
- Interface: `IDietRepository`
  - `getDailyLogs(date: string): Promise<DietLogEntry[]>`
  - `addDietLog(entry: Omit<DietLogEntry, 'id' | 'createdAt'>): Promise<DietLogEntry>`
  - `updateDietLog(id: string, entry: Partial<DietLogEntry>): Promise<void>`
  - `deleteDietLog(id: string): Promise<void>`
  - `searchFoods(query: string, limit?: number): Promise<FoodItem[]>`
  - `getFoodByBarcode(barcode: string): Promise<FoodItem | null>`
  - `createFood(food: Omit<FoodItem, 'id'>): Promise<FoodItem>`
  - `getWaterLogs(date: string): Promise<WaterLogEntry[]>`
  - `addWaterLog(date: string, amountMl: number): Promise<WaterLogEntry>`
  - `resetWaterLogs(date: string): Promise<void>`

### M1 (Database/Repositories) ↔ M3 (Workout & Progression)
- Interface: `IWorkoutRepository`
  - `getRoutines(): Promise<WorkoutRoutine[]>`
  - `getRoutineById(id: string): Promise<WorkoutRoutine | null>`
  - `createRoutine(routine: Omit<WorkoutRoutine, 'id' | 'createdAt'>): Promise<WorkoutRoutine>`
  - `updateRoutine(id: string, routine: Partial<WorkoutRoutine>): Promise<void>`
  - `deleteRoutine(id: string): Promise<void>`
  - `getPreviousExerciseSets(exerciseName: string, targetSets: number): Promise<SetLog[]>`
  - `saveWorkoutSession(session: WorkoutSessionInput): Promise<WorkoutSession>`
  - `getWorkoutSessions(limit?: number, offset?: number): Promise<WorkoutSession[]>`
  - `getExerciseHistory(exerciseName: string): Promise<ExerciseHistoryPoint[]>`

### M1 (Database/Repositories) ↔ M4 (Body & Profile)
- Interface: `IBodyRepository`
  - `getBodyLog(date: string): Promise<BodyLog | null>`
  - `saveBodyLog(log: BodyLogInput): Promise<BodyLog>`
  - `getWeightHistory(startDate: string, endDate: string): Promise<WeightHistoryPoint[]>`
  - `calculateMovingAverage(date: string, days?: number): Promise<number | null>`
  - `savePhoto(date: string, photoUri: string): Promise<string>`
  - `getPhotos(): Promise<{ date: string; uri: string }[]>`
- Interface: `IAuthRepository`
  - `getProfile(): Promise<UserProfile>`
  - `updateProfile(profile: Partial<UserProfile>): Promise<void>`
  - `setTheme(theme: 'dark' | 'light'): Promise<void>`

---

## Code Layout

```
/home/bruno/Documentos/app/
├── assets/                          # App icons and splash screens
├── src/
│   ├── app/                         # Expo Router screens (ONLY routes & navigators)
│   │   ├── _layout.tsx              # Root Stack: SQLiteProvider, ThemeProvider, Toast
│   │   ├── (tabs)/                  # Main 4-tab bottom navigation
│   │   │   ├── _layout.tsx          # Tab bar navigator (Icons, Dark/Light tokens)
│   │   │   ├── index.tsx            # Dieta: Meal diary, macro targets, water tracker
│   │   │   ├── workout.tsx          # Treino: Routines, history, progression
│   │   │   ├── body.tsx             # Evolução: Weigh-in, 7-day MA, measurements, photos
│   │   │   └── profile.tsx          # Perfil: Metas, tema dark/light, export
│   │   ├── nutrition/
│   │   │   ├── search.tsx           # Food search modal (TACO + Open Food Facts)
│   │   │   ├── scanner.tsx          # Barcode camera scanner modal
│   │   │   └── custom.tsx           # Custom food creation modal
│   │   ├── workout/
│   │   │   ├── live.tsx             # Live Workout execution screen with rest timer
│   │   │   ├── edit-routine.tsx     # Routine creator/editor
│   │   │   └── history.tsx          # Workout session history detail & 1RM chart
│   │   └── body/
│   │       ├── log.tsx              # Detailed weight & circumference log modal
│   │       └── compare.tsx          # Before vs After photo comparison viewer
│   ├── components/                  # Reusable UI components
│   │   ├── ui/                      # Base atoms (Button, Card, Input, ProgressBar, Badge)
│   │   ├── nutrition/               # MealCard, MacroRing, WaterTracker, FoodSearchRow
│   │   ├── workout/                 # LiveSetRow, RestTimerModal, ExercisePicker
│   │   └── body/                    # WeightChart, PhotoSlider, MeasureInput
│   ├── constants/                   # Colors, Dark/Light themes, Typography, Config
│   ├── database/                    # SQLite layer (M1)
│   │   ├── connection.ts            # openDatabaseAsync, WAL, FKs, migrations runner
│   │   ├── schema.ts                # DDL migrations for 9 tables
│   │   ├── seed/                    # TACO 42-item Brazilian food seed + default routines
│   │   │   ├── tacoFoods.ts
│   │   │   └── defaultRoutines.ts
│   │   └── repositories/            # Decoupled Repository Pattern implementations
│   │       ├── interfaces.ts        # IDietRepository, IWorkoutRepository, etc.
│   │       ├── SqliteDietRepository.ts
│   │       ├── SqliteWorkoutRepository.ts
│   │       ├── SqliteBodyRepository.ts
│   │       └── SqliteAuthRepository.ts
│   ├── hooks/                       # React hooks (useTheme, useDiet, useWorkout, useBody)
│   ├── services/                    # External services (OpenFoodFactsService, HapticsService)
│   ├── types/                       # Shared domain TypeScript types
│   └── utils/                       # Calculations (Atwater, 7-day MA, Brzycki 1RM, Epley)
├── tests/                           # Unit tests & E2E Test Suite (Dual Track)
│   ├── unit/                        # M1 repository unit tests (CRUD, indexes, calculations)
│   │   ├── DietRepository.test.ts
│   │   ├── WorkoutRepository.test.ts
│   │   ├── BodyRepository.test.ts
│   │   └── Calculations.test.ts
│   └── e2e/                         # Requirement-driven E2E tests (Tiers 1-4)
│       ├── runner.ts
│       ├── tier1_features/
│       ├── tier2_boundaries/
│       ├── tier3_pairwise/
│       └── tier4_realworld/
├── package.json
├── tsconfig.json
├── app.json
└── jest.config.js
```
