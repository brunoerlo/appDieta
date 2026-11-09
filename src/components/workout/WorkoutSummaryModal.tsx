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
import { formatDurationMinutes } from '../../utils/workout';

export interface ExerciseSummaryItem {
  name: string;
  muscleGroup?: string;
  completedSets: number;
  totalSets: number;
  volumeKg: number;
  topSet?: { weightKg: number; reps: number };
}

export interface WorkoutSummaryData {
  routineName: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
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
  onSave,
  onContinueWorkout,
  onDiscard,
  isSaving = false,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

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
            <Text style={styles.trophyIcon}>🏆</Text>
            <Text style={styles.title}>TREINO CONCLUÍDO!</Text>
            <Text style={styles.routineName}>{summary.routineName}</Text>
            <Text style={styles.dateText}>
              {summary.date} • {summary.startTime} - {summary.endTime}
            </Text>
          </View>

          {/* Metrics 2x2 Grid */}
          <View style={styles.grid}>
            <Card style={styles.metricCard}>
              <Text style={styles.metricLabel}>VOLUME TOTAL</Text>
              <Text style={styles.metricValue}>
                {summary.totalVolumeKg.toLocaleString('pt-BR')} kg
              </Text>
            </Card>

            <Card style={styles.metricCard}>
              <Text style={styles.metricLabel}>DURAÇÃO</Text>
              <Text style={styles.metricValue}>
                {formatDurationMinutes(summary.durationMinutes)}
              </Text>
            </Card>

            <Card style={styles.metricCard}>
              <Text style={styles.metricLabel}>SÉRIES CONCLUÍDAS</Text>
              <Text style={styles.metricValue}>
                {summary.completedSetsCount} / {summary.totalSetsCount}
              </Text>
            </Card>

            <Card style={styles.metricCard}>
              <Text style={styles.metricLabel}>STATUS</Text>
              <Text style={[styles.metricValue, styles.statusEmerald]}>
                {summary.completedSetsCount === summary.totalSetsCount
                  ? '100% Completo'
                  : 'Parcial'}
              </Text>
            </Card>
          </View>

          {/* Exercise Breakdown */}
          <Text style={styles.sectionTitle}>RESUMO POR EXERCÍCIO</Text>
          <View style={styles.exerciseList}>
            {summary.exercises.map((ex, idx) => (
              <View key={`${ex.name}-${idx}`} style={styles.exerciseRow}>
                <View style={styles.exerciseHeader}>
                  <Text style={styles.exName}>{ex.name}</Text>
                  <Text style={styles.exVolume}>{ex.volumeKg} kg</Text>
                </View>
                <View style={styles.exMetaRow}>
                  <Text style={styles.exMetaSets}>
                    {ex.completedSets} de {ex.totalSets} séries
                  </Text>
                  {ex.topSet && (
                    <Text style={styles.exTopSet}>
                      Top: {ex.topSet.weightKg}kg × {ex.topSet.reps}
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
            placeholder="Ex: Boa progressão no supino, energia alta..."
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
              title="Salvar Treino no Histórico"
              onPress={onSave}
              variant="primary"
              size="lg"
              loading={isSaving}
              style={styles.actionBtn}
            />

            <Button
              title="Continuar Treinando"
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
              <Text style={styles.discardText}>Descartar Treino</Text>
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
      marginBottom: spacing.xl,
    },
    trophyIcon: {
      fontSize: 48,
      marginBottom: 8,
    },
    title: {
      color: colors.primary,
      fontSize: 20,
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
      fontSize: 18,
      fontWeight: '800',
    },
    statusEmerald: {
      color: colors.primary,
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
      paddingVertical: 8,
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
      fontWeight: '600',
      flex: 1,
    },
    exVolume: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: '700',
    },
    exMetaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    exMetaSets: {
      color: colors.textSecondary,
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
