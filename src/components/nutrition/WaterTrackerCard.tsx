import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { DarkTheme } from '../../constants/theme';
import { Card } from '../ui/Card';
import { ProgressBar } from '../ui/ProgressBar';

export interface WaterTrackerCardProps {
  consumedMl: number;
  targetMl: number;
  onIncrement: (amountMl: number) => void;
  onDecrement: (amountMl: number) => void;
  onReset: () => void;
}

export const WaterTrackerCard: React.FC<WaterTrackerCardProps> = ({
  consumedMl,
  targetMl,
  onIncrement,
  onDecrement,
  onReset,
}) => {
  const safeTarget = targetMl > 0 ? targetMl : 2500;
  const progress = Math.max(0, Math.min(1, consumedMl / safeTarget));
  const percentText = `${Math.round(progress * 100)}%`;

  const handleReset = () => {
    Alert.alert(
      'Zerar consumo de água?',
      'Deseja realmente zerar todos os registros de água deste dia?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Zerar', style: 'destructive', onPress: onReset },
      ]
    );
  };

  return (
    <Card style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <Text style={styles.waterIcon}>💧</Text>
          <Text style={styles.title}>HIDRATAÇÃO DIÁRIA</Text>
        </View>
        <Text style={styles.amountText}>
          {consumedMl.toLocaleString('pt-BR')}{' '}
          <Text style={styles.targetText}>/ {safeTarget.toLocaleString('pt-BR')} ml</Text>
        </Text>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressRow}>
        <ProgressBar
          progress={progress}
          color={DarkTheme.colors.water}
          trackColor={DarkTheme.colors.waterTrack}
          height={8}
          style={styles.progressBar}
        />
        <Text style={styles.percentText}>{percentText}</Text>
      </View>

      {/* Shortcut Buttons */}
      <View style={styles.buttonsRow}>
        <TouchableOpacity
          style={styles.quickButton}
          onPress={() => onIncrement(250)}
          activeOpacity={0.7}
        >
          <Text style={styles.quickButtonText}>+250ml</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickButton}
          onPress={() => onIncrement(500)}
          activeOpacity={0.7}
        >
          <Text style={styles.quickButtonText}>+500ml</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickButton, styles.undoButton]}
          onPress={() => onDecrement(250)}
          disabled={consumedMl <= 0}
          activeOpacity={0.7}
        >
          <Text style={[styles.quickButtonText, consumedMl <= 0 && styles.disabledText]}>
            -250ml
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickButton, styles.resetButton]}
          onPress={handleReset}
          disabled={consumedMl <= 0}
          activeOpacity={0.7}
        >
          <Text style={[styles.resetButtonText, consumedMl <= 0 && styles.disabledText]}>
            Zerar
          </Text>
        </TouchableOpacity>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: DarkTheme.spacing.md,
    marginVertical: DarkTheme.spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  waterIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  title: {
    color: DarkTheme.colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  amountText: {
    color: DarkTheme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  targetText: {
    color: DarkTheme.colors.textDimmed,
    fontSize: 12,
    fontWeight: '500',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  progressBar: {
    flex: 1,
  },
  percentText: {
    color: DarkTheme.colors.water,
    fontSize: 12,
    fontWeight: '700',
    width: 36,
    textAlign: 'right',
  },
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  quickButton: {
    flex: 1,
    backgroundColor: DarkTheme.colors.surfaceMuted,
    borderColor: DarkTheme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: DarkTheme.borderRadius.sm,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickButtonText: {
    color: DarkTheme.colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  undoButton: {
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderColor: 'rgba(244, 63, 94, 0.3)',
  },
  resetButton: {
    backgroundColor: DarkTheme.colors.surfaceMuted,
    borderColor: DarkTheme.colors.cardBorder,
  },
  resetButtonText: {
    color: DarkTheme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  disabledText: {
    color: DarkTheme.colors.textDimmed,
  },
});
