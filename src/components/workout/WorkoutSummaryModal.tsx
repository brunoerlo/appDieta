import React from 'react';
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
import { DarkTheme } from '../../constants/theme';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { formatDurationMinutes } from '../../utils/workout';
import { useSafeTopPadding } from '../../hooks/useSafeTopPadding';

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
  const safeTop = useSafeTopPadding(16);

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
          contentContainerStyle={[styles.scrollContent, { paddingTop: safeTop }]}
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
            placeholderTextColor={DarkTheme.colors.textDimmed}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DarkTheme.colors.background,
  },
  scrollContent: {
    padding: DarkTheme.spacing.lg,
    paddingBottom: DarkTheme.spacing.xxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: DarkTheme.spacing.xl,
  },
  trophyIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  title: {
    color: DarkTheme.colors.primary,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  routineName: {
    color: DarkTheme.colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  dateText: {
    color: DarkTheme.colors.textSecondary,
    fontSize: 13,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DarkTheme.spacing.sm,
    marginBottom: DarkTheme.spacing.xl,
  },
  metricCard: {
    width: '48%',
    backgroundColor: DarkTheme.colors.card,
    borderColor: DarkTheme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: DarkTheme.borderRadius.md,
    padding: DarkTheme.spacing.md,
    alignItems: 'center',
  },
  metricLabel: {
    color: DarkTheme.colors.textDimmed,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  metricValue: {
    color: DarkTheme.colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  statusEmerald: {
    color: DarkTheme.colors.primary,
  },
  sectionTitle: {
    color: DarkTheme.colors.textDimmed,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: DarkTheme.spacing.sm,
  },
  exerciseList: {
    backgroundColor: DarkTheme.colors.card,
    borderColor: DarkTheme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: DarkTheme.borderRadius.md,
    padding: DarkTheme.spacing.md,
    marginBottom: DarkTheme.spacing.xl,
  },
  exerciseRow: {
    borderBottomWidth: 1,
    borderBottomColor: DarkTheme.colors.cardBorder,
    paddingVertical: 8,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  exName: {
    color: DarkTheme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  exVolume: {
    color: DarkTheme.colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  exMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  exMetaSets: {
    color: DarkTheme.colors.textSecondary,
    fontSize: 12,
  },
  exTopSet: {
    color: DarkTheme.colors.textDimmed,
    fontSize: 12,
  },
  notesInput: {
    backgroundColor: DarkTheme.colors.card,
    borderColor: DarkTheme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: DarkTheme.borderRadius.md,
    color: DarkTheme.colors.textPrimary,
    fontSize: 14,
    padding: DarkTheme.spacing.md,
    minHeight: 80,
    marginBottom: DarkTheme.spacing.xl,
  },
  actionsContainer: {
    gap: DarkTheme.spacing.sm,
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
    color: DarkTheme.colors.danger,
    fontSize: 14,
    fontWeight: '600',
  },
});
