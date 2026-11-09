import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { WorkoutRoutine } from '../../types/domain';
import { spacing, borderRadius, ThemeColors } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

export interface RoutineCardProps {
  routine: WorkoutRoutine;
  isActive?: boolean;
  onStartWorkout: (routine: WorkoutRoutine) => void;
  onEditRoutine: (routine: WorkoutRoutine) => void;
  onDeleteRoutine: (routine: WorkoutRoutine) => void;
}

export const RoutineCard: React.FC<RoutineCardProps> = ({
  routine,
  isActive = false,
  onStartWorkout,
  onEditRoutine,
  onDeleteRoutine,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const exercises = useMemo(() => routine.exercises || [], [routine.exercises]);
  const exerciseCount = exercises.length;

  const totalTargetSets = useMemo(() => {
    return exercises.reduce((acc, curr) => acc + (curr.targetSets || 3), 0);
  }, [exercises]);

  const estimatedMinutes = useMemo(() => {
    return Math.max(20, Math.round(totalTargetSets * 2.5));
  }, [totalTargetSets]);

  const categoryTag = useMemo(() => {
    const nameLower = routine.name.toLowerCase();
    if (nameLower.includes('treino a') || nameLower.includes('treino b') || nameLower.includes('treino c')) {
      return 'Divisão ABC';
    }
    if (nameLower.includes('push') || nameLower.includes('pull') || nameLower.includes('legs')) {
      return 'PPL';
    }
    if (nameLower.includes('upper') || nameLower.includes('lower')) {
      return 'Upper / Lower';
    }
    return 'Personalizada';
  }, [routine.name]);

  const previewExercises = useMemo(() => {
    return exercises.slice(0, 3);
  }, [exercises]);

  const remainingExercisesCount = exerciseCount - previewExercises.length;

  const handleDeletePress = () => {
    Alert.alert(
      'Excluir Rotina',
      `Tem certeza que deseja excluir "${routine.name}"? Todos os exercícios vinculados serão removidos.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => onDeleteRoutine(routine),
        },
      ]
    );
  };

  return (
    <Card style={[styles.card, isActive && styles.activeCard]}>
      {/* Top Header: Tag + Actions */}
      <View style={styles.headerRow}>
        <Badge
          label={categoryTag}
          color={categoryTag === 'PPL' ? colors.protein : colors.primary}
          backgroundColor={
            categoryTag === 'PPL' ? 'rgba(59, 130, 246, 0.15)' : colors.primaryMuted
          }
        />
        <View style={styles.actionButtons}>
          <TouchableOpacity
            onPress={() => onEditRoutine(routine)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.iconBtn}
            accessibilityLabel={`Editar rotina ${routine.name}`}
            accessibilityRole="button"
          >
            <Text style={styles.iconText}>✏️</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleDeletePress}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.iconBtn}
            accessibilityLabel={`Excluir rotina ${routine.name}`}
            accessibilityRole="button"
          >
            <Text style={styles.iconText}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Routine Name & Description */}
      <Text style={styles.title}>{routine.name}</Text>
      {routine.description ? (
        <Text style={styles.description} numberOfLines={2}>
          {routine.description}
        </Text>
      ) : null}

      {/* Key Metrics Chips */}
      <View style={styles.metricsRow}>
        <View style={styles.metricChip}>
          <Text style={styles.metricText}>🏋️ {exerciseCount} exercícios</Text>
        </View>
        <View style={styles.metricChip}>
          <Text style={styles.metricText}>🔁 {totalTargetSets} séries</Text>
        </View>
        <View style={styles.metricChip}>
          <Text style={styles.metricText}>⏱️ ~{estimatedMinutes} min</Text>
        </View>
      </View>

      {/* Exercise Preview List */}
      {previewExercises.length > 0 && (
        <View style={styles.previewContainer}>
          {previewExercises.map((ex, idx) => (
            <View key={ex.id || `${ex.name}-${idx}`} style={styles.previewRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.previewName} numberOfLines={1}>
                {ex.name}
              </Text>
              <Text style={styles.previewSets}>{ex.targetSets}x</Text>
            </View>
          ))}
          {remainingExercisesCount > 0 && (
            <Text style={styles.remainingText}>
              +{remainingExercisesCount} outros exercícios...
            </Text>
          )}
        </View>
      )}

      {/* Iniciar Treino CTA */}
      <Button
        title="Iniciar Treino"
        onPress={() => onStartWorkout(routine)}
        variant="primary"
        size="md"
        icon={<Text style={styles.btnIcon}>▶</Text>}
        style={styles.startBtn}
      />
    </Card>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      marginBottom: spacing.md,
      backgroundColor: colors.card,
      borderColor: colors.cardBorder,
      borderWidth: 1,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
    },
    activeCard: {
      borderColor: colors.primary,
      borderWidth: 1.5,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    actionButtons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    iconBtn: {
      minWidth: 44,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: borderRadius.sm,
    },
    iconText: {
      fontSize: 14,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 4,
    },
    description: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 18,
      marginBottom: spacing.md,
    },
    metricsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginBottom: spacing.md,
    },
    metricChip: {
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: borderRadius.sm,
    },
    metricText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '500',
    },
    previewContainer: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    previewRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    bullet: {
      color: colors.primary,
      fontSize: 14,
      marginRight: 6,
    },
    previewName: {
      color: colors.textPrimary,
      fontSize: 13,
      flex: 1,
    },
    previewSets: {
      color: colors.textDimmed,
      fontSize: 12,
      fontWeight: '600',
    },
    remainingText: {
      color: colors.textDimmed,
      fontSize: 12,
      fontStyle: 'italic',
      marginTop: 4,
    },
    startBtn: {
      marginTop: 2,
      width: '100%',
    },
    btnIcon: {
      color: '#FFFFFF',
      fontSize: 12,
      marginRight: 6,
    },
  });

