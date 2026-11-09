import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { spacing, borderRadius, ThemeColors } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { Card } from '../ui/Card';
import { FoodLogRow } from './FoodLogRow';
import { DietLogEntry, MealType } from '../../types/domain';

export interface MealCardProps {
  mealType: MealType;
  title: string;
  icon?: string;
  logs: DietLogEntry[];
  onAddFood: (mealType: MealType) => void;
  onEditLog: (entry: DietLogEntry) => void;
  onDeleteLog: (id: string) => void;
}

const DEFAULT_MEAL_ICONS: Record<MealType, string> = {
  breakfast: '☕',
  lunch: '🍽️',
  snack: '🍎',
  dinner: '🌙',
  supper: '🥛',
};

export const MealCard: React.FC<MealCardProps> = ({
  mealType,
  title,
  icon,
  logs,
  onAddFood,
  onEditLog,
  onDeleteLog,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const mealIcon = icon || DEFAULT_MEAL_ICONS[mealType] || '🍴';

  const totals = useMemo(() => {
    let calories = 0;
    let protein = 0;
    let carbs = 0;
    let fat = 0;

    for (const log of logs) {
      calories += log.calories;
      protein += log.protein;
      carbs += log.carbs;
      fat += log.fat;
    }

    return {
      calories: Math.round(calories),
      protein: Number(protein.toFixed(1)),
      carbs: Number(carbs.toFixed(1)),
      fat: Number(fat.toFixed(1)),
    };
  }, [logs]);

  return (
    <Card style={styles.container}>
      {/* Meal Header */}
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <Text style={styles.icon}>{mealIcon}</Text>
          <Text style={styles.title}>{title.toUpperCase()}</Text>
        </View>

        <Text style={styles.caloriesBadge}>
          {totals.calories > 0 ? `${totals.calories} kcal` : '(Vazio)'}
        </Text>
      </View>

      {/* Macro Subtotal Pill (if any food logged) */}
      {logs.length > 0 && (
        <View style={styles.macroPill}>
          <Text style={styles.macroText}>
            P: <Text style={styles.macroVal}>{totals.protein}g</Text> • C:{' '}
            <Text style={styles.macroVal}>{totals.carbs}g</Text> • G:{' '}
            <Text style={styles.macroVal}>{totals.fat}g</Text>
          </Text>
        </View>
      )}

      {/* Food Rows / Empty State */}
      <View style={styles.foodList}>
        {logs.length === 0 ? (
          <Text style={styles.emptyText}>
            Nenhum alimento registrado nesta refeição
          </Text>
        ) : (
          logs.map((entry) => (
            <FoodLogRow
              key={entry.id}
              entry={entry}
              onEdit={onEditLog}
              onDelete={onDeleteLog}
            />
          ))
        )}
      </View>

      {/* Add Food Button */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => onAddFood(mealType)}
        activeOpacity={0.7}
      >
        <Text style={styles.addButtonText}>+ Adicionar Alimento</Text>
      </TouchableOpacity>
    </Card>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      marginHorizontal: spacing.md,
      marginVertical: spacing.xs,
      padding: spacing.md,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    icon: {
      fontSize: 16,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    caloriesBadge: {
      color: colors.calories,
      fontSize: 13,
      fontWeight: '700',
    },
    macroPill: {
      marginTop: 4,
      marginBottom: 6,
    },
    macroText: {
      color: colors.textSecondary,
      fontSize: 11,
    },
    macroVal: {
      color: colors.textPrimary,
      fontWeight: '600',
    },
    foodList: {
      marginVertical: 4,
    },
    emptyText: {
      color: colors.textDimmed,
      fontSize: 12,
      fontStyle: 'italic',
      paddingVertical: 12,
      textAlign: 'center',
    },
    addButton: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.cardBorder,
      borderWidth: 1,
      borderRadius: borderRadius.sm,
      paddingVertical: 8,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 6,
    },
    addButtonText: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: '700',
    },
  });

