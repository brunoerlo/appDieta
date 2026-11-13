import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { spacing, borderRadius, ThemeColors } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
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

export const ExerciseConfigRow: React.FC<ExerciseConfigRowProps> = ({
  exercise,
  index,
  totalCount,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleSetsChange = (delta: number) => {
    const next = Math.max(1, Math.min(10, exercise.targetSets + delta));
    onUpdate({ targetSets: next });
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
              color={colors.primary}
              backgroundColor={colors.primaryMuted}
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

      {/* Stepper: Target Sets */}
      <View style={styles.controlsRow}>
        <View style={styles.controlSection}>
          <Text style={styles.controlLabel}>Séries na Ficha</Text>
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

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderColor: colors.cardBorder,
      borderWidth: 1,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: spacing.sm,
    },
    titleGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      marginRight: spacing.sm,
    },
    indexBadge: {
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: borderRadius.sm,
      marginRight: spacing.sm,
    },
    indexText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
    },
    nameBlock: {
      flex: 1,
    },
    exerciseName: {
      color: colors.textPrimary,
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
      gap: spacing.md,
      marginBottom: spacing.sm,
    },
    controlSection: {
      flex: 1,
    },
    restSection: {
      flex: 1.2,
    },
    controlLabel: {
      color: colors.textDimmed,
      fontSize: 11,
      fontWeight: '600',
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    stepperContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: borderRadius.sm,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    stepperBtn: {
      minWidth: 44,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepperText: {
      color: colors.primary,
      fontSize: 18,
      fontWeight: '700',
    },
    stepperValue: {
      flex: 1,
      textAlign: 'center',
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: '700',
    },
    disabledText: {
      color: colors.textDimmed,
      opacity: 0.3,
    },
    pillsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: spacing.sm,
    },
    restPill: {
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderRadius: borderRadius.sm,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    restPillActive: {
      backgroundColor: colors.primaryMuted,
      borderColor: colors.primary,
    },
    restPillText: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '600',
    },
    restPillTextActive: {
      color: colors.primary,
    },
    footerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: colors.cardBorder,
      paddingTop: spacing.xs,
      marginTop: 2,
    },
    reorderLabel: {
      color: colors.textDimmed,
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
      backgroundColor: colors.surfaceMuted,
      borderRadius: borderRadius.sm,
    },
    arrowDisabled: {
      opacity: 0.4,
    },
    arrowText: {
      color: colors.textPrimary,
      fontSize: 12,
    },
  });

