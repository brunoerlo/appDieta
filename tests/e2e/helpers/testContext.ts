import { InMemorySQLiteDatabase, createTestDatabase } from '../../helpers/inMemoryDb';
import { SqliteAuthRepository } from '@/database/repositories/SqliteAuthRepository';
import { SqliteDietRepository } from '@/database/repositories/SqliteDietRepository';
import { SqliteWorkoutRepository } from '@/database/repositories/SqliteWorkoutRepository';
import { SqliteBodyRepository } from '@/database/repositories/SqliteBodyRepository';

export interface E2ETestContext {
  db: InMemorySQLiteDatabase;
  authRepo: SqliteAuthRepository;
  dietRepo: SqliteDietRepository;
  workoutRepo: SqliteWorkoutRepository;
  bodyRepo: SqliteBodyRepository;
  cleanup: () => Promise<void>;
}

/**
 * Initializes an isolated, clean test environment with a fresh in-memory SQLite database
 * including all table migrations and official seeds (TACO foods + default workout routines).
 */
export async function createE2ETestContext(): Promise<E2ETestContext> {
  const db = await createTestDatabase();
  const authRepo = new SqliteAuthRepository(db);
  const dietRepo = new SqliteDietRepository(db);
  const workoutRepo = new SqliteWorkoutRepository(db);
  const bodyRepo = new SqliteBodyRepository(db);

  return {
    db,
    authRepo,
    dietRepo,
    workoutRepo,
    bodyRepo,
    cleanup: async () => {
      await db.closeAsync();
    },
  };
}
