import React, { useMemo } from 'react';
import { Stack } from 'expo-router';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { migrateDbIfNeeded } from '../database/connection';
import { SqliteDietRepository } from '../database/repositories/SqliteDietRepository';
import { SqliteAuthRepository } from '../database/repositories/SqliteAuthRepository';
import { SqliteWorkoutRepository } from '../database/repositories/SqliteWorkoutRepository';
import { SqliteBodyRepository } from '../database/repositories/SqliteBodyRepository';
import { DietProvider } from '../context/DietContext';
import { WorkoutProvider } from '../context/WorkoutContext';
import { ThemeProvider } from '../context/ThemeContext';
import { ProfileProvider } from '../context/ProfileContext';
import { BodyProvider } from '../context/BodyContext';
import { useTheme } from '../hooks/useTheme';

function NavContainer() {
  const { colors, isDark } = useTheme();

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
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

function AppContent() {
  const db = useSQLiteContext();
  const dietRepo = useMemo(() => new SqliteDietRepository(db), [db]);
  const authRepo = useMemo(() => new SqliteAuthRepository(db), [db]);
  const workoutRepo = useMemo(() => new SqliteWorkoutRepository(db), [db]);
  const bodyRepo = useMemo(() => new SqliteBodyRepository(db), [db]);

  return (
    <ThemeProvider authRepo={authRepo}>
      <ProfileProvider authRepo={authRepo}>
        <DietProvider dietRepo={dietRepo} authRepo={authRepo}>
          <WorkoutProvider workoutRepo={workoutRepo}>
            <BodyProvider bodyRepo={bodyRepo}>
              <NavContainer />
            </BodyProvider>
          </WorkoutProvider>
        </DietProvider>
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
