import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { DarkTheme } from '../../constants/theme';
import { useWorkout } from '../../hooks/useWorkout';
import { formatElapsedSeconds, calculate1RM } from '../../utils/workout';
import { LiveSetRow } from '../../components/workout/LiveSetRow';
import { RestTimerBar, RestTimerModal } from '../../components/workout/RestTimerModal';
import {
  WorkoutSummaryModal,
  WorkoutSummaryData,
} from '../../components/workout/WorkoutSummaryModal';
import { ExercisePickerModal, ExercisePickerResult } from '../../components/workout/ExercisePickerModal';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';

export default function LiveWorkoutScreen() {
  const router = useRouter();
  const { routineId } = useLocalSearchParams<{ routineId?: string }>();
  const {
    routines,
    activeSession,
    startWorkout,
    startFreestyleWorkout,
    addExerciseToActiveWorkout,
    removeExerciseFromActiveWorkout,
    updateSet,
    addSet,
    removeSet,
    completeSet,
    uncompleteSet,
    discardWorkout,
    finishWorkout,
    restTimer,
    startRestTimer,
    adjustRestTimer,
    skipRestTimer,
  } = useWorkout();

  const [isRestModalVisible, setIsRestModalVisible] = useState(false);
  const [isSummaryVisible, setIsSummaryVisible] = useState(false);
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [notes, setNotes] = useState('');
  const [isFinishing, setIsFinishing] = useState(false);

  // Initialize active workout if not already started
  useEffect(() => {
    if (!activeSession) {
      if (routineId) {
        const found = routines.find((r) => r.id === routineId);
        if (found) {
          startWorkout(found);
        } else {
          startFreestyleWorkout('Treino Livre');
        }
      } else {
        startFreestyleWorkout('Treino Livre');
      }
    }
  }, [routineId, routines, activeSession, startWorkout, startFreestyleWorkout]);

  // Aggregate metrics
  const allSets = useMemo(() => {
    if (!activeSession) return [];
    return activeSession.exercises.flatMap((e) => e.sets);
  }, [activeSession]);

  const completedSets = useMemo(() => {
    return allSets.filter((s) => s.completed);
  }, [allSets]);

  const currentVolumeKg = useMemo(() => {
    return completedSets.reduce(
      (sum, s) => sum + (s.weightKg || 0) * (s.reps || 0),
      0
    );
  }, [completedSets]);

  const handleDiscardPress = () => {
    Alert.alert(
      'Descartar Treino',
      'Deseja descartar o treino em andamento? Todo o progresso não salvo será perdido.',
      [
        { text: 'Continuar Treinando', style: 'cancel' },
        {
          text: 'Descartar',
          style: 'destructive',
          onPress: () => {
            discardWorkout();
            router.back();
          },
        },
      ]
    );
  };

  const handleFinishPress = () => {
    if (completedSets.length === 0) {
      Alert.alert(
        'Nenhuma série concluída',
        'Você não concluiu nenhuma série neste treino. Deseja descartar?',
        [
          { text: 'Continuar Treinando', style: 'cancel' },
          {
            text: 'Descartar',
            style: 'destructive',
            onPress: () => {
              discardWorkout();
              router.back();
            },
          },
        ]
      );
      return;
    }
    setIsSummaryVisible(true);
  };

  const summaryData: WorkoutSummaryData = useMemo(() => {
    if (!activeSession) {
      return {
        routineName: 'Treino',
        date: new Date().toISOString().split('T')[0],
        startTime: '00:00:00',
        endTime: '00:00:00',
        durationMinutes: 1,
        totalVolumeKg: 0,
        completedSetsCount: 0,
        totalSetsCount: 0,
        exercises: [],
      };
    }

    const durationMinutes = Math.max(1, Math.round(activeSession.elapsedSeconds / 60));
    const nowTime = new Date().toTimeString().split(' ')[0];

    const exerciseSummaries = activeSession.exercises.map((e) => {
      const comp = e.sets.filter((s) => s.completed);
      const vol = comp.reduce((sum, s) => sum + (s.weightKg || 0) * (s.reps || 0), 0);

      let topSet: { weightKg: number; reps: number } | undefined;
      let max1RM = 0;
      for (const s of comp) {
        const est = calculate1RM(s.weightKg, s.reps);
        if (est > max1RM) {
          max1RM = est;
          topSet = { weightKg: s.weightKg, reps: s.reps };
        }
      }

      return {
        name: e.name,
        muscleGroup: e.muscleGroup,
        completedSets: comp.length,
        totalSets: e.sets.length,
        volumeKg: vol,
        topSet,
      };
    });

    return {
      routineName: activeSession.routineName,
      date: activeSession.date,
      startTime: activeSession.startTime,
      endTime: nowTime,
      durationMinutes,
      totalVolumeKg: currentVolumeKg,
      completedSetsCount: completedSets.length,
      totalSetsCount: allSets.length,
      exercises: exerciseSummaries,
    };
  }, [activeSession, completedSets, allSets, currentVolumeKg]);

  const handleSaveWorkout = async () => {
    setIsFinishing(true);
    try {
      await finishWorkout(notes);
      setIsSummaryVisible(false);
      router.replace('/workout/history');
    } catch (err: any) {
      Alert.alert('Erro ao salvar', err?.message || 'Falha ao finalizar o treino.');
    } finally {
      setIsFinishing(false);
    }
  };

  const handleAddExerciseFromPicker = (picked: ExercisePickerResult) => {
    addExerciseToActiveWorkout({
      name: picked.name,
      muscleGroup: picked.muscleGroup,
      targetSets: picked.targetSets,
      defaultRestSeconds: picked.defaultRestSeconds,
    });
  };

  if (!activeSession) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Carregando treino...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          onPress={handleDiscardPress}
          style={styles.headerBtn}
          accessibilityRole="button"
          accessibilityLabel="Descartar treino"
        >
          <Text style={styles.discardHeaderLink}>✕ Descartar</Text>
        </TouchableOpacity>

        {/* Stopwatch indicator */}
        <View style={styles.timerBadge}>
          <View style={styles.pulsingDot} />
          <Text style={styles.timerText}>
            {formatElapsedSeconds(activeSession.elapsedSeconds)}
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleFinishPress}
          style={styles.finishBtn}
          accessibilityRole="button"
          accessibilityLabel="Finalizar treino"
        >
          <Text style={styles.finishBtnText}>Finalizar</Text>
        </TouchableOpacity>
      </View>

      {/* Routine Banner */}
      <View style={styles.bannerCard}>
        <Text style={styles.routineNameText}>{activeSession.routineName}</Text>
        <View style={styles.bannerMetricsRow}>
          <Text style={styles.bannerMetric}>
            Volume: <Text style={styles.emeraldMetric}>{currentVolumeKg} kg</Text>
          </Text>
          <Text style={styles.bannerMetricDivider}>•</Text>
          <Text style={styles.bannerMetric}>
            Séries: {completedSets.length}/{allSets.length}
          </Text>
        </View>
      </View>

      {/* Exercises ScrollView */}
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          restTimer.isActive && styles.scrollPaddingForRestBar,
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {activeSession.exercises.map((exercise, exIdx) => (
          <View key={exercise.id || `${exercise.name}-${exIdx}`} style={styles.exerciseCard}>
            {/* Exercise Header */}
            <View style={styles.exHeader}>
              <View style={styles.exTitleBlock}>
                <Text style={styles.exNameText}>{exercise.name}</Text>
                <View style={styles.exBadgesRow}>
                  {exercise.muscleGroup && (
                    <Badge
                      label={exercise.muscleGroup}
                      color={DarkTheme.colors.primary}
                      backgroundColor={DarkTheme.colors.primaryMuted}
                    />
                  )}
                  <Text style={styles.restLabel}>
                    Descanso: {exercise.defaultRestSeconds}s
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => removeExerciseFromActiveWorkout(exIdx)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.removeExBtn}
                accessibilityRole="button"
                accessibilityLabel={`Remover exercício ${exercise.name}`}
              >
                <Text style={styles.removeExIcon}>🗑️</Text>
              </TouchableOpacity>
            </View>

            {/* Table Header Row */}
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.thText, styles.thSet]}>SET</Text>
              <Text style={[styles.thText, styles.thPrev]}>ANTERIOR</Text>
              <Text style={[styles.thText, styles.thKg]}>KG</Text>
              <Text style={[styles.thText, styles.thReps]}>REPS</Text>
              <Text style={[styles.thText, styles.thCheck]}>✓</Text>
            </View>

            {/* Set Rows */}
            {exercise.sets.map((set, setIdx) => (
              <LiveSetRow
                key={set.id || `${exIdx}-${setIdx}`}
                setNumber={set.setNumber}
                weightKg={set.weightKg}
                reps={set.reps}
                previousLoadDisplay={set.previousLoadDisplay}
                completed={set.completed}
                onWeightChange={(weight) =>
                  updateSet(exIdx, setIdx, { weightKg: weight })
                }
                onRepsChange={(reps) => updateSet(exIdx, setIdx, { reps })}
                onToggleComplete={() => {
                  if (set.completed) {
                    uncompleteSet(exIdx, setIdx);
                  } else {
                    completeSet(exIdx, setIdx);
                  }
                }}
                onCopyPrevious={() => {
                  if (set.previousLoadDisplay && set.previousLoadDisplay !== '—') {
                    const match = set.previousLoadDisplay.match(/(\d+(\.\d+)?)kg\s*×\s*(\d+)/);
                    if (match) {
                      updateSet(exIdx, setIdx, {
                        weightKg: parseFloat(match[1]),
                        reps: parseInt(match[3], 10),
                      });
                    }
                  }
                }}
                onDelete={() => removeSet(exIdx, setIdx)}
              />
            ))}

            {/* Exercise Footer: + Adicionar Série */}
            <TouchableOpacity
              onPress={() => addSet(exIdx)}
              style={styles.addSetBtn}
              accessibilityRole="button"
              accessibilityLabel={`Adicionar série a ${exercise.name}`}
            >
              <Text style={styles.addSetText}>+ Adicionar Série</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* Bottom CTA: Add Exercise */}
        <Button
          title="+ Adicionar Exercício ao Treino"
          onPress={() => setIsPickerVisible(true)}
          variant="secondary"
          size="md"
          style={styles.addExerciseBtn}
        />
      </ScrollView>

      {/* Docked Rest Timer Bar */}
      <RestTimerBar
        timer={restTimer}
        onAddSeconds={(sec) => adjustRestTimer(sec)}
        onSubtractSeconds={(sec) => adjustRestTimer(-sec)}
        onSkip={skipRestTimer}
        onExpand={() => setIsRestModalVisible(true)}
      />

      {/* Expanded Rest Timer Modal */}
      <RestTimerModal
        visible={isRestModalVisible}
        timer={restTimer}
        onAddSeconds={(sec) => adjustRestTimer(sec)}
        onSubtractSeconds={(sec) => adjustRestTimer(-sec)}
        onSetSeconds={(sec) => startRestTimer(sec, restTimer.exerciseName)}
        onSkip={skipRestTimer}
        onClose={() => setIsRestModalVisible(false)}
      />

      {/* Workout Summary & Save Modal */}
      <WorkoutSummaryModal
        visible={isSummaryVisible}
        summary={summaryData}
        notes={notes}
        onNotesChange={setNotes}
        onSave={handleSaveWorkout}
        onContinueWorkout={() => setIsSummaryVisible(false)}
        onDiscard={() => {
          setIsSummaryVisible(false);
          handleDiscardPress();
        }}
        isSaving={isFinishing}
      />

      {/* Add Exercise Modal */}
      <ExercisePickerModal
        visible={isPickerVisible}
        onSelectExercise={handleAddExerciseFromPicker}
        onClose={() => setIsPickerVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DarkTheme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: DarkTheme.colors.textSecondary,
    fontSize: 16,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: DarkTheme.spacing.lg,
    paddingVertical: DarkTheme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: DarkTheme.colors.cardBorder,
  },
  headerBtn: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
  },
  discardHeaderLink: {
    color: DarkTheme.colors.danger,
    fontSize: 14,
    fontWeight: '600',
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DarkTheme.colors.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: DarkTheme.borderRadius.full,
    gap: 6,
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: DarkTheme.colors.primary,
  },
  timerText: {
    color: DarkTheme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  finishBtn: {
    backgroundColor: DarkTheme.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: DarkTheme.borderRadius.md,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  bannerCard: {
    paddingHorizontal: DarkTheme.spacing.lg,
    paddingVertical: DarkTheme.spacing.md,
    backgroundColor: DarkTheme.colors.card,
    borderBottomWidth: 1,
    borderBottomColor: DarkTheme.colors.cardBorder,
  },
  routineNameText: {
    color: DarkTheme.colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  bannerMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bannerMetric: {
    color: DarkTheme.colors.textSecondary,
    fontSize: 13,
  },
  bannerMetricDivider: {
    color: DarkTheme.colors.textDimmed,
  },
  emeraldMetric: {
    color: DarkTheme.colors.primary,
    fontWeight: '700',
  },
  scrollContent: {
    padding: DarkTheme.spacing.lg,
    paddingBottom: DarkTheme.spacing.xxl,
  },
  scrollPaddingForRestBar: {
    paddingBottom: 80,
  },
  exerciseCard: {
    backgroundColor: DarkTheme.colors.card,
    borderColor: DarkTheme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: DarkTheme.borderRadius.lg,
    padding: DarkTheme.spacing.md,
    marginBottom: DarkTheme.spacing.lg,
  },
  exHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: DarkTheme.spacing.sm,
  },
  exTitleBlock: {
    flex: 1,
  },
  exNameText: {
    color: DarkTheme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  exBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  restLabel: {
    color: DarkTheme.colors.textDimmed,
    fontSize: 12,
  },
  removeExBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeExIcon: {
    fontSize: 16,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: DarkTheme.spacing.sm,
    paddingVertical: 4,
    marginBottom: 4,
  },
  thText: {
    color: DarkTheme.colors.textDimmed,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  thSet: {
    width: 28,
    textAlign: 'center',
    marginRight: 6,
  },
  thPrev: {
    flex: 1.2,
    paddingHorizontal: 4,
  },
  thKg: {
    width: 60,
    textAlign: 'center',
    marginHorizontal: 4,
  },
  thReps: {
    width: 60,
    textAlign: 'center',
    marginHorizontal: 4,
  },
  thCheck: {
    width: 44,
    textAlign: 'center',
    marginLeft: 4,
  },
  addSetBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: DarkTheme.borderRadius.sm,
    backgroundColor: DarkTheme.colors.surfaceMuted,
    marginTop: 6,
    minHeight: 44,
  },
  addSetText: {
    color: DarkTheme.colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  addExerciseBtn: {
    width: '100%',
    marginBottom: DarkTheme.spacing.lg,
  },
});
