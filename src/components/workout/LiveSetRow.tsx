import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { spacing, borderRadius, ThemeColors } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

export interface LiveSetRowProps {
  setNumber: number;
  weightKg: number;
  reps: number;
  previousLoadDisplay?: string;
  completed: boolean;
  onWeightChange: (weight: number) => void;
  onRepsChange: (reps: number) => void;
  onToggleComplete: () => void;
  onDelete?: () => void;
  onCopyPrevious?: () => void;
}

export const LiveSetRow: React.FC<LiveSetRowProps> = ({
  setNumber,
  weightKg,
  reps,
  previousLoadDisplay,
  completed,
  onWeightChange,
  onRepsChange,
  onToggleComplete,
  onDelete,
  onCopyPrevious,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleWeightChange = (text: string) => {
    const cleaned = text.replace(',', '.');
    const parsed = parseFloat(cleaned);
    if (!isNaN(parsed) && parsed >= 0) {
      onWeightChange(Math.min(999.5, Math.round(parsed * 10) / 10));
    } else if (text === '' || text === '0') {
      onWeightChange(0);
    }
  };

  const handleRepsChange = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    const parsed = parseInt(cleaned, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      onRepsChange(Math.min(999, parsed));
    } else if (text === '' || text === '0') {
      onRepsChange(0);
    }
  };

  return (
    <View style={[styles.row, completed && styles.completedRow]}>
      {/* Set Number Badge */}
      <View style={[styles.setNumberBadge, completed && styles.completedBadge]}>
        <Text style={[styles.setNumberText, completed && styles.completedBadgeText]}>
          {setNumber}
        </Text>
      </View>

      {/* Previous Load Column */}
      <TouchableOpacity
        style={styles.previousCol}
        onPress={onCopyPrevious}
        disabled={!previousLoadDisplay || previousLoadDisplay === '—'}
        accessibilityLabel={`Carga anterior ${previousLoadDisplay || 'nenhuma'}`}
        accessibilityRole="button"
      >
        <Text style={styles.previousText} numberOfLines={1}>
          {previousLoadDisplay || '—'}
        </Text>
      </TouchableOpacity>

      {/* Weight Input (KG) */}
      <View style={styles.inputWrapper}>
        <TextInput
          style={[styles.input, completed && styles.completedInput]}
          keyboardType="decimal-pad"
          value={weightKg > 0 ? weightKg.toString() : ''}
          placeholder="0"
          placeholderTextColor={colors.textDimmed}
          onChangeText={handleWeightChange}
          accessibilityLabel={`Peso da série ${setNumber} em quilogramas`}
        />
      </View>

      {/* Reps Input */}
      <View style={styles.inputWrapper}>
        <TextInput
          style={[styles.input, completed && styles.completedInput]}
          keyboardType="number-pad"
          value={reps > 0 ? reps.toString() : ''}
          placeholder="0"
          placeholderTextColor={colors.textDimmed}
          onChangeText={handleRepsChange}
          accessibilityLabel={`Repetições da série ${setNumber}`}
        />
      </View>

      {/* Complete Checkbox Button (44x44 minimum) */}
      <TouchableOpacity
        style={[styles.checkBtn, completed && styles.checkBtnCompleted]}
        onPress={onToggleComplete}
        accessibilityLabel={
          completed ? `Desmarcar série ${setNumber}` : `Concluir série ${setNumber}`
        }
        accessibilityRole="checkbox"
        accessibilityState={{ checked: completed }}
      >
        <Text style={[styles.checkIcon, completed && styles.checkIconCompleted]}>
          {completed ? '✓' : '○'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderColor: colors.cardBorder,
      borderWidth: 1,
      borderRadius: borderRadius.md,
      paddingVertical: 6,
      paddingHorizontal: spacing.sm,
      marginBottom: 6,
      minHeight: 52,
    },
    completedRow: {
      backgroundColor: colors.primaryMuted,
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
      borderColor: colors.cardBorder,
    },
    setNumberBadge: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 6,
    },
    completedBadge: {
      backgroundColor: colors.primary,
    },
    setNumberText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
    },
    completedBadgeText: {
      color: '#FFFFFF',
    },
    previousCol: {
      flex: 1.2,
      paddingHorizontal: 4,
      justifyContent: 'center',
    },
    previousText: {
      color: colors.textDimmed,
      fontSize: 12,
      fontWeight: '500',
    },
    inputWrapper: {
      width: 60,
      marginHorizontal: 4,
    },
    input: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.cardBorder,
      borderWidth: 1,
      borderRadius: borderRadius.sm,
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: '700',
      textAlign: 'center',
      paddingVertical: 6,
      paddingHorizontal: 4,
      minHeight: 40,
    },
    completedInput: {
      color: colors.textSecondary,
    },
    checkBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 4,
    },
    checkBtnCompleted: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    checkIcon: {
      color: colors.textDimmed,
      fontSize: 18,
      fontWeight: '700',
    },
    checkIconCompleted: {
      color: '#FFFFFF',
    },
  });

