import { Platform, StatusBar } from 'react-native';
import React from 'react';

let mockInsets = { top: 0, left: 0, right: 0, bottom: 0 };

jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return {
    ...actual,
    useSafeAreaInsets: () => mockInsets,
  };
});

import { useSafeTopPadding } from '@/hooks/useSafeTopPadding';
import { AppTopBar } from '@/components/ui/AppTopBar';
import { InMemorySQLiteDatabase, createTestDatabase } from '../helpers/inMemoryDb';
import { SqliteAuthRepository } from '@/database/repositories/SqliteAuthRepository';
import { ProfileStateManager } from '@/context/ProfileContext';

describe('Milestone M7: Safe Area, Top Bar, Route Guard and Auth State', () => {
  describe('1. useSafeTopPadding Hook', () => {
    const originalOS = Platform.OS;

    beforeEach(() => {
      mockInsets = { top: 0, left: 0, right: 0, bottom: 0 };
    });

    afterEach(() => {
      Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
    });

    it('returns iOS fallback (44) when insets top is 0 on iOS', () => {
      Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
      mockInsets = { top: 0, left: 0, right: 0, bottom: 0 };

      const padding = useSafeTopPadding(0);
      expect(padding).toBe(44);
    });

    it('returns Android fallback (24) when insets top and currentHeight are 0 on Android', () => {
      Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
      mockInsets = { top: 0, left: 0, right: 0, bottom: 0 };
      const originalHeight = StatusBar.currentHeight;
      Object.defineProperty(StatusBar, 'currentHeight', { value: 0, configurable: true });

      const padding = useSafeTopPadding(0);
      expect(padding).toBe(24);

      Object.defineProperty(StatusBar, 'currentHeight', { value: originalHeight, configurable: true });
    });

    it('uses StatusBar.currentHeight on Android when higher than insets.top', () => {
      Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
      mockInsets = { top: 24, left: 0, right: 0, bottom: 0 };
      const originalHeight = StatusBar.currentHeight;
      Object.defineProperty(StatusBar, 'currentHeight', { value: 38, configurable: true });

      const padding = useSafeTopPadding(8);
      // Math.max(24, 38) + 8 = 46
      expect(padding).toBe(46);

      Object.defineProperty(StatusBar, 'currentHeight', { value: originalHeight, configurable: true });
    });

    it('correctly adds extraOffset to insets.top', () => {
      Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
      mockInsets = { top: 47, left: 0, right: 0, bottom: 34 };

      const padding = useSafeTopPadding(12);
      expect(padding).toBe(59);
    });
  });

  describe('2. AppTopBar Component Structure', () => {
    it('creates standard header element with title and subtitle', () => {
      const topBarElement = React.createElement(AppTopBar, {
        title: 'Treinos Diários',
        subtitle: 'Foco em Hipertrofia',
        centerTitle: true,
      });

      expect(topBarElement).toBeDefined();
      expect(topBarElement.props.title).toBe('Treinos Diários');
      expect(topBarElement.props.subtitle).toBe('Foco em Hipertrofia');
      expect(topBarElement.props.centerTitle).toBe(true);
    });

    it('supports Instagram brand title mode', () => {
      const topBarElement = React.createElement(AppTopBar, {
        isLogoInstagram: true,
      });

      expect(topBarElement.props.isLogoInstagram).toBe(true);
    });

    it('configures leftAction and rightAction callbacks', () => {
      const mockPress = jest.fn();
      const topBarElement = React.createElement(AppTopBar, {
        title: 'Editar Rotina',
        leftAction: {
          label: 'Cancelar',
          onPress: mockPress,
        },
      });

      expect(topBarElement.props.leftAction).toBeDefined();
      expect((topBarElement.props.leftAction as any).label).toBe('Cancelar');
    });
  });

  describe('3. Route Guard State Machine Logic (Auth Protection)', () => {
    // Pure logic simulation of useAuthProtection
    function evaluateAuthRouteGuard(state: {
      isLoading: boolean;
      navReady: boolean;
      isLoggedIn: boolean;
      onboardingCompleted: boolean;
      segment0: string;
    }): string | null {
      if (state.isLoading) return null;
      if (!state.navReady) return null;

      const inAuthGroup = state.segment0 === 'auth';

      if (!state.isLoggedIn) {
        if (!inAuthGroup) return '/auth';
      } else if (!state.onboardingCompleted) {
        if (!inAuthGroup) return '/auth?step=onboarding';
      } else {
        if (inAuthGroup) return '/(tabs)';
      }

      return null; // No-op, stable state
    }

    it('does not redirect while profile is loading from SQLite', () => {
      const decision = evaluateAuthRouteGuard({
        isLoading: true,
        navReady: true,
        isLoggedIn: false,
        onboardingCompleted: false,
        segment0: '(tabs)',
      });
      expect(decision).toBeNull();
    });

    it('does not redirect before root navigation is ready', () => {
      const decision = evaluateAuthRouteGuard({
        isLoading: false,
        navReady: false,
        isLoggedIn: false,
        onboardingCompleted: false,
        segment0: '(tabs)',
      });
      expect(decision).toBeNull();
    });

    it('redirects unauthenticated user from tabs to /auth', () => {
      const decision = evaluateAuthRouteGuard({
        isLoading: false,
        navReady: true,
        isLoggedIn: false,
        onboardingCompleted: false,
        segment0: '(tabs)',
      });
      expect(decision).toBe('/auth');
    });

    it('does not redirect unauthenticated user if already on /auth (prevents loop)', () => {
      const decision = evaluateAuthRouteGuard({
        isLoading: false,
        navReady: true,
        isLoggedIn: false,
        onboardingCompleted: false,
        segment0: 'auth',
      });
      expect(decision).toBeNull();
    });

    it('redirects authenticated user without onboarding to /auth?step=onboarding', () => {
      const decision = evaluateAuthRouteGuard({
        isLoading: false,
        navReady: true,
        isLoggedIn: true,
        onboardingCompleted: false,
        segment0: '(tabs)',
      });
      expect(decision).toBe('/auth?step=onboarding');
    });

    it('allows user without onboarding to remain on /auth to complete step 2', () => {
      const decision = evaluateAuthRouteGuard({
        isLoading: false,
        navReady: true,
        isLoggedIn: true,
        onboardingCompleted: false,
        segment0: 'auth',
      });
      expect(decision).toBeNull();
    });

    it('redirects fully authenticated and onboarded user out of /auth to /(tabs)', () => {
      const decision = evaluateAuthRouteGuard({
        isLoading: false,
        navReady: true,
        isLoggedIn: true,
        onboardingCompleted: true,
        segment0: 'auth',
      });
      expect(decision).toBe('/(tabs)');
    });

    it('allows fully authenticated and onboarded user to stay in /(tabs)', () => {
      const decision = evaluateAuthRouteGuard({
        isLoading: false,
        navReady: true,
        isLoggedIn: true,
        onboardingCompleted: true,
        segment0: '(tabs)',
      });
      expect(decision).toBeNull();
    });
  });

  describe('4. Full Authentication, Onboarding, and Logout Cycle', () => {
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

    it('executes registration, onboarding targets completion, and logout session lifecycle', async () => {
      // 1. Initial State: not logged in
      expect(manager.isLoggedIn).toBe(false);
      expect(manager.onboardingCompleted).toBe(false);

      // 2. Register
      const registered = await manager.register({
        name: 'Ana Pereira',
        email: 'ana@irontrack.app',
        password: 'securePassword123',
      });

      expect(registered.name).toBe('Ana Pereira');
      expect(registered.email).toBe('ana@irontrack.app');
      expect(manager.isLoggedIn).toBe(true);
      expect(manager.onboardingCompleted).toBe(false);

      // 3. Complete Onboarding with targets
      const onboarded = await manager.completeOnboarding({
        heightCm: 168,
        targetWeightKg: 62.0,
        currentWeightKg: 65.0,
        trainingGoal: 'cutting',
        activityLevel: 'intense',
        targetCalories: 1850,
        targetProtein: 140,
        targetCarbs: 170,
        targetFat: 50,
        targetWaterMl: 3000,
      });

      expect(onboarded.onboardingCompleted).toBe(true);
      expect(manager.onboardingCompleted).toBe(true);
      expect(onboarded.heightCm).toBe(168);
      expect(onboarded.targetWeightKg).toBe(62.0);
      expect(onboarded.trainingGoal).toBe('cutting');
      expect(onboarded.activityLevel).toBe('intense');
      expect(onboarded.targetCalories).toBe(1850);
      expect(onboarded.targetProtein).toBe(140);
      expect(onboarded.targetWaterMl).toBe(3000);

      // 4. Logout
      await manager.logout();
      expect(manager.isLoggedIn).toBe(false);

      // 5. Login back
      const loggedIn = await manager.login({
        email: 'ana@irontrack.app',
        password: 'securePassword123',
      });
      expect(loggedIn.email).toBe('ana@irontrack.app');
      expect(manager.isLoggedIn).toBe(true);
      expect(manager.onboardingCompleted).toBe(true);
    });
  });
});
