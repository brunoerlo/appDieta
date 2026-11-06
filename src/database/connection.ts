import * as SQLite from 'expo-sqlite';
import { SCHEMA_DDL } from './schema';
import { TACO_FOODS_SEED } from './seed/tacoFoods';
import { DEFAULT_ROUTINES_SEED } from './seed/defaultRoutines';
import { ISqliteDatabase } from './repositories/interfaces';

export const DATABASE_NAME = 'fitness.db';

let dbInstance: SQLite.SQLiteDatabase | null = null;

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
  // 1. Create all 9 tables and 10 indexes
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
        `INSERT INTO foods (id, name, category, serving_grams, calories, protein, carbs, fat, fiber, barcode, source, serving_unit_name, serving_unit_grams, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        food.id,
        food.name,
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
}

/**
 * Returns the singleton database instance, initializing pragmas and running migrations.
 */
export async function getDatabaseAsync(): Promise<SQLite.SQLiteDatabase> {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await configurePragmas(dbInstance);
    await runMigrations(dbInstance);
  }
  return dbInstance;
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
  if (dbInstance) {
    try {
      await dbInstance.closeAsync();
    } catch {
      // ignore
    }
    dbInstance = null;
  }
}
