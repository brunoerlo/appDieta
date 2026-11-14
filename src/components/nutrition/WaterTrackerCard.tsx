import React, { useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { spacing, borderRadius, ThemeColors } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { Card } from '../ui/Card';
import { ProgressBar } from '../ui/ProgressBar';

export interface WaterTrackerCardProps {
  consumedMl: number;
  targetMl: number;
  onIncrement: (amountMl: number) => void | Promise<void>;
  onDecrement: (amountMl: number) => void | Promise<void>;
  onReset: () => void | Promise<void>;
}

export const WaterTrackerCard: React.FC<WaterTrackerCardProps> = ({
  consumedMl,
  targetMl,
  onIncrement,
  onDecrement,
  onReset,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isProcessingRef = useRef(false);

  const safeTarget = targetMl > 0 ? targetMl : 2500;
  const progress = Math.max(0, Math.min(1, consumedMl / safeTarget));
  const percentText = `${Math.round(progress * 100)}%`;

  const handleAction = async (action: () => void | Promise<void>) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    try {
      await Promise.resolve(action());
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível atualizar o consumo de água.');
    } finally {
      isProcessingRef.current = false;
    }
  };

  const handleReset = () => {
    Alert.alert(
      'Zerar consumo de água?',
      'Deseja realmente zerar todos os registros de água deste dia?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Zerar',
          style: 'destructive',
          onPress: () => {
            void handleAction(() => onReset());
          },
        },
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
          color={colors.water}
          trackColor={colors.waterTrack}
          height={8}
          style={styles.progressBar}
        />
        <Text style={styles.percentText}>{percentText}</Text>
      </View>

      {/* Shortcut Buttons */}
      <View style={styles.buttonsRow}>
        <TouchableOpacity
          style={styles.quickButton}
          onPress={() => {
            void handleAction(() => onIncrement(250));
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.quickButtonText}>+250ml</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickButton}
          onPress={() => {
            void handleAction(() => onIncrement(500));
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.quickButtonText}>+500ml</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickButton, styles.undoButton]}
          onPress={() => {
            void handleAction(() => onDecrement(250));
          }}
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

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      marginHorizontal: spacing.md,
      marginVertical: spacing.sm,
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
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1,
    },
    amountText: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: '700',
    },
    targetText: {
      color: colors.textDimmed,
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
      color: colors.water,
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
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.cardBorder,
      borderWidth: 1,
      borderRadius: borderRadius.sm,
      paddingVertical: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    quickButtonText: {
      color: colors.textPrimary,
      fontSize: 12,
      fontWeight: '700',
    },
    undoButton: {
      backgroundColor: colors.dangerMuted,
      borderColor: colors.danger,
    },
    resetButton: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.cardBorder,
    },
    resetButtonText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
    },
    disabledText: {
      color: colors.textDimmed,
    },
  });

