import React, { useState, useMemo, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { spacing, borderRadius, ThemeColors } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { DietLogEntry } from '../../types/domain';
import { isBeverageEntry } from '../../utils/nutrition';
import { Button } from '../ui/Button';

export interface PortionEditModalProps {
  visible: boolean;
  entry: DietLogEntry | null;
  onSave: (
    id: string,
    updated: {
      servingGrams: number;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
    }
  ) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
  onClose: () => void;
}

interface PortionEditModalContentProps {
  entry: DietLogEntry;
  onSave: PortionEditModalProps['onSave'];
  onDelete: PortionEditModalProps['onDelete'];
  onClose: () => void;
}

const PortionEditModalContent: React.FC<PortionEditModalContentProps> = ({
  entry,
  onSave,
  onDelete,
  onClose,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [gramsInput, setGramsInput] = useState<string>(String(entry.servingGrams || ''));
  const [saving, setSaving] = useState<boolean>(false);
  const isSubmittingRef = useRef<boolean>(false);

  const parsedGrams = Number(gramsInput.trim().replace(',', '.'));
  const grams =
    gramsInput.trim() !== '' && Number.isFinite(parsedGrams) && parsedGrams > 0
      ? Math.min(10000, parsedGrams)
      : 0;

  const isDrink = isBeverageEntry(entry);
  const unitLabel = isDrink ? 'ml' : 'g';
  const chips = isDrink
    ? [
        { label: '-50ml', delta: -50 },
        { label: '+50ml', delta: 50 },
        { label: '+100ml', delta: 100 },
      ]
    : [
        { label: '-10g', delta: -10 },
        { label: '+10g', delta: 10 },
        { label: '+50g', delta: 50 },
      ];

  const baseGrams = entry.servingGrams > 0 ? entry.servingGrams : 100;
  const ratio = (grams > 0 ? grams : 0) / baseGrams;

  const liveCalories = Number((entry.calories * ratio).toFixed(1));
  const liveProtein = Number((entry.protein * ratio).toFixed(1));
  const liveCarbs = Number((entry.carbs * ratio).toFixed(1));
  const liveFat = Number((entry.fat * ratio).toFixed(1));

  const handleGramsTextChange = (t: string) => {
    const cleaned = t.replace(',', '.').replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    const normalized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleaned;
    setGramsInput(normalized);
  };

  const handleSave = async () => {
    if (isSubmittingRef.current || saving) return;
    if (!Number.isFinite(parsedGrams) || parsedGrams < 0.1 || parsedGrams > 10000) {
      Alert.alert(
        'Porção inválida',
        `Informe uma quantidade válida entre 0,1 e 10.000 ${unitLabel}.`
      );
      return;
    }

    isSubmittingRef.current = true;
    setSaving(true);
    try {
      await onSave(entry.id, {
        servingGrams: Number(parsedGrams.toFixed(1)),
        calories: liveCalories,
        protein: liveProtein,
        carbs: liveCarbs,
        fat: liveFat,
      });
      onClose();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível salvar as alterações.');
    } finally {
      isSubmittingRef.current = false;
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (isSubmittingRef.current || saving) return;
    isSubmittingRef.current = true;
    setSaving(true);
    try {
      await onDelete(entry.id);
      onClose();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível excluir o alimento.');
    } finally {
      isSubmittingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.backdrop}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Ajustar Porção</Text>
        <Text style={styles.foodName} numberOfLines={2}>
          {entry.foodName}
        </Text>

        {/* Quantity Input */}
        <Text style={styles.label}>Quantidade consumida ({isDrink ? 'ml' : 'gramas'}):</Text>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={gramsInput}
            onChangeText={handleGramsTextChange}
            keyboardType="decimal-pad"
            selectTextOnFocus
            maxLength={10}
          />
          <Text style={styles.suffix}>{unitLabel}</Text>
        </View>

        {/* Quick Increment Chips */}
        <View style={styles.chipsRow}>
          {chips.map((c) => (
            <TouchableOpacity
              key={c.label}
              style={styles.chip}
              disabled={saving}
              onPress={() => {
                const next = Math.min(10000, Math.max(0.1, Number((grams + c.delta).toFixed(1))));
                setGramsInput(String(next));
              }}
            >
              <Text style={styles.chipText}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recalculated Nutrition Preview */}
        <View style={styles.previewBox}>
          <Text style={styles.previewTitle}>Valores Recalculados:</Text>
          <View style={styles.previewGrid}>
            <View style={styles.previewItem}>
              <Text style={styles.previewValue}>{liveCalories}</Text>
              <Text style={styles.previewLabel}>kcal</Text>
            </View>
            <View style={styles.previewItem}>
              <Text style={styles.previewValue}>{liveProtein}g</Text>
              <Text style={styles.previewLabel}>Proteína</Text>
            </View>
            <View style={styles.previewItem}>
              <Text style={styles.previewValue}>{liveCarbs}g</Text>
              <Text style={styles.previewLabel}>Carbos</Text>
            </View>
            <View style={styles.previewItem}>
              <Text style={styles.previewValue}>{liveFat}g</Text>
              <Text style={styles.previewLabel}>Gordura</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonStack}>
          <Button
            title="Salvar Alterações"
            onPress={handleSave}
            loading={saving}
            variant="primary"
          />
          <Button
            title="Excluir Alimento"
            onPress={handleDelete}
            disabled={saving}
            variant="destructive"
            style={styles.spacingBtn}
          />
          <Button
            title="Cancelar"
            onPress={onClose}
            disabled={saving}
            variant="ghost"
            style={styles.spacingBtn}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

export const PortionEditModal: React.FC<PortionEditModalProps> = ({
  visible,
  entry,
  onSave,
  onDelete,
  onClose,
}) => {
  if (!visible || !entry) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <PortionEditModalContent
        key={`${entry.id}-${entry.servingGrams}`}
        entry={entry}
        onSave={onSave}
        onDelete={onDelete}
        onClose={onClose}
      />
    </Modal>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.lg,
    },
    card: {
      backgroundColor: colors.card,
      borderColor: colors.cardBorder,
      borderWidth: 1,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      width: '100%',
      maxWidth: 380,
    },
    title: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    foodName: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: '700',
      marginTop: 4,
      marginBottom: 16,
    },
    label: {
      color: colors.textSecondary,
      fontSize: 13,
      marginBottom: 8,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.cardBorder,
      borderWidth: 1,
      borderRadius: borderRadius.md,
      paddingHorizontal: 12,
      marginBottom: 10,
    },
    input: {
      flex: 1,
      height: 46,
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: '700',
    },
    suffix: {
      color: colors.textSecondary,
      fontSize: 16,
      fontWeight: '600',
    },
    chipsRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
    },
    chip: {
      flex: 1,
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.cardBorder,
      borderWidth: 1,
      borderRadius: borderRadius.sm,
      paddingVertical: 6,
      alignItems: 'center',
    },
    chipText: {
      color: colors.textPrimary,
      fontSize: 12,
      fontWeight: '600',
    },
    previewBox: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: borderRadius.md,
      padding: 12,
      marginBottom: 16,
    },
    previewTitle: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '600',
      marginBottom: 8,
    },
    previewGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    previewItem: {
      alignItems: 'center',
    },
    previewValue: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: '700',
    },
    previewLabel: {
      color: colors.textDimmed,
      fontSize: 11,
      marginTop: 2,
    },
    buttonStack: {
      gap: 8,
    },
    spacingBtn: {
      marginTop: 2,
    },
  });

