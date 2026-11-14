import * as SQLite from 'expo-sqlite';
import { SCHEMA_DDL } from './schema';
import { TACO_FOODS_SEED, READY_DISHES_SEED, BEVERAGES_SEED } from './seed/tacoFoods';
import { DEFAULT_ROUTINES_SEED } from './seed/defaultRoutines';
import { ISqliteDatabase } from './repositories/interfaces';

export const DATABASE_NAME = 'fitness.db';

let dbInstance: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Configures SQLite PRAGMAs for performance and referential integrity.
 */
export async function configurePragmas(db: ISqliteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
  `);
}

/**
 * Migration V1: Initial schema, default user, TACO foods, and default routines.
 */
export async function runMigrationV1(db: ISqliteDatabase): Promise<void> {
  // 1. Create all tables and indexes
  await db.execAsync(SCHEMA_DDL);

  // 2. Seed Default User if table is empty
  const existingUser = await db.getFirstAsync<{ id: string }>('SELECT id FROM users LIMIT 1;');
  if (!existingUser) {
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO users (id, email, name, target_calories, target_protein, target_carbs, target_fat, target_water_ml, theme, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      'default_user',
      'atleta@irontrack.app',
      'Atleta',
      2000,
      150,
      200,
      60,
      2500,
      'dark',
      now,
      now
    );
  }

  // 3. Seed TACO Brazilian Foods if table is empty
  const existingFood = await db.getFirstAsync<{ id: string }>('SELECT id FROM foods LIMIT 1;');
  if (!existingFood) {
    const now = new Date().toISOString();
    for (const food of TACO_FOODS_SEED) {
      await db.runAsync(
        `INSERT INTO foods (id, name, name_normalized, category, serving_grams, calories, protein, carbs, fat, fiber, barcode, source, serving_unit_name, serving_unit_grams, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        food.id,
        food.name,
        food.nameNormalized ?? null,
        food.category ?? '',
        food.servingGrams,
        food.calories,
        food.protein,
        food.carbs,
        food.fat,
        food.fiber ?? 0,
        food.barcode ?? null,
        food.source,
        food.servingUnitName ?? 'g',
        food.servingUnitGrams ?? 1,
        now
      );
    }
  }

  // 4. Seed Standard Workout Routines and Exercises if table is empty
  const existingRoutine = await db.getFirstAsync<{ id: string }>('SELECT id FROM workout_routines LIMIT 1;');
  if (!existingRoutine) {
    const now = new Date().toISOString();
    for (const routine of DEFAULT_ROUTINES_SEED) {
      await db.runAsync(
        `INSERT INTO workout_routines (id, name, description, sort_order, created_at)
         VALUES (?, ?, ?, ?, ?);`,
        routine.id,
        routine.name,
        routine.description,
        routine.sortOrder,
        now
      );

      for (let i = 0; i < routine.exercises.length; i++) {
        const ex = routine.exercises[i];
        const exId = `seed-${routine.id}-${i + 1}`;
        await db.runAsync(
          `INSERT INTO routine_exercises (id, routine_id, name, muscle_group, target_sets, default_rest_seconds, sort_order, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
          exId,
          routine.id,
          ex.name,
          ex.muscleGroup,
          ex.targetSets,
          ex.defaultRestSeconds,
          ex.sortOrder,
          now
        );
      }
    }
  }
}

/**
 * Migration V2: User auth/profile columns, custom exercises table, and ready dishes.
 */
export async function runMigrationV2(db: ISqliteDatabase): Promise<void> {
  // 1. Inspect existing columns in users table
  const userColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(users);');
  const existingColNames = new Set(userColumns.map((c) => c.name));

  const columnsToAdd: [string, string][] = [
    ['password', 'TEXT'],
    ['is_logged_in', 'INTEGER DEFAULT 0'],
    ['onboarding_completed', 'INTEGER DEFAULT 0'],
    ['height_cm', 'REAL'],
    ['target_weight_kg', 'REAL'],
    ['training_goal', 'TEXT'],
    ['activity_level', 'TEXT'],
  ];

  for (const [colName, colType] of columnsToAdd) {
    if (!existingColNames.has(colName)) {
      await db.execAsync(`ALTER TABLE users ADD COLUMN ${colName} ${colType};`);
    }
  }

  // 2. Create custom_exercises table and indexes if not exists
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS custom_exercises (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL DEFAULT 'default_user',
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      default_sets INTEGER NOT NULL DEFAULT 3,
      default_rest_seconds INTEGER NOT NULL DEFAULT 90,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_custom_exercises_category ON custom_exercises(category);
    CREATE INDEX IF NOT EXISTS idx_custom_exercises_name ON custom_exercises(name COLLATE NOCASE);
  `);

  // 3. Seed Ready Dishes with category 'Refeições' and source 'recipe'
  const now = new Date().toISOString();
  for (const dish of READY_DISHES_SEED) {
    await db.runAsync(
      `INSERT OR IGNORE INTO foods (id, name, name_normalized, category, serving_grams, calories, protein, carbs, fat, fiber, barcode, source, serving_unit_name, serving_unit_grams, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      dish.id,
      dish.name,
      dish.nameNormalized ?? null,
      dish.category ?? 'Refeições',
      dish.servingGrams,
      dish.calories,
      dish.protein,
      dish.carbs,
      dish.fat,
      dish.fiber ?? 0,
      dish.barcode ?? null,
      dish.source,
      dish.servingUnitName ?? 'g',
      dish.servingUnitGrams ?? 1,
      now
    );
  }
}

/**
 * Migration V3: Seed beverage items with category 'Bebidas' and serving units in ml.
 */
export async function runMigrationV3(db: ISqliteDatabase): Promise<void> {
  const now = new Date().toISOString();
  for (const drink of BEVERAGES_SEED) {
    await db.runAsync(
      `INSERT OR IGNORE INTO foods (id, name, name_normalized, category, serving_grams, calories, protein, carbs, fat, fiber, barcode, source, serving_unit_name, serving_unit_grams, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      drink.id,
      drink.name,
      drink.nameNormalized ?? null,
      drink.category ?? 'Bebidas',
      drink.servingGrams,
      drink.calories,
      drink.protein,
      drink.carbs,
      drink.fat,
      drink.fiber ?? 0,
      drink.barcode ?? null,
      drink.source,
      drink.servingUnitName ?? 'ml',
      drink.servingUnitGrams ?? 100,
      now
    );
  }
}

/**
 * Migration V4: Multi-tenant user_id isolation across all user data tables and UNIQUE(user_id, date) on body_logs.
 */
export async function runMigrationV4(db: ISqliteDatabase): Promise<void> {
  const tablesNeedUserId = [
    'diet_logs',
    'water_logs',
    'workout_routines',
    'routine_exercises',
    'workout_sessions',
    'set_logs',
    'custom_exercises',
  ];

  for (const table of tablesNeedUserId) {
    const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table});`);
    const hasUserId = cols.some((c) => c.name === 'user_id');
    if (!hasUserId) {
      await db.execAsync(
        `ALTER TABLE ${table} ADD COLUMN user_id TEXT NOT NULL DEFAULT 'default_user';`
      );
    }
  }

  // Check if body_logs already has user_id column; if not, rebuild with UNIQUE(user_id, date)
  const bodyCols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(body_logs);');
  const bodyHasUserId = bodyCols.some((c) => c.name === 'user_id');
  if (!bodyHasUserId) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS body_logs_v4 (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL DEFAULT 'default_user',
        date TEXT NOT NULL,
        weight_kg REAL NOT NULL,
        body_fat_pct REAL,
        waist_cm REAL,
        chest_cm REAL,
        arms_cm REAL,
        legs_cm REAL,
        photo_uris_json TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(user_id, date)
      );
      INSERT OR IGNORE INTO body_logs_v4 (id, user_id, date, weight_kg, body_fat_pct, waist_cm, chest_cm, arms_cm, legs_cm, photo_uris_json, created_at)
        SELECT id, 'default_user', date, weight_kg, body_fat_pct, waist_cm, chest_cm, arms_cm, legs_cm, photo_uris_json, created_at
        FROM body_logs;
      DROP TABLE body_logs;
      ALTER TABLE body_logs_v4 RENAME TO body_logs;
      CREATE INDEX IF NOT EXISTS idx_body_logs_date ON body_logs(date DESC);
    `);
  }

  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_diet_logs_user_date ON diet_logs(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_water_logs_user_date ON water_logs(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_workout_routines_user_sort ON workout_routines(user_id, sort_order);
    CREATE INDEX IF NOT EXISTS idx_routine_exercises_user ON routine_exercises(user_id);
    CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_date ON workout_sessions(user_id, date DESC);
    CREATE INDEX IF NOT EXISTS idx_set_logs_user_exercise ON set_logs(user_id, exercise_name, completed);
    CREATE INDEX IF NOT EXISTS idx_body_logs_user_date ON body_logs(user_id, date DESC);
    CREATE INDEX IF NOT EXISTS idx_custom_exercises_user_category ON custom_exercises(user_id, category);
  `);
}

/**
 * Migration runner based on PRAGMA user_version.
 */
export async function runMigrations(db: ISqliteDatabase): Promise<void> {
  const versionRow = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  const currentVersion = versionRow?.user_version ?? 0;

  if (currentVersion < 1) {
    await db.withTransactionAsync(async () => {
      await runMigrationV1(db);
      await db.execAsync('PRAGMA user_version = 1;');
    });
  }

  if (currentVersion < 2) {
    await db.withTransactionAsync(async () => {
      await runMigrationV2(db);
      await db.execAsync('PRAGMA user_version = 2;');
    });
  }

  if (currentVersion < 3) {
    await db.withTransactionAsync(async () => {
      await runMigrationV3(db);
      await db.execAsync('PRAGMA user_version = 3;');
    });
  }

  if (currentVersion < 4) {
    await db.withTransactionAsync(async () => {
      await runMigrationV4(db);
      await db.execAsync('PRAGMA user_version = 4;');
    });
  }
}

/**
 * Returns the singleton database instance, initializing pragmas and running migrations.
 * Memoizes initPromise to prevent race conditions during concurrent cold-start calls.
 */
export async function getDatabaseAsync(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) {
    return dbInstance;
  }
  if (!initPromise) {
    initPromise = (async () => {
      try {
        const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
        await configurePragmas(db);
        await runMigrations(db);
        dbInstance = db;
        return db;
      } catch (err) {
        initPromise = null;
        throw err;
      }
    })();
  }
  return initPromise;
}

/**
 * Handler for <SQLiteProvider onInit={migrateDbIfNeeded}> in src/app/_layout.tsx.
 */
export async function migrateDbIfNeeded(db: SQLite.SQLiteDatabase): Promise<void> {
  await configurePragmas(db);
  await runMigrations(db);
  dbInstance = db;
}

/**
 * Resets the cached database connection.
 */
export async function resetDatabaseConnectionAsync(): Promise<void> {
  initPromise = null;
  if (dbInstance) {
    try {
      await dbInstance.closeAsync();
    } catch {
      // ignore
    }
    dbInstance = null;
  }
}
