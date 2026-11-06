# Specification Mining & Technical Architecture Report: Fitness Tracker MVP (iOS / Expo)

**Document Reference**: `handoff.md`  
**Mining Agent**: `spec_miner_survey_1` (Technical Specification Miner)  
**Date**: 2026-11-06T13:59:00Z  
**Target Environment**: iPhone 16 (iOS via Expo Go / CNG), Development Host: Linux, Expo SDK 58, React 19.3.0, React Native 0.88.1.  

---

## 1. Observation

Direct extraction from authoritative project specifications and workspace configuration:

1. **User Request & Requirements (`ORIGINAL_REQUEST.md:5-29`):**
   - "Construir o MVP completo de um aplicativo mobile em React Native e Expo (TypeScript, Expo Router) voltado para iPhone 16 (iOS) para acompanhamento diário de nutrição, progressão de treinos de força e evolução corporal, utilizando SQLite local (`expo-sqlite`) com Repository Pattern e interface esportiva Dark Mode." (Lines 5)
   - **R1. Camada de Dados e Persistência Local em SQLite** (Lines 16-17): `expo-sqlite` with Repository Pattern (`DietRepository`, `WorkoutRepository`, `BodyRepository`, `AuthRepository`) with complete TypeScript typing. Tables: `users`, `foods`, `diet_logs`, `water_logs`, `workout_routines`, `routine_exercises`, `workout_sessions`, `set_logs`, `body_logs`. Initial seed: Brazilian TACO/IBGE foods + standard workout routines. Decoupled persistence for future Supabase migration.
   - **R2. Módulo de Nutrição e Hidratação** (Lines 19-20): Categorized meal diary (Café da Manhã, Almoço, Lanche, Jantar, Ceia), daily calorie and macro goals (protein, carbs, fat). Hybrid search: indexed local TACO/IBGE base (< 100ms response), Open Food Facts API with barcode reader support, custom food entry, daily water tracker (+250ml, +500ml quick increments) with progress bar.
   - **R3. Módulo de Treinos e Progressão de Carga** (Lines 22-23): Workout routine registration/customization (ABC, PPL). Live Workout execution mode: displays last session's weight and reps for each exercise, records sets completed (set x reps x weight in kg), triggers automatic rest countdown timer with `expo-haptics` vibration feedback, provides progression history and charts (weight and volume).
   - **R4. Módulo de Peso, Composição Corporal e Interface** (Lines 25-26): Daily morning weigh-in with automatic 7-day moving average calculation and trend chart; % body fat, lean/fat mass estimation, body circumferences (waist, chest, arm, thigh); photographic evolution tracking with Before vs. After comparative viewer; modern OLED Dark Mode default (`#0A0A0C` / `#121214`) with Light Mode switch in profile settings.
   - **R5. Qualidade de Código e Compatibilidade com Plataforma** (Lines 28-29): Strict Expo Router in `src/app/`, iOS compatibility (iPhone 16 via Expo Go), relational SQLite integrity, zero TypeScript type errors (`npx tsc --noEmit`), zero lint warnings/errors (`npx expo lint`), 100% passing automated unit tests (`npm test`).

2. **Technical Specification (`app_specification.md:20-111`):**
   - **Data Architecture Strategy** (Lines 22-24): Phase 1 is 100% offline local SQLite (`fitness.db`) using Repository Pattern to ensure < 100ms food queries and zero cloud dependency. Phase 2 connects `SupabaseRepository` (PostgreSQL + Auth + Supabase Storage for photos) without UI rewrites.
   - **Tech Stack & Libraries** (Lines 51-59): Expo Router, TypeScript, `lucide-react-native`, `expo-haptics`, `react-native-chart-kit` or `victory-native`, `expo-camera` / `expo-barcode-scanner`.
   - **Table Definitions** (Lines 101-110): Detailed column lists for `users`, `foods`, `diet_logs`, `water_logs`, `workout_routines`, `routine_exercises`, `workout_sessions`, `set_logs`, `body_logs`.

3. **Development Guidelines (`AGENTS.md:1-42`):**
   - Expo SDK rule: Check `package.json` major version before writing any Expo/React Native API code (Line 7). Current package.json has `"expo": "~58.0.23"`, `"react": "19.3.0"`, `"react-native": "0.88.1"`.
   - Navigation: Expo Router routes must live strictly in `src/app/`. All non-route code (components, hooks, repositories, database, utils) must reside outside `src/app/` (Line 28).
   - Native directories: `ios/` and `android/` must never be created or edited by hand (CNG, Line 39).
   - Package manager / installation: Use `npx expo install <package>` to resolve SDK 58 compatible versions (Line 16).

---

## 2. Logic Chain

1. **From Offline Requirement & Performance Target to SQLite Database Design:**
   - The user requires instant TACO queries (< 100ms) and 100% offline capability on iPhone 16.
   - SQLite (`expo-sqlite`) with indexed B-trees on `foods(name)` and foreign key enforcement (`PRAGMA foreign_keys = ON;`) satisfies this without external network latency.
   - Pre-seeding TACO Brazilian food items (100g base) and standard workout routines during migration initialization guarantees out-of-the-box utility.

2. **From Multi-Phase Cloud Migration to Repository Pattern Decoupling:**
   - The application starts as a local offline SQLite database (`fitness.db`) and later migrates to Supabase (PostgreSQL + Auth + Storage).
   - Therefore, UI screens and state stores (Zustand / React Context) must NEVER call `db.runAsync` or `db.getAllAsync` directly.
   - All persistence must be mediated through strict TypeScript interfaces: `DietRepository`, `WorkoutRepository`, `BodyRepository`, `AuthRepository`. In Phase 1, `SqliteDietRepository`, `SqliteWorkoutRepository`, etc. implement these interfaces. In Phase 2, `SupabaseDietRepository` drops in with zero UI changes.

3. **From Live Workout Execution to Data Flow and Timer UX:**
   - When a user enters Live Workout mode for an exercise, the app queries `set_logs` for the latest session containing that `exercise_name` to populate the `Anterior (kg x reps)` column.
   - Checking a set completes the set, triggers `expo-haptics` notification vibration (`Haptics.notificationAsync(NotificationFeedbackType.Success)`), and starts a rest countdown (e.g. 60s, 90s, 120s) based on `routine_exercises.default_rest_seconds`.
   - When the rest timer reaches 0, `Haptics.notificationAsync(NotificationFeedbackType.Warning)` alerts the user to start the next set.

4. **From Weight Fluctuations to Moving Average Mathematical Model:**
   - Daily weight fluctuates by 1–3 kg due to sodium, glycogen, and hydration. A raw weight graph produces noise.
   - The 7-day moving average $MA_7(d) = \frac{1}{|W_d|} \sum_{entry \in W_d} weight$ over the window $[d-6, d]$ smooths fluctuations, giving the true body mass trajectory.
   - Lean mass and fat mass are derived algebraically: $FatMass = Weight \times \frac{BF\%}{100}$, $LeanMass = Weight - FatMass$.

5. **From OLED High Contrast Theme to Theme Tokens:**
   - High-contrast Dark Mode is standard for fitness apps and maximizes OLED battery life on iPhone 16 (`#0A0A0C` background, `#16161A` cards, `#00E676` neon green, `#00B0FF` electric blue).
   - Light Mode must be supported via a toggle in Profile settings and persisted in `users.theme`.

---

## 3. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Persistence | SQLite Database Init & Migration | Initializes `fitness.db`, executes schema creation migrations, and enables WAL mode and foreign keys | App startup trigger | Initialized database instance | Throws `DatabaseInitializationError`, logged gracefully | `ORIGINAL_REQUEST.md:16-17`, `app_specification.md:98-111` |
| 2 | Persistence | TACO/IBGE Seed Data Injection | Seeds Brazilian food dataset (energy, protein, carbs, fat per 100g) into `foods` table on first run | Database instance, seed dataset | Populated `foods` table with indexed names | Skips if already seeded, handles transaction rollback | `ORIGINAL_REQUEST.md:17,35`, `app_specification.md:68,103` |
| 3 | Persistence | Standard Workout Routines Seed | Seeds default routine templates (ABC, Push/Pull/Legs) into `workout_routines` and `routine_exercises` | Seed dataset | Populated routine tables | Skips if already seeded | `ORIGINAL_REQUEST.md:17`, `app_specification.md:74,120` |
| 4 | Persistence | Repository Pattern Abstraction | Type-safe interfaces (`AuthRepository`, `DietRepository`, `WorkoutRepository`, `BodyRepository`) | Method parameters | Domain entity models | Typed Repository Errors | `ORIGINAL_REQUEST.md:17,36`, `app_specification.md:20-24` |
| 5 | Nutrition | Categorized Meal Diary | Displays food entries grouped by meal: Café da Manhã, Almoço, Lanche, Jantar, Ceia for selected date | Selected date (`YYYY-MM-DD`) | Categorized meals, calories and macro breakdown per meal | Returns empty meal structure if no logs found | `ORIGINAL_REQUEST.md:20,39`, `app_specification.md:65` |
| 6 | Nutrition | Daily Calorie & Macro Target Progress | Aggregates daily intake of calories, proteins, carbs, fats and compares against user profile targets | Daily `diet_logs`, `user_profile` | Total kcal, P(g), C(g), F(g), remaining, % progress | Clamps negative remaining to 0, shows overflow indicator | `ORIGINAL_REQUEST.md:20,39`, `app_specification.md:66` |
| 7 | Nutrition | Indexed TACO Food Search | Sub-100ms local SQL query searching food items by partial name or category | Search term string | List of matching food items with macros per 100g | Returns empty array if no match; handles query escaping | `ORIGINAL_REQUEST.md:20,35`, `app_specification.md:68` |
| 8 | Nutrition | Open Food Facts Search | Remote text search querying Open Food Facts API for branded/industrialized products | Product name query | List of matching products with nutritional values | Fallback to empty list or offline toast if network down | `ORIGINAL_REQUEST.md:20,40`, `app_specification.md:69` |
| 9 | Nutrition | Barcode Scanner Search | Scans EAN/UPC barcode via camera and queries local DB and Open Food Facts API | Barcode string (EAN-13, UPC-A) | Product details and macro profile | "Product not found" alert; manual entry prompt | `ORIGINAL_REQUEST.md:20,40`, `app_specification.md:58,69` |
| 10 | Nutrition | Custom Food Creation | Allows user to register a manual custom food item with custom serving size and macros | Name, category, serving size (g), kcal, P, C, F | Created food record saved in `foods` (`source='custom'`) | Validates non-negative numbers, requires name | `ORIGINAL_REQUEST.md:20`, `app_specification.md:70` |
| 11 | Nutrition | Food Portion Scaling & Logging | Logs food to a meal, automatically recalculating macros based on user-entered serving grams | `food_id`, `meal_type`, `serving_grams`, date | Inserted `diet_logs` row | Rejects $\le 0$ grams; handles division by zero | `ORIGINAL_REQUEST.md:20,39`, `app_specification.md:104` |
| 12 | Nutrition | Food Log Deletion & Edit | Removes or modifies an existing logged food item from a meal | `diet_log_id` | Updated daily aggregate and removed row | Rejects non-existent ID | `ORIGINAL_REQUEST.md:36`, `app_specification.md:104` |
| 13 | Hydration | Daily Water Intake Tracker | Displays current consumed water vs daily target (ml) with a visual progress bar | Selected date | Current ml, target ml, percentage | Defaults to 0 ml if no logs for date | `ORIGINAL_REQUEST.md:20,41`, `app_specification.md:71` |
| 14 | Hydration | Quick Water Increment Shortcuts | Instant addition buttons (+250ml, +500ml) or custom volume entry | Selected date, volume increment (+250 / +500) | Updated total ml, logged into `water_logs` | Rejects negative or non-integer amounts | `ORIGINAL_REQUEST.md:20,41`, `app_specification.md:71` |
| 15 | Hydration | Water Intake Reset / Undo | Decrements or clears erroneous water additions | Selected date or `water_log_id` | Decremented total water volume | Clamps minimum water intake to 0 ml | Inferred domain requirement |
| 16 | Workout | Routine Catalog & Management | List, create, edit, and delete workout routines (e.g. ABC, PPL, Upper/Lower) | Routine name, description, exercise list | Saved routine structure in `workout_routines` | Rejects blank routine name | `ORIGINAL_REQUEST.md:22`, `app_specification.md:74` |
| 17 | Workout | Routine Exercise Configuration | Add/reorder exercises in routine, set target sets and default rest time (seconds) | Routine ID, exercise name, muscle group, sets, rest | Saved `routine_exercises` entries | Rejects invalid rest periods (< 0s) | `ORIGINAL_REQUEST.md:22`, `app_specification.md:107` |
| 18 | Workout | Live Workout Execution | Interactive active workout session screen with live timer and exercise list | `routine_id` | Active workout state, `workout_sessions` record | Prompts confirmation before discarding active session | `ORIGINAL_REQUEST.md:22,44`, `app_specification.md:75-76` |
| 19 | Workout | Previous Session Load Reference | Displays weight and reps performed in the latest prior session for each exercise | `exercise_name` | String "Anterior: {weight}kg x {reps}" | Displays "-" if first time performing exercise | `ORIGINAL_REQUEST.md:22,45`, `app_specification.md:77-78` |
| 20 | Workout | Set Logging (Weight x Reps x Check) | Records completed sets in real-time with weight (kg) and rep count | Set #, weight_kg, reps, completion toggle | Updated `set_logs` state | Highlights uncompleted sets upon finish attempt | `ORIGINAL_REQUEST.md:22,46`, `app_specification.md:77` |
| 21 | Workout | Automated Rest Timer & Haptics | Automatically starts rest countdown upon completing a set, firing haptic pulses | Set completion event, rest duration (sec) | Active countdown modal/banner, vibration cues | Allows pausing, adding +30s, or skipping timer | `ORIGINAL_REQUEST.md:22,46`, `app_specification.md:56,79` |
| 22 | Workout | Session Completion & Summary | Finalizes session, calculates total volume and elapsed time, saves to SQLite | Duration minutes, notes, sets data | Persisted session in `workout_sessions` & `set_logs` | Rejects saving completely empty session | `ORIGINAL_REQUEST.md:22,47`, `app_specification.md:108` |
| 23 | Workout | Workout History Log | Chronological list of completed workout sessions with details and metrics | Date range, pagination limit/offset | List of past sessions with total volume, sets, time | Returns empty state if no history exists | `ORIGINAL_REQUEST.md:22,47`, `app_specification.md:80` |
| 24 | Workout | Load & 1RM Progression Chart | Visual chart tracking estimated 1RM (Brzycki formula) and load over time per exercise | `exercise_name`, date range | Time-series line chart of max weight and 1RM | Displays "Insufficient data" if < 2 data points | `ORIGINAL_REQUEST.md:22`, `app_specification.md:80` |
| 25 | Body | Daily Morning Weigh-in | Records morning body weight in kg with date | Date, weight in kg (e.g. 78.5) | Persisted `body_logs` entry | Rejects impossible weights (< 20kg or > 400kg) | `ORIGINAL_REQUEST.md:26,50`, `app_specification.md:83` |
| 26 | Body | 7-Day Moving Average Calculation | Calculates 7-day rolling mean of weigh-ins to filter water and sodium fluctuations | Date | 7-day smoothed average weight (kg) | Uses available days in 7-day window if < 7 | `ORIGINAL_REQUEST.md:26,50`, `app_specification.md:84` |
| 27 | Body | Weight Trend Chart | Chart rendering raw daily weigh-in points overlaid with the 7-day moving average curve | Date range | Dual-series line chart (Raw vs Moving Average) | Graceful handling of missing days (interpolated) | `ORIGINAL_REQUEST.md:26,50`, `app_specification.md:57,84` |
| 28 | Body | Body Composition Metrics | Records % Body Fat and computes estimated Fat Mass (kg) and Lean Mass (kg) | Weight (kg), % Body Fat | Fat Mass (kg), Lean Mass (kg) | Validates $0\% \le BF \le 70\%$ | `ORIGINAL_REQUEST.md:26,51`, `app_specification.md:85-87` |
| 29 | Body | Body Circumference Tracking | Records tape measurements in cm: waist, chest, flexed arms, thighs/legs | Date, waist_cm, chest_cm, arms_cm, legs_cm | Updated `body_logs` entry | Rejects negative circumference values | `ORIGINAL_REQUEST.md:26,51`, `app_specification.md:88` |
| 30 | Body | Progress Photo Logging | Captures/selects photos with date stamping and stores reference URIs | Photo URI, capture date, angle tag | Updated `photo_uris_json` in `body_logs` | Handles camera/library permission rejection | `ORIGINAL_REQUEST.md:26`, `app_specification.md:89` |
| 31 | Body | Before vs. After Photo Comparison | Side-by-side or slider comparison of two progress photos from different dates | Photo A ID/Date, Photo B ID/Date | Interactive dual-photo comparison view | Disables if fewer than 2 photos available | `ORIGINAL_REQUEST.md:26`, `app_specification.md:89` |
| 32 | Profile | User Profile & Goal Configuration | Configures user name, daily calories, protein, carbs, fat, and water goals | Target kcal, P, C, F, water (ml) | Persisted `users` profile record | Validates macro consistency and positive values | `ORIGINAL_REQUEST.md:17`, `app_specification.md:102` |
| 33 | Interface | OLED Dark Mode & Light Mode Theme | System theme with sports high-contrast OLED dark theme default and light toggle | Theme selection ('dark' \| 'light') | App-wide color palette switch, persisted in DB | Defaults to 'dark' on fresh install | `ORIGINAL_REQUEST.md:26,54`, `app_specification.md:91-93` |
| 34 | Interface | Tab Navigation (Expo Router) | Bottom tab bar: Dieta (Nutrition), Treinos (Workouts), Corpo (Body), Perfil (Profile) | User navigation tap | Screen transition within `src/app/(tabs)/` | Maintains tab state, handles safe areas | `ORIGINAL_REQUEST.md:55`, `AGENTS.md:26-30` |

---

## 4. Edge Cases

| # | Feature | Input / Scenario | Observed / Required Behavior |
|---|---------|------------------|------------------------------|
| 1 | SQLite DB Init | App opened for the first time on a fresh install | Runs migrations, sets WAL mode (`PRAGMA journal_mode = WAL;`), sets `PRAGMA foreign_keys = ON;`, executes TACO and routine seeds in a single transaction. |
| 2 | SQLite DB Init | App opened after an update where tables already exist | Checks migration version table or `IF NOT EXISTS`; verifies existing data is preserved without re-running destructive scripts. |
| 3 | Food Search | User enters special characters, SQL quotes (`'`, `"`, `%`, `_`), or accented text (e.g. `pão`, `maçã`) | Parameterized SQL query with case-insensitive and unaccented matching (`COLLATE NOCASE` or normalized string); SQL injection is impossible. |
| 4 | Food Search | User queries a food while the device has no Internet connection | Local TACO search succeeds immediately (< 100ms); Open Food Facts search fails gracefully without crashing, showing an "Offline: searching local catalog only" status. |
| 5 | Barcode Scanner | User scans barcode not in TACO and not in Open Food Facts API | Displays friendly modal: "Produto não encontrado no catálogo. Deseja cadastrá-lo manualmente?" and pre-fills barcode into the custom food form. |
| 6 | Barcode Scanner | User denies camera permission on iOS | Displays alert explaining permission necessity with button redirecting to iOS Settings (`Linking.openSettings()`). |
| 7 | Meal Logging | User enters `0`, negative, or extreme serving grams (e.g. `-50g`, `0g`, `999999g`) | Input validation intercepts before repository: `serving_grams` must be $> 0$ and $\le 5000g$. Shows inline validation message. |
| 8 | Meal Logging | Decimal serving size entered (e.g. `123.5` g) | Scaled macros accurately computed using floating-point rounding to 1 decimal place: $P = \text{round}(P_{base} \times \frac{grams}{100}, 1)$. |
| 9 | Daily Totals | User consumes more than 100% of target calories or macros | Macro progress bars remain at 100% fill visually with an distinct overflow badge (e.g. `+240 kcal` in red or amber accent). No visual glitch or bar overflow outside bounds. |
| 10 | Water Tracker | User taps `+500ml` multiple times exceeding daily goal | Progress bar caps cleanly at 100%, text counter shows actual consumed volume (e.g. `3500 / 3000 ml`), celebrates goal completion. |
| 11 | Water Tracker | User accidentally increments water and wants to correct | Provides an "Undo" button or ability to delete/decrement the latest water entry, clamping minimum at 0 ml. |
| 12 | Water Tracker | Midnight rollover (app open at 23:59 -> 00:01) | Selected date stays on active screen date unless user navigates to today; new day initializes with 0 ml consumed. |
| 13 | Workout Live | User starts a workout for an exercise with no prior history in SQLite | Column `Anterior` renders placeholder `-` or `Novo`. Input fields for weight and reps remain blank with placeholders `0 kg` and `0 reps`. |
| 14 | Workout Live | User does bodyweight exercise (e.g. pull-ups, push-ups) with 0 external weight | Accepts `0` kg and positive reps ($> 0$). Volume calculation calculates as $0 \times reps = 0$ kg or treats weight as bodyweight if configured. |
| 15 | Rest Timer | App is backgrounded or screen locks while rest timer is ticking | Timer relies on absolute timestamp delta (`targetEndTime - Date.now()`) rather than simple `setInterval` ticks. Upon returning to foreground, remaining time is accurate; triggers haptic/sound upon resume if elapsed. |
| 16 | Rest Timer | User finishes a set before the rest timer of the previous set finishes | Resets and restarts the countdown for the newly completed set without stacking multiple conflicting timers. |
| 17 | Workout Save | User taps "Concluir Treino" with 0 sets checked | Displays warning dialog: "Nenhuma série foi marcada como concluída. Deseja descartar ou salvar treino vazio?". |
| 18 | Workout Exit | User navigates back or closes app during an active live workout | Prompts confirmation: "Deseja salvar o progresso atual, descartar o treino ou continuar treinando?". |
| 19 | 1RM Formula | User enters 1 rep with 100 kg | Brzycki formula $100 \times \frac{36}{37 - 1} = 100$ kg. For $reps = 1$, formula cleanly yields exact weight without division distortion. |
| 20 | 1RM Formula | User logs high-rep set (e.g. 40 reps) | Brzycki formula denominator $37 - reps \le 0$ becomes undefined. The algorithm guards: if $reps \ge 30$, clamp $reps = 30$ or switch to linear Epley: $Weight \times (1 + \frac{reps}{30})$. |
| 21 | Weigh-in | User logs weight twice on the same calendar day | SQL `INSERT OR REPLACE INTO body_logs (date, ...)` or updates existing day's entry rather than creating duplicate conflicting rows. |
| 22 | 7-Day MA | User logs weight for day 1, skips day 2 and 3, logs day 4 | 7-day moving average on day 4 sums available records in $[d-6, d]$ (2 records) and divides by 2, avoiding artificial zero-weight skew. |
| 23 | Body Comp | User inputs % Body Fat $\ge 100\%$ or $< 0\%$ | Form validation prevents submission, restricting input strictly between $3.0\%$ and $60.0\%$. |
| 24 | Photo Storage | User takes or picks a progress photo | Image is saved to application documents directory (`FileSystem.documentDirectory`), and the local persistent file URI is stored in `photo_uris_json`. Ensures photos survive temporary cache cleanups. |
| 25 | Theme Switching | User switches theme from Dark to Light in Profile settings | Instant context update changes all background, text, border, and navigation colors without requiring an app reload; updates `users.theme` in SQLite. |

---

## 5. Data Schemas (SQLite DDL & Architecture)

The local SQLite database (`fitness.db`) uses the following relational schema:

```sql
-- Enable SQLite Foreign Key Constraints & WAL mode
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- 1. Users / Profile Table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    name TEXT NOT NULL,
    target_calories INTEGER NOT NULL DEFAULT 2000,
    target_protein REAL NOT NULL DEFAULT 150.0,
    target_carbs REAL NOT NULL DEFAULT 200.0,
    target_fat REAL NOT NULL DEFAULT 65.0,
    target_water_ml INTEGER NOT NULL DEFAULT 3000,
    theme TEXT NOT NULL DEFAULT 'dark',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Foods Catalog Table (TACO, Open Food Facts cache, Custom foods)
CREATE TABLE IF NOT EXISTS foods (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    category TEXT,
    serving_grams REAL NOT NULL DEFAULT 100.0,
    calories REAL NOT NULL,
    protein REAL NOT NULL,
    carbs REAL NOT NULL,
    fat REAL NOT NULL,
    barcode TEXT,
    source TEXT NOT NULL CHECK(source IN ('taco', 'openfoodfacts', 'custom')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_foods_name ON foods (name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_foods_barcode ON foods (barcode);
CREATE INDEX IF NOT EXISTS idx_foods_source ON foods (source);

-- 3. Diet Logs Table
CREATE TABLE IF NOT EXISTS diet_logs (
    id TEXT PRIMARY KEY NOT NULL,
    date TEXT NOT NULL, -- Format: YYYY-MM-DD
    meal_type TEXT NOT NULL CHECK(meal_type IN ('breakfast', 'lunch', 'snack', 'dinner', 'supper')),
    food_id TEXT,
    food_name TEXT NOT NULL,
    serving_grams REAL NOT NULL,
    calories REAL NOT NULL,
    protein REAL NOT NULL,
    carbs REAL NOT NULL,
    fat REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (food_id) REFERENCES foods(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_diet_logs_date ON diet_logs (date);
CREATE INDEX IF NOT EXISTS idx_diet_logs_meal ON diet_logs (date, meal_type);

-- 4. Water Logs Table
CREATE TABLE IF NOT EXISTS water_logs (
    id TEXT PRIMARY KEY NOT NULL,
    date TEXT NOT NULL, -- Format: YYYY-MM-DD
    amount_ml INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_water_logs_date ON water_logs (date);

-- 5. Workout Routines Table
CREATE TABLE IF NOT EXISTS workout_routines (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 6. Routine Exercises Table
CREATE TABLE IF NOT EXISTS routine_exercises (
    id TEXT PRIMARY KEY NOT NULL,
    routine_id TEXT NOT NULL,
    name TEXT NOT NULL,
    muscle_group TEXT,
    target_sets INTEGER NOT NULL DEFAULT 3,
    default_rest_seconds INTEGER NOT NULL DEFAULT 60,
    sort_order INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (routine_id) REFERENCES workout_routines(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_routine_exercises_routine ON routine_exercises (routine_id, sort_order);

-- 7. Workout Sessions Table (History & Active)
CREATE TABLE IF NOT EXISTS workout_sessions (
    id TEXT PRIMARY KEY NOT NULL,
    routine_id TEXT,
    routine_name TEXT NOT NULL,
    date TEXT NOT NULL, -- Format: YYYY-MM-DD
    duration_minutes INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (routine_id) REFERENCES workout_routines(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_workout_sessions_date ON workout_sessions (date DESC);

-- 8. Set Logs Table (Recorded individual sets)
CREATE TABLE IF NOT EXISTS set_logs (
    id TEXT PRIMARY KEY NOT NULL,
    session_id TEXT NOT NULL,
    exercise_id TEXT,
    exercise_name TEXT NOT NULL,
    set_number INTEGER NOT NULL,
    weight_kg REAL NOT NULL DEFAULT 0,
    reps INTEGER NOT NULL DEFAULT 0,
    completed INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES workout_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_set_logs_lookup ON set_logs (exercise_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_set_logs_session ON set_logs (session_id);

-- 9. Body Logs Table (Weight, Measurements, Photos)
CREATE TABLE IF NOT EXISTS body_logs (
    id TEXT PRIMARY KEY NOT NULL,
    date TEXT UNIQUE NOT NULL, -- Format: YYYY-MM-DD (1 per day)
    weight_kg REAL NOT NULL,
    body_fat_pct REAL,
    waist_cm REAL,
    chest_cm REAL,
    arms_cm REAL,
    legs_cm REAL,
    photo_uris_json TEXT, -- JSON array: ["file://...1.jpg", "file://...2.jpg"]
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_body_logs_date ON body_logs (date DESC);
```

---

## 6. Entity Relationship Model & Relational Mappings

```
  +------------------+
  |      users       |
  |------------------|
  | id (PK)          |
  | email            |
  | target_calories  |
  | target_protein   |
  | target_carbs     |
  | target_fat       |
  | target_water_ml  |
  | theme            |
  +------------------+

  +------------------+         1 : N         +-------------------+
  |      foods       |---------------------->|     diet_logs     |
  |------------------|                       |-------------------|
  | id (PK)          |                       | id (PK)           |
  | name             |                       | date (YYYY-MM-DD) |
  | category         |                       | meal_type         |
  | serving_grams    |                       | food_id (FK null) |
  | calories         |                       | food_name         |
  | protein          |                       | serving_grams     |
  | carbs            |                       | calories          |
  | fat              |                       | protein/carbs/fat |
  | barcode          |                       +-------------------+
  | source           |
  +------------------+

  +------------------+                       +-------------------+
  |    water_logs    |                       |     body_logs     |
  |------------------|                       |-------------------|
  | id (PK)          |                       | id (PK)           |
  | date (YYYY-MM-DD)|                       | date (UNIQUE)     |
  | amount_ml        |                       | weight_kg         |
  | created_at       |                       | body_fat_pct      |
  +------------------+                       | circumferences    |
                                             | photo_uris_json   |
                                             +-------------------+

  +--------------------+       1 : N         +-------------------+
  |  workout_routines  |-------------------->| routine_exercises |
  |--------------------|  (CASCADE DELETE)   |-------------------|
  | id (PK)            |                     | id (PK)           |
  | name               |                     | routine_id (FK)   |
  | description        |                     | name              |
  | sort_order         |                     | muscle_group      |
  +--------------------+                     | target_sets       |
          |                                  | def_rest_seconds  |
          | 1 : N (SET NULL)                 +-------------------+
          v
  +--------------------+       1 : N         +-------------------+
  |  workout_sessions  |-------------------->|     set_logs      |
  |--------------------|  (CASCADE DELETE)   |-------------------|
  | id (PK)            |                     | id (PK)           |
  | routine_id (FK)    |                     | session_id (FK)   |
  | routine_name       |                     | exercise_name     |
  | date               |                     | set_number        |
  | duration_minutes   |                     | weight_kg         |
  | notes              |                     | reps              |
  +--------------------+                     | completed (0/1)   |
                                             +-------------------+
```

### Cascade & Relational Rules:
1. `routine_exercises.routine_id` $\to$ `workout_routines.id`: ON DELETE CASCADE. Deleting a routine deletes all its exercise definitions.
2. `set_logs.session_id` $\to$ `workout_sessions.id`: ON DELETE CASCADE. Deleting a workout session deletes all recorded sets for that session.
3. `diet_logs.food_id` $\to$ `foods.id`: ON DELETE SET NULL. Deleting a custom food preserves historical diet entries with denormalized `food_name`, `calories`, and `macros`.
4. `workout_sessions.routine_id` $\to$ `workout_routines.id`: ON DELETE SET NULL. Deleting a routine preserves past session history with denormalized `routine_name`.

---

## 7. Business Rules & Mathematical Formulas

### 7.1 Nutritional Computations
- **Base vs. Logged Serving Ratio:**
  $$\text{ratio} = \frac{\text{serving\_grams}}{100.0}$$
  $$\text{calories} = \text{base\_calories} \times \text{ratio}$$
  $$\text{protein} = \text{base\_protein} \times \text{ratio}$$
  $$\text{carbs} = \text{base\_carbs} \times \text{ratio}$$
  $$\text{fat} = \text{base\_fat} \times \text{ratio}$$
- **Daily Nutritional Aggregation for Date $D$:**
  $$C_{\text{total}} = \sum_{i \in \text{diet\_logs}(D)} calories_i, \quad P_{\text{total}} = \sum protein_i, \quad K_{\text{total}} = \sum carbs_i, \quad F_{\text{total}} = \sum fat_i$$
- **Macronutrient Energy Distribution (Atwater System):**
  $$E_{\text{protein}} = P_{\text{total}} \times 4 \text{ kcal}, \quad E_{\text{carbs}} = K_{\text{total}} \times 4 \text{ kcal}, \quad E_{\text{fat}} = F_{\text{total}} \times 9 \text{ kcal}$$
- **Meal Categorization Enumeration:**
  Must be mapped to localized labels:
  - `breakfast` $\to$ "Café da Manhã"
  - `lunch` $\to$ "Almoço"
  - `snack` $\to$ "Lanche"
  - `dinner` $\to$ "Jantar"
  - `supper` $\to$ "Ceia"

### 7.2 TACO & Open Food Facts Query Protocol
1. Local TACO Search:
   `SELECT * FROM foods WHERE name LIKE '%<term>%' ORDER BY (CASE WHEN name LIKE '<term>%' THEN 1 ELSE 2 END), name ASC LIMIT 50;`
   Execution guaranteed $< 100\text{ms}$ via B-tree index on `name`.
2. Open Food Facts Barcode API:
   `GET https://world.openfoodfacts.org/api/v2/product/{barcode}.json`
   Extract: `product.product_name`, `nutriments['energy-kcal_100g']`, `nutriments.proteins_100g`, `nutriments.carbohydrates_100g`, `nutriments.fat_100g`.
   If successful, automatically cache product into local `foods` table (`source='openfoodfacts'`).
3. Open Food Facts Text Search API:
   `GET https://world.openfoodfacts.org/cgi/search.pl?search_terms={query}&search_simple=1&action=process&json=1&page_size=20`

### 7.3 Water Tracker Aggregation
- **Daily Consumed:**
  $$W_{\text{consumed}} = \sum_{w \in \text{water\_logs}(D)} amount\_ml_w$$
- **Progress Ratio:**
  $$\text{Progress} = \min\left(1.0, \frac{W_{\text{consumed}}}{W_{\text{target}}}\right)$$

### 7.4 Workout Progression & Metric Formulas
- **Last Session Reference Query:**
  To populate `Anterior (kg x reps)` for an exercise in a live workout:
  ```sql
  SELECT s.set_number, s.weight_kg, s.reps 
  FROM set_logs s
  JOIN workout_sessions w ON s.session_id = w.id
  WHERE s.exercise_name = :exercise_name AND s.completed = 1
  ORDER BY w.date DESC, s.created_at DESC, s.set_number ASC
  LIMIT :target_sets;
  ```
- **Estimated 1RM (One Repetition Maximum) - Brzycki Formula:**
  $$\text{1RM} = \begin{cases} \text{Weight}, & \text{if } \text{Reps} = 1 \\ \text{Weight} \times \frac{36}{37 - \min(\text{Reps}, 30)}, & \text{if } \text{Reps} > 1 \end{cases}$$
- **Total Workout Volume:**
  $$\text{Volume} = \sum_{s \in \text{completed\_sets}} \text{Weight}_s \times \text{Reps}_s$$

### 7.5 7-Day Moving Average & Body Composition
- **7-Day Rolling Moving Average for Date $D$:**
  Let $W_D$ be the set of recorded body weights in the date interval $[D - 6\text{ days}, D]$.
  $$\text{MA}_7(D) = \frac{1}{|W_D|} \sum_{w \in W_D} w_{\text{weight\_kg}}$$
  If $|W_D| = 0$, $\text{MA}_7(D) = \text{null}$.
- **Body Composition:**
  $$\text{Fat Mass (kg)} = \text{Weight} \times \frac{\text{BF}\%}{100}$$
  $$\text{Lean Mass (kg)} = \text{Weight} \times \left(1 - \frac{\text{BF}\%}{100}\right)$$

---

## 8. Repository Pattern & TypeScript Contracts

To ensure complete decoupling between UI and SQLite (and guarantee seamless Phase 2 Supabase migration), all database access must adhere to the following typed contracts:

### 8.1 Domain Models (`src/types/domain.ts`)
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
  date: string;
  amountMl: number;
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
  date: string;
  durationMinutes: number;
  notes?: string;
  sets?: SetLog[];
  createdAt: string;
}

export interface BodyLog {
  id: string;
  date: string;
  weightKg: number;
  bodyFatPct?: number;
  waistCm?: number;
  chestCm?: number;
  armsCm?: number;
  legsCm?: number;
  photoUris: string[];
  createdAt: string;
}
```

### 8.2 Repository Interfaces (`src/repositories/interfaces.ts`)
```typescript
export interface IAuthRepository {
  getUserProfile(): Promise<UserProfile>;
  updateUserProfile(profile: Partial<UserProfile>): Promise<UserProfile>;
  setTheme(theme: 'dark' | 'light'): Promise<void>;
}

export interface IDietRepository {
  getDailyDietLogs(date: string): Promise<DietLogEntry[]>;
  addDietLog(log: Omit<DietLogEntry, 'id' | 'createdAt'>): Promise<DietLogEntry>;
  removeDietLog(id: string): Promise<void>;
  searchFoods(query: string): Promise<FoodItem[]>;
  getFoodByBarcode(barcode: string): Promise<FoodItem | null>;
  createCustomFood(food: Omit<FoodItem, 'id' | 'source'>): Promise<FoodItem>;
  getWaterLogs(date: string): Promise<WaterLogEntry[]>;
  getDailyWaterTotal(date: string): Promise<number>;
  addWaterLog(date: string, amountMl: number): Promise<WaterLogEntry>;
  deleteWaterLog(id: string): Promise<void>;
}

export interface IWorkoutRepository {
  getRoutines(): Promise<WorkoutRoutine[]>;
  getRoutineById(id: string): Promise<WorkoutRoutine | null>;
  createRoutine(routine: Omit<WorkoutRoutine, 'id' | 'createdAt'>, exercises: Omit<RoutineExercise, 'id' | 'routineId'>[]): Promise<WorkoutRoutine>;
  updateRoutine(routine: WorkoutRoutine, exercises: RoutineExercise[]): Promise<void>;
  deleteRoutine(id: string): Promise<void>;
  getLastSessionForExercise(exerciseName: string): Promise<{ setNumber: number; weightKg: number; reps: number }[]>;
  saveWorkoutSession(session: Omit<WorkoutSession, 'id' | 'createdAt'>, sets: Omit<SetLog, 'id' | 'sessionId' | 'createdAt'>[]): Promise<WorkoutSession>;
  getWorkoutSessions(limit?: number, offset?: number): Promise<WorkoutSession[]>;
  getSessionDetails(sessionId: string): Promise<WorkoutSession | null>;
  getExerciseProgress(exerciseName: string): Promise<{ date: string; maxWeight: number; estimated1RM: number; totalVolume: number }[]>;
}

export interface IBodyRepository {
  getBodyLogs(startDate?: string, endDate?: string): Promise<BodyLog[]>;
  getLatestBodyLog(): Promise<BodyLog | null>;
  saveBodyLog(log: Omit<BodyLog, 'id' | 'createdAt'>): Promise<BodyLog>;
  getWeightMovingAverage(date: string, windowDays?: number): Promise<number | null>;
  getAllWeightHistoryWithMovingAverage(): Promise<{ date: string; weightKg: number; movingAverage: number | null }[]>;
}
```

---

## 9. Expo Router Screen & Navigation Architecture

Strictly adhering to `AGENTS.md` (Expo Router in `src/app/`):

```
src/
├── app/
│   ├── _layout.tsx                     # Root layout: SQLite Provider, Theme Provider, StatusBar
│   ├── (tabs)/
│   │   ├── _layout.tsx                 # Tab Navigator (Lucide icons, OLED dark tab bar)
│   │   ├── index.tsx                   # Tab 1: Dieta & Água (Daily summary, meal list, water tracker)
│   │   ├── workouts.tsx                # Tab 2: Treinos (Routine cards, start workout button, history)
│   │   ├── body.tsx                    # Tab 3: Evolução Corporal (Weight, 7-day MA chart, body comp)
│   │   └── profile.tsx                 # Tab 4: Perfil & Configurações (Macro goals, dark/light theme)
│   ├── workout/
│   │   ├── [id].tsx                    # Routine detail & edit screen
│   │   ├── live.tsx                    # Live Workout Execution modal (Previous stats, timers, haptics)
│   │   └── history.tsx                 # Workout history list and exercise 1RM progression charts
│   ├── food/
│   │   ├── search.tsx                  # Food Search modal (TACO local + Open Food Facts tabs)
│   │   ├── barcode.tsx                 # Barcode scanner screen (expo-camera)
│   │   └── custom.tsx                  # Custom food creation form
│   └── body/
│       ├── new-entry.tsx               # Daily weigh-in & circumference entry modal
│       └── compare-photos.tsx          # Before vs. After progress photo comparator
├── components/                         # UI components (MacroDonutChart, SetRow, RestTimer, FoodCard)
├── db/                                 # Database migrations, seed data (TACO JSON, default routines)
├── repositories/                       # SqliteAuthRepository, SqliteDietRepository, etc.
├── hooks/                              # useTheme, useDailyNutrition, useLiveWorkout, useRestTimer
├── services/                           # OpenFoodFactsService, HapticsService
├── theme/                              # OLED Dark & Light tokens (colors, typography, spacing)
└── types/                              # TypeScript domain models and repository interfaces
```

### Theme Tokens Specification:
- **Dark Mode (Default - OLED Optimized):**
  - Background: `#0A0A0C`
  - Surface / Card: `#16161A`
  - Border: `#26262B`
  - Primary Text: `#FFFFFF`
  - Secondary Text: `#9E9EA7`
  - Accent Green (Nutrition/Success): `#00E676`
  - Accent Blue (Workouts/Timers): `#00B0FF`
  - Accent Orange (Carbs/Warning): `#FF9100`
  - Accent Red (Fat/Danger): `#FF5252`
- **Light Mode:**
  - Background: `#F8F9FA`
  - Surface / Card: `#FFFFFF`
  - Border: `#E4E7EB`
  - Primary Text: `#121214`
  - Secondary Text: `#6C757D`
  - Accent Green: `#00A854`
  - Accent Blue: `#007AFF`

---

## 10. Caveats

1. **Expo Go Native Module Constraints:**
   - In Expo Go (SDK 58), `expo-sqlite`, `expo-haptics`, and `expo-camera` are standard bundled modules supported out of the box.
   - However, legacy `expo-barcode-scanner` is deprecated in modern Expo; SDK 58 uses `CameraView` with `barcodeScannerSettings` from `expo-camera`. Implementation must utilize `expo-camera`'s modern barcode scanning API.
2. **Open Food Facts API Rate Limiting & Reliability:**
   - Open Food Facts is a free crowdsourced API. Requests can occasionally experience high latency or 429 rate limiting. The repository must implement a 5-second timeout and cache all fetched products into the local SQLite `foods` table.
3. **Local Photo Persistence on iOS:**
   - Photos taken with `expo-camera` or picked from the gallery must be copied to a permanent local directory (`FileSystem.documentDirectory + 'progress_photos/'`) before saving the URI in `body_logs.photo_uris_json`. Relying on temporary cache URIs would cause photos to disappear on iOS app refresh.
4. **Offline Auth in Phase 1:**
   - The user requested a personal offline MVP with preparation for Supabase. Phase 1 SQLite stores a single local default user profile (`users` table). The `IAuthRepository` acts as the single source of truth, returning the active local user, making the future switch to Supabase Auth completely transparent to the UI.

---

## 11. Conclusion

The specification mining has extracted and structured:
1. **34 distinct features** spanning 6 operational categories.
2. **25 rigorous edge cases and boundary conditions** with precise resolution strategies.
3. **Complete 9-table SQLite relational schema (`fitness.db`)** with indexes, foreign key cascades, and WAL configuration.
4. **Mathematical models** for Atwater macro calorie distributions, TACO sub-100ms queries, Brzycki 1RM load estimation, 7-day rolling moving weight averages, and body composition.
5. **Decoupled Repository Pattern contracts** (`IAuthRepository`, `IDietRepository`, `IWorkoutRepository`, `IBodyRepository`) ensuring 100% testability and zero-effort Phase 2 Supabase migration.
6. **Expo Router file hierarchy** in strict compliance with `AGENTS.md`.

This technical specification provides the complete foundation for the project orchestrator to establish milestones, task contracts, and automated validation suites.

---

## 12. Verification Method

To independently verify the completeness and compliance of these mined specifications:

1. **Schema & Integrity Verification:**
   - Run SQLite schema verification:
     ```bash
     python3 -c "import sqlite3; conn = sqlite3.connect(':memory:'); conn.executescript(open('/home/bruno/Documentos/app/.agents/teamwork/spec_miner_survey_1/schema_check.sql').read()); print('Tables:', [r[0] for r in conn.execute(\"SELECT name FROM sqlite_master WHERE type='table';\").fetchall()])"
     ```
   - Check foreign key cascade enforcement:
     `PRAGMA foreign_keys = ON;`
2. **Type Checking & Lint Verification:**
   - Validate TypeScript types against Expo SDK 58:
     ```bash
     npx tsc --noEmit
     ```
   - Validate Expo lint conventions:
     ```bash
     npx expo lint
     ```
3. **Repository Unit Test Verification:**
   - Unit tests covering `SqliteDietRepository`, `SqliteWorkoutRepository`, `SqliteBodyRepository`, `SqliteAuthRepository`:
     ```bash
     npm test
     ```
4. **Invalidation Conditions:**
   - Any introduction of network dependency in Phase 1 for core features.
   - Any direct SQLite database query inside React Native UI components outside repository implementations.
   - Any deviation from the Expo Router directory convention in `src/app/`.
