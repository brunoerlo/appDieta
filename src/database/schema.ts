export const SCHEMA_DDL = `
-- =========================================================================
-- 1. USERS (Profile, Nutrition Targets & Settings)
-- =========================================================================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT,
  name TEXT NOT NULL DEFAULT 'Atleta',
  target_calories REAL NOT NULL DEFAULT 2000,
  target_protein REAL NOT NULL DEFAULT 150,
  target_carbs REAL NOT NULL DEFAULT 200,
  target_fat REAL NOT NULL DEFAULT 60,
  target_water_ml INTEGER NOT NULL DEFAULT 2500,
  theme TEXT NOT NULL DEFAULT 'dark' CHECK(theme IN ('dark', 'light')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- =========================================================================
-- 2. FOODS (Food Catalog - TACO/IBGE, Open Food Facts, Custom)
-- =========================================================================
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
  source TEXT NOT NULL DEFAULT 'taco',
  serving_unit_name TEXT DEFAULT 'g',
  serving_unit_grams REAL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_foods_name ON foods(name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_foods_barcode ON foods(barcode);
CREATE INDEX IF NOT EXISTS idx_foods_source ON foods(source);

-- =========================================================================
-- 3. DIET_LOGS (Daily Meal Entries)
-- =========================================================================
CREATE TABLE IF NOT EXISTS diet_logs (
  id TEXT PRIMARY KEY NOT NULL,
  date TEXT NOT NULL,
  meal_type TEXT NOT NULL CHECK(meal_type IN ('breakfast', 'lunch', 'snack', 'dinner', 'supper')),
  food_id TEXT,
  food_name TEXT NOT NULL,
  serving_grams REAL NOT NULL,
  calories REAL NOT NULL,
  protein REAL NOT NULL,
  carbs REAL NOT NULL,
  fat REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_diet_logs_date ON diet_logs(date);
CREATE INDEX IF NOT EXISTS idx_diet_logs_date_meal ON diet_logs(date, meal_type);

-- =========================================================================
-- 4. WATER_LOGS (Hydration Entries)
-- =========================================================================
CREATE TABLE IF NOT EXISTS water_logs (
  id TEXT PRIMARY KEY NOT NULL,
  date TEXT NOT NULL,
  amount_ml INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_water_logs_date ON water_logs(date);

-- =========================================================================
-- 5. WORKOUT_ROUTINES (Routine Templates: ABC, PPL, etc.)
-- =========================================================================
CREATE TABLE IF NOT EXISTS workout_routines (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_workout_routines_sort ON workout_routines(sort_order);

-- =========================================================================
-- 6. ROUTINE_EXERCISES (Exercises Assigned to Routines)
-- =========================================================================
CREATE TABLE IF NOT EXISTS routine_exercises (
  id TEXT PRIMARY KEY NOT NULL,
  routine_id TEXT NOT NULL,
  name TEXT NOT NULL,
  muscle_group TEXT NOT NULL,
  target_sets INTEGER NOT NULL DEFAULT 3,
  default_rest_seconds INTEGER NOT NULL DEFAULT 90,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (routine_id) REFERENCES workout_routines(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_routine_exercises_routine ON routine_exercises(routine_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_routine_exercises_name ON routine_exercises(name COLLATE NOCASE);

-- =========================================================================
-- 7. WORKOUT_SESSIONS (Executed Live & Past Workouts)
-- =========================================================================
CREATE TABLE IF NOT EXISTS workout_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  routine_id TEXT,
  routine_name TEXT NOT NULL,
  date TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  total_volume_kg REAL NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (routine_id) REFERENCES workout_routines(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_workout_sessions_date ON workout_sessions(date DESC);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_routine ON workout_sessions(routine_id);

-- =========================================================================
-- 8. SET_LOGS (Completed Sets with Weight & Reps)
-- =========================================================================
CREATE TABLE IF NOT EXISTS set_logs (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL,
  exercise_id TEXT,
  exercise_name TEXT NOT NULL,
  set_number INTEGER NOT NULL,
  weight_kg REAL NOT NULL,
  reps INTEGER NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (session_id) REFERENCES workout_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_set_logs_session ON set_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_set_logs_exercise ON set_logs(exercise_id, set_number);
CREATE INDEX IF NOT EXISTS idx_set_logs_exercise_name ON set_logs(exercise_name, completed);

-- =========================================================================
-- 9. BODY_LOGS (Weight, 7-Day MA, Measurements & Photos)
-- =========================================================================
CREATE TABLE IF NOT EXISTS body_logs (
  id TEXT PRIMARY KEY NOT NULL,
  date TEXT NOT NULL UNIQUE,
  weight_kg REAL NOT NULL,
  body_fat_pct REAL,
  waist_cm REAL,
  chest_cm REAL,
  arms_cm REAL,
  legs_cm REAL,
  photo_uris_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_body_logs_date ON body_logs(date DESC);
`;
