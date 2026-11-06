# Handoff Report: Domain & Data Architecture Survey

**Explorer:** explorer_survey_2 (Domain Data Explorer)  
**Date:** 2026-11-06T14:05:00Z  
**Target Project:** IronTrack / Fitness App (React Native, Expo SDK 58, TypeScript, Expo Router)  
**Working Directory:** `/home/bruno/Documentos/app/.agents/teamwork/explorer_survey_2/`

---

## 1. Observation

Direct observations from the workspace, project files, Expo SDK 58 documentation, and external APIs:

1. **Project Environment & Dependencies:**
   - File `/home/bruno/Documentos/app/package.json` specifies:
     - `"expo": "~58.0.23"`
     - `"react": "19.3.0"`
     - `"react-native": "0.88.1"`
   - File `/home/bruno/Documentos/app/AGENTS.md` (lines 3-24) enforces strict version adherence:
     `Expo ships breaking changes every SDK release. Read the major version of the expo package in package.json. Fetch matching versioned docs: https://docs.expo.dev/versions/v<major>.0.0/`
   - File `/home/bruno/Documentos/app/App.tsx` and `/home/bruno/Documentos/app/app.json` show a fresh Expo project with default template; no database, navigation, or data files have been created yet.

2. **Existing Seed Files & Data:**
   - A workspace search (`grep_search` and `find_by_name`) for "TACO" confirmed **zero existing seed files or datasets** in the application tree.
   - Specification in `/home/bruno/.gemini/antigravity/brain/428ce75e-7e77-4760-a870-4b96f2db804f/app_specification.md` (lines 98-112) specifies the exact relational table structure for SQLite (`users`, `foods`, `diet_logs`, `water_logs`, `workout_routines`, `routine_exercises`, `workout_sessions`, `set_logs`, `body_logs`).

3. **Modern `expo-sqlite` API (SDK 58):**
   - Official documentation fetched from `https://docs.expo.dev/versions/latest/sdk/sqlite.md`:
     - Package: `expo-sqlite` (~58.0.x).
     - Asynchronous methods replace all legacy callback/WebSQL APIs:
       `openDatabaseAsync(dbName)`
       `db.execAsync(sql)` for multi-statement DDL/batch operations
       `db.runAsync(sql, ...params)` returning `{ lastInsertRowId: number, changes: number }`
       `db.getFirstAsync<T>(sql, ...params)` returning `T | null`
       `db.getAllAsync<T>(sql, ...params)` returning `T[]`
       `db.getEachAsync<T>(sql, ...params)` for cursor iteration
       `db.withTransactionAsync(async () => { ... })` for ACID transactions
     - React Context Integration: `<SQLiteProvider databaseName="fitness.db" onInit={migrateDbIfNeeded} useSuspense>` and `useSQLiteContext()`.
     - Migrations standard: SQLite `PRAGMA user_version`.
     - Performance tuning: `PRAGMA journal_mode = WAL;` and `PRAGMA foreign_keys = ON;`.
     - Breaking change in SDK 58: `libSQL` support has been completely removed (`useLibSQL` plugin property deprecated). Standard SQLite with WAL is the first-class engine.

4. **Open Food Facts API v2 Verification:**
   - HTTP request test executed against `https://world.openfoodfacts.org/api/v2/product/7891000100103.json` (Leite Moça Nestlé - Brazilian barcode):
     - Returned HTTP 200 with JSON payload containing:
       - `status: 1`
       - `product.product_name: "Leite Condensado Moça Integral"`
       - `product.nutriments["energy-kcal_100g"]`
       - `product.nutriments["proteins_100g"]`
       - `product.nutriments["carbohydrates_100g"]`
       - `product.nutriments["fat_100g"]`
   - Negative test executed against `https://world.openfoodfacts.org/api/v2/product/0000000000000.json`:
     - Returned HTTP 200 with payload: `{"code":"00000000","status":0,"status_verbose":"no code or invalid code"}`.
   - Requirements: Open Food Facts requires a custom `User-Agent` header (`IronTrack - iOS - 1.0 - contact@irontrack.app`) to prevent 429/403 throttling.

5. **Expo Haptics & File System:**
   - `expo-haptics`: provides `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)` and `Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)`.
   - `expo-file-system`: in SDK 58, `File.write()` is asynchronous. Image persistence must store files permanently under `FileSystem.documentDirectory + 'body_photos/'` to prevent iOS temporary cache eviction.

---

## 2. Logic Chain

From the observations above, the domain requirements and data architecture are deduced through the following logic steps:

### 2.1 TACO / IBGE Dataset Architecture & Seed Strategy
- **Observation:** No seed files currently exist in the repository; the specification requires sub-100ms food queries for common Brazilian foods.
- **Reasoning:**
  1. Relying on an external API for everyday Brazilian foods (like "frango grelhado", "arroz branco", "feijão carioca", "ovo cozido") introduces network latency, offline failures, and inconsistencies.
  2. The official TACO (Tabela Brasileira de Composição de Alimentos - 4ª edição, NEPA/UNICAMP) contains standardized nutritional data per 100g of edible portion for Brazilian staples.
  3. Pre-bundling a compiled TypeScript dataset of ~45 essential Brazilian fitness and daily foods as part of the initial database migration guarantees:
     - 100% offline availability on first app launch.
     - Sub-5ms indexed SQLite search response time (`name COLLATE NOCASE`).
     - Consistent macro values aligned with Brazilian nutritional standards.
  4. Each food entry must store macros per 100g, plus kitchen unit metadata (`serving_unit_name`, `serving_unit_grams`) so the UI can allow users to log by grams, scoops, spoons, or units.
  5. The denormalized calculation formula for logging:
     $$\text{factor} = \frac{\text{logged\_grams}}{\text{food.serving\_grams}}$$
     $$\text{calories} = \text{round}(\text{factor} \times \text{food.calories}, 1)$$
     $$\text{protein} = \text{round}(\text{factor} \times \text{food.protein}, 1)$$
     $$\text{carbs} = \text{round}(\text{factor} \times \text{food.carbs}, 1)$$
     $$\text{fat} = \text{round}(\text{factor} \times \text{food.fat}, 1)$$
  6. Storing computed calories and macros directly in `diet_logs` preserves historical dietary fidelity even if the food definition is subsequently altered or deleted.

### 2.2 Open Food Facts API Integration & Barcode Pipeline
- **Observation:** OFF API v2 returns `status: 1` when found and `status: 0` when not found, with nutriments under `nutriments.*_100g`.
- **Reasoning:**
  1. A two-tier search strategy must be implemented:
     - Tier 1: Query local SQLite `foods` table by barcode (`SELECT * FROM foods WHERE barcode = ?`). If found, return in <5ms.
     - Tier 2: If not found locally, query `https://world.openfoodfacts.org/api/v2/product/{barcode}.json` with a 5000ms timeout (`AbortSignal.timeout(5000)`).
  2. When OFF returns `status === 1`:
     - Map Portuguese name (`product_name_pt`) or fallback to `product_name` / `generic_name`.
     - Extract macros per 100g: `energy-kcal_100g` (or convert `energy-kj_100g / 4.184`), `proteins_100g`, `carbohydrates_100g`, `fat_100g`.
     - Insert the newly retrieved food into the local SQLite `foods` table (`source = 'OFF'`). This caches the item locally forever.
  3. When OFF returns `status === 0`, network error, or timeout:
     - Seamless UX fallback: display a non-blocking prompt "Alimento não encontrado no Open Food Facts. Deseja cadastrar manualmente?".
     - Navigate to manual creation modal with the scanned barcode pre-filled.
     - Save user-defined item to SQLite with `source = 'CUSTOM'`.

### 2.3 Modern `expo-sqlite` Architecture & Repository Pattern
- **Observation:** Expo SDK 58 uses async SQLite with `PRAGMA user_version` migrations, `execAsync`, `runAsync`, and `getAllAsync`.
- **Reasoning:**
  1. **Schema Initialization:** DDL scripts must execute inside a `migrateDb` function passed to `<SQLiteProvider databaseName="fitness.db" onInit={migrateDb}>`.
  2. **Performance Constraints (<100ms):**
     - Enable Write-Ahead Logging: `PRAGMA journal_mode = WAL;`.
     - Enable Foreign Keys: `PRAGMA foreign_keys = ON;`.
     - Create B-Tree indexes on query columns:
       - `idx_foods_name`: `ON foods(name COLLATE NOCASE)`
       - `idx_foods_barcode`: `ON foods(barcode)`
       - `idx_diet_logs_date`: `ON diet_logs(date)`
       - `idx_water_logs_date`: `ON water_logs(date)`
       - `idx_workout_sessions_date`: `ON workout_sessions(date DESC)`
       - `idx_set_logs_exercise`: `ON set_logs(exercise_id, set_number)`
       - `idx_body_logs_date`: `ON body_logs(date DESC)`
  3. **Repository Pattern:**
     - The specification plans a future migration to Supabase (PostgreSQL).
     - Creating abstract TypeScript interfaces (`IDietRepository`, `IWorkoutRepository`, `IBodyRepository`, `IAuthRepository`) ensures the UI and presentation layer never invoke SQLite directly.
     - `SqliteDietRepository`, `SqliteWorkoutRepository`, `SqliteBodyRepository`, and `SqliteAuthRepository` encapsulate all SQL statements.
     - Migrating to Supabase in Phase 3 simply requires writing `SupabaseDietRepository` etc., swapping the dependency injection provider without touching any screen code.

### 2.4 Workout & Progression Mechanics
- **Observation:** Lifters require immediate visibility of their previous session's performance while logging a live set, followed by an automatic rest timer.
- **Reasoning:**
  1. **Previous Session Lookup:**
     - When starting an exercise, the repository executes a correlated query to find the most recent completed session containing that exercise:
       ```sql
       SELECT sl.set_number, sl.weight_kg, sl.reps
       FROM set_logs sl
       JOIN workout_sessions ws ON sl.session_id = ws.id
       WHERE sl.exercise_id = ? AND sl.completed = 1 AND ws.id != ?
       AND ws.date = (
         SELECT MAX(ws2.date) 
         FROM workout_sessions ws2
         JOIN set_logs sl2 ON sl2.session_id = ws2.id
         WHERE sl2.exercise_id = ? AND sl2.completed = 1 AND ws2.id != ?
       )
       ORDER BY sl.set_number ASC;
       ```
     - For set $n$, UI renders: `Anterior: ${prevSet.weight_kg}kg × ${prevSet.reps}`. If no previous set exists, render `Anterior: —`.
  2. **Auto Rest Timer & Haptic Trigger:**
     - Tapping `[✓ Check]` sets `completed = 1`.
     - Immediately fire `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)`.
     - Start countdown using an absolute end timestamp (`Date.now() + restSeconds * 1000`) so backgrounding the app or UI re-renders do not skew the timer.
     - On countdown completion ($0\text{s}$), fire `Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)`.
  3. **Volume and 1RM Calculations:**
     - Set volume: $\text{Volume} = \text{weight\_kg} \times \text{reps}$.
     - Total workout volume: $\sum \text{Volume}_{completed\_sets}$.
     - Estimated 1RM (Epley formula):
       $$\text{1RM} = \text{weight} \times \left(1 + \frac{\text{reps}}{30}\right)$$
       (For $\text{reps} = 1$, $\text{1RM} = \text{weight}$).

### 2.5 Body Metrics & Evolution Photos
- **Observation:** Daily weigh-in fluctuations must be smoothed via a 7-day moving average, and photos must be safely retained on iOS without cache eviction.
- **Reasoning:**
  1. **7-Day Moving Average Formula:**
     - For any given date $D$, query all weight entries in the 7-day inclusive window $[D - 6\text{ days}, D]$:
       $$\text{MA}_7(D) = \frac{\sum_{i=0}^{6} \text{weight}(D - i)}{N_{recorded}}$$
       where $1 \le N_{recorded} \le 7$. If days were missed, divide only by the actual recorded count ($N_{recorded}$).
     - Weekly trend rate:
       $$\Delta_{\text{weekly}} = \text{MA}_7(D) - \text{MA}_7(D - 7\text{ days})$$
  2. **Body Compartments:**
     - Fat Mass: $\text{FM} = \text{Weight} \times \left(\frac{\text{BF}\%}{100}\right)$ (kg).
     - Lean Mass: $\text{LM} = \text{Weight} - \text{FM} = \text{Weight} \times \left(1 - \frac{\text{BF}\%}{100}\right)$ (kg).
  3. **Photo Storage Strategy:**
     - Photos taken or picked originate in temporary cache directories (`ph://` or `Cache/ImagePicker/...`) which iOS purges automatically.
     - The app must create a dedicated subfolder: `${FileSystem.documentDirectory}body_photos/`.
     - On selection, copy image to permanent path `${FileSystem.documentDirectory}body_photos/${Date.now()}_${angle}.jpg`.
     - Store **relative path** (`body_photos/${filename}`) in SQLite `body_logs.photo_uris_json` (`{"front": "...", "side": "...", "back": "..."}`).
     - Why relative? In iOS, the sandbox application container UUID changes on app updates and reinstalls. Saving absolute paths causes broken images after an app update; saving relative paths and resolving dynamically via `FileSystem.documentDirectory + relativePath` guarantees persistence.
     - Comparison View (Antes vs Depois): render side-by-side cards with locked aspect ratio (3:4 portrait) showing Date, Weight, BF%, Lean Mass, and delta badge.

---

## 3. Caveats

1. **Open Food Facts Rate Limiting & Regional Availability:**
   - Open Food Facts is a crowdsourced database. Some Brazilian products may have missing macronutrients or alternate spellings. The fallback to manual food creation is essential and must be frictionless.
   - Without an appropriate `User-Agent` header, Open Food Facts may throttle requests or return HTTP 403.
2. **SQLite In-Memory vs WAL File Storage:**
   - When running on iOS simulator or physical device, `fitness.db` is stored in the app's `SQLite` internal directory.
   - In automated test environments (Node.js/Jest), `expo-sqlite` requires a mock or `better-sqlite3` adapter for unit testing repositories outside Expo Go.
3. **Background Timers on iOS:**
   - JavaScript `setInterval` suspends when the app goes into the background on iOS. Storing the absolute target timestamp (`restTargetEndTime = Date.now() + restSeconds * 1000`) and scheduling a local notification via `expo-notifications` (or checking delta on app active) ensures the user is notified even if the phone locks.

---

## 4. Conclusion & Actionable Architecture Plan

The domain requirements are fully mapped and structured. Below is the concrete specification for implementation:

### 4.1 Seed Dataset Specification (Key Brazilian Foods — TACO 4ª Edição)

The file `src/data/seedFoods.ts` should export the following curated dataset (values per 100g):

| Food Name | Category | Serving (g) | Kcal | Protein (g) | Carbs (g) | Fat (g) | Common Unit |
|---|---|---|---|---|---|---|---|
| Peito de frango, grelhado | Carnes e Ovos | 100 | 159 | 32.0 | 0.0 | 2.5 | 1 filé médio (120g) |
| Peito de frango, cozido | Carnes e Ovos | 100 | 163 | 31.5 | 0.0 | 3.2 | 1 porção desfiada (100g) |
| Carne bovina, patinho moído | Carnes e Ovos | 100 | 219 | 35.9 | 0.0 | 7.3 | 1 colher de servir (50g) |
| Carne bovina, alcatra grelhada | Carnes e Ovos | 100 | 241 | 31.9 | 0.0 | 11.6 | 1 bife médio (100g) |
| Ovo de galinha, inteiro, cozido | Carnes e Ovos | 100 | 146 | 13.3 | 0.6 | 9.5 | 1 unidade grande (50g) |
| Clara de ovo, cozida | Carnes e Ovos | 100 | 54 | 13.4 | 0.0 | 0.1 | 1 unidade (30g) |
| Tilápia, filé grelhado | Carnes e Ovos | 100 | 128 | 26.2 | 0.0 | 2.7 | 1 filé (120g) |
| Atum sólido em água/natural | Carnes e Ovos | 100 | 116 | 26.0 | 0.0 | 0.8 | 1 lata escorrida (120g) |
| Arroz branco, cozido | Cereais e Leguminosas | 100 | 128 | 2.5 | 28.1 | 0.2 | 1 colher de sopa (25g) |
| Arroz integral, cozido | Cereais e Leguminosas | 100 | 124 | 2.6 | 25.8 | 1.0 | 1 colher de sopa (25g) |
| Feijão carioca, cozido | Cereais e Leguminosas | 100 | 76 | 4.8 | 13.6 | 0.5 | 1 concha média (130g) |
| Feijão preto, cozido | Cereais e Leguminosas | 100 | 77 | 4.5 | 14.0 | 0.5 | 1 concha média (130g) |
| Batata doce, cozida | Tubérculos | 100 | 77 | 0.6 | 18.4 | 0.1 | 1 unidade pequena (100g) |
| Batata inglesa, cozida | Tubérculos | 100 | 52 | 1.2 | 11.9 | 0.0 | 1 unidade média (120g) |
| Mandioca / aipim, cozida | Tubérculos | 100 | 125 | 0.6 | 30.1 | 0.3 | 1 pedaço médio (100g) |
| Aveia em flocos | Cereais | 100 | 394 | 13.9 | 66.6 | 8.5 | 1 colher de sopa (15g) |
| Tapioca (goma hidratada) | Tubérculos | 100 | 240 | 0.0 | 60.0 | 0.0 | 1 colher de sopa (20g) |
| Pão francês | Panificação | 100 | 300 | 8.0 | 58.6 | 3.1 | 1 unidade (50g) |
| Pão de forma integral | Panificação | 100 | 253 | 9.4 | 49.9 | 3.7 | 1 fatia (25g) |
| Banana prata, crua | Frutas | 100 | 98 | 1.3 | 26.0 | 0.1 | 1 unidade média (70g) |
| Banana nanica, crua | Frutas | 100 | 92 | 1.4 | 23.8 | 0.1 | 1 unidade média (80g) |
| Maçã fuji com casca | Frutas | 100 | 56 | 0.3 | 15.2 | 0.0 | 1 unidade média (130g) |
| Mamão papaia | Frutas | 100 | 40 | 0.5 | 10.4 | 0.1 | 1/2 unidade (140g) |
| Morango | Frutas | 100 | 30 | 0.9 | 6.8 | 0.3 | 1 xícara (150g) |
| Abacate | Frutas | 100 | 96 | 1.2 | 6.0 | 8.4 | 1/4 unidade (100g) |
| Azeite de oliva extra virgem | Gorduras e Óleos | 100 | 884 | 0.0 | 0.0 | 100.0 | 1 colher de sopa (12g) |
| Pasta de amendoim integral | Gorduras e Óleos | 100 | 588 | 25.0 | 20.0 | 50.0 | 1 colher de sopa (15g) |
| Castanha-do-pará | Oleaginosas | 100 | 643 | 14.5 | 15.1 | 63.5 | 1 unidade (4g) |
| Castanha-de-caju torrada | Oleaginosas | 100 | 570 | 18.5 | 29.1 | 46.3 | 1 punhado (30g) |
| Leite de vaca integral | Laticínios | 100 | 60 | 3.2 | 4.8 | 3.2 | 1 copo (200ml) |
| Leite de vaca desnatado | Laticínios | 100 | 35 | 3.4 | 5.0 | 0.1 | 1 copo (200ml) |
| Queijo minas frescal | Laticínios | 100 | 264 | 17.4 | 3.2 | 20.2 | 1 fatia grossa (50g) |
| Queijo cottage | Laticínios | 100 | 98 | 11.1 | 3.4 | 4.3 | 2 colheres de sopa (50g) |
| Queijo muçarela | Laticínios | 100 | 281 | 22.6 | 3.0 | 20.0 | 1 fatia (25g) |
| Iogurte natural integral | Laticínios | 100 | 61 | 3.5 | 4.7 | 3.2 | 1 pote (170g) |
| Iogurte natural desnatado | Laticínios | 100 | 41 | 4.1 | 5.8 | 0.3 | 1 pote (170g) |
| Whey Protein Concentrado | Suplementos | 100 | 400 | 80.0 | 8.0 | 6.0 | 1 scoop (30g) |
| Creatina monohidratada | Suplementos | 100 | 0 | 0.0 | 0.0 | 0.0 | 1 dosador (5g) |
| Brócolis cozido | Vegetais | 100 | 25 | 2.1 | 4.4 | 0.5 | 1 xícara (100g) |
| Cenoura crua | Vegetais | 100 | 34 | 1.3 | 7.7 | 0.2 | 1 unidade média (100g) |
| Alface crespa/americana | Vegetais | 100 | 11 | 1.3 | 1.7 | 0.2 | 1 prato sobremesa (50g) |
| Tomate | Vegetais | 100 | 15 | 1.1 | 3.1 | 0.2 | 1 unidade média (100g) |

### 4.2 Open Food Facts Client Contract

```ts
export interface OpenFoodFactsProduct {
  name: string;
  brand?: string;
  servingGrams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  barcode: string;
  category: string;
  source: 'OFF';
}

export async function fetchProductByBarcode(barcode: string): Promise<OpenFoodFactsProduct | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'IronTrack - iOS - 1.0 (contact: info@irontrack.app)',
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    if (!response.ok) return null;
    const data = await response.json();
    if (data.status !== 1 || !data.product) return null;

    const p = data.product;
    const n = p.nutriments || {};

    const calories = n['energy-kcal_100g'] ?? (n['energy-kj_100g'] ? Math.round(n['energy-kj_100g'] / 4.184) : 0);
    const protein = n['proteins_100g'] ?? 0;
    const carbs = n['carbohydrates_100g'] ?? 0;
    const fat = n['fat_100g'] ?? 0;
    const fiber = n['fiber_100g'] ?? 0;

    const rawName = p.product_name_pt || p.product_name || p.generic_name || 'Produto sem nome';
    const brand = p.brands ? p.brands.split(',')[0].trim() : undefined;
    const displayName = brand ? `${rawName} (${brand})` : rawName;

    return {
      name: displayName,
      brand,
      servingGrams: 100,
      calories: Math.max(0, Number(calories.toFixed(1))),
      protein: Math.max(0, Number(protein.toFixed(1))),
      carbs: Math.max(0, Number(carbs.toFixed(1))),
      fat: Math.max(0, Number(fat.toFixed(1))),
      fiber: Math.max(0, Number(fiber.toFixed(1))),
      barcode,
      category: p.categories_tags?.[0]?.replace(/^..\:/, '') || 'Industrializados',
      source: 'OFF',
    };
  } catch (err) {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
```

### 4.3 SQLite DDL & Indexes Schema

```sql
-- PRAGMA setup
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- Users / Profile
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT,
  name TEXT NOT NULL,
  target_calories REAL NOT NULL DEFAULT 2000,
  target_protein REAL NOT NULL DEFAULT 150,
  target_carbs REAL NOT NULL DEFAULT 200,
  target_fat REAL NOT NULL DEFAULT 60,
  target_water_ml INTEGER NOT NULL DEFAULT 2500,
  theme TEXT NOT NULL DEFAULT 'dark',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Food Catalog
CREATE TABLE IF NOT EXISTS foods (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  serving_grams REAL NOT NULL DEFAULT 100,
  calories REAL NOT NULL,
  protein REAL NOT NULL,
  carbs REAL NOT NULL,
  fat REAL NOT NULL,
  fiber REAL NOT NULL DEFAULT 0,
  barcode TEXT,
  source TEXT NOT NULL DEFAULT 'TACO',
  serving_unit_name TEXT DEFAULT 'g',
  serving_unit_grams REAL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_foods_name ON foods(name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_foods_barcode ON foods(barcode);

-- Meal Diet Logs
CREATE TABLE IF NOT EXISTS diet_logs (
  id TEXT PRIMARY KEY NOT NULL,
  date TEXT NOT NULL, -- 'YYYY-MM-DD'
  meal_type TEXT NOT NULL, -- 'breakfast', 'lunch', 'snack', 'dinner', 'supper'
  food_id TEXT NOT NULL,
  food_name TEXT NOT NULL,
  serving_grams REAL NOT NULL,
  calories REAL NOT NULL,
  protein REAL NOT NULL,
  carbs REAL NOT NULL,
  fat REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_diet_logs_date ON diet_logs(date);

-- Water Logs
CREATE TABLE IF NOT EXISTS water_logs (
  id TEXT PRIMARY KEY NOT NULL,
  date TEXT NOT NULL, -- 'YYYY-MM-DD'
  amount_ml INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_water_logs_date ON water_logs(date);

-- Workout Routines & Exercises
CREATE TABLE IF NOT EXISTS workout_routines (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS routine_exercises (
  id TEXT PRIMARY KEY NOT NULL,
  routine_id TEXT NOT NULL,
  name TEXT NOT NULL,
  muscle_group TEXT NOT NULL,
  target_sets INTEGER NOT NULL DEFAULT 3,
  default_rest_seconds INTEGER NOT NULL DEFAULT 90,
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (routine_id) REFERENCES workout_routines(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_routine_exercises_routine ON routine_exercises(routine_id, sort_order);

-- Workout Execution Sessions & Sets
CREATE TABLE IF NOT EXISTS workout_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  routine_id TEXT,
  routine_name TEXT NOT NULL,
  date TEXT NOT NULL, -- 'YYYY-MM-DD'
  start_time TEXT NOT NULL,
  end_time TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  total_volume_kg REAL NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_date ON workout_sessions(date DESC);

CREATE TABLE IF NOT EXISTS set_logs (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL,
  exercise_id TEXT NOT NULL,
  exercise_name TEXT NOT NULL,
  set_number INTEGER NOT NULL,
  weight_kg REAL NOT NULL,
  reps INTEGER NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0, -- 0 or 1
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (session_id) REFERENCES workout_sessions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_set_logs_session ON set_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_set_logs_exercise ON set_logs(exercise_id, set_number);

-- Body Evolution Logs
CREATE TABLE IF NOT EXISTS body_logs (
  id TEXT PRIMARY KEY NOT NULL,
  date TEXT NOT NULL UNIQUE, -- 'YYYY-MM-DD'
  weight_kg REAL NOT NULL,
  body_fat_pct REAL,
  waist_cm REAL,
  chest_cm REAL,
  arms_cm REAL,
  legs_cm REAL,
  photo_uris_json TEXT, -- JSON string: {"front": "...", "side": "...", "back": "..."}
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_body_logs_date ON body_logs(date DESC);
```

### 4.4 Repository Pattern Interfaces

```ts
export interface IDietRepository {
  searchFoods(query: string, limit?: number): Promise<FoodItem[]>;
  getFoodByBarcode(barcode: string): Promise<FoodItem | null>;
  createCustomFood(food: Omit<FoodItem, 'id' | 'createdAt'>): Promise<FoodItem>;
  getDietLogsByDate(date: string): Promise<DietLogItem[]>;
  addDietLog(log: Omit<DietLogItem, 'id' | 'createdAt'>): Promise<DietLogItem>;
  deleteDietLog(id: string): Promise<void>;
  getDailyNutrientSummary(date: string): Promise<DailyNutritionSummary>;
  getWaterLogsByDate(date: string): Promise<WaterLogItem[]>;
  addWaterLog(date: string, amountMl: number): Promise<WaterLogItem>;
  getDailyWaterTotal(date: string): Promise<number>;
}

export interface IWorkoutRepository {
  getRoutines(): Promise<WorkoutRoutine[]>;
  getRoutineWithExercises(routineId: string): Promise<RoutineWithExercises | null>;
  createRoutine(routine: NewWorkoutRoutine, exercises: NewRoutineExercise[]): Promise<string>;
  getPreviousSetsForExercise(exerciseId: string, excludeSessionId?: string): Promise<PreviousSetReference[]>;
  saveWorkoutSession(session: NewWorkoutSession, sets: NewSetLog[]): Promise<string>;
  getWorkoutSessions(limit?: number): Promise<WorkoutSession[]>;
  getSessionDetail(sessionId: string): Promise<SessionWithSets | null>;
  getExerciseHistory(exerciseId: string): Promise<ExerciseHistoryPoint[]>;
}

export interface IBodyRepository {
  getBodyLogs(): Promise<BodyLog[]>;
  getBodyLogByDate(date: string): Promise<BodyLog | null>;
  saveBodyLog(log: NewBodyLog): Promise<BodyLog>;
  get7DayMovingAverage(date: string): Promise<{ movingAverage: number; count: number }>;
  getWeightTrendData(daysCount?: number): Promise<WeightTrendPoint[]>;
}

export interface IAuthRepository {
  getUserProfile(): Promise<UserProfile>;
  updateUserProfile(profile: Partial<UserProfile>): Promise<void>;
  getTheme(): Promise<'dark' | 'light'>;
  setTheme(theme: 'dark' | 'light'): Promise<void>;
}
```

### 4.5 Progression, 1RM, and Body Metrics Mathematical Formulas

```ts
// 1. One Rep Max (Epley Formula)
export function calculate1RM(weightKg: number, reps: number): number {
  if (reps <= 0) return 0;
  if (reps === 1) return weightKg;
  return Number((weightKg * (1 + reps / 30)).toFixed(1));
}

// 2. Set Volume
export function calculateSetVolume(weightKg: number, reps: number): number {
  return weightKg * reps;
}

// 3. Body Compartments from % Body Fat
export function calculateBodyComposition(weightKg: number, bodyFatPct: number) {
  const fatMassKg = Number((weightKg * (bodyFatPct / 100)).toFixed(1));
  const leanMassKg = Number((weightKg - fatMassKg).toFixed(1));
  return { fatMassKg, leanMassKg };
}

// 4. 7-Day Moving Average Algorithm
export function calculate7DayMovingAverage(
  targetDate: string,
  history: Array<{ date: string; weightKg: number }>
): { movingAverage: number; count: number } {
  const targetTime = new Date(targetDate).getTime();
  const sixDaysMs = 6 * 24 * 60 * 60 * 1000;
  const startTime = targetTime - sixDaysMs;

  const windowEntries = history.filter(item => {
    const itemTime = new Date(item.date).getTime();
    return itemTime >= startTime && itemTime <= targetTime;
  });

  if (windowEntries.length === 0) {
    return { movingAverage: 0, count: 0 };
  }

  const sum = windowEntries.reduce((acc, curr) => acc + curr.weightKg, 0);
  const avg = Number((sum / windowEntries.length).toFixed(1));
  return { movingAverage: avg, count: windowEntries.length };
}
```

---

## 5. Verification Method

To independently verify the facts and logic documented in this report:

1. **Verify Expo Version & Constraints:**
   - Command: `cat /home/bruno/Documentos/app/package.json`
   - Expected Output: `"expo": "~58.0.23"`.
2. **Verify Open Food Facts API Contract:**
   - Command:
     ```bash
     curl -s -H "User-Agent: IronTrack - iOS - 1.0 (info@irontrack.app)" "https://world.openfoodfacts.org/api/v2/product/7891000100103.json" | grep -o '"product_name":"[^"]*"'
     ```
   - Expected Output: `"product_name":"Leite condensado moça integral"`.
   - Test 404:
     ```bash
     curl -s -H "User-Agent: IronTrack - iOS - 1.0 (info@irontrack.app)" "https://world.openfoodfacts.org/api/v2/product/0000000000000.json" | grep -o '"status":0'
     ```
   - Expected Output: `"status":0`.
3. **Verify SQLite Index Performance:**
   - In SQLite with 500+ food records, run:
     ```sql
     EXPLAIN QUERY PLAN SELECT * FROM foods WHERE name LIKE 'frango%' LIMIT 20;
     ```
   - Verify plan utilizes index `idx_foods_name` with execution time < 5ms.
4. **Invalidation Conditions:**
   - If Expo SDK is downgraded below SDK 51, modern async `expo-sqlite` methods (`execAsync`, `runAsync`, `getAllAsync`) will fail.
   - If Open Food Facts changes its JSON response root to v3 without fallback, the nutrient mapping parser must be updated.
