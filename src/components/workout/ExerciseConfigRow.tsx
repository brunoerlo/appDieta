import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { DarkTheme } from '../../constants/theme';
import { Badge } from '../ui/Badge';

export interface DraftExercise {
  id?: string;
  name: string;
  muscleGroup: string;
  targetSets: number;
  defaultRestSeconds: number;
  sortOrder: number;
}

export interface ExerciseConfigRowProps {
  exercise: DraftExercise;
  index: number;
  totalCount: number;
  onUpdate: (updated: Partial<DraftExercise>) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

const COMMON_REST_OPTIONS = [45, 60, 75, 90, 120];

export const ExerciseConfigRow: React.FC<ExerciseConfigRowProps> = ({
  exercise,
  index,
  totalCount,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
}) => {
  const handleSetsChange = (delta: number) => {
    const next = Math.max(1, Math.min(10, exercise.targetSets + delta));
    onUpdate({ targetSets: next });
  };

  const handleRestChange = (delta: number) => {
    const next = Math.max(30, Math.min(300, exercise.defaultRestSeconds + delta));
    onUpdate({ defaultRestSeconds: next });
  };

  const isFirst = index === 0;
  const isLast = index === totalCount - 1;

  return (
    <View style={styles.card}>
      {/* Header: Order, Name, Muscle Group, Remove */}
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <View style={styles.indexBadge}>
            <Text style={styles.indexText}>#{index + 1}</Text>
          </View>
          <View style={styles.nameBlock}>
            <Text style={styles.exerciseName} numberOfLines={1}>
              {exercise.name}
            </Text>
            <Badge
              label={exercise.muscleGroup || 'Geral'}
              color={DarkTheme.colors.primary}
              backgroundColor={DarkTheme.colors.primaryMuted}
              style={styles.muscleBadge}
            />
          </View>
        </View>

        <TouchableOpacity
          onPress={onRemove}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.removeBtn}
          accessibilityLabel={`Remover exercício ${exercise.name}`}
          accessibilityRole="button"
        >
          <Text style={styles.removeIcon}>🗑️</Text>
        </TouchableOpacity>
      </View>

      {/* Steppers: Sets & Rest */}
      <View style={styles.controlsRow}>
        {/* Sets Stepper */}
        <View style={styles.controlSection}>
          <Text style={styles.controlLabel}>Séries Alvo</Text>
          <View style={styles.stepperContainer}>
            <TouchableOpacity
              onPress={() => handleSetsChange(-1)}
              style={styles.stepperBtn}
              disabled={exercise.targetSets <= 1}
              accessibilityLabel="Diminuir séries"
              accessibilityRole="button"
            >
              <Text style={[styles.stepperText, exercise.targetSets <= 1 && styles.disabledText]}>
                -
              </Text>
            </TouchableOpacity>
            <Text style={styles.stepperValue}>{exercise.targetSets}</Text>
            <TouchableOpacity
              onPress={() => handleSetsChange(1)}
              style={styles.stepperBtn}
              disabled={exercise.targetSets >= 10}
              accessibilityLabel="Aumentar séries"
              accessibilityRole="button"
            >
              <Text style={[styles.stepperText, exercise.targetSets >= 10 && styles.disabledText]}>
                +
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Rest Interval Stepper */}
        <View style={[styles.controlSection, styles.restSection]}>
          <Text style={styles.controlLabel}>Descanso Padrão</Text>
          <View style={styles.stepperContainer}>
            <TouchableOpacity
              onPress={() => handleRestChange(-15)}
              style={styles.stepperBtn}
              disabled={exercise.defaultRestSeconds <= 30}
              accessibilityLabel="Diminuir 15 segundos"
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.stepperText,
                  exercise.defaultRestSeconds <= 30 && styles.disabledText,
                ]}
              >
                -
              </Text>
            </TouchableOpacity>
            <Text style={styles.stepperValue}>{exercise.defaultRestSeconds}s</Text>
            <TouchableOpacity
              onPress={() => handleRestChange(15)}
              style={styles.stepperBtn}
              disabled={exercise.defaultRestSeconds >= 300}
              accessibilityLabel="Aumentar 15 segundos"
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.stepperText,
                  exercise.defaultRestSeconds >= 300 && styles.disabledText,
                ]}
              >
                +
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Quick Rest Pills */}
      <View style={styles.pillsRow}>
        {COMMON_REST_OPTIONS.map((seconds) => (
          <TouchableOpacity
            key={seconds}
            onPress={() => onUpdate({ defaultRestSeconds: seconds })}
            style={[
              styles.restPill,
              exercise.defaultRestSeconds === seconds && styles.restPillActive,
            ]}
            accessibilityLabel={`Definir descanso ${seconds} segundos`}
            accessibilityRole="button"
          >
            <Text
              style={[
                styles.restPillText,
                exercise.defaultRestSeconds === seconds && styles.restPillTextActive,
              ]}
            >
              {seconds}s
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Footer: Reorder Controls */}
      <View style={styles.footerRow}>
        <Text style={styles.reorderLabel}>Ordem na rotina</Text>
        <View style={styles.reorderButtons}>
          <TouchableOpacity
            onPress={onMoveUp}
            disabled={isFirst}
            style={[styles.arrowBtn, isFirst && styles.arrowDisabled]}
            accessibilityLabel="Mover para cima"
            accessibilityRole="button"
          >
            <Text style={[styles.arrowText, isFirst && styles.disabledText]}>▲</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onMoveDown}
            disabled={isLast}
            style={[styles.arrowBtn, isLast && styles.arrowDisabled]}
            accessibilityLabel="Mover para baixo"
            accessibilityRole="button"
          >
            <Text style={[styles.arrowText, isLast && styles.disabledText]}>▼</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: DarkTheme.colors.card,
    borderColor: DarkTheme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: DarkTheme.borderRadius.md,
    padding: DarkTheme.spacing.md,
    marginBottom: DarkTheme.spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: DarkTheme.spacing.sm,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: DarkTheme.spacing.sm,
  },
  indexBadge: {
    backgroundColor: DarkTheme.colors.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: DarkTheme.borderRadius.sm,
    marginRight: DarkTheme.spacing.sm,
  },
  indexText: {
    color: DarkTheme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  nameBlock: {
    flex: 1,
  },
  exerciseName: {
    color: DarkTheme.colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  muscleBadge: {
    alignSelf: 'flex-start',
  },
  removeBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeIcon: {
    fontSize: 16,
  },
  controlsRow: {
    flexDirection: 'row',
    gap: DarkTheme.spacing.md,
    marginBottom: DarkTheme.spacing.sm,
  },
  controlSection: {
    flex: 1,
  },
  restSection: {
    flex: 1.2,
  },
  controlLabel: {
    color: DarkTheme.colors.textDimmed,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DarkTheme.colors.surfaceMuted,
    borderRadius: DarkTheme.borderRadius.sm,
    borderWidth: 1,
    borderColor: DarkTheme.colors.cardBorder,
  },
  stepperBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperText: {
    color: DarkTheme.colors.primary,
    fontSize: 18,
    fontWeight: '700',
  },
  stepperValue: {
    flex: 1,
    textAlign: 'center',
    color: DarkTheme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  disabledText: {
    color: DarkTheme.colors.textDimmed,
    opacity: 0.3,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: DarkTheme.spacing.sm,
  },
  restPill: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: DarkTheme.borderRadius.sm,
    backgroundColor: DarkTheme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: DarkTheme.colors.cardBorder,
  },
  restPillActive: {
    backgroundColor: DarkTheme.colors.primaryMuted,
    borderColor: DarkTheme.colors.primary,
  },
  restPillText: {
    color: DarkTheme.colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  restPillTextActive: {
    color: DarkTheme.colors.primary,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: DarkTheme.colors.cardBorder,
    paddingTop: DarkTheme.spacing.xs,
    marginTop: 2,
  },
  reorderLabel: {
    color: DarkTheme.colors.textDimmed,
    fontSize: 11,
  },
  reorderButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  arrowBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DarkTheme.colors.surfaceMuted,
    borderRadius: DarkTheme.borderRadius.sm,
  },
  arrowDisabled: {
    opacity: 0.4,
  },
  arrowText: {
    color: DarkTheme.colors.textPrimary,
    fontSize: 12,
  },
});
