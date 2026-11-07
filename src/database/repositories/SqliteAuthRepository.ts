import {
  IAuthRepository,
  ISqliteDatabase,
  RegisterUserInput,
  LoginUserInput,
  OnboardingData,
} from './interfaces';
import { UserProfile } from '../../types/domain';

const PASSWORD_SALT = 'irontrack_secure_salt_v2';

export async function hashPassword(password: string): Promise<string> {
  if (!password) return '';
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + ':' + PASSWORD_SALT);
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback for test or legacy environments
  let hash = 0;
  const str = password + ':' + PASSWORD_SALT;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return 'fallback_' + Math.abs(hash).toString(16);
}

interface UserRow {
  id: string;
  email: string | null;
  password?: string | null;
  name: string;
  is_logged_in: number;
  onboarding_completed: number;
  height_cm: number | null;
  target_weight_kg: number | null;
  training_goal: string | null;
  activity_level: string | null;
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
      password: row.password ?? undefined,
      name: row.name,
      isLoggedIn: Boolean(row.is_logged_in),
      onboardingCompleted: Boolean(row.onboarding_completed),
      heightCm: row.height_cm ?? undefined,
      targetWeightKg: row.target_weight_kg ?? undefined,
      trainingGoal: row.training_goal ?? undefined,
      activityLevel: row.activity_level ?? undefined,
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
    // Prefer user currently marked as logged in
    let row = await this.db.getFirstAsync<UserRow>(
      `SELECT id, email, password, name, is_logged_in, onboarding_completed, height_cm, target_weight_kg, training_goal, activity_level, target_calories, target_protein, target_carbs, target_fat, target_water_ml, theme, created_at, updated_at
       FROM users
       WHERE is_logged_in = 1
       LIMIT 1;`
    );

    if (!row) {
      // Fallback to the first user in table
      row = await this.db.getFirstAsync<UserRow>(
        `SELECT id, email, password, name, is_logged_in, onboarding_completed, height_cm, target_weight_kg, training_goal, activity_level, target_calories, target_protein, target_carbs, target_fat, target_water_ml, theme, created_at, updated_at
         FROM users
         LIMIT 1;`
      );
    }

    if (row) {
      return this.mapRow(row);
    }

    // Default profile fallback if table is completely empty
    const defaultId = 'default_user';
    const now = new Date().toISOString();
    await this.db.runAsync(
      `INSERT INTO users (id, email, name, is_logged_in, onboarding_completed, target_calories, target_protein, target_carbs, target_fat, target_water_ml, theme, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      defaultId,
      'atleta@irontrack.app',
      'Atleta',
      0,
      0,
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
      isLoggedIn: false,
      onboardingCompleted: false,
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
         height_cm = ?,
         target_weight_kg = ?,
         training_goal = ?,
         activity_level = ?,
         is_logged_in = ?,
         onboarding_completed = ?,
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
      updated.heightCm ?? null,
      updated.targetWeightKg ?? null,
      updated.trainingGoal ?? null,
      updated.activityLevel ?? null,
      updated.isLoggedIn ? 1 : 0,
      updated.onboardingCompleted ? 1 : 0,
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

  async registerUser(input: RegisterUserInput): Promise<UserProfile> {
    const trimmedEmail = input.email.trim().toLowerCase();
    const trimmedName = input.name.trim();

    if (!trimmedEmail) {
      throw new Error('E-mail é obrigatório para cadastro.');
    }

    const existing = await this.db.getFirstAsync<{ id: string }>(
      'SELECT id FROM users WHERE LOWER(email) = ? LIMIT 1;',
      trimmedEmail
    );
    if (existing) {
      throw new Error('E-mail já cadastrado no aplicativo.');
    }

    const hashedPassword = input.password ? await hashPassword(input.password) : null;
    const now = new Date().toISOString();
    const id = `user_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    // Set any previously logged-in users to 0
    await this.db.runAsync('UPDATE users SET is_logged_in = 0;');

    await this.db.runAsync(
      `INSERT INTO users (
         id, email, password, name, is_logged_in, onboarding_completed,
         target_calories, target_protein, target_carbs, target_fat, target_water_ml,
         theme, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      id,
      trimmedEmail,
      hashedPassword,
      trimmedName || 'Atleta',
      1,
      0,
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
      id,
      email: trimmedEmail,
      password: hashedPassword ?? undefined,
      name: trimmedName || 'Atleta',
      isLoggedIn: true,
      onboardingCompleted: false,
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

  async loginUser(input: LoginUserInput): Promise<UserProfile> {
    const trimmedEmail = input.email.trim().toLowerCase();
    const userRow = await this.db.getFirstAsync<UserRow>(
      `SELECT id, email, password, name, is_logged_in, onboarding_completed, height_cm, target_weight_kg, training_goal, activity_level, target_calories, target_protein, target_carbs, target_fat, target_water_ml, theme, created_at, updated_at
       FROM users
       WHERE LOWER(email) = ?
       LIMIT 1;`,
      trimmedEmail
    );

    if (!userRow) {
      throw new Error('Usuário não encontrado. Verifique seu e-mail ou crie uma conta.');
    }

    if (userRow.password) {
      if (!input.password) {
        throw new Error('Senha incorreta.');
      }
      const hashed = await hashPassword(input.password);
      if (hashed !== userRow.password) {
        throw new Error('Senha incorreta.');
      }
    }

    const now = new Date().toISOString();
    // Log out all users first
    await this.db.runAsync('UPDATE users SET is_logged_in = 0;');
    // Set this user as logged in
    await this.db.runAsync(
      'UPDATE users SET is_logged_in = 1, updated_at = ? WHERE id = ?;',
      now,
      userRow.id
    );

    return {
      ...this.mapRow(userRow),
      isLoggedIn: true,
      updatedAt: now,
    };
  }

  async logoutUser(): Promise<void> {
    const now = new Date().toISOString();
    await this.db.runAsync('UPDATE users SET is_logged_in = 0, updated_at = ?;', now);
  }

  async completeOnboarding(data: OnboardingData): Promise<UserProfile> {
    const current = await this.getProfile();
    const now = new Date().toISOString();

    const targetCalories = data.targetCalories ?? current.targetCalories;
    const targetProtein = data.targetProtein ?? current.targetProtein;
    const targetCarbs = data.targetCarbs ?? current.targetCarbs;
    const targetFat = data.targetFat ?? current.targetFat;
    const targetWaterMl = data.targetWaterMl ?? current.targetWaterMl;

    await this.db.runAsync(
      `UPDATE users SET
         height_cm = ?,
         target_weight_kg = ?,
         training_goal = ?,
         activity_level = ?,
         target_calories = ?,
         target_protein = ?,
         target_carbs = ?,
         target_fat = ?,
         target_water_ml = ?,
         onboarding_completed = 1,
         updated_at = ?
       WHERE id = ?;`,
      data.heightCm,
      data.targetWeightKg,
      data.trainingGoal,
      data.activityLevel,
      targetCalories,
      targetProtein,
      targetCarbs,
      targetFat,
      targetWaterMl,
      now,
      current.id
    );

    return {
      ...current,
      heightCm: data.heightCm,
      targetWeightKg: data.targetWeightKg,
      trainingGoal: data.trainingGoal,
      activityLevel: data.activityLevel,
      targetCalories,
      targetProtein,
      targetCarbs,
      targetFat,
      targetWaterMl,
      onboardingCompleted: true,
      updatedAt: now,
    };
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
