import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DarkTheme } from '../../constants/theme';
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

const styles = StyleSheet.create({
  dockedBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1E222B',
    borderTopWidth: 2,
    borderTopColor: DarkTheme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: DarkTheme.spacing.md,
    paddingVertical: 10,
    zIndex: 999,
  },
  dockedInfo: {
    flex: 1,
    marginRight: DarkTheme.spacing.sm,
  },
  dockedTimerText: {
    color: DarkTheme.colors.primary,
    fontSize: 16,
    fontWeight: '800',
  },
  dockedExerciseText: {
    color: DarkTheme.colors.textSecondary,
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
    borderRadius: DarkTheme.borderRadius.sm,
    backgroundColor: DarkTheme.colors.card,
    borderColor: DarkTheme.colors.cardBorder,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockedBtnText: {
    color: DarkTheme.colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  dockedSkipBtn: {
    borderColor: DarkTheme.colors.danger,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  dockedSkipText: {
    color: DarkTheme.colors.danger,
    fontSize: 14,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    padding: DarkTheme.spacing.lg,
  },
  modalCard: {
    backgroundColor: DarkTheme.colors.card,
    borderColor: DarkTheme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: DarkTheme.borderRadius.lg,
    padding: DarkTheme.spacing.lg,
    alignItems: 'center',
  },
  modalHeader: {
    width: '100%',
    alignItems: 'flex-start',
    marginBottom: DarkTheme.spacing.sm,
  },
  minimizeBtn: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
  },
  minimizeText: {
    color: DarkTheme.colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  modalTitle: {
    color: DarkTheme.colors.primary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  modalExerciseName: {
    color: DarkTheme.colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: DarkTheme.spacing.lg,
  },
  timerCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 4,
    borderColor: DarkTheme.colors.primary,
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: DarkTheme.spacing.xl,
  },
  timerDigits: {
    color: DarkTheme.colors.textPrimary,
    fontSize: 44,
    fontWeight: '800',
  },
  timerSub: {
    color: DarkTheme.colors.textDimmed,
    fontSize: 12,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  modalSteppers: {
    flexDirection: 'row',
    gap: DarkTheme.spacing.md,
    marginBottom: DarkTheme.spacing.lg,
    width: '100%',
    justifyContent: 'center',
  },
  stepperActionBtn: {
    minWidth: 80,
    minHeight: 48,
    paddingHorizontal: DarkTheme.spacing.lg,
    borderRadius: DarkTheme.borderRadius.md,
    backgroundColor: DarkTheme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: DarkTheme.colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperActionText: {
    color: DarkTheme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  presetsContainer: {
    width: '100%',
    marginBottom: DarkTheme.spacing.xl,
  },
  presetsLabel: {
    color: DarkTheme.colors.textDimmed,
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
    borderRadius: DarkTheme.borderRadius.sm,
    backgroundColor: DarkTheme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: DarkTheme.colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetPillActive: {
    backgroundColor: DarkTheme.colors.primaryMuted,
    borderColor: DarkTheme.colors.primary,
  },
  presetPillText: {
    color: DarkTheme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  presetPillTextActive: {
    color: DarkTheme.colors.primary,
  },
  skipBtn: {
    width: '100%',
    minHeight: 48,
    borderRadius: DarkTheme.borderRadius.md,
    borderWidth: 1,
    borderColor: DarkTheme.colors.danger,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBtnText: {
    color: DarkTheme.colors.danger,
    fontSize: 15,
    fontWeight: '700',
  },
});
