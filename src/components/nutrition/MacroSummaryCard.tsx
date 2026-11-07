import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DarkTheme } from '../../constants/theme';
import { Card } from '../ui/Card';
import { ProgressBar } from '../ui/ProgressBar';

export interface MacroValues {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface MacroSummaryCardProps {
  consumed: MacroValues;
  targets: MacroValues;
}

export const MacroSummaryCard: React.FC<MacroSummaryCardProps> = ({
  consumed,
  targets,
}) => {
  const targetCalories = targets.calories > 0 ? targets.calories : 2000;
  const remainingCalories = Number((targetCalories - consumed.calories).toFixed(0));
  const calorieProgress = targetCalories > 0 ? consumed.calories / targetCalories : 0;

  const proteinProgress = targets.protein > 0 ? consumed.protein / targets.protein : 0;
  const carbsProgress = targets.carbs > 0 ? consumed.carbs / targets.carbs : 0;
  const fatProgress = targets.fat > 0 ? consumed.fat / targets.fat : 0;

  return (
    <Card style={styles.container}>
      {/* Header / Calorie Summary */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.eyebrow}>RESUMO DIÁRIO</Text>
          <View style={styles.calorieRow}>
            <Text style={styles.calorieValue}>
              {Math.round(consumed.calories).toLocaleString('pt-BR')}
            </Text>
            <Text style={styles.calorieTarget}>
              / {Math.round(targetCalories).toLocaleString('pt-BR')} kcal
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.remainingBadge,
            {
              backgroundColor:
                remainingCalories >= 0
                  ? DarkTheme.colors.primaryMuted
                  : DarkTheme.colors.dangerMuted,
            },
          ]}
        >
          <Text
            style={[
              styles.remainingText,
              {
                color:
                  remainingCalories >= 0
                    ? DarkTheme.colors.primary
                    : DarkTheme.colors.danger,
              },
            ]}
          >
            {remainingCalories >= 0
              ? `${remainingCalories} kcal rest.`
              : `+${Math.abs(remainingCalories)} kcal excedente`}
          </Text>
        </View>
      </View>

      {/* Main Calorie Progress Bar */}
      <View style={styles.calorieBarContainer}>
        <ProgressBar
          progress={calorieProgress}
          color={DarkTheme.colors.calories}
          trackColor={DarkTheme.colors.caloriesTrack}
          height={10}
        />
        <Text style={styles.caloriePercentText}>
          {Math.round(calorieProgress * 100)}%
        </Text>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* 3 Macro Columns */}
      <View style={styles.macrosRow}>
        {/* Protein */}
        <View style={styles.macroColumn}>
          <Text style={styles.macroTitle}>PROTEÍNA</Text>
          <Text style={styles.macroAmount}>
            {Math.round(consumed.protein)}g{' '}
            <Text style={styles.macroTarget}>/ {Math.round(targets.protein)}g</Text>
          </Text>
          <ProgressBar
            progress={proteinProgress}
            color={DarkTheme.colors.protein}
            trackColor={DarkTheme.colors.proteinTrack}
            height={6}
            style={styles.macroBar}
          />
          <Text style={styles.macroPercent}>
            {Math.round(proteinProgress * 100)}%
          </Text>
        </View>

        {/* Carbs */}
        <View style={styles.macroColumn}>
          <Text style={styles.macroTitle}>CARBOIDRATO</Text>
          <Text style={styles.macroAmount}>
            {Math.round(consumed.carbs)}g{' '}
            <Text style={styles.macroTarget}>/ {Math.round(targets.carbs)}g</Text>
          </Text>
          <ProgressBar
            progress={carbsProgress}
            color={DarkTheme.colors.carbs}
            trackColor={DarkTheme.colors.carbsTrack}
            height={6}
            style={styles.macroBar}
          />
          <Text style={styles.macroPercent}>
            {Math.round(carbsProgress * 100)}%
          </Text>
        </View>

        {/* Fat */}
        <View style={styles.macroColumn}>
          <Text style={styles.macroTitle}>GORDURA</Text>
          <Text style={styles.macroAmount}>
            {Math.round(consumed.fat)}g{' '}
            <Text style={styles.macroTarget}>/ {Math.round(targets.fat)}g</Text>
          </Text>
          <ProgressBar
            progress={fatProgress}
            color={DarkTheme.colors.fat}
            trackColor={DarkTheme.colors.fatTrack}
            height={6}
            style={styles.macroBar}
          />
          <Text style={styles.macroPercent}>
            {Math.round(fatProgress * 100)}%
          </Text>
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: DarkTheme.spacing.md,
    marginVertical: DarkTheme.spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  eyebrow: {
    color: DarkTheme.colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  calorieRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  calorieValue: {
    color: DarkTheme.colors.textPrimary,
    fontSize: 26,
    fontWeight: '800',
  },
  calorieTarget: {
    color: DarkTheme.colors.textDimmed,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  remainingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: DarkTheme.borderRadius.full,
  },
  remainingText: {
    fontSize: 12,
    fontWeight: '700',
  },
  calorieBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 10,
  },
  caloriePercentText: {
    color: DarkTheme.colors.calories,
    fontSize: 12,
    fontWeight: '700',
    width: 36,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: DarkTheme.colors.cardBorder,
    marginVertical: 14,
  },
  macrosRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  macroColumn: {
    flex: 1,
  },
  macroTitle: {
    color: DarkTheme.colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  macroAmount: {
    color: DarkTheme.colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
    marginBottom: 6,
  },
  macroTarget: {
    color: DarkTheme.colors.textDimmed,
    fontSize: 11,
    fontWeight: '500',
  },
  macroBar: {
    marginBottom: 4,
  },
  macroPercent: {
    color: DarkTheme.colors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
  },
});
