import React, { useState, useMemo, useRef } from 'react';
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
  Alert,
} from 'react-native';
import { spacing, borderRadius, ThemeColors } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
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
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const initialVal = initialGrams || food.servingGrams || 100;
  const [gramsInput, setGramsInput] = useState<string>(String(initialVal));
  const [selectedMeal, setSelectedMeal] = useState<MealType>(
    ALL_MEALS.includes(initialMealType) ? initialMealType : 'lunch'
  );
  const [saving, setSaving] = useState(false);
  const isSubmittingRef = useRef(false);

  const parsedGrams = Number(gramsInput.trim().replace(',', '.'));
  const grams =
    gramsInput.trim() !== '' && Number.isFinite(parsedGrams) && parsedGrams > 0
      ? Math.min(10000, parsedGrams)
      : 0;

  const isDrink =
    food.category === 'Bebidas' ||
    (food.servingUnitName && food.servingUnitName.includes('ml')) ||
    food.id.startsWith('drink-');
  const unitLabel = isDrink ? 'ml' : 'g';
  const presets = isDrink ? [100, 200, 350, 500] : [50, 100, 150, 200];

  const baseGrams = food.servingGrams > 0 ? food.servingGrams : 100;
  const ratio = (grams > 0 ? grams : 0) / baseGrams;

  const liveCalories = Number((food.calories * ratio).toFixed(1));
  const liveProtein = Number((food.protein * ratio).toFixed(1));
  const liveCarbs = Number((food.carbs * ratio).toFixed(1));
  const liveFat = Number((food.fat * ratio).toFixed(1));

  const handleGramsTextChange = (t: string) => {
    const cleaned = t.replace(',', '.').replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    const normalized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleaned;
    setGramsInput(normalized);
  };

  const handleConfirm = async () => {
    if (isSubmittingRef.current || saving) return;
    if (!Number.isFinite(parsedGrams) || parsedGrams < 0.1 || parsedGrams > 10000) {
      Alert.alert(
        'Quantidade inválida',
        `Informe uma quantidade válida entre 0,1 e 10.000 ${unitLabel}.`
      );
      return;
    }

    isSubmittingRef.current = true;
    setSaving(true);
    try {
      await onConfirm({
        food,
        mealType: selectedMeal,
        servingGrams: Number(parsedGrams.toFixed(1)),
        calories: liveCalories,
        protein: liveProtein,
        carbs: liveCarbs,
        fat: liveFat,
      });
      onClose();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível adicionar o alimento.');
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
      <View style={styles.sheetContainer}>
        <View style={styles.dragHandle} />

        <Text style={styles.foodTitle} numberOfLines={2}>
          {food.name}
        </Text>
        <Text style={styles.foodSubtitle}>
          Base: {baseGrams}{unitLabel} • {food.calories} kcal ({food.source.toUpperCase()})
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
            onPress={() => {
              const next = Math.max(0.1, Number((grams - 10).toFixed(1)));
              setGramsInput(String(next));
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.stepperText}>-10</Text>
          </TouchableOpacity>

          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.gramInput}
              value={gramsInput}
              onChangeText={handleGramsTextChange}
              keyboardType="decimal-pad"
              selectTextOnFocus
              maxLength={10}
            />
            <Text style={styles.gramSuffix}>{unitLabel}</Text>
          </View>

          <TouchableOpacity
            style={styles.stepperBtn}
            onPress={() => {
              const next = Math.min(10000, Number((grams + 10).toFixed(1)));
              setGramsInput(String(next));
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.stepperText}>+10</Text>
          </TouchableOpacity>
        </View>

        {/* Preset Chips */}
        <View style={styles.presetRow}>
          {presets.map((preset) => (
            <TouchableOpacity
              key={preset}
              style={[styles.presetChip, grams === preset && styles.presetChipActive]}
              onPress={() => setGramsInput(String(preset))}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.presetText, grams === preset && styles.presetTextActive]}
              >
                {preset}{unitLabel}
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
          disabled={saving}
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

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      justifyContent: 'flex-end',
    },
    sheetContainer: {
      backgroundColor: colors.card,
      borderTopLeftRadius: borderRadius.lg,
      borderTopRightRadius: borderRadius.lg,
      borderColor: colors.cardBorder,
      borderWidth: 1,
      padding: spacing.lg,
      paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    },
    dragHandle: {
      width: 40,
      height: 4,
      backgroundColor: colors.cardBorder,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: 14,
    },
    foodTitle: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: '700',
    },
    foodSubtitle: {
      color: colors.textSecondary,
      fontSize: 12,
      marginTop: 4,
      marginBottom: 16,
    },
    sectionLabel: {
      color: colors.textSecondary,
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
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.cardBorder,
      borderWidth: 1,
      borderRadius: borderRadius.full,
      paddingHorizontal: 12,
      paddingVertical: 6,
      marginRight: 8,
    },
    mealChipActive: {
      backgroundColor: colors.primaryMuted,
      borderColor: colors.primary,
    },
    mealChipText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
    mealChipTextActive: {
      color: colors.primary,
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
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.cardBorder,
      borderWidth: 1,
      borderRadius: borderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepperText: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: '700',
    },
    inputWrapper: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.cardBorder,
      borderWidth: 1,
      borderRadius: borderRadius.md,
      paddingHorizontal: 12,
      height: 46,
    },
    gramInput: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: '700',
      textAlign: 'center',
    },
    gramSuffix: {
      color: colors.textSecondary,
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
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.cardBorder,
      borderWidth: 1,
      borderRadius: borderRadius.sm,
      paddingVertical: 6,
      alignItems: 'center',
    },
    presetChipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryMuted,
    },
    presetText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
    presetTextActive: {
      color: colors.primary,
    },
    nutritionBox: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceMuted,
      borderRadius: borderRadius.md,
      paddingVertical: 12,
      paddingHorizontal: 8,
      marginBottom: 16,
      justifyContent: 'space-around',
    },
    macroCell: {
      alignItems: 'center',
    },
    cellVal: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: '700',
    },
    cellLbl: {
      color: colors.textDimmed,
      fontSize: 11,
      marginTop: 2,
    },
    cancelBtn: {
      marginTop: 6,
    },
  });

