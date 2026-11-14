import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';

export interface WeighInModalProps {
  visible: boolean;
  initialWeight?: number;
  date: string;
  onClose: () => void;
  onSave: (weightKg: number) => Promise<void>;
}

export const WeighInModal: React.FC<WeighInModalProps> = ({
  visible,
  initialWeight,
  date,
  onClose,
  onSave,
}) => {
  const { colors } = useTheme();
  const [weightStr, setWeightStr] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      if (visible) {
        if (initialWeight && initialWeight > 0) {
          setWeightStr(initialWeight.toFixed(1));
        } else {
          setWeightStr('80.0');
        }
        setError(null);
      }
    });
    return () => {
      active = false;
    };
  }, [visible, initialWeight]);


  const handleAdjust = (delta: number) => {
    const parsed = Number(weightStr.trim().replace(',', '.'));
    const current = Number.isFinite(parsed) && parsed > 0 ? parsed : 80;
    const next = Math.max(20, Math.min(400, current + delta));
    setWeightStr(next.toFixed(1));
    setError(null);
  };

  const handleSave = async () => {
    if (isSubmittingRef.current) return;
    const trimmed = weightStr.trim().replace(',', '.');
    const val = trimmed === '' ? NaN : Number(trimmed);
    if (!Number.isFinite(val) || val < 20 || val > 400) {
      setError('Informe um peso válido entre 20 e 400 kg');
      return;
    }
    isSubmittingRef.current = true;
    setSaving(true);
    try {
      await onSave(Number(val.toFixed(2)));
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Falha ao salvar peso');
    } finally {
      isSubmittingRef.current = false;
      setSaving(false);
    }
  };

  const parts = date.split('-');
  const dateFormatted = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : date;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { if (!saving) onClose(); }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={[styles.modalBox, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: colors.textPrimary }]}>Registrar Pesagem</Text>
              <Text style={[styles.dateText, { color: colors.textSecondary }]}>{dateFormatted}</Text>
            </View>
            <TouchableOpacity onPress={onClose} disabled={saving} style={styles.closeBtn}>
              <Text style={[styles.closeBtnText, { color: colors.textDimmed }]}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Weight Input Display */}
          <View style={styles.inputSection}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Peso Corporal Matinal</Text>
            <View style={[styles.inputRow, { borderColor: colors.cardBorder, backgroundColor: colors.surfaceMuted }]}>
              <TextInput
                style={[styles.input, { color: colors.textPrimary }]}
                value={weightStr}
                onChangeText={(t) => {
                  setWeightStr(t);
                  setError(null);
                }}
                keyboardType="decimal-pad"
                selectTextOnFocus
                placeholder="0.0"
                placeholderTextColor={colors.textDimmed}
                autoFocus
                maxLength={10}
              />
              <Text style={[styles.unit, { color: colors.textSecondary }]}>kg</Text>
            </View>

            {/* Quick Adjust Buttons */}
            <View style={styles.adjustRow}>
              <TouchableOpacity
                onPress={() => handleAdjust(-0.5)}
                style={[styles.adjustBtn, { backgroundColor: colors.surfaceMuted, borderColor: colors.cardBorder }]}
              >
                <Text style={[styles.adjustBtnText, { color: colors.textPrimary }]}>-0.5</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleAdjust(-0.1)}
                style={[styles.adjustBtn, { backgroundColor: colors.surfaceMuted, borderColor: colors.cardBorder }]}
              >
                <Text style={[styles.adjustBtnText, { color: colors.textPrimary }]}>-0.1</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleAdjust(0.1)}
                style={[styles.adjustBtn, { backgroundColor: colors.surfaceMuted, borderColor: colors.cardBorder }]}
              >
                <Text style={[styles.adjustBtnText, { color: colors.textPrimary }]}>+0.1</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleAdjust(0.5)}
                style={[styles.adjustBtn, { backgroundColor: colors.surfaceMuted, borderColor: colors.cardBorder }]}
              >
                <Text style={[styles.adjustBtnText, { color: colors.textPrimary }]}>+0.5</Text>
              </TouchableOpacity>
            </View>

            {error && <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>}
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              onPress={onClose}
              disabled={saving}
              style={[styles.cancelBtn, { borderColor: colors.cardBorder }]}
            >
              <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              style={[styles.saveBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.saveText}>{saving ? 'Salvando...' : 'Confirmar'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  dateText: {
    fontSize: 13,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    fontSize: 18,
    fontWeight: '700',
  },
  inputSection: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    height: 56,
  },
  input: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
  },
  unit: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  adjustRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 8,
  },
  adjustBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
  },
  adjustBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 12,
    marginTop: 8,
    fontWeight: '500',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
