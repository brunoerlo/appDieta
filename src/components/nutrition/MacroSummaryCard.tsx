import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { spacing, borderRadius, ThemeColors } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
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
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

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
                  ? colors.primaryMuted
                  : colors.dangerMuted,
            },
          ]}
        >
          <Text
            style={[
              styles.remainingText,
              {
                color:
                  remainingCalories >= 0
                    ? colors.primary
                    : colors.danger,
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
          color={colors.calories}
          trackColor={colors.caloriesTrack}
          height={10}
          style={styles.calorieProgressBar}
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
            color={colors.protein}
            trackColor={colors.proteinTrack}
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
            color={colors.carbs}
            trackColor={colors.carbsTrack}
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
            color={colors.fat}
            trackColor={colors.fatTrack}
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

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      marginHorizontal: spacing.md,
      marginVertical: spacing.sm,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    eyebrow: {
      color: colors.textSecondary,
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
      color: colors.textPrimary,
      fontSize: 26,
      fontWeight: '800',
    },
    calorieTarget: {
      color: colors.textDimmed,
      fontSize: 14,
      fontWeight: '600',
      marginLeft: 6,
    },
    remainingBadge: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: borderRadius.full,
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
    calorieProgressBar: {
      flex: 1,
    },
    caloriePercentText: {
      color: colors.calories,
      fontSize: 12,
      fontWeight: '700',
      width: 36,
      textAlign: 'right',
    },
    divider: {
      height: 1,
      backgroundColor: colors.cardBorder,
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
      color: colors.textSecondary,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    macroAmount: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: '700',
      marginTop: 2,
      marginBottom: 6,
    },
    macroTarget: {
      color: colors.textDimmed,
      fontSize: 11,
      fontWeight: '500',
    },
    macroBar: {
      marginBottom: 4,
    },
    macroPercent: {
      color: colors.textSecondary,
      fontSize: 10,
      fontWeight: '600',
    },
  });

