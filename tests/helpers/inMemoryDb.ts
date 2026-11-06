import Database from 'better-sqlite3';
import { ISqliteDatabase } from '@/database/repositories/interfaces';
import { runMigrations } from '@/database/connection';

/**
 * In-memory SQLite database adapter implementing ISqliteDatabase via better-sqlite3.
 */
export class InMemorySQLiteDatabase implements ISqliteDatabase {
  public rawDb: Database.Database;

  constructor() {
    this.rawDb = new Database(':memory:');
    this.rawDb.pragma('foreign_keys = ON');
    this.rawDb.pragma('journal_mode = WAL');
  }

  async execAsync(source: string): Promise<void> {
    this.rawDb.exec(source);
  }

  async runAsync(source: string, ...params: any[]): Promise<{ lastInsertRowId: number; changes: number }> {
    const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    const stmt = this.rawDb.prepare(source);
    const info = stmt.run(...flatParams);
    return {
      lastInsertRowId: Number(info.lastInsertRowid),
      changes: info.changes,
    };
  }

  async getFirstAsync<T = any>(source: string, ...params: any[]): Promise<T | null> {
    const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    const stmt = this.rawDb.prepare(source);
    const result = stmt.get(...flatParams) as T | undefined;
    return result ?? null;
  }

  async getAllAsync<T = any>(source: string, ...params: any[]): Promise<T[]> {
    const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    const stmt = this.rawDb.prepare(source);
    return stmt.all(...flatParams) as T[];
  }

  async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    this.rawDb.exec('BEGIN TRANSACTION;');
    try {
      await task();
      this.rawDb.exec('COMMIT;');
    } catch (err) {
      this.rawDb.exec('ROLLBACK;');
      throw err;
    }
  }

  async closeAsync(): Promise<void> {
    this.rawDb.close();
  }
}

/**
 * Creates and initializes a fresh in-memory database with all migrations and seeds executed.
 */
export async function createTestDatabase(): Promise<InMemorySQLiteDatabase> {
  const db = new InMemorySQLiteDatabase();
  await runMigrations(db);
  return db;
}
