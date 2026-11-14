import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useBody } from '../../hooks/useBody';
import { useTheme } from '../../hooks/useTheme';

export default function BodyLogModalScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { selectedDate, currentBodyLog, saveWeighIn, saveMeasurements } = useBody();

  const [weightStr, setWeightStr] = useState('');
  const [bodyFatStr, setBodyFatStr] = useState('');
  const [waistStr, setWaistStr] = useState('');
  const [chestStr, setChestStr] = useState('');
  const [armsStr, setArmsStr] = useState('');
  const [legsStr, setLegsStr] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active || !currentBodyLog) return;
      if (currentBodyLog.weightKg > 0) setWeightStr(String(currentBodyLog.weightKg));
      if (currentBodyLog.bodyFatPct !== undefined) setBodyFatStr(String(currentBodyLog.bodyFatPct));
      if (currentBodyLog.waistCm !== undefined) setWaistStr(String(currentBodyLog.waistCm));
      if (currentBodyLog.chestCm !== undefined) setChestStr(String(currentBodyLog.chestCm));
      if (currentBodyLog.armsCm !== undefined) setArmsStr(String(currentBodyLog.armsCm));
      if (currentBodyLog.legsCm !== undefined) setLegsStr(String(currentBodyLog.legsCm));
    });
    return () => {
      active = false;
    };
  }, [currentBodyLog]);


  const parseVal = (str: string): number | undefined => {
    const trimmed = str.trim().replace(',', '.');
    if (!trimmed) return undefined;
    const v = Number(trimmed);
    return Number.isFinite(v) ? Number(v.toFixed(1)) : NaN;
  };

  const handleSave = async () => {
    if (isSubmittingRef.current) return;

    const w = parseVal(weightStr);
    const bf = parseVal(bodyFatStr);
    const waist = parseVal(waistStr);
    const chest = parseVal(chestStr);
    const arms = parseVal(armsStr);
    const legs = parseVal(legsStr);

    if (
      w === undefined &&
      bf === undefined &&
      waist === undefined &&
      chest === undefined &&
      arms === undefined &&
      legs === undefined
    ) {
      setError('Informe ao menos o peso ou uma medida para salvar');
      return;
    }

    if (w !== undefined && (!Number.isFinite(w) || w < 20 || w > 400)) {
      setError('Informe um peso válido entre 20 e 400 kg');
      return;
    }

    if (bf !== undefined && (!Number.isFinite(bf) || bf < 2 || bf > 70)) {
      setError('Percentual de gordura deve estar entre 2% e 70%');
      return;
    }

    const circumferences = [
      { label: 'Cintura', val: waist },
      { label: 'Tórax', val: chest },
      { label: 'Braço', val: arms },
      { label: 'Coxa', val: legs },
    ];

    for (const item of circumferences) {
      if (item.val !== undefined && (!Number.isFinite(item.val) || item.val < 10 || item.val > 300)) {
        setError(`A medida de ${item.label} deve estar entre 10 e 300 cm`);
        return;
      }
    }

    isSubmittingRef.current = true;
    setSaving(true);
    try {
      if (w !== undefined && w > 0) {
        await saveWeighIn(w);
      }
      await saveMeasurements({
        bodyFatPct: bf,
        waistCm: waist,
        chestCm: chest,
        armsCm: arms,
        legsCm: legs,
      });
      router.back();
    } catch (err: any) {
      setError(err?.message || 'Falha ao salvar dados');
    } finally {
      isSubmittingRef.current = false;
      setSaving(false);
    }
  };

  const parts = selectedDate.split('-');
  const dateFormatted = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : selectedDate;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right', 'bottom']}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.cardBorder }]}>
          <TouchableOpacity onPress={() => router.back()} disabled={saving} style={styles.backBtn}>
            <Text style={[styles.backBtnText, { color: colors.textPrimary }]}>✕ Fechar</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Registrar Evolução</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <Text style={[styles.dateSubtitle, { color: colors.textSecondary }]}>
            Data selecionada: {dateFormatted}
          </Text>

          {/* Weigh-in Box */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Pesagem Matinal</Text>
            <View
              style={[
                styles.inputRow,
                { backgroundColor: colors.surfaceMuted, borderColor: colors.cardBorder },
              ]}
            >
              <TextInput
                style={[styles.bigInput, { color: colors.textPrimary }]}
                value={weightStr}
                onChangeText={(t) => {
                  setWeightStr(t);
                  setError(null);
                }}
                keyboardType="decimal-pad"
                placeholder="Ex: 82.5"
                placeholderTextColor={colors.textDimmed}
                maxLength={10}
              />
              <Text style={[styles.unit, { color: colors.primary }]}>kg</Text>
            </View>
          </View>

          {/* Measurements Box */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Medidas & Gordura</Text>

            {/* BF% */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Gordura Corporal (%)
              </Text>
              <View
                style={[
                  styles.inputRow,
                  { backgroundColor: colors.surfaceMuted, borderColor: colors.cardBorder },
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
                  maxLength={10}
                />
                <Text style={[styles.unit, { color: colors.fat }]}>%</Text>
              </View>
            </View>

            {/* Waist */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Cintura (cm)</Text>
              <View
                style={[
                  styles.inputRow,
                  { backgroundColor: colors.surfaceMuted, borderColor: colors.cardBorder },
                ]}
              >
                <TextInput
                  style={[styles.input, { color: colors.textPrimary }]}
                  value={waistStr}
                  onChangeText={(t) => {
                    setWaistStr(t);
                    setError(null);
                  }}
                  keyboardType="decimal-pad"
                  placeholder="Ex: 82.0"
                  placeholderTextColor={colors.textDimmed}
                  maxLength={10}
                />
                <Text style={[styles.unit, { color: colors.textSecondary }]}>cm</Text>
              </View>
            </View>

            {/* Chest */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Tórax (cm)</Text>
              <View
                style={[
                  styles.inputRow,
                  { backgroundColor: colors.surfaceMuted, borderColor: colors.cardBorder },
                ]}
              >
                <TextInput
                  style={[styles.input, { color: colors.textPrimary }]}
                  value={chestStr}
                  onChangeText={(t) => {
                    setChestStr(t);
                    setError(null);
                  }}
                  keyboardType="decimal-pad"
                  placeholder="Ex: 104.0"
                  placeholderTextColor={colors.textDimmed}
                  maxLength={10}
                />
                <Text style={[styles.unit, { color: colors.textSecondary }]}>cm</Text>
              </View>
            </View>

            {/* Arms */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Braço (cm)</Text>
              <View
                style={[
                  styles.inputRow,
                  { backgroundColor: colors.surfaceMuted, borderColor: colors.cardBorder },
                ]}
              >
                <TextInput
                  style={[styles.input, { color: colors.textPrimary }]}
                  value={armsStr}
                  onChangeText={(t) => {
                    setArmsStr(t);
                    setError(null);
                  }}
                  keyboardType="decimal-pad"
                  placeholder="Ex: 38.5"
                  placeholderTextColor={colors.textDimmed}
                  maxLength={10}
                />
                <Text style={[styles.unit, { color: colors.textSecondary }]}>cm</Text>
              </View>
            </View>

            {/* Legs */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Coxa (cm)</Text>
              <View
                style={[
                  styles.inputRow,
                  { backgroundColor: colors.surfaceMuted, borderColor: colors.cardBorder },
                ]}
              >
                <TextInput
                  style={[styles.input, { color: colors.textPrimary }]}
                  value={legsStr}
                  onChangeText={(t) => {
                    setLegsStr(t);
                    setError(null);
                  }}
                  keyboardType="decimal-pad"
                  placeholder="Ex: 58.0"
                  placeholderTextColor={colors.textDimmed}
                  maxLength={10}
                />
                <Text style={[styles.unit, { color: colors.textSecondary }]}>cm</Text>
              </View>
            </View>
          </View>

          {error && <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>}

          {/* Save Button */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleSave}
            disabled={saving}
            style={[styles.saveBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.saveBtnText}>{saving ? 'Salvando...' : 'Salvar Registro'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    padding: 6,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerSpacer: {
    width: 60,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  dateSubtitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 48,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  bigInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
  },
  unit: {
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  saveBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
