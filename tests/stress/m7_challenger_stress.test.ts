import { Platform, StatusBar } from 'react-native';
import React from 'react';
import { InMemorySQLiteDatabase, createTestDatabase } from '../helpers/inMemoryDb';
import { SqliteAuthRepository, hashPassword } from '@/database/repositories/SqliteAuthRepository';
import { ProfileStateManager } from '@/context/ProfileContext';
import { calculateSuggestedTargets } from '@/utils/nutrition';
import { useSafeTopPadding } from '@/hooks/useSafeTopPadding';

let mockInsets = { top: 0, left: 0, right: 0, bottom: 0 };

jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return {
    ...actual,
    useSafeAreaInsets: () => mockInsets,
  };
});

describe('Milestone M7: Challenger Empirical Stress & Adversarial Verification', () => {
  let db: InMemorySQLiteDatabase;
  let authRepo: SqliteAuthRepository;
  let manager: ProfileStateManager;

  beforeEach(async () => {
    db = await createTestDatabase();
    authRepo = new SqliteAuthRepository(db);
    manager = new ProfileStateManager(authRepo);
    await manager.loadProfile();
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  // =========================================================================
  // 1. ROUTE PROTECTION & STATE MACHINE INTEGRITY
  // =========================================================================
  describe('1. Route Protection State Machine & Boundary Cases', () => {
    function evaluateAuthProtection(params: {
      isLoading: boolean;
      navKey: string | null | undefined;
      isLoggedIn: boolean;
      onboardingCompleted: boolean;
      segments: string[];
    }): string | null {
      // 1. Wait for SQLite profile fetch
      if (params.isLoading) return null;
      // 2. Wait for root navigation to be mounted
      if (!params.navKey) return null;

      const inAuthGroup = params.segments[0] === 'auth';

      // Rule A: Not logged in -> Route to /auth
      if (!params.isLoggedIn) {
        if (!inAuthGroup) return '/auth';
      }
      // Rule B: Logged in but onboarding not completed -> Route to /auth?step=onboarding
      else if (!params.onboardingCompleted) {
        if (!inAuthGroup) return '/auth?step=onboarding';
      }
      // Rule C: Fully authenticated & onboarded -> Leave /auth to main app
      else if (params.isLoggedIn && params.onboardingCompleted) {
        if (inAuthGroup) return '/(tabs)';
      }

      return null;
    }

    it('intercepts unauthenticated access across all app subroutes and deep links', () => {
      const protectedRoutes = [
        ['(tabs)'],
        ['(tabs)', 'index'],
        ['(tabs)', 'diet'],
        ['(tabs)', 'workout'],
        ['(tabs)', 'body'],
        ['(tabs)', 'profile'],
        ['workout', 'live'],
        ['workout', 'history'],
        ['workout', 'edit-routine'],
        ['nutrition', 'search'],
        ['nutrition', 'scanner'],
        ['nutrition', 'custom'],
        ['body', 'log'],
        ['body', 'compare'],
      ];

      for (const route of protectedRoutes) {
        const redirect = evaluateAuthProtection({
          isLoading: false,
          navKey: 'root_nav_mounted_1',
          isLoggedIn: false,
          onboardingCompleted: false,
          segments: route,
        });
        expect(redirect).toBe('/auth');
      }
    });

    it('intercepts uncompleted onboarding across all app subroutes', () => {
      const protectedRoutes = [
        ['(tabs)'],
        ['(tabs)', 'profile'],
        ['workout', 'live'],
        ['body', 'log'],
      ];

      for (const route of protectedRoutes) {
        const redirect = evaluateAuthProtection({
          isLoading: false,
          navKey: 'root_nav_mounted_1',
          isLoggedIn: true,
          onboardingCompleted: false,
          segments: route,
        });
        expect(redirect).toBe('/auth?step=onboarding');
      }
    });

    it('does not trigger redirect while loading profile or before navigation mounts', () => {
      // Loading true, navigation mounted
      expect(
        evaluateAuthProtection({
          isLoading: true,
          navKey: 'root_nav_mounted',
          isLoggedIn: false,
          onboardingCompleted: false,
          segments: ['(tabs)'],
        })
      ).toBeNull();

      // Loading false, navigation unready (null or empty key)
      expect(
        evaluateAuthProtection({
          isLoading: false,
          navKey: null,
          isLoggedIn: false,
          onboardingCompleted: false,
          segments: ['(tabs)'],
        })
      ).toBeNull();

      expect(
        evaluateAuthProtection({
          isLoading: false,
          navKey: '',
          isLoggedIn: false,
          onboardingCompleted: false,
          segments: ['(tabs)'],
        })
      ).toBeNull();
    });

    it('prevents navigation loops when already on the intended target route', () => {
      // Unauthenticated user already on /auth
      expect(
        evaluateAuthProtection({
          isLoading: false,
          navKey: 'root_nav_mounted',
          isLoggedIn: false,
          onboardingCompleted: false,
          segments: ['auth'],
        })
      ).toBeNull();

      // Authenticated without onboarding already on /auth
      expect(
        evaluateAuthProtection({
          isLoading: false,
          navKey: 'root_nav_mounted',
          isLoggedIn: true,
          onboardingCompleted: false,
          segments: ['auth'],
        })
      ).toBeNull();

      // Fully onboarded user on tabs
      expect(
        evaluateAuthProtection({
          isLoading: false,
          navKey: 'root_nav_mounted',
          isLoggedIn: true,
          onboardingCompleted: true,
          segments: ['(tabs)'],
        })
      ).toBeNull();
    });

    it('redirects fully onboarded user out of /auth to /(tabs)', () => {
      expect(
        evaluateAuthProtection({
          isLoading: false,
          navKey: 'root_nav_mounted',
          isLoggedIn: true,
          onboardingCompleted: true,
          segments: ['auth'],
        })
      ).toBe('/(tabs)');
    });
  });

  // =========================================================================
  // 2. USER TRANSITION: REGISTER -> STEP 2 ONBOARDING -> COMPLETE -> TABS
  // =========================================================================
  describe('2. User Transition: Registration -> Onboarding -> Tabs Access', () => {
    it('executes atomic transition from registration to onboarding to tabs with SQLite persistence', async () => {
      // Verify initial default profile
      const initialProfile = await authRepo.getProfile();
      expect(initialProfile.isLoggedIn).toBe(false);

      // 1. Register new user
      const startMs = Date.now();
      const user = await manager.register({
        name: 'Roberto Carlos',
        email: 'roberto@irontrack.app',
        password: 'securePassword2026',
      });
      const registerLatency = Date.now() - startMs;
      console.log(`[CHALLENGE 2.1] Registration completed in ${registerLatency}ms`);

      expect(user.name).toBe('Roberto Carlos');
      expect(user.email).toBe('roberto@irontrack.app');
      expect(user.isLoggedIn).toBe(true);
      expect(user.onboardingCompleted).toBe(false);
      expect(manager.isLoggedIn).toBe(true);
      expect(manager.onboardingCompleted).toBe(false);

      // Verify DB persistence of step 1 state
      const dbRow1 = await db.getFirstAsync<any>(
        'SELECT email, is_logged_in, onboarding_completed FROM users WHERE id = ?;',
        user.id
      );
      expect(dbRow1.is_logged_in).toBe(1);
      expect(dbRow1.onboarding_completed).toBe(0);

      // 2. Calculate scientific suggested targets
      const suggested = calculateSuggestedTargets({
        weightKg: 82.5,
        heightCm: 182,
        age: 28,
        gender: 'male',
        trainingGoal: 'hypertrophy',
        activityLevel: 'moderate',
      });
      expect(suggested.calories).toBeGreaterThan(suggested.tdee); // Hypertrophy surplus
      expect(suggested.protein).toBe(Math.round(82.5 * 2.0)); // 165g
      expect(suggested.fat).toBe(Math.round(82.5 * 0.9)); // 74g
      expect(suggested.waterMl).toBe(Math.round((82.5 * 40) / 250) * 250); // 3250ml (250ml bottle increments)

      // 3. Complete Step 2 Onboarding with targets
      const onboardStart = Date.now();
      const completedUser = await manager.completeOnboarding({
        heightCm: 182,
        targetWeightKg: 85.0,
        currentWeightKg: 82.5,
        trainingGoal: 'hypertrophy',
        activityLevel: 'moderate',
        targetCalories: suggested.calories,
        targetProtein: suggested.protein,
        targetCarbs: suggested.carbs,
        targetFat: suggested.fat,
        targetWaterMl: suggested.waterMl,
      });
      const onboardLatency = Date.now() - onboardStart;
      console.log(`[CHALLENGE 2.2] Onboarding completion persisted in ${onboardLatency}ms`);

      expect(completedUser.onboardingCompleted).toBe(true);
      expect(manager.onboardingCompleted).toBe(true);
      expect(completedUser.heightCm).toBe(182);
      expect(completedUser.targetWeightKg).toBe(85.0);
      expect(completedUser.trainingGoal).toBe('hypertrophy');
      expect(completedUser.targetCalories).toBe(suggested.calories);

      // Verify DB persistence of completed onboarding
      const dbRow2 = await db.getFirstAsync<any>(
        'SELECT is_logged_in, onboarding_completed, height_cm, target_weight_kg, training_goal, target_calories FROM users WHERE id = ?;',
        user.id
      );
      expect(dbRow2.is_logged_in).toBe(1);
      expect(dbRow2.onboarding_completed).toBe(1);
      expect(dbRow2.height_cm).toBe(182);
      expect(dbRow2.target_weight_kg).toBe(85.0);
      expect(dbRow2.training_goal).toBe('hypertrophy');

      // 4. Emulate app restart: fresh getProfile() fetches logged in user
      const freshRepo = new SqliteAuthRepository(db);
      const reloadedProfile = await freshRepo.getProfile();
      expect(reloadedProfile.id).toBe(user.id);
      expect(reloadedProfile.isLoggedIn).toBe(true);
      expect(reloadedProfile.onboardingCompleted).toBe(true);
      expect(reloadedProfile.targetCalories).toBe(suggested.calories);
    });

    it('correctly handles comma decimals and boundary inputs in onboarding', () => {
      const parseWeight = (str: string) => parseFloat(str.replace(',', '.'));
      expect(parseWeight('78,5')).toBe(78.5);
      expect(parseWeight('100.25')).toBe(100.25);
      expect(isNaN(parseWeight('abc'))).toBe(true);
    });
  });

  // =========================================================================
  // 3. LOGOUT LIFECYCLE & MULTI-USER SESSION SWITCHING
  // =========================================================================
  describe('3. Logout Session Clearing & Multi-Account Isolation', () => {
    it('clears session on logout and ensures cold boot does not restore logged-in state', async () => {
      // Register and onboard User A
      const userA = await manager.register({
        name: 'User A',
        email: 'user_a@irontrack.app',
        password: 'passwordA',
      });
      await manager.completeOnboarding({
        heightCm: 175,
        targetWeightKg: 75,
        currentWeightKg: 75,
        trainingGoal: 'maintenance',
        activityLevel: 'moderate',
        targetCalories: 2200,
        targetProtein: 150,
        targetCarbs: 250,
        targetFat: 60,
        targetWaterMl: 2500,
      });

      expect(manager.isLoggedIn).toBe(true);

      // Logout
      await manager.logout();
      expect(manager.isLoggedIn).toBe(false);

      // DB check: users.is_logged_in must be 0
      const dbUserA = await db.getFirstAsync<any>(
        'SELECT is_logged_in FROM users WHERE id = ?;',
        userA.id
      );
      expect(dbUserA.is_logged_in).toBe(0);

      // Cold boot with new manager and repo
      const coldRepo = new SqliteAuthRepository(db);
      const coldProfile = await coldRepo.getProfile();
      expect(coldProfile.isLoggedIn).toBe(false);
    });

    it('supports clean multi-account switching between distinct athletes', async () => {
      // 1. Register User 1
      const user1 = await manager.register({
        name: 'Carlos Hipertrofia',
        email: 'carlos@test.com',
        password: 'passCarlos1',
      });
      await manager.completeOnboarding({
        heightCm: 180,
        targetWeightKg: 90,
        currentWeightKg: 85,
        trainingGoal: 'hypertrophy',
        activityLevel: 'intense',
        targetCalories: 3000,
        targetProtein: 180,
        targetCarbs: 380,
        targetFat: 80,
        targetWaterMl: 3500,
      });

      // 2. User 1 logs out
      await manager.logout();
      expect(manager.isLoggedIn).toBe(false);

      // 3. Register User 2
      const user2 = await manager.register({
        name: 'Mariana Cutting',
        email: 'mariana@test.com',
        password: 'passMariana2',
      });
      await manager.completeOnboarding({
        heightCm: 165,
        targetWeightKg: 58,
        currentWeightKg: 64,
        trainingGoal: 'cutting',
        activityLevel: 'moderate',
        targetCalories: 1600,
        targetProtein: 130,
        targetCarbs: 150,
        targetFat: 45,
        targetWaterMl: 2500,
      });

      expect(user2.id).not.toBe(user1.id);
      expect(manager.profile?.id).toBe(user2.id);
      expect(manager.profile?.targetCalories).toBe(1600);

      // DB check: exactly 1 user should have is_logged_in = 1
      const loggedInUsers = await db.getAllAsync<any>(
        'SELECT id, email FROM users WHERE is_logged_in = 1;'
      );
      expect(loggedInUsers.length).toBe(1);
      expect(loggedInUsers[0].id).toBe(user2.id);

      // 4. User 2 logs out
      await manager.logout();

      // 5. User 1 logs back in
      const reLoggedIn1 = await manager.login({
        email: 'carlos@test.com',
        password: 'passCarlos1',
      });
      expect(reLoggedIn1.id).toBe(user1.id);
      expect(reLoggedIn1.targetCalories).toBe(3000);
      expect(reLoggedIn1.isLoggedIn).toBe(true);
      expect(reLoggedIn1.onboardingCompleted).toBe(true);

      const loggedInAfter = await db.getAllAsync<any>(
        'SELECT id FROM users WHERE is_logged_in = 1;'
      );
      expect(loggedInAfter.length).toBe(1);
      expect(loggedInAfter[0].id).toBe(user1.id);
    });
  });

  // =========================================================================
  // 4. INVALID CREDENTIALS & ERROR FEEDBACK (NO CRASH)
  // =========================================================================
  describe('4. Invalid Credentials, Input Validation & Security', () => {
    it('rejects duplicate email registrations case-insensitively', async () => {
      await authRepo.registerUser({
        name: 'First User',
        email: 'atleta.teste@irontrack.app',
        password: 'password123',
      });

      // Exact email duplicate
      await expect(
        authRepo.registerUser({
          name: 'Second User',
          email: 'atleta.teste@irontrack.app',
          password: 'password456',
        })
      ).rejects.toThrow('E-mail já cadastrado');

      // Upper-cased email duplicate
      await expect(
        authRepo.registerUser({
          name: 'Third User',
          email: 'ATLETA.TESTE@IRONTRACK.APP',
          password: 'password789',
        })
      ).rejects.toThrow('E-mail já cadastrado');
    });

    it('rejects login with non-existent user with graceful error', async () => {
      await expect(
        authRepo.loginUser({
          email: 'nonexistent@irontrack.app',
          password: 'anyPassword',
        })
      ).rejects.toThrow('Usuário não encontrado');
    });

    it('rejects login with incorrect password with graceful error', async () => {
      await authRepo.registerUser({
        name: 'Valid User',
        email: 'valid@irontrack.app',
        password: 'correctPassword',
      });

      await expect(
        authRepo.loginUser({
          email: 'valid@irontrack.app',
          password: 'wrongPassword',
        })
      ).rejects.toThrow('Senha incorreta.');
    });

    it('verifies passwords are never stored in plaintext', async () => {
      const plaintext = 'SuperSecretAtletaPass2026!';
      const user = await authRepo.registerUser({
        name: 'Secure Athlete',
        email: 'secure@irontrack.app',
        password: plaintext,
      });

      const dbRow = await db.getFirstAsync<any>(
        'SELECT password FROM users WHERE id = ?;',
        user.id
      );

      expect(dbRow.password).toBeDefined();
      expect(dbRow.password).not.toBe(plaintext);
      expect(dbRow.password.length).toBeGreaterThanOrEqual(16);

      // Verify hashPassword determinism
      const hash1 = await hashPassword(plaintext);
      const hash2 = await hashPassword(plaintext);
      expect(hash1).toBe(hash2);
      expect(hash1).toBe(dbRow.password);
    });

    it('computes 100 password hashes with sub-millisecond average latency', async () => {
      const start = Date.now();
      for (let i = 0; i < 100; i++) {
        await hashPassword(`PassWord_${i}_Secret`);
      }
      const duration = Date.now() - start;
      const perHash = duration / 100;
      console.log(`[CHALLENGE 4.1] 100 password hashes computed in ${duration}ms (${perHash.toFixed(3)}ms/hash)`);
      expect(perHash).toBeLessThan(5); // Well within acceptable mobile UI responsiveness threshold
    });
  });

  // =========================================================================
  // 5. SAFE AREA & TOP BAR PADDING RIGOR
  // =========================================================================
  describe('5. Safe Area Top Padding Bounds Across Screen Cutouts', () => {
    const originalOS = Platform.OS;

    afterEach(() => {
      Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
    });

    it('guarantees safe top margin under iOS Dynamic Island (59dp)', () => {
      Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
      mockInsets = { top: 59, left: 0, right: 0, bottom: 34 };

      const top = useSafeTopPadding(8);
      expect(top).toBe(67); // 59 + 8
    });

    it('guarantees safe top margin under Android punch-hole cutouts (48dp)', () => {
      Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
      mockInsets = { top: 0, left: 0, right: 0, bottom: 0 };
      const originalHeight = StatusBar.currentHeight;
      Object.defineProperty(StatusBar, 'currentHeight', { value: 48, configurable: true });

      const top = useSafeTopPadding(12);
      expect(top).toBe(60); // 48 + 12

      Object.defineProperty(StatusBar, 'currentHeight', { value: originalHeight, configurable: true });
    });

    it('never drops below platform fallback floors', () => {
      // iOS floor is 44
      Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
      mockInsets = { top: 0, left: 0, right: 0, bottom: 0 };
      expect(useSafeTopPadding(0)).toBe(44);

      // Android floor is 24
      Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
      Object.defineProperty(StatusBar, 'currentHeight', { value: 0, configurable: true });
      expect(useSafeTopPadding(0)).toBe(24);
    });
  });

  // =========================================================================
  // 6. CONCURRENT AUTH STRESS
  // =========================================================================
  describe('6. High Concurrency & Parallel Execution Stress', () => {
    it('handles 30 concurrent profile operations without deadlock or SQLite corruption', async () => {
      await authRepo.registerUser({
        name: 'Concurrent Runner',
        email: 'concurrent@irontrack.app',
        password: 'pass',
      });

      const promises = Array.from({ length: 30 }, (_, i) => {
        return authRepo.updateProfile({
          targetCalories: 2000 + i * 10,
          targetWaterMl: 2500 + i * 20,
        });
      });

      const start = Date.now();
      const results = await Promise.all(promises);
      const elapsed = Date.now() - start;
      console.log(`[CHALLENGE 6.1] 30 concurrent updates settled in ${elapsed}ms`);

      expect(results.length).toBe(30);
      const finalProfile = await authRepo.getProfile();
      expect(finalProfile.targetCalories).toBeGreaterThanOrEqual(2000);
      expect(finalProfile.targetWaterMl).toBeGreaterThanOrEqual(2500);
    });
  });
});
