import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing, borderRadius, ThemeColors } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { formatDatePortuguese, getTodayDateString, shiftDateString } from '../../utils/date';

export interface ExerciseSummaryItem {
  name: string;
  muscleGroup?: string;
  completedSets: number;
  totalSets: number;
  volumeKg: number;
  topSet?: { weightKg: number; reps: number };
  setsDetail?: string[];
}

export interface WorkoutSummaryData {
  routineName: string;
  date: string;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
  totalVolumeKg: number;
  completedSetsCount: number;
  totalSetsCount: number;
  exercises: ExerciseSummaryItem[];
}

export interface WorkoutSummaryModalProps {
  visible: boolean;
  summary: WorkoutSummaryData;
  notes: string;
  onNotesChange: (notes: string) => void;
  onDateChange?: (newDate: string) => void;
  onSave: () => Promise<void>;
  onContinueWorkout: () => void;
  onDiscard: () => void;
  isSaving?: boolean;
}

export const WorkoutSummaryModal: React.FC<WorkoutSummaryModalProps> = ({
  visible,
  summary,
  notes,
  onNotesChange,
  onDateChange,
  onSave,
  onContinueWorkout,
  onDiscard,
  isSaving = false,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const todayStr = getTodayDateString();
  const isToday = summary.date === todayStr;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      statusBarTranslucent={true}
      onRequestClose={onContinueWorkout}
    >
      <SafeAreaView style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.trophyIcon}>📋</Text>
            <Text style={styles.title}>RESUMO DO TREINO</Text>
            <Text style={styles.routineName}>{summary.routineName}</Text>
            <Text style={styles.dateText}>
              Confira as cargas e o volume total antes de salvar
            </Text>
          </View>

          {/* Date Selector in Summary */}
          {onDateChange && (
            <View style={styles.dateSelectorCard}>
              <TouchableOpacity
                onPress={() => onDateChange(shiftDateString(summary.date, -1))}
                style={styles.dateArrowBtn}
                accessibilityRole="button"
                accessibilityLabel="Dia anterior"
              >
                <Text style={styles.dateArrowText}>‹</Text>
              </TouchableOpacity>

              <View style={styles.dateCenter}>
                <Text style={styles.dateLabelSmall}>DATA DO TREINO</Text>
                <Text style={styles.dateValueText}>
                  {formatDatePortuguese(summary.date)}
                </Text>
                {!isToday && (
                  <TouchableOpacity
                    onPress={() => onDateChange(todayStr)}
                    style={styles.todayChip}
                    accessibilityRole="button"
                    accessibilityLabel="Ir para hoje"
                  >
                    <Text style={styles.todayChipText}>Ir para Hoje</Text>
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                onPress={() => onDateChange(shiftDateString(summary.date, 1))}
                style={styles.dateArrowBtn}
                accessibilityRole="button"
                accessibilityLabel="Próximo dia"
              >
                <Text style={styles.dateArrowText}>›</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Metrics 2x2 Grid (No Duration!) */}
          <View style={styles.grid}>
            <Card style={styles.metricCard}>
              <Text style={styles.metricLabel}>VOLUME TOTAL</Text>
              <Text style={[styles.metricValue, styles.statusEmerald]}>
                {summary.totalVolumeKg.toLocaleString('pt-BR')} kg
              </Text>
            </Card>

            <Card style={styles.metricCard}>
              <Text style={styles.metricLabel}>DATA DO TREINO</Text>
              <Text style={styles.metricValue}>
                {formatDatePortuguese(summary.date)}
              </Text>
            </Card>

            <Card style={styles.metricCard}>
              <Text style={styles.metricLabel}>EXERCÍCIOS</Text>
              <Text style={styles.metricValue}>
                {summary.exercises.length}
              </Text>
            </Card>

            <Card style={styles.metricCard}>
              <Text style={styles.metricLabel}>SÉRIES REGISTRADAS</Text>
              <Text style={styles.metricValue}>
                {summary.completedSetsCount}
              </Text>
            </Card>
          </View>

          {/* Exercise Breakdown */}
          <Text style={styles.sectionTitle}>CARGAS POR EXERCÍCIO</Text>
          <View style={styles.exerciseList}>
            {summary.exercises.map((ex, idx) => (
              <View
                key={`${ex.name}-${idx}`}
                style={[
                  styles.exerciseRow,
                  idx === summary.exercises.length - 1 && styles.exerciseRowLast,
                ]}
              >
                <View style={styles.exerciseHeader}>
                  <Text style={styles.exName}>{ex.name}</Text>
                  <Text style={styles.exVolume}>
                    {ex.volumeKg.toLocaleString('pt-BR')} kg
                  </Text>
                </View>
                {ex.setsDetail && ex.setsDetail.length > 0 ? (
                  <Text style={styles.exSetsDetailText}>
                    {ex.setsDetail.join('  •  ')}
                  </Text>
                ) : null}
                <View style={styles.exMetaRow}>
                  <Text style={styles.exMetaSets}>
                    {ex.completedSets} {ex.completedSets === 1 ? 'série' : 'séries'}
                  </Text>
                  {ex.topSet && (
                    <Text style={styles.exTopSet}>
                      Maior carga: {ex.topSet.weightKg}kg × {ex.topSet.reps}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>

          {/* Notes Field */}
          <Text style={styles.sectionTitle}>NOTAS / OBSERVAÇÕES</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Ex: Boa progressão no supino, subi 2kg..."
            placeholderTextColor={colors.textDimmed}
            value={notes}
            onChangeText={onNotesChange}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          {/* Action CTAs */}
          <View style={styles.actionsContainer}>
            <Button
              title="Confirmar e Salvar Treino"
              onPress={onSave}
              variant="primary"
              size="lg"
              loading={isSaving}
              style={styles.actionBtn}
            />

            <Button
              title="Voltar e Editar Cargas"
              onPress={onContinueWorkout}
              variant="secondary"
              size="md"
              disabled={isSaving}
              style={styles.actionBtn}
            />

            <TouchableOpacity
              onPress={onDiscard}
              disabled={isSaving}
              style={styles.discardBtn}
              accessibilityRole="button"
              accessibilityLabel="Descartar treino"
            >
              <Text style={styles.discardText}>Descartar Rascunho</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      padding: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    header: {
      alignItems: 'center',
      marginBottom: spacing.lg,
    },
    trophyIcon: {
      fontSize: 44,
      marginBottom: 8,
    },
    title: {
      color: colors.primary,
      fontSize: 19,
      fontWeight: '800',
      letterSpacing: 1,
      marginBottom: 4,
    },
    routineName: {
      color: colors.textPrimary,
      fontSize: 22,
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: 4,
    },
    dateText: {
      color: colors.textSecondary,
      fontSize: 13,
      textAlign: 'center',
    },
    dateSelectorCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.card,
      borderColor: colors.cardBorder,
      borderWidth: 1,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      marginBottom: spacing.md,
    },
    dateArrowBtn: {
      minWidth: 44,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: borderRadius.sm,
      backgroundColor: colors.surfaceMuted,
    },
    dateArrowText: {
      color: colors.primary,
      fontSize: 22,
      fontWeight: '700',
    },
    dateCenter: {
      alignItems: 'center',
      flex: 1,
      paddingHorizontal: spacing.sm,
    },
    dateLabelSmall: {
      color: colors.textDimmed,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.8,
      marginBottom: 2,
    },
    dateValueText: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: '700',
    },
    todayChip: {
      marginTop: 4,
      backgroundColor: colors.primaryMuted,
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: borderRadius.full,
    },
    todayChipText: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: '700',
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginBottom: spacing.xl,
    },
    metricCard: {
      width: '48%',
      backgroundColor: colors.card,
      borderColor: colors.cardBorder,
      borderWidth: 1,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      alignItems: 'center',
    },
    metricLabel: {
      color: colors.textDimmed,
      fontSize: 11,
      fontWeight: '600',
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    metricValue: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: '800',
      textAlign: 'center',
    },
    statusEmerald: {
      color: colors.primary,
      fontSize: 18,
    },
    sectionTitle: {
      color: colors.textDimmed,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 1,
      marginBottom: spacing.sm,
    },
    exerciseList: {
      backgroundColor: colors.card,
      borderColor: colors.cardBorder,
      borderWidth: 1,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginBottom: spacing.xl,
    },
    exerciseRow: {
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
      paddingVertical: 10,
    },
    exerciseRowLast: {
      borderBottomWidth: 0,
    },
    exerciseHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    exName: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: '700',
      flex: 1,
    },
    exVolume: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: '700',
    },
    exSetsDetailText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '600',
      marginBottom: 4,
    },
    exMetaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    exMetaSets: {
      color: colors.textDimmed,
      fontSize: 12,
    },
    exTopSet: {
      color: colors.textDimmed,
      fontSize: 12,
    },
    notesInput: {
      backgroundColor: colors.card,
      borderColor: colors.cardBorder,
      borderWidth: 1,
      borderRadius: borderRadius.md,
      color: colors.textPrimary,
      fontSize: 14,
      padding: spacing.md,
      minHeight: 80,
      marginBottom: spacing.xl,
    },
    actionsContainer: {
      gap: spacing.sm,
    },
    actionBtn: {
      width: '100%',
    },
    discardBtn: {
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
    },
    discardText: {
      color: colors.danger,
      fontSize: 14,
      fontWeight: '600',
    },
  });

