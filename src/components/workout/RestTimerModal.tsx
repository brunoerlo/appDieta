import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing, borderRadius, ThemeColors } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { RestTimerState } from '../../context/WorkoutContext';
import { formatRestTimerDisplay } from '../../utils/workout';

export interface RestTimerBarProps {
  timer: RestTimerState;
  onAddSeconds: (seconds: number) => void;
  onSubtractSeconds: (seconds: number) => void;
  onSkip: () => void;
  onExpand: () => void;
}

export const RestTimerBar: React.FC<RestTimerBarProps> = ({
  timer,
  onAddSeconds,
  onSubtractSeconds,
  onSkip,
  onExpand,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (!timer.isActive) return null;

  return (
    <View style={styles.dockedBar}>
      <TouchableOpacity
        style={styles.dockedInfo}
        onPress={onExpand}
        accessibilityRole="button"
        accessibilityLabel="Expandir cronômetro de descanso"
      >
        <Text style={styles.dockedTimerText}>
          ⏱ {formatRestTimerDisplay(timer.remainingSeconds)}
        </Text>
        <Text style={styles.dockedExerciseText} numberOfLines={1}>
          {timer.exerciseName || 'Descanso'}
        </Text>
      </TouchableOpacity>

      <View style={styles.dockedControls}>
        <TouchableOpacity
          style={styles.dockedBtn}
          onPress={() => onSubtractSeconds(15)}
          accessibilityRole="button"
          accessibilityLabel="Diminuir 15 segundos do descanso"
        >
          <Text style={styles.dockedBtnText}>-15s</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.dockedBtn}
          onPress={() => onAddSeconds(30)}
          accessibilityRole="button"
          accessibilityLabel="Adicionar 30 segundos ao descanso"
        >
          <Text style={styles.dockedBtnText}>+30s</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.dockedBtn, styles.dockedSkipBtn]}
          onPress={onSkip}
          accessibilityRole="button"
          accessibilityLabel="Pular descanso"
        >
          <Text style={styles.dockedSkipText}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export interface RestTimerModalProps {
  visible: boolean;
  timer: RestTimerState;
  onAddSeconds: (seconds: number) => void;
  onSubtractSeconds: (seconds: number) => void;
  onSetSeconds: (seconds: number) => void;
  onSkip: () => void;
  onClose: () => void;
}

const PRESET_OPTIONS = [45, 60, 90, 120, 180];

export const RestTimerModal: React.FC<RestTimerModalProps> = ({
  visible,
  timer,
  onAddSeconds,
  onSubtractSeconds,
  onSetSeconds,
  onSkip,
  onClose,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <SafeAreaView style={styles.modalCard}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={onClose}
              style={styles.minimizeBtn}
              accessibilityRole="button"
              accessibilityLabel="Minimizar cronômetro de descanso"
            >
              <Text style={styles.minimizeText}>⌄ Minimizar</Text>
            </TouchableOpacity>
          </View>

          {/* Title */}
          <Text style={styles.modalTitle}>DESCANSO EM ANDAMENTO</Text>
          <Text style={styles.modalExerciseName}>
            {timer.exerciseName || 'Exercício'}
          </Text>

          {/* Central Timer Display */}
          <View style={styles.timerCircle}>
            <Text style={styles.timerDigits}>
              {formatRestTimerDisplay(timer.remainingSeconds)}
            </Text>
            <Text style={styles.timerSub}>restando</Text>
          </View>

          {/* Stepper Controls */}
          <View style={styles.modalSteppers}>
            <TouchableOpacity
              style={styles.stepperActionBtn}
              onPress={() => onSubtractSeconds(15)}
              accessibilityRole="button"
              accessibilityLabel="Diminuir 15 segundos"
            >
              <Text style={styles.stepperActionText}>-15s</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.stepperActionBtn}
              onPress={() => onAddSeconds(30)}
              accessibilityRole="button"
              accessibilityLabel="Adicionar 30 segundos"
            >
              <Text style={styles.stepperActionText}>+30s</Text>
            </TouchableOpacity>
          </View>

          {/* Presets Row */}
          <View style={styles.presetsContainer}>
            <Text style={styles.presetsLabel}>Predefinições rápidas:</Text>
            <View style={styles.presetsRow}>
              {PRESET_OPTIONS.map((sec) => (
                <TouchableOpacity
                  key={sec}
                  style={[
                    styles.presetPill,
                    timer.remainingSeconds === sec && styles.presetPillActive,
                  ]}
                  onPress={() => onSetSeconds(sec)}
                  accessibilityRole="button"
                  accessibilityLabel={`Definir tempo em ${sec} segundos`}
                >
                  <Text
                    style={[
                      styles.presetPillText,
                      timer.remainingSeconds === sec && styles.presetPillTextActive,
                    ]}
                  >
                    {sec}s
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Skip CTA */}
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={() => {
              onSkip();
              onClose();
            }}
            accessibilityRole="button"
            accessibilityLabel="Pular descanso agora"
          >
            <Text style={styles.skipBtnText}>Pular Descanso</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    dockedBar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.surfaceMuted,
      borderTopWidth: 2,
      borderTopColor: colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      zIndex: 999,
    },
    dockedInfo: {
      flex: 1,
      marginRight: spacing.sm,
    },
    dockedTimerText: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: '800',
    },
    dockedExerciseText: {
      color: colors.textSecondary,
      fontSize: 12,
    },
    dockedControls: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    dockedBtn: {
      minWidth: 44,
      minHeight: 44,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: borderRadius.sm,
      backgroundColor: colors.card,
      borderColor: colors.cardBorder,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dockedBtnText: {
      color: colors.textPrimary,
      fontSize: 12,
      fontWeight: '700',
    },
    dockedSkipBtn: {
      borderColor: colors.danger,
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
    },
    dockedSkipText: {
      color: colors.danger,
      fontSize: 14,
      fontWeight: '700',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    modalCard: {
      backgroundColor: colors.card,
      borderColor: colors.cardBorder,
      borderWidth: 1,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      alignItems: 'center',
    },
    modalHeader: {
      width: '100%',
      alignItems: 'flex-start',
      marginBottom: spacing.sm,
    },
    minimizeBtn: {
      minWidth: 44,
      minHeight: 44,
      justifyContent: 'center',
    },
    minimizeText: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: '600',
    },
    modalTitle: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 1,
      marginBottom: 4,
    },
    modalExerciseName: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: spacing.lg,
    },
    timerCircle: {
      width: 180,
      height: 180,
      borderRadius: 90,
      borderWidth: 4,
      borderColor: colors.primary,
      backgroundColor: colors.primaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xl,
    },
    timerDigits: {
      color: colors.textPrimary,
      fontSize: 44,
      fontWeight: '800',
    },
    timerSub: {
      color: colors.textDimmed,
      fontSize: 12,
      textTransform: 'uppercase',
      marginTop: 2,
    },
    modalSteppers: {
      flexDirection: 'row',
      gap: spacing.md,
      marginBottom: spacing.lg,
      width: '100%',
      justifyContent: 'center',
    },
    stepperActionBtn: {
      minWidth: 80,
      minHeight: 48,
      paddingHorizontal: spacing.lg,
      borderRadius: borderRadius.md,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepperActionText: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: '700',
    },
    presetsContainer: {
      width: '100%',
      marginBottom: spacing.xl,
    },
    presetsLabel: {
      color: colors.textDimmed,
      fontSize: 12,
      marginBottom: 8,
      textAlign: 'center',
    },
    presetsRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
    },
    presetPill: {
      minWidth: 44,
      minHeight: 44,
      paddingHorizontal: 12,
      borderRadius: borderRadius.sm,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    presetPillActive: {
      backgroundColor: colors.primaryMuted,
      borderColor: colors.primary,
    },
    presetPillText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '600',
    },
    presetPillTextActive: {
      color: colors.primary,
    },
    skipBtn: {
      width: '100%',
      minHeight: 48,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.danger,
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    skipBtnText: {
      color: colors.danger,
      fontSize: 15,
      fontWeight: '700',
    },
  });
