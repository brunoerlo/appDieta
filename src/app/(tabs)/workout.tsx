import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { DarkTheme } from '../../constants/theme';
import { useWorkout } from '../../hooks/useWorkout';
import { WorkoutRoutine } from '../../types/domain';
import { RoutineCard } from '../../components/workout/RoutineCard';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { formatElapsedSeconds } from '../../utils/workout';

const FILTER_CATEGORIES = [
  'Todas',
  'Divisão ABC',
  'Push / Pull / Legs',
  'Personalizadas',
];

export default function WorkoutTabScreen() {
  const router = useRouter();
  const {
    routines,
    isLoadingRoutines,
    refreshRoutines,
    deleteRoutine,
    startWorkout,
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
    startWorkout(routine);
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
    <SafeAreaView style={styles.container}>
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
            refreshing={isRefreshing || isLoadingRoutines}
            onRefresh={onRefresh}
            tintColor={DarkTheme.colors.primary}
          />
        }
      >
        {/* Active Session Resume Card (if active) */}
        {activeSession && (
          <Card style={styles.activeSessionCard}>
            <View style={styles.activeHeaderRow}>
              <View style={styles.activeBadge}>
                <View style={styles.pulsingDot} />
                <Text style={styles.activeBadgeText}>TREINO EM ANDAMENTO</Text>
              </View>
              <Text style={styles.activeTimerText}>
                ⏱ {formatElapsedSeconds(activeSession.elapsedSeconds)}
              </Text>
            </View>

            <Text style={styles.activeRoutineName}>
              {activeSession.routineName}
            </Text>

            <Text style={styles.activeSetsInfo}>
              {activeSession.exercises.reduce(
                (sum, e) => sum + e.sets.filter((s) => s.completed).length,
                0
              )}{' '}
              de{' '}
              {activeSession.exercises.reduce((sum, e) => sum + e.sets.length, 0)}{' '}
              séries concluídas
            </Text>

            <Button
              title="▶ Retomar Treino"
              onPress={handleResumeWorkout}
              variant="primary"
              size="md"
              style={styles.resumeBtn}
            />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DarkTheme.colors.background,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: DarkTheme.spacing.lg,
    paddingTop: DarkTheme.spacing.sm,
    paddingBottom: DarkTheme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: DarkTheme.colors.cardBorder,
  },
  headerTitle: {
    color: DarkTheme.colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    color: DarkTheme.colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  historyBtn: {
    backgroundColor: DarkTheme.colors.surfaceMuted,
    borderColor: DarkTheme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: DarkTheme.borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  historyBtnText: {
    color: DarkTheme.colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  scrollContent: {
    padding: DarkTheme.spacing.lg,
    paddingBottom: DarkTheme.spacing.xxl,
  },
  activeSessionCard: {
    backgroundColor: '#17231E',
    borderColor: DarkTheme.colors.primary,
    borderWidth: 1.5,
    borderRadius: DarkTheme.borderRadius.lg,
    padding: DarkTheme.spacing.md,
    marginBottom: DarkTheme.spacing.lg,
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
    backgroundColor: DarkTheme.colors.primary,
  },
  activeBadgeText: {
    color: DarkTheme.colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  activeTimerText: {
    color: DarkTheme.colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  activeRoutineName: {
    color: DarkTheme.colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  activeSetsInfo: {
    color: DarkTheme.colors.textSecondary,
    fontSize: 13,
    marginBottom: DarkTheme.spacing.md,
  },
  resumeBtn: {
    width: '100%',
  },
  actionRow: {
    marginBottom: DarkTheme.spacing.md,
  },
  newRoutineBtn: {
    width: '100%',
  },
  filterScroll: {
    gap: 8,
    paddingBottom: DarkTheme.spacing.md,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: DarkTheme.borderRadius.full,
    backgroundColor: DarkTheme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: DarkTheme.colors.cardBorder,
    minHeight: 38,
    justifyContent: 'center',
  },
  filterPillActive: {
    backgroundColor: DarkTheme.colors.primaryMuted,
    borderColor: DarkTheme.colors.primary,
  },
  filterText: {
    color: DarkTheme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  filterTextActive: {
    color: DarkTheme.colors.primary,
  },
  routinesList: {
    marginTop: DarkTheme.spacing.xs,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: DarkTheme.spacing.xxl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    color: DarkTheme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySubtitle: {
    color: DarkTheme.colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: DarkTheme.spacing.xl,
  },
});
