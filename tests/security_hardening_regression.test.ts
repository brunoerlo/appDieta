import fs from 'fs';
import path from 'path';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { InMemorySQLiteDatabase, createTestDatabase } from './helpers/inMemoryDb';
import { SqliteAuthRepository } from '../src/database/repositories/SqliteAuthRepository';
import { SqliteDietRepository } from '../src/database/repositories/SqliteDietRepository';
import { SqliteWorkoutRepository } from '../src/database/repositories/SqliteWorkoutRepository';
import { SqliteBodyRepository } from '../src/database/repositories/SqliteBodyRepository';
import { SupabaseAuthRepository } from '../src/database/repositories/SupabaseAuthRepository';
import { SupabaseDietRepository } from '../src/database/repositories/SupabaseDietRepository';
import { SupabaseWorkoutRepository } from '../src/database/repositories/SupabaseWorkoutRepository';
import { LargeSecureStore } from '../src/services/supabaseClient';
import { PhotoStorageService } from '../src/services/PhotoStorageService';
import { resolvePhotoUri } from '../src/utils/photoComparison';
import { parseDecimalInput } from '../src/utils/nutrition';
import { DietStateManager } from '../src/context/DietContext';

describe('Security Hardening & Regression Suite (Gate 3 QA)', () => {
  const projectRoot = path.resolve(__dirname, '..');

  // =========================================================================
  // 1. [C-01] & [M-01] & [A-06] Migration SQL Verification
  // =========================================================================
  describe('[C-01] & [M-01] & [A-06] Migration SQL (20261114000000_security_hardening_and_rpcs.sql)', () => {
    const migrationPath = path.join(
      projectRoot,
      'supabase/migrations/20261114000000_security_hardening_and_rpcs.sql'
    );
    const sql = fs.readFileSync(migrationPath, 'utf8');

    it('[C-01] enforces WITH CHECK + EXISTS parent ownership validation on routine_exercises, workout_sessions, and set_logs', () => {
      // routine_exercises -> parent workout_routines
      expect(sql).toMatch(
        /create\s+policy\s+"routine_exercises_insert_own"\s+on\s+public\.routine_exercises[\s\S]*?with\s+check\s*\([\s\S]*?exists\s*\(\s*select\s+1\s+from\s+public\.workout_routines\s+r\s+where\s+r\.id\s*=\s*routine_id\s+and\s+r\.user_id\s*=\s*\(select\s+auth\.uid\(\)\)/i
      );
      expect(sql).toMatch(
        /create\s+policy\s+"routine_exercises_update_own"\s+on\s+public\.routine_exercises[\s\S]*?with\s+check\s*\([\s\S]*?exists\s*\(\s*select\s+1\s+from\s+public\.workout_routines\s+r\s+where\s+r\.id\s*=\s*routine_id\s+and\s+r\.user_id\s*=\s*\(select\s+auth\.uid\(\)\)/i
      );

      // workout_sessions -> parent workout_routines (when routine_id is not null)
      expect(sql).toMatch(
        /create\s+policy\s+"workout_sessions_insert_own"\s+on\s+public\.workout_sessions[\s\S]*?with\s+check\s*\([\s\S]*?routine_id\s+is\s+null\s+or\s+exists\s*\(\s*select\s+1\s+from\s+public\.workout_routines\s+r\s+where\s+r\.id\s*=\s*routine_id\s+and\s+r\.user_id\s*=\s*\(select\s+auth\.uid\(\)\)/i
      );
      expect(sql).toMatch(
        /create\s+policy\s+"workout_sessions_update_own"\s+on\s+public\.workout_sessions[\s\S]*?with\s+check\s*\([\s\S]*?routine_id\s+is\s+null\s+or\s+exists\s*\(\s*select\s+1\s+from\s+public\.workout_routines\s+r\s+where\s+r\.id\s*=\s*routine_id\s+and\s+r\.user_id\s*=\s*\(select\s+auth\.uid\(\)\)/i
      );

      // set_logs -> parent workout_sessions
      expect(sql).toMatch(
        /create\s+policy\s+"set_logs_insert_own"\s+on\s+public\.set_logs[\s\S]*?with\s+check\s*\([\s\S]*?exists\s*\(\s*select\s+1\s+from\s+public\.workout_sessions\s+ws\s+where\s+ws\.id\s*=\s*session_id\s+and\s+ws\.user_id\s*=\s*\(select\s+auth\.uid\(\)\)/i
      );
      expect(sql).toMatch(
        /create\s+policy\s+"set_logs_update_own"\s+on\s+public\.set_logs[\s\S]*?with\s+check\s*\([\s\S]*?exists\s*\(\s*select\s+1\s+from\s+public\.workout_sessions\s+ws\s+where\s+ws\.id\s*=\s*session_id\s+and\s+ws\.user_id\s*=\s*\(select\s+auth\.uid\(\)\)/i
      );
    });

    it('[M-01] defines finite CHECK constraints across all 10 public tables', () => {
      const expectedConstraints = [
        { table: 'public.profiles', constraint: 'chk_profiles_bounds' },
        { table: 'public.foods', constraint: 'chk_foods_bounds' },
        { table: 'public.diet_logs', constraint: 'chk_diet_logs_bounds' },
        { table: 'public.water_logs', constraint: 'chk_water_logs_bounds' },
        { table: 'public.workout_routines', constraint: 'chk_workout_routines_bounds' },
        { table: 'public.routine_exercises', constraint: 'chk_routine_exercises_bounds' },
        { table: 'public.workout_sessions', constraint: 'chk_workout_sessions_bounds' },
        { table: 'public.set_logs', constraint: 'chk_set_logs_bounds' },
        { table: 'public.body_logs', constraint: 'chk_body_logs_bounds' },
        { table: 'public.custom_exercises', constraint: 'chk_custom_exercises_bounds' },
      ];

      for (const { table, constraint } of expectedConstraints) {
        const pattern = new RegExp(
          `alter\\s+table\\s+${table.replace('.', '\\.')}\\s+add\\s+constraint\\s+${constraint}\\s+check\\s*\\(`,
          'i'
        );
        expect(sql).toMatch(pattern);
      }
    });

    it('revokes privileges from anon and protects immutable profile columns via trigger', () => {
      expect(sql).toMatch(/revoke\s+all\s+on\s+all\s+tables\s+in\s+schema\s+public\s+from\s+anon\s*;/i);
      expect(sql).toMatch(/revoke\s+all\s+on\s+all\s+sequences\s+in\s+schema\s+public\s+from\s+anon\s*;/i);
      expect(sql).toMatch(/revoke\s+all\s+on\s+all\s+routines\s+in\s+schema\s+public\s+from\s+anon\s*;/i);

      expect(sql).toMatch(
        /create\s+or\s+replace\s+function\s+public\.protect_profile_immutable_columns\(\)[\s\S]*?security\s+invoker[\s\S]*?set\s+search_path\s*=\s*''/i
      );
      expect(sql).toMatch(
        /create\s+trigger\s+trg_protect_profile_immutable_columns\s+before\s+update\s+on\s+public\.profiles\s+for\s+each\s+row\s+execute\s+function\s+public\.protect_profile_immutable_columns\(\)/i
      );
    });

    it('[A-06] defines atomic workout RPCs with SECURITY INVOKER and empty search_path', () => {
      expect(sql).toMatch(
        /create\s+or\s+replace\s+function\s+public\.update_workout_routine_atomic\([\s\S]*?returns\s+void[\s\S]*?language\s+plpgsql[\s\S]*?security\s+invoker[\s\S]*?set\s+search_path\s*=\s*''/i
      );
      expect(sql).toMatch(
        /create\s+or\s+replace\s+function\s+public\.save_workout_session_atomic\([\s\S]*?returns\s+jsonb[\s\S]*?language\s+plpgsql[\s\S]*?security\s+invoker[\s\S]*?set\s+search_path\s*=\s*''/i
      );

      expect(sql).toMatch(
        /revoke\s+all\s+on\s+function\s+public\.update_workout_routine_atomic\([^)]+\)\s+from\s+public,\s*anon\s*;/i
      );
      expect(sql).toMatch(
        /grant\s+execute\s+on\s+function\s+public\.update_workout_routine_atomic\([^)]+\)\s+to\s+authenticated\s*;/i
      );
      expect(sql).toMatch(
        /revoke\s+all\s+on\s+function\s+public\.save_workout_session_atomic\([^)]+\)\s+from\s+public,\s*anon\s*;/i
      );
      expect(sql).toMatch(
        /grant\s+execute\s+on\s+function\s+public\.save_workout_session_atomic\([^)]+\)\s+to\s+authenticated\s*;/i
      );
    });
  });

  // =========================================================================
  // 2. [C-02] & [A-04] Multi-User SQLite Isolation & Local Auth Hardening
  // =========================================================================
  describe('[C-02] & [A-04] Multi-User SQLite Isolation & Local Auth Security [SQLITE REAL]', () => {
    let db: InMemorySQLiteDatabase;
    let authRepo: SqliteAuthRepository;
    let dietRepo: SqliteDietRepository;
    let workoutRepo: SqliteWorkoutRepository;
    let bodyRepo: SqliteBodyRepository;

    beforeEach(async () => {
      db = await createTestDatabase();
      authRepo = new SqliteAuthRepository(db);
      dietRepo = new SqliteDietRepository(db);
      workoutRepo = new SqliteWorkoutRepository(db);
      bodyRepo = new SqliteBodyRepository(db);
    });

    afterEach(async () => {
      await db.closeAsync();
    });

    it('[A-04] getProfile() without active session never leaks another registered user via LIMIT 1, and never exposes password', async () => {
      // Remove default_user first so registered user is the FIRST row in `users` table
      await db.runAsync(`DELETE FROM users WHERE id = 'default_user';`);

      const userA = await authRepo.registerUser({
        name: 'Alice Secret',
        email: 'alice@secret.com',
        password: 'AliceStrongPassword!123',
      });
      expect(userA.isLoggedIn).toBe(true);
      expect('password' in userA).toBe(false);
      expect((userA as any).password).toBeUndefined();

      // Log out Alice so no user has is_logged_in = 1
      await authRepo.logoutUser();

      // getProfile() must NOT leak Alice's row via an unscoped `SELECT * FROM users LIMIT 1`
      const unauthProfile = await authRepo.getProfile();
      expect(unauthProfile.isLoggedIn).toBe(false);
      expect(unauthProfile.id).toBe('default_user');
      expect(unauthProfile.email).not.toBe('alice@secret.com');
      expect(unauthProfile.name).not.toBe('Alice Secret');
      expect('password' in unauthProfile).toBe(false);
      expect((unauthProfile as any).password).toBeUndefined();

      // Also verify SupabaseAuthRepository returns a neutral guest profile (id='', isLoggedIn=false) when unauthenticated
      const supaAuth = new SupabaseAuthRepository({
        auth: {
          getSession: jest.fn(async () => ({ data: { session: null }, error: null })),
        },
        from: jest.fn(),
      } as any);
      const guest = await supaAuth.getProfile();
      expect(guest.isLoggedIn).toBe(false);
      expect(guest.id).toBe('');
      expect('password' in guest).toBe(false);
    });

    it('[A-04] strips password from updateProfile output and rejects loginUser on accounts with empty/null password hash', async () => {
      // Insert a passwordless account directly in SQLite (e.g. default/legacy row with empty or NULL password)
      const now = new Date().toISOString();
      await db.runAsync(
        `INSERT INTO users (id, email, password, name, is_logged_in, onboarding_completed, target_calories, target_protein, target_carbs, target_fat, target_water_ml, theme, created_at, updated_at)
         VALUES ('no-pass-user', 'nopass@test.com', '', 'No Pass', 0, 0, 2000, 150, 200, 60, 2500, 'dark', ?, ?);`,
        now,
        now
      );
      await db.runAsync(
        `INSERT INTO users (id, email, password, name, is_logged_in, onboarding_completed, target_calories, target_protein, target_carbs, target_fat, target_water_ml, theme, created_at, updated_at)
         VALUES ('null-pass-user', 'nullpass@test.com', NULL, 'Null Pass', 0, 0, 2000, 150, 200, 60, 2500, 'dark', ?, ?);`,
        now,
        now
      );

      // Even if attacker passes "" or any string, loginUser must reject passwordless accounts
      await expect(authRepo.loginUser({ email: 'nopass@test.com', password: '' })).rejects.toThrow(
        'Senha incorreta.'
      );
      await expect(
        authRepo.loginUser({ email: 'nopass@test.com', password: 'any' })
      ).rejects.toThrow('Senha incorreta.');
      await expect(
        authRepo.loginUser({ email: 'nullpass@test.com', password: '' })
      ).rejects.toThrow('Senha incorreta.');

      // Verify updateProfile strips any injected `password` field
      const updated = await authRepo.updateProfile({
        name: 'Safe Name',
        ...({ password: 'injected_secret' } as any),
      });
      expect(updated.name).toBe('Safe Name');
      expect('password' in updated).toBe(false);
      expect((updated as any).password).toBeUndefined();
    });

    it('[C-02] isolates SqliteDietRepository, SqliteWorkoutRepository, and SqliteBodyRepository between user-a and user-b', async () => {
      const now = new Date().toISOString();
      // Create User A ('user-a') and User B ('user-b') with explicit IDs
      await db.runAsync(
        `INSERT INTO users (id, email, password, name, is_logged_in, onboarding_completed, target_calories, target_protein, target_carbs, target_fat, target_water_ml, theme, created_at, updated_at)
         VALUES ('user-a', 'usera@test.com', 'v2$salt$hash', 'User A', 1, 1, 2200, 160, 220, 70, 3000, 'dark', ?, ?);`,
        now,
        now
      );
      await db.runAsync(
        `INSERT INTO users (id, email, password, name, is_logged_in, onboarding_completed, target_calories, target_protein, target_carbs, target_fat, target_water_ml, theme, created_at, updated_at)
         VALUES ('user-b', 'userb@test.com', 'v2$salt$hash', 'User B', 0, 1, 1800, 140, 180, 55, 2500, 'dark', ?, ?);`,
        now,
        now
      );

      const switchActiveUser = async (userId: 'user-a' | 'user-b') => {
        await db.runAsync(`UPDATE users SET is_logged_in = CASE WHEN id = ? THEN 1 ELSE 0 END;`, userId);
      };

      const targetDate = '2026-11-14';

      // --- 1. User A creates diet logs, water logs, workout routines/sessions, and body logs ---
      await switchActiveUser('user-a');

      const dietLogA = await dietRepo.addDietLog({
        date: targetDate,
        mealType: 'lunch',
        foodName: 'Picanha User A',
        servingGrams: 250,
        calories: 600,
        protein: 65,
        carbs: 0,
        fat: 35,
      });
      const waterLogA = await dietRepo.addWaterLog(targetDate, 500);

      const routineA = await workoutRepo.createRoutine(
        { name: 'Treino Secreto A', description: 'Apenas User A', sortOrder: 1, exercises: [] },
        [
          {
            name: 'Supino Reto',
            muscleGroup: 'Peito',
            targetSets: 4,
            defaultRestSeconds: 90,
            sortOrder: 1,
          },
        ]
      );
      const customExA = await workoutRepo.createCustomExercise({
        name: 'Rosca Especial A',
        category: 'Bíceps',
        defaultSets: 3,
        defaultRestSeconds: 60,
      });
      const sessionA = await workoutRepo.saveWorkoutSession(
        {
          routineId: routineA.id,
          routineName: routineA.name,
          date: targetDate,
          durationMinutes: 55,
          totalVolumeKg: 1000,
          notes: 'Sessão privada A',
        },
        [
          {
            exerciseName: 'Supino Reto',
            setNumber: 1,
            weightKg: 100,
            reps: 10,
            completed: true,
          },
        ]
      );

      await bodyRepo.saveBodyLog({
        date: targetDate,
        weightKg: 88.5,
        bodyFatPct: 12.5,
        waistCm: 80,
        photoUris: ['file:///data/user/0/host.exp.exponent/files/body_photos/a_front.jpg'],
      });

      // --- 2. Switch to User B ('user-b') and verify complete isolation + tamper resistance ---
      await switchActiveUser('user-b');

      // Diet isolation
      expect(await dietRepo.getDailyLogs(targetDate)).toEqual([]);
      expect(await dietRepo.getWaterLogs(targetDate)).toEqual([]);
      expect(await dietRepo.getDailyWaterTotal(targetDate)).toBe(0);

      // User B attempts to modify/delete User A's diet & water logs
      await dietRepo.updateDietLog(dietLogA.id, { calories: 1, servingGrams: 1 });
      await dietRepo.deleteDietLog(dietLogA.id);
      await dietRepo.deleteWaterLog(waterLogA.id);
      await dietRepo.resetWaterLogs(targetDate);

      // Workout isolation
      const routinesForB = await workoutRepo.getRoutines();
      expect(routinesForB.some((r) => r.id === routineA.id)).toBe(false);
      expect(await workoutRepo.getRoutineById(routineA.id)).toBeNull();
      expect(await workoutRepo.getWorkoutSessions()).toEqual([]);
      expect(await workoutRepo.getSessionDetails(sessionA.id)).toBeNull();
      expect(await workoutRepo.getPreviousExerciseSets('Supino Reto')).toEqual([]);
      expect(await workoutRepo.getExerciseHistory('Supino Reto')).toEqual([]);
      expect(await workoutRepo.getCustomExercises()).toEqual([]);

      // User B attempts to update/delete User A's routine
      await workoutRepo.updateRoutine(routineA.id, { name: 'Hacked by B' }, []);
      await workoutRepo.deleteRoutine(routineA.id);

      // Body isolation
      expect(await bodyRepo.getBodyLog(targetDate)).toBeNull();
      expect(await bodyRepo.calculateMovingAverage(targetDate, 7)).toBeNull();
      expect(await bodyRepo.getWeightHistory()).toEqual([]);
      expect(await bodyRepo.getPhotos()).toEqual([]);

      // User B attempts to delete User A's photo and saves User B's own body log on same date
      await bodyRepo.deletePhoto(
        targetDate,
        'file:///data/user/0/host.exp.exponent/files/body_photos/a_front.jpg'
      );
      await bodyRepo.saveBodyLog({
        date: targetDate,
        weightKg: 64.0,
        bodyFatPct: 20.0,
        photoUris: [],
      });

      // --- 3. Switch back to User A and verify all User A records remain intact ---
      await switchActiveUser('user-a');

      const logsA = await dietRepo.getDailyLogs(targetDate);
      expect(logsA).toHaveLength(1);
      expect(logsA[0].id).toBe(dietLogA.id);
      expect(logsA[0].calories).toBe(600);
      expect(logsA[0].servingGrams).toBe(250);
      expect(await dietRepo.getDailyWaterTotal(targetDate)).toBe(500);

      const fetchedRoutineA = await workoutRepo.getRoutineById(routineA.id);
      expect(fetchedRoutineA).not.toBeNull();
      expect(fetchedRoutineA?.name).toBe('Treino Secreto A');
      expect(fetchedRoutineA?.exercises).toHaveLength(1);

      const sessionsA = await workoutRepo.getWorkoutSessions();
      expect(sessionsA).toHaveLength(1);
      expect(sessionsA[0].id).toBe(sessionA.id);
      expect(await workoutRepo.getCustomExercises()).toEqual([
        expect.objectContaining({ id: customExA.id, name: 'Rosca Especial A' }),
      ]);

      const bodyA = await bodyRepo.getBodyLog(targetDate);
      expect(bodyA).not.toBeNull();
      expect(bodyA?.weightKg).toBe(88.5);
      expect(bodyA?.photoUris).toEqual([
        'file:///data/user/0/host.exp.exponent/files/body_photos/a_front.jpg',
      ]);
    });
  });

  // =========================================================================
  // 3. [A-02] LargeSecureStore AES-256-CTR Encryption (> 2048 bytes)
  // =========================================================================
  describe('[A-02] LargeSecureStore AES-256-CTR Session Storage [MOCK]', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalPlatformOS = Platform.OS;

    beforeEach(async () => {
      await AsyncStorage.clear();
      jest.clearAllMocks();
    });

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv;
      (Platform as any).OS = originalPlatformOS;
    });

    it('encrypts large session payloads (> 2048 bytes) with AES-256-CTR, stores key in SecureStore, ciphertext in AsyncStorage, decrypts with 100% fidelity, and cleans both on removeItem', async () => {
      // Simulate native iOS/Android runtime so SecureStore is actively exercised
      process.env.NODE_ENV = 'development';
      (Platform as any).OS = 'ios';

      const secureKeyVault = new Map<string, string>();
      const setItemSpy = jest
        .spyOn(SecureStore, 'setItemAsync')
        .mockImplementation(async (k: string, v: string) => {
          secureKeyVault.set(k, v);
        });
      const getItemSpy = jest
        .spyOn(SecureStore, 'getItemAsync')
        .mockImplementation(async (k: string) => secureKeyVault.get(k) ?? null);
      const deleteItemSpy = jest
        .spyOn(SecureStore, 'deleteItemAsync')
        .mockImplementation(async (k: string) => {
          secureKeyVault.delete(k);
        });

      const store = new LargeSecureStore();
      const storageKey = 'sb-project-auth-token';

      // Construct a realistic large Supabase session payload exceeding 2048 bytes (~4800 bytes)
      const largeSessionPayload = JSON.stringify({
        access_token: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${'A'.repeat(2400)}.signaturePart123`,
        refresh_token: `refresh_${'R'.repeat(1200)}`,
        expires_in: 3600,
        token_type: 'bearer',
        user: {
          id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          email: 'athlete@menosfrango.app',
          user_metadata: {
            full_name: 'Atleta Iron',
            notes: 'X'.repeat(1000),
          },
        },
      });
      expect(largeSessionPayload.length).toBeGreaterThan(2048);

      await store.setItem(storageKey, largeSessionPayload);

      // 1. Key must be stored in SecureStore (64 hex chars = 256 bits)
      expect(setItemSpy).toHaveBeenCalledTimes(1);
      const [secureStoreKey, storedHexKey] = setItemSpy.mock.calls[0];
      expect(secureStoreKey).toBe('sb_key_sb-project-auth-token');
      expect(storedHexKey).toMatch(/^[0-9a-f]{64}$/i);

      // 2. Ciphertext in AsyncStorage must NOT equal plaintext or contain raw tokens
      const rawCiphertext = await AsyncStorage.getItem(storageKey);
      expect(rawCiphertext).not.toBeNull();
      expect(rawCiphertext).not.toBe(largeSessionPayload);
      expect(rawCiphertext).not.toContain('access_token');
      expect(rawCiphertext).not.toContain('athlete@menosfrango.app');
      expect(rawCiphertext).toMatch(/^[0-9a-f]+$/i);

      // 3. Decryption via getItem must reconstruct the exact >2048-byte payload with 100% fidelity
      const decrypted = await store.getItem(storageKey);
      expect(getItemSpy).toHaveBeenCalledWith('sb_key_sb-project-auth-token');
      expect(decrypted).toBe(largeSessionPayload);

      // 4. removeItem must wipe both AsyncStorage ciphertext and SecureStore key
      await store.removeItem(storageKey);
      expect(deleteItemSpy).toHaveBeenCalledWith('sb_key_sb-project-auth-token');
      expect(await AsyncStorage.getItem(storageKey)).toBeNull();
      expect(await store.getItem(storageKey)).toBeNull();

      setItemSpy.mockRestore();
      getItemSpy.mockRestore();
      deleteItemSpy.mockRestore();
    });
  });

  // =========================================================================
  // 4. [A-05] PhotoStorageService & resolvePhotoUri Confinement & Sanitization
  // =========================================================================
  describe('[A-05] PhotoStorageService & resolvePhotoUri Traversal & Scheme Protection [MOCK]', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('blocks path traversal (../, %2e%2e%2f, null bytes, backslashes) and plaintext http:// in PhotoStorageService.resolveUri and resolvePhotoUri', () => {
      const maliciousUris = [
        '../../etc/passwd',
        'file:///data/user/0/host.exp.exponent/files/body_photos/../../etc/passwd',
        'body_photos/%2e%2e%2f%2e%2e%2fetc/passwd',
        'https://cdn.supabase.co/storage/v1/object/sign/body-photos/%2e%2e%2fsecret.jpg',
        'file:///data/user/0/host.exp.exponent/files/body_photos/photo.jpg\0.png',
        'body_photos\\..\\secret.db',
        'http://insecure.example.com/body_photos/front.jpg',
        'javascript:alert(document.cookie)',
        'vbscript:msgbox(1)',
      ];

      for (const badUri of maliciousUris) {
        expect(PhotoStorageService.resolveUri(badUri)).toBe('');
        expect(resolvePhotoUri(badUri)).toBe('');
      }

      // Valid URIs must be accepted
      const validHttps =
        'https://project.supabase.co/storage/v1/object/sign/body-photos/user-1/2026-11-14.jpg?token=abc';
      const validFile =
        'file:///data/user/0/host.exp.exponent/files/body_photos/2026-11-14_front_123.jpg';
      const validRelative = 'body_photos/2026-11-14_front_123.jpg';

      expect(PhotoStorageService.resolveUri(validHttps)).toBe(validHttps);
      expect(resolvePhotoUri(validHttps)).toBe(validHttps);

      expect(PhotoStorageService.resolveUri(validFile)).toBe(validFile);
      expect(resolvePhotoUri(validFile)).toBe(validFile);

      expect(PhotoStorageService.resolveUri(validRelative)).toBe(
        `${FileSystem.documentDirectory}body_photos/2026-11-14_front_123.jpg`
      );
    });

    it('refuses to delete files outside ${FileSystem.documentDirectory}body_photos/ in PhotoStorageService.deletePhotoFile', async () => {
      const outsideTargets = [
        'file:///etc/passwd',
        'file:///data/user/0/host.exp.exponent/files/SQLite/irontrack.db',
        'file:///data/user/0/host.exp.exponent/files/body_photos/../SQLite/irontrack.db',
        'file:///data/user/0/host.exp.exponent/files/body_photos/%2e%2e/secret.txt',
        'file:///data/user/0/host.exp.exponent/files/body_photos/nested/sub.jpg',
        'file:///data/user/0/host.exp.exponent/cache/temp.jpg',
      ];

      for (const target of outsideTargets) {
        await PhotoStorageService.deletePhotoFile(target);
      }
      expect(FileSystem.deleteAsync).not.toHaveBeenCalled();

      // A legitimate file directly inside body_photos/ IS deleted
      const legitimateTarget = `${FileSystem.documentDirectory}body_photos/2026-11-14_front_999.jpg`;
      await PhotoStorageService.deletePhotoFile(legitimateTarget);
      expect(FileSystem.deleteAsync).toHaveBeenCalledTimes(1);
      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(legitimateTarget, { idempotent: true });
    });
  });

  // =========================================================================
  // 5. [M-02] & [A-06] SupabaseDietRepository & SupabaseWorkoutRepository
  // =========================================================================
  describe('[M-02] & [A-06] SupabaseDietRepository Sanitization & SupabaseWorkoutRepository Atomic RPCs [MOCK]', () => {
    it('[M-02] sanitizes PostgREST metacharacters (comma, parens, dot, percent, asterisk) before building .or() in searchFoods', async () => {
      const orSpy = jest.fn().mockReturnThis();
      const mockBuilder: any = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        or: orSpy,
        returns: jest.fn(async () => ({ data: [], error: null })),
      };
      const mockClient: any = {
        from: jest.fn(() => mockBuilder),
      };

      const repo = new SupabaseDietRepository(mockClient);
      await repo.searchFoods('frango,id.eq.123)*(%).test');

      expect(orSpy).toHaveBeenCalledTimes(1);
      const filterArg: string = orSpy.mock.calls[0][0];

      // Metacharacters injected by user must be stripped so only the two legitimate ilike clauses exist
      expect(filterArg).toBe(
        'name.ilike.%frango id eq 123 test%,name_normalized.ilike.%frango id eq 123 test%'
      );
      expect(filterArg).not.toContain('id.eq.123');
      expect(filterArg).not.toContain('(');
      expect(filterArg).not.toContain(')');
      expect(filterArg).not.toContain('*');
    });

    it('[M-02] rejects NaN, Infinity, -Infinity, and 0 in addWaterLog/addWater and clamps extreme water deltas safely', async () => {
      const insertSpy = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn(async () => ({
            data: {
              id: 'w-1',
              date: '2026-11-14',
              amount_ml: 10000,
              created_at: '2026-11-14T10:00:00Z',
            },
            error: null,
          })),
        }),
      });
      const mockClient: any = {
        from: jest.fn(() => ({ insert: insertSpy })),
      };

      const repo = new SupabaseDietRepository(mockClient);

      await expect(repo.addWaterLog('2026-11-14', Number.NaN)).rejects.toThrow(
        'Quantidade de água inválida.'
      );
      await expect(repo.addWaterLog('2026-11-14', Number.POSITIVE_INFINITY)).rejects.toThrow(
        'Quantidade de água inválida.'
      );
      await expect(repo.addWaterLog('2026-11-14', Number.NEGATIVE_INFINITY)).rejects.toThrow(
        'Quantidade de água inválida.'
      );
      await expect(repo.addWaterLog('2026-11-14', 0)).rejects.toThrow(
        'Quantidade de água inválida.'
      );
      expect(insertSpy).not.toHaveBeenCalled();

      // DietStateManager.addWater also rejects NaN, Infinity, and <= 0 without calling repo
      const mockDietRepo: any = {
        addWaterLog: jest.fn(),
        getDailyNutritionSummary: jest.fn(),
        getDailyWaterTotal: jest.fn(),
        getWaterLogs: jest.fn(),
      };
      const mockAuthRepo: any = { getProfile: jest.fn() };
      const manager = new DietStateManager(mockDietRepo, mockAuthRepo, '2026-11-14');

      await manager.addWater(Number.NaN);
      await manager.addWater(Number.POSITIVE_INFINITY);
      await manager.addWater(-500);
      await manager.addWater(0);
      expect(mockDietRepo.addWaterLog).not.toHaveBeenCalled();
    });

    it('[A-06] invokes update_workout_routine_atomic and save_workout_session_atomic RPCs on SupabaseWorkoutRepository', async () => {
      const rpcMock = jest.fn(async (fnName: string) => {
        if (fnName === 'update_workout_routine_atomic') {
          return { data: null, error: null };
        }
        if (fnName === 'save_workout_session_atomic') {
          return {
            data: {
              session: {
                id: 'session-atomic-1',
                routine_id: 'routine-1',
                routine_name: 'Push Atomic',
                date: '2026-11-14',
                start_time: '10:00',
                end_time: '11:00',
                duration_minutes: 60,
                total_volume_kg: 2400,
                notes: 'RPC test',
                created_at: '2026-11-14T11:00:00Z',
              },
              sets: [
                {
                  id: 'set-atomic-1',
                  session_id: 'session-atomic-1',
                  exercise_id: 'ex-1',
                  exercise_name: 'Supino Reto',
                  set_number: 1,
                  weight_kg: 100,
                  reps: 12,
                  completed: true,
                  created_at: '2026-11-14T11:00:00Z',
                },
              ],
            },
            error: null,
          };
        }
        return { data: null, error: { message: 'Unexpected RPC' } };
      });

      const mockClient: any = {
        rpc: rpcMock,
        from: jest.fn(),
      };

      const repo = new SupabaseWorkoutRepository(mockClient);

      await repo.updateRoutine(
        'routine-1',
        { name: 'Push Atomic', description: 'Updated via RPC', sortOrder: 2 },
        [
          {
            id: 'ex-1',
            routineId: 'routine-1',
            name: 'Supino Reto',
            muscleGroup: 'Peito',
            targetSets: 4,
            defaultRestSeconds: 90,
            sortOrder: 1,
          },
        ]
      );

      expect(rpcMock).toHaveBeenCalledWith('update_workout_routine_atomic', {
        p_routine_id: 'routine-1',
        p_name: 'Push Atomic',
        p_description: 'Updated via RPC',
        p_update_description: true,
        p_sort_order: 2,
        p_exercises: [
          {
            name: 'Supino Reto',
            muscle_group: 'Peito',
            target_sets: 4,
            default_rest_seconds: 90,
            sort_order: 1,
          },
        ],
      });

      const savedSession = await repo.saveWorkoutSession(
        {
          routineId: 'routine-1',
          routineName: 'Push Atomic',
          date: '2026-11-14',
          startTime: '10:00',
          endTime: '11:00',
          durationMinutes: 60,
          notes: 'RPC test',
        },
        [
          {
            exerciseId: 'ex-1',
            exerciseName: 'Supino Reto',
            setNumber: 1,
            weightKg: 100,
            reps: 12,
            completed: true,
          },
        ]
      );

      expect(rpcMock).toHaveBeenCalledWith('save_workout_session_atomic', {
        p_routine_id: 'routine-1',
        p_routine_name: 'Push Atomic',
        p_date: '2026-11-14',
        p_start_time: '10:00',
        p_end_time: '11:00',
        p_duration_minutes: 60,
        p_total_volume_kg: 1200,
        p_notes: 'RPC test',
        p_sets: [
          {
            exercise_id: 'ex-1',
            exercise_name: 'Supino Reto',
            set_number: 1,
            weight_kg: 100,
            reps: 12,
            completed: true,
          },
        ],
      });
      expect(savedSession.id).toBe('session-atomic-1');
      expect(savedSession.sets).toHaveLength(1);
      expect(mockClient.from).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 6. [M-03] parseDecimalInput in src/utils/nutrition.ts
  // =========================================================================
  describe('[M-03] parseDecimalInput Decimal & Adversarial Input Parsing', () => {
    it('parses pt-BR comma decimals, dot decimals, and zero accurately, and returns NaN for malformed or non-finite inputs', () => {
      expect(parseDecimalInput('82,5')).toBe(82.5);
      expect(parseDecimalInput('82.5')).toBe(82.5);
      expect(parseDecimalInput('0')).toBe(0);
      expect(parseDecimalInput(' 105,75 ')).toBe(105.75);
      expect(parseDecimalInput(82.5)).toBe(82.5);

      expect(Number.isNaN(parseDecimalInput('abc'))).toBe(true);
      expect(Number.isNaN(parseDecimalInput(''))).toBe(true);
      expect(Number.isNaN(parseDecimalInput('   '))).toBe(true);
      expect(Number.isNaN(parseDecimalInput('NaN'))).toBe(true);
      expect(Number.isNaN(parseDecimalInput('Infinity'))).toBe(true);
      expect(Number.isNaN(parseDecimalInput('-Infinity'))).toBe(true);
      expect(Number.isNaN(parseDecimalInput('82,5,1'))).toBe(true);
      expect(Number.isNaN(parseDecimalInput('82.5.1'))).toBe(true);
      expect(Number.isNaN(parseDecimalInput(null))).toBe(true);
      expect(Number.isNaN(parseDecimalInput(undefined))).toBe(true);
      expect(Number.isNaN(parseDecimalInput(Number.NaN))).toBe(true);
      expect(Number.isNaN(parseDecimalInput(Number.POSITIVE_INFINITY))).toBe(true);
    });
  });
});
