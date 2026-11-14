import * as Crypto from 'expo-crypto';
import {
  IAuthRepository,
  ISqliteDatabase,
  RegisterUserInput,
  LoginUserInput,
  OnboardingData,
} from './interfaces';
import { UserProfile } from '../../types/domain';

const ITERATIONS = 64;

// RFC 6234 SHA-256 implementation to guarantee 256-bit cryptographic hashing in all environments
const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(n: number, x: number): number {
  return (x >>> n) | (x << (32 - n));
}

function sha256HexSync(input: string): string {
  const utf8 = new TextEncoder().encode(input);
  const bitLen = utf8.length * 8;
  const totalBytes = Math.ceil((utf8.length + 9) / 64) * 64;
  const msg = new Uint8Array(totalBytes);
  msg.set(utf8);
  msg[utf8.length] = 0x80;
  const view = new DataView(msg.buffer);
  view.setUint32(totalBytes - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(totalBytes - 4, bitLen >>> 0, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);
  for (let offset = 0; offset < totalBytes; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(7, w[i - 15]) ^ rotr(18, w[i - 15]) ^ (w[i - 15] >>> 3);
      const s1 = rotr(17, w[i - 2]) ^ rotr(19, w[i - 2]) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((v) => v.toString(16).padStart(8, '0'))
    .join('');
}

export function generateSalt(byteLength = 16): string {
  const bytes = new Uint8Array(byteLength);
  if (typeof Crypto?.getRandomValues === 'function') {
    Crypto.getRandomValues(bytes);
  } else if (
    typeof globalThis !== 'undefined' &&
    typeof globalThis.crypto?.getRandomValues === 'function'
  ) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < byteLength; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

let lastGeneratedSalt = generateSalt(16);

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function hashPassword(password: string, salt?: string): Promise<string> {
  if (!password) return '';
  const effectiveSalt = salt && salt.length > 0 ? salt : lastGeneratedSalt;
  if (salt && salt.length > 0) {
    lastGeneratedSalt = salt;
  }

  let digest = sha256HexSync(`${effectiveSalt}:${password}`);
  for (let i = 1; i < ITERATIONS; i++) {
    digest = sha256HexSync(`${effectiveSalt}:${digest}:${i}`);
  }
  return `v2$${effectiveSalt}$${digest}`;
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
    // 1. Prefer user currently marked as logged in
    let row = await this.db.getFirstAsync<UserRow>(
      `SELECT id, email, name, is_logged_in, onboarding_completed, height_cm, target_weight_kg, training_goal, activity_level, target_calories, target_protein, target_carbs, target_fat, target_water_ml, theme, created_at, updated_at
       FROM users
       WHERE is_logged_in = 1
       LIMIT 1;`
    );

    if (row) {
      return this.mapRow(row);
    }

    // 2. When no user is logged in, strictly query only 'default_user' (never leak another registered user)
    row = await this.db.getFirstAsync<UserRow>(
      `SELECT id, email, name, is_logged_in, onboarding_completed, height_cm, target_weight_kg, training_goal, activity_level, target_calories, target_protein, target_carbs, target_fat, target_water_ml, theme, created_at, updated_at
       FROM users
       WHERE id = 'default_user'
       LIMIT 1;`
    );

    if (row) {
      return {
        ...this.mapRow(row),
        isLoggedIn: false,
      };
    }

    // 3. Default profile fallback if 'default_user' does not exist yet
    const defaultId = 'default_user';
    const now = new Date().toISOString();
    await this.db.runAsync(
      `INSERT OR IGNORE INTO users (id, email, name, is_logged_in, onboarding_completed, target_calories, target_protein, target_carbs, target_fat, target_water_ml, theme, created_at, updated_at)
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
      id: current.id,
      updatedAt: new Date().toISOString(),
    };
    delete (updated as any).password;

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

    if (!input.password) {
      throw new Error('A senha é obrigatória para cadastro.');
    }

    const existing = await this.db.getFirstAsync<{ id: string }>(
      'SELECT id FROM users WHERE LOWER(email) = ? LIMIT 1;',
      trimmedEmail
    );
    if (existing) {
      throw new Error('E-mail já cadastrado no aplicativo.');
    }

    const userSalt = generateSalt(16);
    const hashedPassword = await hashPassword(input.password, userSalt);
    const now = new Date().toISOString();
    const id = `user_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    await this.db.withTransactionAsync(async () => {
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
    });

    return {
      id,
      email: trimmedEmail,
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

    if (!userRow.password || !input.password) {
      throw new Error('Senha incorreta.');
    }

    let candidateHash: string;
    if (userRow.password.startsWith('v2$')) {
      const parts = userRow.password.split('$');
      const salt = parts[1] ?? '';
      candidateHash = await hashPassword(input.password, salt);
    } else {
      candidateHash = await hashPassword(input.password);
    }

    if (!constantTimeEqual(candidateHash, userRow.password)) {
      throw new Error('Senha incorreta.');
    }

    const now = new Date().toISOString();
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync('UPDATE users SET is_logged_in = 0;');
      await this.db.runAsync(
        'UPDATE users SET is_logged_in = 1, updated_at = ? WHERE id = ?;',
        now,
        userRow.id
      );
    });

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
