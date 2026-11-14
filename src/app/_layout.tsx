import React, { useMemo, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import {
  Stack,
  useRouter,
  useSegments,
  useRootNavigationState,
  useGlobalSearchParams,
} from 'expo-router';
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

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | null;
}

export class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Ocorreu uma falha inesperada na aplicação.',
    };
  }

  componentDidCatch(error: Error) {
    console.warn('[RootErrorBoundary] Uncaught error:', error?.message || error);
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorMessage: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View
          style={{
            flex: 1,
            backgroundColor: '#0A0A0C',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 20,
              fontWeight: '800',
              marginBottom: 8,
              textAlign: 'center',
            }}
          >
            Algo deu errado
          </Text>
          <Text
            style={{
              color: '#94A3B8',
              fontSize: 14,
              marginBottom: 20,
              textAlign: 'center',
            }}
          >
            {this.state.errorMessage || 'Ocorreu uma falha inesperada.'}
          </Text>
          <TouchableOpacity
            onPress={this.handleRetry}
            style={{
              backgroundColor: '#10B981',
              paddingHorizontal: 20,
              paddingVertical: 12,
              borderRadius: 10,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>
              Tentar Novamente
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

export function useAuthProtection() {
  const { isLoggedIn, onboardingCompleted, isBootstrapping } = useProfile();
  const segments = useSegments();
  const params = useGlobalSearchParams<{ step?: string }>();
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();

  useEffect(() => {
    // 1. Wait only for initial profile bootstrap to complete
    if (isBootstrapping) return;

    // 2. Wait for root navigation to be mounted and ready
    if (!rootNavigationState?.key) return;

    const inAuthGroup = (segments as string[])[0] === 'auth';
    const isOnboardingStep = params?.step === 'onboarding';

    // Rule A: Not logged in -> Route to /auth (and disallow ?step=onboarding when unauthenticated)
    if (!isLoggedIn) {
      if (!inAuthGroup || isOnboardingStep) {
        router.replace('/auth');
      }
    }
    // Rule B: Logged in but onboarding not completed -> Route to /auth?step=onboarding
    else if (!onboardingCompleted) {
      if (!inAuthGroup || !isOnboardingStep) {
        router.replace('/auth?step=onboarding');
      }
    }
    // Rule C: Fully authenticated & onboarded -> Leave /auth to main app
    else if (isLoggedIn && onboardingCompleted) {
      if (inAuthGroup) {
        router.replace('/(tabs)');
      }
    }
  }, [
    isLoggedIn,
    onboardingCompleted,
    isBootstrapping,
    segments,
    params?.step,
    rootNavigationState?.key,
    router,
  ]);
}

function NavContainer() {
  const { colors, isDark } = useTheme();
  const { isBootstrapping } = useProfile();
  useAuthProtection();

  if (isBootstrapping) {
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
  const isAuthenticated = Boolean(profile?.isLoggedIn && profile?.id);
  const userKey = isAuthenticated && profile?.id ? profile.id : 'guest';

  return (
    <ThemeProvider authRepo={authRepo} userKey={userKey}>
      <DietProvider
        userKey={userKey}
        enabled={isAuthenticated}
        dietRepo={dietRepo}
        authRepo={authRepo}
      >
        <WorkoutProvider
          userKey={userKey}
          enabled={isAuthenticated}
          workoutRepo={workoutRepo}
        >
          <BodyProvider
            userKey={userKey}
            enabled={isAuthenticated}
            bodyRepo={bodyRepo}
          >
            <NavContainer />
          </BodyProvider>
        </WorkoutProvider>
      </DietProvider>
    </ThemeProvider>
  );
}

function AppContent() {
  const db = useSQLiteContext();
  const dietRepo = useMemo(() => new SupabaseDietRepository(undefined, db), [db]);
  const authRepo = useMemo(() => new SupabaseAuthRepository(), []);
  const workoutRepo = useMemo(() => new SupabaseWorkoutRepository(), []);
  const bodyRepo = useMemo(() => new SupabaseBodyRepository(), []);

  return (
    <ProfileProvider authRepo={authRepo}>
      <DataProviders
        authRepo={authRepo}
        dietRepo={dietRepo}
        workoutRepo={workoutRepo}
        bodyRepo={bodyRepo}
      />
    </ProfileProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <RootErrorBoundary>
        <SQLiteProvider databaseName="fitness.db" onInit={migrateDbIfNeeded}>
          <AppContent />
        </SQLiteProvider>
      </RootErrorBoundary>
    </SafeAreaProvider>
  );
}
