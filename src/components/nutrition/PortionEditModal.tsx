import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { DarkTheme } from '../../constants/theme';
import { DietLogEntry } from '../../types/domain';
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
  ) => void;
  onDelete: (id: string) => void;
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
  const [grams, setGrams] = useState<number>(entry.servingGrams);

  const baseGrams = entry.servingGrams > 0 ? entry.servingGrams : 100;
  const ratio = (grams > 0 ? grams : 0) / baseGrams;

  const liveCalories = Number((entry.calories * ratio).toFixed(1));
  const liveProtein = Number((entry.protein * ratio).toFixed(1));
  const liveCarbs = Number((entry.carbs * ratio).toFixed(1));
  const liveFat = Number((entry.fat * ratio).toFixed(1));

  const handleSave = () => {
    if (grams <= 0) return;
    onSave(entry.id, {
      servingGrams: grams,
      calories: liveCalories,
      protein: liveProtein,
      carbs: liveCarbs,
      fat: liveFat,
    });
    onClose();
  };

  const handleDelete = () => {
    onDelete(entry.id);
    onClose();
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

        {/* Grams Input */}
        <Text style={styles.label}>Quantidade consumida (gramas):</Text>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={String(grams || '')}
            onChangeText={(t) => setGrams(Number(t.replace(/[^0-9]/g, '')) || 0)}
            keyboardType="numeric"
            selectTextOnFocus
          />
          <Text style={styles.suffix}>g</Text>
        </View>

        {/* Quick Increment Chips */}
        <View style={styles.chipsRow}>
          <TouchableOpacity
            style={styles.chip}
            onPress={() => setGrams((g) => Math.max(1, g - 10))}
          >
            <Text style={styles.chipText}>-10g</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.chip}
            onPress={() => setGrams((g) => g + 10)}
          >
            <Text style={styles.chipText}>+10g</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.chip}
            onPress={() => setGrams((g) => g + 50)}
          >
            <Text style={styles.chipText}>+50g</Text>
          </TouchableOpacity>
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
          <Button title="Salvar Alterações" onPress={handleSave} variant="primary" />
          <Button
            title="Excluir Alimento"
            onPress={handleDelete}
            variant="destructive"
            style={styles.spacingBtn}
          />
          <Button
            title="Cancelar"
            onPress={onClose}
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

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: DarkTheme.spacing.lg,
  },
  card: {
    backgroundColor: DarkTheme.colors.card,
    borderColor: DarkTheme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: DarkTheme.borderRadius.lg,
    padding: DarkTheme.spacing.lg,
    width: '100%',
    maxWidth: 380,
  },
  title: {
    color: DarkTheme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  foodName: {
    color: DarkTheme.colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 16,
  },
  label: {
    color: DarkTheme.colors.textSecondary,
    fontSize: 13,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DarkTheme.colors.surfaceMuted,
    borderColor: DarkTheme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: DarkTheme.borderRadius.md,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  input: {
    flex: 1,
    height: 46,
    color: DarkTheme.colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  suffix: {
    color: DarkTheme.colors.textSecondary,
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
    backgroundColor: DarkTheme.colors.surfaceMuted,
    borderColor: DarkTheme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: DarkTheme.borderRadius.sm,
    paddingVertical: 6,
    alignItems: 'center',
  },
  chipText: {
    color: DarkTheme.colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  previewBox: {
    backgroundColor: DarkTheme.colors.surfaceMuted,
    borderRadius: DarkTheme.borderRadius.md,
    padding: 12,
    marginBottom: 16,
  },
  previewTitle: {
    color: DarkTheme.colors.textSecondary,
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
    color: DarkTheme.colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  previewLabel: {
    color: DarkTheme.colors.textDimmed,
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
