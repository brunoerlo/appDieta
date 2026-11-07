import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { BodyLog } from '../../types/domain';
import { useTheme } from '../../hooks/useTheme';

export interface MeasurementsModalProps {
  visible: boolean;
  currentLog: BodyLog | null;
  date: string;
  onClose: () => void;
  onSave: (measurements: {
    bodyFatPct?: number;
    waistCm?: number;
    chestCm?: number;
    armsCm?: number;
    legsCm?: number;
  }) => Promise<void>;
}

export const MeasurementsModal: React.FC<MeasurementsModalProps> = ({
  visible,
  currentLog,
  date,
  onClose,
  onSave,
}) => {
  const { colors } = useTheme();

  const [bodyFatStr, setBodyFatStr] = useState('');
  const [waistStr, setWaistStr] = useState('');
  const [chestStr, setChestStr] = useState('');
  const [armsStr, setArmsStr] = useState('');
  const [legsStr, setLegsStr] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      if (visible) {
        setBodyFatStr(currentLog?.bodyFatPct !== undefined ? String(currentLog.bodyFatPct) : '');
        setWaistStr(currentLog?.waistCm !== undefined ? String(currentLog.waistCm) : '');
        setChestStr(currentLog?.chestCm !== undefined ? String(currentLog.chestCm) : '');
        setArmsStr(currentLog?.armsCm !== undefined ? String(currentLog.armsCm) : '');
        setLegsStr(currentLog?.legsCm !== undefined ? String(currentLog.legsCm) : '');
        setError(null);
      }
    });
    return () => {
      active = false;
    };
  }, [visible, currentLog]);


  const parseVal = (str: string): number | undefined => {
    if (!str.trim()) return undefined;
    const v = parseFloat(str.replace(',', '.'));
    return isNaN(v) ? undefined : Number(v.toFixed(1));
  };

  const handleSave = async () => {
    const bf = parseVal(bodyFatStr);
    const waist = parseVal(waistStr);
    const chest = parseVal(chestStr);
    const arms = parseVal(armsStr);
    const legs = parseVal(legsStr);

    if (bf !== undefined && (bf < 2 || bf > 70)) {
      setError('Percentual de gordura deve estar entre 2% e 70%');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        bodyFatPct: bf,
        waistCm: waist,
        chestCm: chest,
        armsCm: arms,
        legsCm: legs,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Falha ao salvar medidas');
    } finally {
      setSaving(false);
    }
  };

  const parts = date.split('-');
  const dateFormatted = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : date;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={[styles.modalBox, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: colors.textPrimary }]}>Medidas & Composição</Text>
              <Text style={[styles.dateText, { color: colors.textSecondary }]}>{dateFormatted}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={[styles.closeBtnText, { color: colors.textDimmed }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Body Fat % */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Gordura Corporal (%)
              </Text>
              <View
                style={[
                  styles.inputRow,
                  { borderColor: colors.cardBorder, backgroundColor: colors.surfaceMuted },
                ]}
              >
                <TextInput
                  style={[styles.input, { color: colors.textPrimary }]}
                  value={bodyFatStr}
                  onChangeText={(t) => {
                    setBodyFatStr(t);
                    setError(null);
                  }}
                  keyboardType="decimal-pad"
                  placeholder="Ex: 15.0"
                  placeholderTextColor={colors.textDimmed}
                />
                <Text style={[styles.unit, { color: colors.fat }]}>%</Text>
              </View>
            </View>

            {/* Circumferences Section */}
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              Circunferências (cm)
            </Text>

            {/* Waist */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Cintura</Text>
              <View
                style={[
                  styles.inputRow,
                  { borderColor: colors.cardBorder, backgroundColor: colors.surfaceMuted },
                ]}
              >
                <TextInput
                  style={[styles.input, { color: colors.textPrimary }]}
                  value={waistStr}
                  onChangeText={setWaistStr}
                  keyboardType="decimal-pad"
                  placeholder="Ex: 82.0"
                  placeholderTextColor={colors.textDimmed}
                />
                <Text style={[styles.unit, { color: colors.textSecondary }]}>cm</Text>
              </View>
            </View>

            {/* Chest */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Tórax / Peito</Text>
              <View
                style={[
                  styles.inputRow,
                  { borderColor: colors.cardBorder, backgroundColor: colors.surfaceMuted },
                ]}
              >
                <TextInput
                  style={[styles.input, { color: colors.textPrimary }]}
                  value={chestStr}
                  onChangeText={setChestStr}
                  keyboardType="decimal-pad"
                  placeholder="Ex: 104.0"
                  placeholderTextColor={colors.textDimmed}
                />
                <Text style={[styles.unit, { color: colors.textSecondary }]}>cm</Text>
              </View>
            </View>

            {/* Arms */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Braço</Text>
              <View
                style={[
                  styles.inputRow,
                  { borderColor: colors.cardBorder, backgroundColor: colors.surfaceMuted },
                ]}
              >
                <TextInput
                  style={[styles.input, { color: colors.textPrimary }]}
                  value={armsStr}
                  onChangeText={setArmsStr}
                  keyboardType="decimal-pad"
                  placeholder="Ex: 38.5"
                  placeholderTextColor={colors.textDimmed}
                />
                <Text style={[styles.unit, { color: colors.textSecondary }]}>cm</Text>
              </View>
            </View>

            {/* Legs */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Coxa</Text>
              <View
                style={[
                  styles.inputRow,
                  { borderColor: colors.cardBorder, backgroundColor: colors.surfaceMuted },
                ]}
              >
                <TextInput
                  style={[styles.input, { color: colors.textPrimary }]}
                  value={legsStr}
                  onChangeText={setLegsStr}
                  keyboardType="decimal-pad"
                  placeholder="Ex: 58.0"
                  placeholderTextColor={colors.textDimmed}
                />
                <Text style={[styles.unit, { color: colors.textSecondary }]}>cm</Text>
              </View>
            </View>

            {error && <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>}
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.cancelBtn, { borderColor: colors.cardBorder }]}
            >
              <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              style={[styles.saveBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.saveText}>{saving ? 'Salvando...' : 'Salvar Medidas'}</Text>
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
    maxHeight: '85%',
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
    marginBottom: 16,
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
  scrollContent: {
    paddingBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 10,
  },
  inputGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    height: 48,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  unit: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  errorText: {
    fontSize: 12,
    marginTop: 8,
    fontWeight: '500',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
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
