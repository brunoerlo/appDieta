import React, { useMemo, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { migrateDbIfNeeded } from '../database/connection';
import { SupabaseDietRepository } from '../database/repositories/SupabaseDietRepository';
import { SupabaseAuthRepository } from '../database/repositories/SupabaseAuthRepository';
import { SupabaseWorkoutRepository } from '../database/repositories/SupabaseWorkoutRepository';
import { SupabaseBodyRepository } from '../database/repositories/SupabaseBodyRepository';
import { DietProvider } from '../context/DietContext';
import { WorkoutProvider } from '../context/WorkoutContext';
import { ThemeProvider } from '../context/ThemeContext';
import { ProfileProvider } from '../context/ProfileContext';
import { BodyProvider } from '../context/BodyContext';
import { useProfile } from '../hooks/useProfile';
import { useTheme } from '../hooks/useTheme';

export function useAuthProtection() {
  const { isLoggedIn, onboardingCompleted, isLoading } = useProfile();
  const segments = useSegments();
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();

  useEffect(() => {
    // 1. Wait for SQLite profile fetch to complete
    if (isLoading) return;

    // 2. Wait for root navigation to be mounted and ready
    if (!rootNavigationState?.key) return;

    const inAuthGroup = (segments as string[])[0] === 'auth';

    // Rule A: Not logged in -> Route to /auth
    if (!isLoggedIn) {
      if (!inAuthGroup) {
        router.replace('/auth');
      }
    }
    // Rule B: Logged in but onboarding not completed -> Route to /auth?step=onboarding
    else if (!onboardingCompleted) {
      if (!inAuthGroup) {
        router.replace('/auth?step=onboarding');
      }
    }
    // Rule C: Fully authenticated & onboarded -> Leave /auth to main app
    else if (isLoggedIn && onboardingCompleted) {
      if (inAuthGroup) {
        router.replace('/(tabs)');
      }
    }
  }, [isLoggedIn, onboardingCompleted, isLoading, segments, rootNavigationState?.key, router]);
}

function NavContainer() {
  const { colors, isDark } = useTheme();
  const { isLoading } = useProfile();
  useAuthProtection();

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="nutrition/search"
          options={{
            presentation: 'modal',
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        />
        <Stack.Screen
          name="nutrition/scanner"
          options={{
            presentation: 'fullScreenModal',
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        />
        <Stack.Screen
          name="nutrition/custom"
          options={{
            presentation: 'modal',
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        />
        <Stack.Screen
          name="workout/edit-routine"
          options={{
            presentation: 'modal',
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        />
        <Stack.Screen
          name="workout/live"
          options={{
            presentation: 'fullScreenModal',
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        />
        <Stack.Screen
          name="workout/history"
          options={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        />
        {/* Milestone M4 Secondary Screens */}
        <Stack.Screen
          name="body/log"
          options={{
            presentation: 'modal',
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        />
        <Stack.Screen
          name="body/compare"
          options={{
            presentation: 'modal',
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        />
      </Stack>
    </>
  );
}

function DataProviders({
  authRepo,
  dietRepo,
  workoutRepo,
  bodyRepo,
}: {
  authRepo: SupabaseAuthRepository;
  dietRepo: SupabaseDietRepository;
  workoutRepo: SupabaseWorkoutRepository;
  bodyRepo: SupabaseBodyRepository;
}) {
  const { profile } = useProfile();
  const userKey = profile?.isLoggedIn && profile?.id ? profile.id : 'guest';

  return (
    <DietProvider key={`diet-${userKey}`} dietRepo={dietRepo} authRepo={authRepo}>
      <WorkoutProvider key={`workout-${userKey}`} workoutRepo={workoutRepo}>
        <BodyProvider key={`body-${userKey}`} bodyRepo={bodyRepo}>
          <NavContainer />
        </BodyProvider>
      </WorkoutProvider>
    </DietProvider>
  );
}

function AppContent() {
  const db = useSQLiteContext();
  const dietRepo = useMemo(() => new SupabaseDietRepository(undefined, db), [db]);
  const authRepo = useMemo(() => new SupabaseAuthRepository(), []);
  const workoutRepo = useMemo(() => new SupabaseWorkoutRepository(), []);
  const bodyRepo = useMemo(() => new SupabaseBodyRepository(), []);

  return (
    <ThemeProvider authRepo={authRepo}>
      <ProfileProvider authRepo={authRepo}>
        <DataProviders
          authRepo={authRepo}
          dietRepo={dietRepo}
          workoutRepo={workoutRepo}
          bodyRepo={bodyRepo}
        />
      </ProfileProvider>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SQLiteProvider databaseName="fitness.db" onInit={migrateDbIfNeeded}>
        <AppContent />
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}
