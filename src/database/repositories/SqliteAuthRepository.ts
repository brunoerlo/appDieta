import { IAuthRepository, ISqliteDatabase } from './interfaces';
import { UserProfile } from '../../types/domain';

interface UserRow {
  id: string;
  email: string | null;
  name: string;
  target_calories: number;
  target_protein: number;
  target_carbs: number;
  target_fat: number;
  target_water_ml: number;
  theme: 'dark' | 'light';
  created_at: string;
  updated_at: string | null;
}

export class SqliteAuthRepository implements IAuthRepository {
  constructor(private db: ISqliteDatabase) {}

  private mapRow(row: UserRow): UserProfile {
    return {
      id: row.id,
      email: row.email ?? '',
      name: row.name,
      targetCalories: row.target_calories,
      targetProtein: row.target_protein,
      targetCarbs: row.target_carbs,
      targetFat: row.target_fat,
      targetWaterMl: row.target_water_ml,
      theme: row.theme,
      createdAt: row.created_at,
      updatedAt: row.updated_at ?? undefined,
    };
  }

  async getProfile(): Promise<UserProfile> {
    const row = await this.db.getFirstAsync<UserRow>(
      `SELECT id, email, name, target_calories, target_protein, target_carbs, target_fat, target_water_ml, theme, created_at, updated_at
       FROM users
       LIMIT 1;`
    );

    if (row) {
      return this.mapRow(row);
    }

    // Default profile fallback if table is empty
    const defaultId = 'default_user';
    const now = new Date().toISOString();
    await this.db.runAsync(
      `INSERT INTO users (id, email, name, target_calories, target_protein, target_carbs, target_fat, target_water_ml, theme, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      defaultId,
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

    return {
      id: defaultId,
      email: 'atleta@irontrack.app',
      name: 'Atleta',
      targetCalories: 2000,
      targetProtein: 150,
      targetCarbs: 200,
      targetFat: 60,
      targetWaterMl: 2500,
      theme: 'dark',
      createdAt: now,
      updatedAt: now,
    };
  }

  async updateProfile(profile: Partial<UserProfile>): Promise<UserProfile> {
    const current = await this.getProfile();
    const updated: UserProfile = {
      ...current,
      ...profile,
      updatedAt: new Date().toISOString(),
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
         theme = ?,
         updated_at = ?
       WHERE id = ?;`,
      updated.name,
      updated.email,
      updated.targetCalories,
      updated.targetProtein,
      updated.targetCarbs,
      updated.targetFat,
      updated.targetWaterMl,
      updated.theme,
      updated.updatedAt,
      updated.id
    );

    return updated;
  }

  async setTheme(theme: 'dark' | 'light'): Promise<void> {
    const profile = await this.getProfile();
    const now = new Date().toISOString();
    await this.db.runAsync(
      `UPDATE users SET theme = ?, updated_at = ? WHERE id = ?;`,
      theme,
      now,
      profile.id
    );
  }

  async getTheme(): Promise<'dark' | 'light'> {
    const profile = await this.getProfile();
    return profile.theme;
  }
}
