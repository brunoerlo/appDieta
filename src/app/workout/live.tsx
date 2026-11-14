import React, { useState, useEffect, useMemo, useRef } from 'react';
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
import { ThemeColors, spacing, borderRadius } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { useWorkout } from '../../hooks/useWorkout';
import { calculate1RM } from '../../utils/workout';
import {
  formatDatePortuguese,
  getTodayDateString,
  shiftDateString,
} from '../../utils/date';
import { LiveSetRow } from '../../components/workout/LiveSetRow';
import {
  WorkoutSummaryModal,
  WorkoutSummaryData,
} from '../../components/workout/WorkoutSummaryModal';
import {
  ExercisePickerModal,
  ExercisePickerResult,
} from '../../components/workout/ExercisePickerModal';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useSafeTopPadding } from '../../hooks/useSafeTopPadding';

export default function LiveWorkoutScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const safeTop = useSafeTopPadding(6);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { routineId } = useLocalSearchParams<{ routineId?: string }>();
  const {
    routines,
    activeSession,
    startWorkout,
    addExerciseToActiveWorkout,
    removeExerciseFromActiveWorkout,
    updateSet,
    addSet,
    removeSet,
    setWorkoutDate,
    setWorkoutNotes,
    discardWorkout,
    finishWorkout,
  } = useWorkout();

  const [isSummaryVisible, setIsSummaryVisible] = useState(false);
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const hasInitializedRef = useRef(false);
  const isSubmittingRef = useRef(false);

  // Initialize active workout draft once on screen entry if not already open
  useEffect(() => {
    if (hasInitializedRef.current) return;
    if (!activeSession) {
      hasInitializedRef.current = true;
      if (routineId) {
        const found = routines.find((r) => r.id === routineId);
        if (found) {
          startWorkout(found);
        } else {
          startWorkout();
        }
      } else {
        startWorkout();
      }
    } else {
      hasInitializedRef.current = true;
    }
  }, [routineId, routines, activeSession, startWorkout]);

  // Aggregate metrics across all active sets
  const allSets = useMemo(() => {
    if (!activeSession) return [];
    return activeSession.exercises.flatMap((e) => e.sets);
  }, [activeSession]);

  const completedSets = useMemo(() => {
    const marked = allSets.filter((s) => s.completed);
    return marked.length > 0 ? marked : allSets;
  }, [allSets]);

  const currentVolumeKg = useMemo(() => {
    return completedSets.reduce(
      (sum, s) => sum + (s.weightKg || 0) * (s.reps || 0),
      0
    );
  }, [completedSets]);

  const handleBackKeepDraft = () => {
    router.back();
  };

  const handleDiscardPress = () => {
    Alert.alert(
      'Descartar Rascunho',
      'Deseja descartar este rascunho de treino? As alterações não salvas serão perdidas.',
      [
        { text: 'Manter Rascunho', style: 'cancel' },
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
    if (allSets.length === 0) {
      Alert.alert(
        'Nenhum exercício na ficha',
        'Adicione pelo menos um exercício com séries para salvar o treino.',
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }
    setIsSummaryVisible(true);
  };

  const summaryData: WorkoutSummaryData = useMemo(() => {
    if (!activeSession) {
      return {
        routineName: 'Treino',
        date: getTodayDateString(),
        totalVolumeKg: 0,
        completedSetsCount: 0,
        totalSetsCount: 0,
        exercises: [],
      };
    }

    const exerciseSummaries = activeSession.exercises.map((e) => {
      const activeExSets = e.sets.filter((s) => s.completed);
      const setsToSummarize = activeExSets.length > 0 ? activeExSets : e.sets;
      const vol = setsToSummarize.reduce(
        (sum, s) => sum + (s.weightKg || 0) * (s.reps || 0),
        0
      );

      let topSet: { weightKg: number; reps: number } | undefined;
      let max1RM = -1;
      for (const s of setsToSummarize) {
        const est = calculate1RM(s.weightKg, s.reps);
        if (est > max1RM) {
          max1RM = est;
          topSet = { weightKg: s.weightKg, reps: s.reps };
        }
      }

      const setsDetail = setsToSummarize.map(
        (s, idx) => `Série ${idx + 1}: ${s.weightKg}kg × ${s.reps}`
      );

      return {
        name: e.name,
        muscleGroup: e.muscleGroup,
        completedSets: setsToSummarize.length,
        totalSets: e.sets.length,
        volumeKg: vol,
        topSet,
        setsDetail,
      };
    });

    return {
      routineName: activeSession.routineName,
      date: activeSession.date,
      totalVolumeKg: currentVolumeKg,
      completedSetsCount: completedSets.length,
      totalSetsCount: allSets.length,
      exercises: exerciseSummaries,
    };
  }, [activeSession, completedSets, allSets, currentVolumeKg]);

  const handleSaveWorkout = async () => {
    if (!activeSession || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsFinishing(true);
    try {
      await finishWorkout(activeSession.notes, {
        date: activeSession.date,
        durationMinutes: 0,
      });
      setIsSummaryVisible(false);
      router.replace('/workout/history');
    } catch (err: any) {
      Alert.alert('Erro ao salvar', err?.message || 'Falha ao salvar o treino.');
    } finally {
      isSubmittingRef.current = false;
      setIsFinishing(false);
    }
  };

  const handleAddExerciseFromPicker = async (picked: ExercisePickerResult) => {
    try {
      await Promise.resolve(
        addExerciseToActiveWorkout({
          name: picked.name,
          muscleGroup: picked.muscleGroup,
          targetSets: picked.targetSets,
          defaultRestSeconds: picked.defaultRestSeconds,
        })
      );
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível adicionar o exercício ao treino.');
    }
  };

  const handleConfirmRemoveExercise = (exIdx: number, exName: string) => {
    Alert.alert(
      'Remover Exercício',
      `Deseja remover "${exName}" deste treino?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: () => removeExerciseFromActiveWorkout(exIdx),
        },
      ]
    );
  };

  if (!activeSession) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
        <View style={[styles.loadingContainer, { paddingTop: safeTop }]}>
          <Text style={styles.loadingText}>Carregando ficha de treino...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const todayStr = getTodayDateString();
  const isToday = activeSession.date === todayStr;

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      {/* Top Header */}
      <View style={[styles.topHeader, { paddingTop: safeTop }]}>
        <TouchableOpacity
          onPress={handleBackKeepDraft}
          style={styles.headerBtn}
          accessibilityRole="button"
          accessibilityLabel="Voltar mantendo rascunho"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.backHeaderLink} numberOfLines={1}>‹ Voltar</Text>
        </TouchableOpacity>

        <View style={styles.sheetHeaderBadge}>
          <Text style={styles.sheetHeaderBadgeText} numberOfLines={1}>
            FICHA DE CARGAS
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleFinishPress}
          style={styles.finishBtn}
          accessibilityRole="button"
          accessibilityLabel="Finalizar treino"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.finishBtnText} numberOfLines={1}>Salvar Treino</Text>
        </TouchableOpacity>
      </View>

      {/* Routine & Date Selector Banner */}
      <View style={styles.bannerCard}>
        <View style={styles.bannerTopRow}>
          <View style={styles.bannerTitleCol}>
            <Text style={styles.routineNameText}>{activeSession.routineName}</Text>
            <View style={styles.bannerMetricsRow}>
              <Text style={styles.bannerMetric}>
                Volume Total:{' '}
                <Text style={styles.emeraldMetric}>
                  {currentVolumeKg.toLocaleString('pt-BR')} kg
                </Text>
              </Text>
              <Text style={styles.bannerMetricDivider}>•</Text>
              <Text style={styles.bannerMetric}>
                {activeSession.exercises.length} exercícios ({allSets.length} séries)
              </Text>
            </View>
          </View>
        </View>

        {/* Workout Date Selector */}
        <View style={styles.dateBar}>
          <TouchableOpacity
            onPress={() => setWorkoutDate(shiftDateString(activeSession.date, -1))}
            style={styles.dateStepBtn}
            accessibilityRole="button"
            accessibilityLabel="Dia anterior"
          >
            <Text style={styles.dateStepBtnText}>‹</Text>
          </TouchableOpacity>

          <View style={styles.dateDisplayBox}>
            <Text style={styles.dateDisplayLabel}>
              📅 Data: <Text style={styles.dateDisplayValue}>{formatDatePortuguese(activeSession.date)}</Text>
            </Text>
            {!isToday && (
              <TouchableOpacity
                onPress={() => setWorkoutDate(todayStr)}
                style={styles.resetTodayBtn}
                accessibilityRole="button"
                accessibilityLabel="Alterar data para hoje"
              >
                <Text style={styles.resetTodayText}>Ir para Hoje</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            onPress={() => setWorkoutDate(shiftDateString(activeSession.date, 1))}
            style={styles.dateStepBtn}
            accessibilityRole="button"
            accessibilityLabel="Próximo dia"
          >
            <Text style={styles.dateStepBtnText}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Exercises ScrollView */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.helperBannerText}>
          As cargas do último treino já vêm preenchidas. Altere apenas o que mudou e clique em Salvar Treino.
        </Text>

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
                      color={colors.primary}
                      backgroundColor={colors.primaryMuted}
                    />
                  )}
                  <Text style={styles.setsCountLabel}>
                    {exercise.sets.length} {exercise.sets.length === 1 ? 'série' : 'séries'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => handleConfirmRemoveExercise(exIdx, exercise.name)}
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
              <Text style={[styles.thText, styles.thSet]}>SÉRIE</Text>
              <Text style={[styles.thText, styles.thPrev]}>ANTERIOR</Text>
              <Text style={[styles.thText, styles.thKg]}>KG</Text>
              <Text style={[styles.thText, styles.thReps]}>REPS</Text>
              {exercise.sets.length > 1 && (
                <Text style={[styles.thText, styles.thDelete]} />
              )}
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
                canDelete={exercise.sets.length > 1}
                onWeightChange={(weight) =>
                  updateSet(exIdx, setIdx, { weightKg: weight })
                }
                onRepsChange={(reps) => updateSet(exIdx, setIdx, { reps })}
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

        {/* Primary Bottom Save Button */}
        <Button
          title="Salvar Treino"
          onPress={handleFinishPress}
          variant="primary"
          size="lg"
          style={styles.bottomSaveBtn}
        />

        {/* Discard Draft Action */}
        <TouchableOpacity
          onPress={handleDiscardPress}
          style={styles.discardDraftFooterBtn}
          accessibilityRole="button"
          accessibilityLabel="Descartar treino"
        >
          <Text style={styles.discardDraftFooterText}>Descartar Rascunho</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Workout Summary & Confirmation Modal */}
      <WorkoutSummaryModal
        visible={isSummaryVisible}
        summary={summaryData}
        notes={activeSession.notes || ''}
        onNotesChange={setWorkoutNotes}
        onDateChange={setWorkoutDate}
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

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingText: {
      color: colors.textSecondary,
      fontSize: 16,
    },
    topHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    headerBtn: {
      minWidth: 44,
      minHeight: 44,
      justifyContent: 'center',
    },
    backHeaderLink: {
      color: colors.primary,
      fontSize: 15,
      fontWeight: '700',
    },
    sheetHeaderBadge: {
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: borderRadius.full,
    },
    sheetHeaderBadgeText: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.6,
    },
    finishBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: borderRadius.md,
      minWidth: 44,
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
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
      gap: spacing.sm,
    },
    bannerTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    bannerTitleCol: {
      flex: 1,
    },
    routineNameText: {
      color: colors.textPrimary,
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
      color: colors.textSecondary,
      fontSize: 13,
    },
    bannerMetricDivider: {
      color: colors.textDimmed,
    },
    emeraldMetric: {
      color: colors.primary,
      fontWeight: '700',
    },
    dateBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surfaceMuted,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingHorizontal: 6,
      paddingVertical: 4,
    },
    dateStepBtn: {
      minWidth: 40,
      minHeight: 38,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: borderRadius.sm,
    },
    dateStepBtnText: {
      color: colors.primary,
      fontSize: 20,
      fontWeight: '700',
    },
    dateDisplayBox: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    dateDisplayLabel: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '600',
    },
    dateDisplayValue: {
      color: colors.textPrimary,
      fontWeight: '700',
    },
    resetTodayBtn: {
      backgroundColor: colors.primaryMuted,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: borderRadius.full,
    },
    resetTodayText: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: '700',
    },
    scrollContent: {
      padding: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    helperBannerText: {
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 17,
      marginBottom: spacing.md,
    },
    exerciseCard: {
      backgroundColor: colors.card,
      borderColor: colors.cardBorder,
      borderWidth: 1,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      marginBottom: spacing.lg,
    },
    exHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: spacing.sm,
    },
    exTitleBlock: {
      flex: 1,
    },
    exNameText: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 4,
    },
    exBadgesRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    setsCountLabel: {
      color: colors.textDimmed,
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
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      marginBottom: 4,
    },
    thText: {
      color: colors.textDimmed,
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    thSet: {
      width: 34,
      textAlign: 'center',
      marginRight: 6,
    },
    thPrev: {
      flex: 1.2,
      paddingHorizontal: 4,
    },
    thKg: {
      width: 68,
      textAlign: 'center',
      marginHorizontal: 4,
    },
    thReps: {
      width: 68,
      textAlign: 'center',
      marginHorizontal: 4,
    },
    thDelete: {
      width: 32,
      marginLeft: 2,
    },
    addSetBtn: {
      paddingVertical: 10,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: borderRadius.sm,
      backgroundColor: colors.surfaceMuted,
      marginTop: 6,
      minHeight: 44,
    },
    addSetText: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: '600',
    },
    addExerciseBtn: {
      width: '100%',
      marginBottom: spacing.md,
    },
    bottomSaveBtn: {
      width: '100%',
      marginBottom: spacing.sm,
    },
    discardDraftFooterBtn: {
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
    },
    discardDraftFooterText: {
      color: colors.danger,
      fontSize: 13,
      fontWeight: '600',
    },
  });

