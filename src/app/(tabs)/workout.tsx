import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { spacing, borderRadius, ThemeColors } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { useWorkout } from '../../hooks/useWorkout';
import { WorkoutRoutine } from '../../types/domain';
import { RoutineCard } from '../../components/workout/RoutineCard';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { formatDatePortuguese } from '../../utils/date';

const FILTER_CATEGORIES = [
  'Todas',
  'Divisão ABC',
  'Push / Pull / Legs',
  'Personalizadas',
];

export default function WorkoutTabScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    routines,
    refreshRoutines,
    deleteRoutine,
    startWorkout,
    discardWorkout,
    activeSession,
  } = useWorkout();

  const [selectedFilter, setSelectedFilter] = useState('Todas');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refreshRoutines();
    setIsRefreshing(false);
  }, [refreshRoutines]);

  const filteredRoutines = useMemo(() => {
    return routines.filter((r) => {
      const nameLower = r.name.toLowerCase();
      if (selectedFilter === 'Todas') return true;
      if (selectedFilter === 'Divisão ABC') {
        return (
          nameLower.includes('treino a') ||
          nameLower.includes('treino b') ||
          nameLower.includes('treino c')
        );
      }
      if (selectedFilter === 'Push / Pull / Legs') {
        return (
          nameLower.includes('push') ||
          nameLower.includes('pull') ||
          nameLower.includes('legs')
        );
      }
      if (selectedFilter === 'Personalizadas') {
        return (
          !nameLower.includes('treino a') &&
          !nameLower.includes('treino b') &&
          !nameLower.includes('treino c') &&
          !nameLower.includes('push') &&
          !nameLower.includes('pull') &&
          !nameLower.includes('legs')
        );
      }
      return true;
    });
  }, [routines, selectedFilter]);

  const handleStartRoutine = (routine: WorkoutRoutine) => {
    if (activeSession && activeSession.routineId !== routine.id) {
      Alert.alert(
        'Rascunho em Aberto',
        `Você já possui um rascunho de "${activeSession.routineName}" em aberto. Deseja substituí-lo por "${routine.name}"?`,
        [
          {
            text: 'Continuar Atual',
            style: 'cancel',
            onPress: () => router.push('/workout/live'),
          },
          {
            text: 'Substituir Rascunho',
            style: 'destructive',
            onPress: () => {
              startWorkout(routine);
              router.push({
                pathname: '/workout/live',
                params: { routineId: routine.id },
              });
            },
          },
        ]
      );
      return;
    }

    if (!activeSession) {
      startWorkout(routine);
    }
    router.push({
      pathname: '/workout/live',
      params: { routineId: routine.id },
    });
  };

  const handleEditRoutine = (routine: WorkoutRoutine) => {
    router.push({
      pathname: '/workout/edit-routine',
      params: { routineId: routine.id },
    });
  };

  const handleDeleteRoutine = async (routine: WorkoutRoutine) => {
    await deleteRoutine(routine.id);
  };

  const handleResumeWorkout = () => {
    router.push('/workout/live');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <View>
          <Text style={styles.headerTitle}>TREINOS</Text>
          <Text style={styles.headerSubtitle}>
            {routines.length} rotinas cadastradas
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => router.push('/workout/history')}
          style={styles.historyBtn}
          accessibilityRole="button"
          accessibilityLabel="Acessar histórico de treinos"
        >
          <Text style={styles.historyBtnText}>📜 Histórico</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Active Draft Resume Card (if open draft exists) */}
        {activeSession && (
          <Card style={styles.activeSessionCard}>
            <View style={styles.activeHeaderRow}>
              <View style={styles.activeBadge}>
                <View style={styles.pulsingDot} />
                <Text style={styles.activeBadgeText}>RASCUNHO EM ABERTO</Text>
              </View>
              <Text style={styles.activeTimerText}>
                📅 {formatDatePortuguese(activeSession.date)}
              </Text>
            </View>

            <Text style={styles.activeRoutineName}>
              {activeSession.routineName}
            </Text>

            <Text style={styles.activeSetsInfo}>
              {activeSession.exercises.length} exercícios •{' '}
              {activeSession.exercises.reduce((sum, e) => sum + e.sets.length, 0)}{' '}
              séries •{' '}
              {activeSession.exercises
                .reduce(
                  (sum, e) =>
                    sum +
                    e.sets.reduce(
                      (sSum, s) => sSum + (s.weightKg || 0) * (s.reps || 0),
                      0
                    ),
                  0
                )
                .toLocaleString('pt-BR')}{' '}
              kg
            </Text>

            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button
                title="Continuar Preenchendo"
                onPress={handleResumeWorkout}
                variant="primary"
                size="md"
                style={{ flex: 1 }}
              />
              <Button
                title="Descartar"
                onPress={discardWorkout}
                variant="secondary"
                size="md"
              />
            </View>
          </Card>
        )}

        {/* Quick Action: New Routine */}
        <View style={styles.actionRow}>
          <Button
            title="+ Nova Rotina"
            onPress={() => router.push('/workout/edit-routine')}
            variant="secondary"
            size="md"
            style={styles.newRoutineBtn}
          />
        </View>

        {/* Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {FILTER_CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.filterPill,
                selectedFilter === cat && styles.filterPillActive,
              ]}
              onPress={() => setSelectedFilter(cat)}
              accessibilityRole="button"
              accessibilityLabel={`Filtrar por ${cat}`}
            >
              <Text
                style={[
                  styles.filterText,
                  selectedFilter === cat && styles.filterTextActive,
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Routines List */}
        <View style={styles.routinesList}>
          {filteredRoutines.map((routine) => (
            <RoutineCard
              key={routine.id}
              routine={routine}
              isActive={activeSession?.routineId === routine.id}
              onStartWorkout={handleStartRoutine}
              onEditRoutine={handleEditRoutine}
              onDeleteRoutine={handleDeleteRoutine}
            />
          ))}

          {filteredRoutines.length === 0 && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyTitle}>Nenhuma rotina encontrada</Text>
              <Text style={styles.emptySubtitle}>
                Crie sua própria ficha personalizada usando o botão &quot;+ Nova Rotina&quot; acima.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    topHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    headerTitle: {
      color: colors.textPrimary,
      fontSize: 22,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    headerSubtitle: {
      color: colors.textSecondary,
      fontSize: 13,
      marginTop: 2,
    },
    historyBtn: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.cardBorder,
      borderWidth: 1,
      borderRadius: borderRadius.md,
      paddingHorizontal: 12,
      paddingVertical: 8,
      minHeight: 44,
      justifyContent: 'center',
    },
    historyBtnText: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: '600',
    },
    scrollContent: {
      padding: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    activeSessionCard: {
      backgroundColor: colors.primaryMuted,
      borderColor: colors.primary,
      borderWidth: 1.5,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      marginBottom: spacing.lg,
    },
    activeHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    activeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    pulsingDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
    },
    activeBadgeText: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    activeTimerText: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    activeRoutineName: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 4,
    },
    activeSetsInfo: {
      color: colors.textSecondary,
      fontSize: 13,
      marginBottom: spacing.md,
    },
    resumeBtn: {
      width: '100%',
    },
    actionRow: {
      marginBottom: spacing.md,
    },
    newRoutineBtn: {
      width: '100%',
    },
    filterScroll: {
      gap: 8,
      paddingBottom: spacing.md,
    },
    filterPill: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: borderRadius.full,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      minHeight: 38,
      justifyContent: 'center',
    },
    filterPillActive: {
      backgroundColor: colors.primaryMuted,
      borderColor: colors.primary,
    },
    filterText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '600',
    },
    filterTextActive: {
      color: colors.primary,
    },
    routinesList: {
      marginTop: spacing.xs,
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.xxl,
    },
    emptyIcon: {
      fontSize: 48,
      marginBottom: 12,
    },
    emptyTitle: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 6,
    },
    emptySubtitle: {
      color: colors.textSecondary,
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 18,
      paddingHorizontal: spacing.xl,
    },
  });
