-- Schema check for fitness.db
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

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
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (food_id) REFERENCES foods(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_diet_logs_date ON diet_logs (date);
CREATE INDEX IF NOT EXISTS idx_diet_logs_meal ON diet_logs (date, meal_type);

CREATE TABLE IF NOT EXISTS water_logs (
    id TEXT PRIMARY KEY NOT NULL,
    date TEXT NOT NULL,
    amount_ml INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_water_logs_date ON water_logs (date);

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
    muscle_group TEXT,
    target_sets INTEGER NOT NULL DEFAULT 3,
    default_rest_seconds INTEGER NOT NULL DEFAULT 60,
    sort_order INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (routine_id) REFERENCES workout_routines(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_routine_exercises_routine ON routine_exercises (routine_id, sort_order);

CREATE TABLE IF NOT EXISTS workout_sessions (
    id TEXT PRIMARY KEY NOT NULL,
    routine_id TEXT,
    routine_name TEXT NOT NULL,
    date TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (routine_id) REFERENCES workout_routines(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_workout_sessions_date ON workout_sessions (date DESC);

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

CREATE TABLE IF NOT EXISTS body_logs (
    id TEXT PRIMARY KEY NOT NULL,
    date TEXT UNIQUE NOT NULL,
    weight_kg REAL NOT NULL,
    body_fat_pct REAL,
    waist_cm REAL,
    chest_cm REAL,
    arms_cm REAL,
    legs_cm REAL,
    photo_uris_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_body_logs_date ON body_logs (date DESC);
