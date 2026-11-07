import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { DarkTheme } from '../../constants/theme';
import { FoodItem, MealType } from '../../types/domain';
import { MEAL_TYPE_NAMES } from '../../utils/nutrition';
import { Button } from '../ui/Button';

export interface ServingSizeModalProps {
  visible: boolean;
  food: FoodItem | null;
  mealType: MealType;
  initialGrams?: number;
  onClose: () => void;
  onConfirm: (entry: {
    food: FoodItem;
    mealType: MealType;
    servingGrams: number;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }) => Promise<void> | void;
}

const ALL_MEALS: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner', 'supper'];

interface ServingSizeModalContentProps {
  food: FoodItem;
  mealType: MealType;
  initialGrams?: number;
  onClose: () => void;
  onConfirm: ServingSizeModalProps['onConfirm'];
}

const ServingSizeModalContent: React.FC<ServingSizeModalContentProps> = ({
  food,
  mealType: initialMealType,
  initialGrams = 100,
  onClose,
  onConfirm,
}) => {
  const [grams, setGrams] = useState<number>(initialGrams || food.servingGrams || 100);
  const [selectedMeal, setSelectedMeal] = useState<MealType>(initialMealType);
  const [saving, setSaving] = useState(false);

  const baseGrams = food.servingGrams > 0 ? food.servingGrams : 100;
  const ratio = (grams > 0 ? grams : 0) / baseGrams;

  const liveCalories = Number((food.calories * ratio).toFixed(1));
  const liveProtein = Number((food.protein * ratio).toFixed(1));
  const liveCarbs = Number((food.carbs * ratio).toFixed(1));
  const liveFat = Number((food.fat * ratio).toFixed(1));

  const handleConfirm = async () => {
    if (grams <= 0 || saving) return;
    setSaving(true);
    try {
      await onConfirm({
        food,
        mealType: selectedMeal,
        servingGrams: grams,
        calories: liveCalories,
        protein: liveProtein,
        carbs: liveCarbs,
        fat: liveFat,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.backdrop}
    >
      <View style={styles.sheetContainer}>
        <View style={styles.dragHandle} />

        <Text style={styles.foodTitle} numberOfLines={2}>
          {food.name}
        </Text>
        <Text style={styles.foodSubtitle}>
          Base: {baseGrams}g • {food.calories} kcal ({food.source.toUpperCase()})
        </Text>

        {/* Meal Type Selector Chips */}
        <Text style={styles.sectionLabel}>REFEIÇÃO:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mealScroll}>
          {ALL_MEALS.map((mt) => (
            <TouchableOpacity
              key={mt}
              style={[styles.mealChip, selectedMeal === mt && styles.mealChipActive]}
              onPress={() => setSelectedMeal(mt)}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.mealChipText, selectedMeal === mt && styles.mealChipTextActive]}
              >
                {MEAL_TYPE_NAMES[mt]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Portion Stepper & Input */}
        <Text style={styles.sectionLabel}>QUANTIDADE:</Text>
        <View style={styles.inputRow}>
          <TouchableOpacity
            style={styles.stepperBtn}
            onPress={() => setGrams((g) => Math.max(1, g - 10))}
            activeOpacity={0.7}
          >
            <Text style={styles.stepperText}>-10</Text>
          </TouchableOpacity>

          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.gramInput}
              value={String(grams || '')}
              onChangeText={(t) => setGrams(Number(t.replace(/[^0-9]/g, '')) || 0)}
              keyboardType="numeric"
              selectTextOnFocus
            />
            <Text style={styles.gramSuffix}>g</Text>
          </View>

          <TouchableOpacity
            style={styles.stepperBtn}
            onPress={() => setGrams((g) => g + 10)}
            activeOpacity={0.7}
          >
            <Text style={styles.stepperText}>+10</Text>
          </TouchableOpacity>
        </View>

        {/* Preset Chips */}
        <View style={styles.presetRow}>
          {[50, 100, 150, 200].map((preset) => (
            <TouchableOpacity
              key={preset}
              style={[styles.presetChip, grams === preset && styles.presetChipActive]}
              onPress={() => setGrams(preset)}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.presetText, grams === preset && styles.presetTextActive]}
              >
                {preset}g
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recalculated Nutrition Box */}
        <View style={styles.nutritionBox}>
          <View style={styles.macroCell}>
            <Text style={styles.cellVal}>{liveCalories}</Text>
            <Text style={styles.cellLbl}>kcal</Text>
          </View>
          <View style={styles.macroCell}>
            <Text style={styles.cellVal}>{liveProtein}g</Text>
            <Text style={styles.cellLbl}>Proteína</Text>
          </View>
          <View style={styles.macroCell}>
            <Text style={styles.cellVal}>{liveCarbs}g</Text>
            <Text style={styles.cellLbl}>Carbos</Text>
          </View>
          <View style={styles.macroCell}>
            <Text style={styles.cellVal}>{liveFat}g</Text>
            <Text style={styles.cellLbl}>Gordura</Text>
          </View>
        </View>

        {/* Buttons */}
        <Button
          title={`Adicionar ao ${MEAL_TYPE_NAMES[selectedMeal]} (${liveCalories} kcal)`}
          onPress={handleConfirm}
          loading={saving}
          variant="primary"
        />
        <Button
          title="Cancelar"
          onPress={onClose}
          variant="ghost"
          style={styles.cancelBtn}
        />
      </View>
    </KeyboardAvoidingView>
  );
};

export const ServingSizeModal: React.FC<ServingSizeModalProps> = ({
  visible,
  food,
  mealType,
  initialGrams,
  onClose,
  onConfirm,
}) => {
  if (!visible || !food) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <ServingSizeModalContent
        key={`${food.id}-${mealType}-${initialGrams}`}
        food={food}
        mealType={mealType}
        initialGrams={initialGrams}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: DarkTheme.colors.card,
    borderTopLeftRadius: DarkTheme.borderRadius.lg,
    borderTopRightRadius: DarkTheme.borderRadius.lg,
    borderColor: DarkTheme.colors.cardBorder,
    borderWidth: 1,
    padding: DarkTheme.spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: DarkTheme.colors.cardBorder,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  foodTitle: {
    color: DarkTheme.colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  foodSubtitle: {
    color: DarkTheme.colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
    marginBottom: 16,
  },
  sectionLabel: {
    color: DarkTheme.colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  mealScroll: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  mealChip: {
    backgroundColor: DarkTheme.colors.surfaceMuted,
    borderColor: DarkTheme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: DarkTheme.borderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  mealChipActive: {
    backgroundColor: DarkTheme.colors.primaryMuted,
    borderColor: DarkTheme.colors.primary,
  },
  mealChipText: {
    color: DarkTheme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  mealChipTextActive: {
    color: DarkTheme.colors.primary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  stepperBtn: {
    width: 48,
    height: 46,
    backgroundColor: DarkTheme.colors.surfaceMuted,
    borderColor: DarkTheme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: DarkTheme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperText: {
    color: DarkTheme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DarkTheme.colors.surfaceMuted,
    borderColor: DarkTheme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: DarkTheme.borderRadius.md,
    paddingHorizontal: 12,
    height: 46,
  },
  gramInput: {
    flex: 1,
    color: DarkTheme.colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  gramSuffix: {
    color: DarkTheme.colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  presetChip: {
    flex: 1,
    backgroundColor: DarkTheme.colors.surfaceMuted,
    borderColor: DarkTheme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: DarkTheme.borderRadius.sm,
    paddingVertical: 6,
    alignItems: 'center',
  },
  presetChipActive: {
    borderColor: DarkTheme.colors.primary,
    backgroundColor: DarkTheme.colors.primaryMuted,
  },
  presetText: {
    color: DarkTheme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  presetTextActive: {
    color: DarkTheme.colors.primary,
  },
  nutritionBox: {
    flexDirection: 'row',
    backgroundColor: DarkTheme.colors.surfaceMuted,
    borderRadius: DarkTheme.borderRadius.md,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginBottom: 16,
    justifyContent: 'space-around',
  },
  macroCell: {
    alignItems: 'center',
  },
  cellVal: {
    color: DarkTheme.colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  cellLbl: {
    color: DarkTheme.colors.textDimmed,
    fontSize: 11,
    marginTop: 2,
  },
  cancelBtn: {
    marginTop: 6,
  },
});
