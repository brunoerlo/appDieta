import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { spacing, borderRadius, ThemeColors } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

export interface LiveSetRowProps {
  setNumber: number;
  weightKg: number;
  reps: number;
  previousLoadDisplay?: string;
  completed?: boolean;
  canDelete?: boolean;
  onWeightChange: (weight: number) => void;
  onRepsChange: (reps: number) => void;
  onToggleComplete?: () => void;
  onDelete?: () => void;
  onCopyPrevious?: () => void;
}

export const LiveSetRow: React.FC<LiveSetRowProps> = ({
  setNumber,
  weightKg,
  reps,
  previousLoadDisplay,
  canDelete = false,
  onWeightChange,
  onRepsChange,
  onDelete,
  onCopyPrevious,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [weightInputText, setWeightInputText] = React.useState<string | null>(null);

  const parsedLocalWeight =
    weightInputText !== null ? parseFloat(weightInputText.replace(',', '.')) : NaN;
  const localMatchesProp =
    weightInputText !== null &&
    ((weightKg === 0 && (weightInputText === '' || weightInputText === '0' || weightInputText === '0.' || weightInputText === '0,')) ||
      (!isNaN(parsedLocalWeight) && Math.round(parsedLocalWeight * 10) / 10 === weightKg));

  const displayedWeightText = localMatchesProp
    ? weightInputText!
    : weightKg > 0
    ? weightKg.toString()
    : '';

  const handleWeightChange = (text: string) => {
    const filtered = text.replace(/[^0-9.,]/g, '');
    setWeightInputText(filtered);
    const cleaned = filtered.replace(',', '.');
    const parsed = parseFloat(cleaned);
    if (!isNaN(parsed) && parsed >= 0) {
      onWeightChange(Math.min(999.5, Math.round(parsed * 10) / 10));
    } else if (filtered === '' || filtered === '0') {
      onWeightChange(0);
    }
  };

  const handleRepsChange = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    const parsed = parseInt(cleaned, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      onRepsChange(Math.min(999, parsed));
    } else if (cleaned === '' || cleaned === '0') {
      onRepsChange(0);
    }
  };

  return (
    <View style={styles.row}>
      {/* Set Number Badge */}
      <View style={styles.setNumberBadge}>
        <Text style={styles.setNumberText}>{setNumber}ª</Text>
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
          style={styles.input}
          keyboardType="decimal-pad"
          value={displayedWeightText}
          placeholder="0"
          placeholderTextColor={colors.textDimmed}
          onChangeText={handleWeightChange}
          onBlur={() => setWeightInputText(null)}
          selectTextOnFocus
          maxLength={6}
          accessibilityLabel={`Peso da série ${setNumber} em quilogramas`}
        />
      </View>

      {/* Reps Input */}
      <View style={styles.inputWrapper}>
        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          value={reps > 0 ? reps.toString() : ''}
          placeholder="0"
          placeholderTextColor={colors.textDimmed}
          onChangeText={handleRepsChange}
          selectTextOnFocus
          maxLength={4}
          accessibilityLabel={`Repetições da série ${setNumber}`}
        />
      </View>

      {/* Optional Remove Set Button */}
      {onDelete && canDelete ? (
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={onDelete}
          accessibilityLabel={`Remover série ${setNumber}`}
          accessibilityRole="button"
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Text style={styles.deleteIcon}>✕</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.deletePlaceholder} />
      )}
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
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
      borderWidth: 1,
      borderRadius: borderRadius.md,
      paddingVertical: 6,
      paddingHorizontal: spacing.sm,
      marginBottom: 6,
      minHeight: 50,
    },
    setNumberBadge: {
      width: 32,
      height: 28,
      borderRadius: borderRadius.sm,
      backgroundColor: colors.primaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 6,
    },
    setNumberText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '800',
    },
    previousCol: {
      flex: 1.2,
      paddingHorizontal: 4,
      justifyContent: 'center',
    },
    previousText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
    inputWrapper: {
      width: 68,
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
    deleteBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 2,
    },
    deletePlaceholder: {
      width: 32,
      marginLeft: 2,
    },
    deleteIcon: {
      color: colors.textDimmed,
      fontSize: 13,
      fontWeight: '700',
    },
  });

