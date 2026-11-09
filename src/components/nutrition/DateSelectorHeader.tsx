import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { spacing, borderRadius, ThemeColors } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { getTodayDateString, shiftDateString } from '../../utils/nutrition';

export interface DateSelectorHeaderProps {
  selectedDate: string; // ISO format 'YYYY-MM-DD'
  onSelectDate: (date: string) => void;
  onResetToToday: () => void;
}

const MONTH_NAMES_SHORT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

const WEEKDAY_NAMES_SHORT = [
  'Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'
];

export function formatDatePortuguese(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const todayStr = getTodayDateString();
  const yesterdayStr = shiftDateString(todayStr, -1);
  const tomorrowStr = shiftDateString(todayStr, 1);

  const day = d;
  const monthName = MONTH_NAMES_SHORT[m - 1] || '';

  if (dateStr === todayStr) {
    return `Hoje, ${day} de ${monthName}`;
  }
  if (dateStr === yesterdayStr) {
    return `Ontem, ${day} de ${monthName}`;
  }
  if (dateStr === tomorrowStr) {
    return `Amanhã, ${day} de ${monthName}`;
  }

  const weekday = WEEKDAY_NAMES_SHORT[target.getDay()] || '';
  return `${weekday}, ${day} de ${monthName}`;
}

export const DateSelectorHeader: React.FC<DateSelectorHeaderProps> = ({
  selectedDate,
  onSelectDate,
  onResetToToday,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isToday = selectedDate === getTodayDateString();

  const handlePrevDay = () => {
    onSelectDate(shiftDateString(selectedDate, -1));
  };

  const handleNextDay = () => {
    onSelectDate(shiftDateString(selectedDate, 1));
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        accessibilityLabel="Dia anterior"
        onPress={handlePrevDay}
        style={styles.arrowButton}
        activeOpacity={0.7}
      >
        <Text style={styles.arrowText}>‹</Text>
      </TouchableOpacity>

      <View style={styles.centerSection}>
        <Text style={styles.dateText}>{formatDatePortuguese(selectedDate)}</Text>
        {!isToday && (
          <TouchableOpacity
            accessibilityLabel="Ir para hoje"
            onPress={onResetToToday}
            style={styles.todayButton}
            activeOpacity={0.7}
          >
            <Text style={styles.todayButtonText}>Ir para Hoje</Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity
        accessibilityLabel="Próximo dia"
        onPress={handleNextDay}
        style={styles.arrowButton}
        activeOpacity={0.7}
      >
        <Text style={styles.arrowText}>›</Text>
      </TouchableOpacity>
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.background,
    },
    arrowButton: {
      width: 38,
      height: 38,
      borderRadius: borderRadius.full,
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    arrowText: {
      color: colors.textPrimary,
      fontSize: 24,
      fontWeight: '600',
      marginTop: -2,
    },
    centerSection: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.sm,
    },
    dateText: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: '700',
    },
    todayButton: {
      marginTop: 4,
      backgroundColor: colors.primaryMuted,
      borderColor: colors.primary,
      borderWidth: 1,
      borderRadius: borderRadius.full,
      paddingHorizontal: 12,
      paddingVertical: 3,
    },
    todayButtonText: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: '700',
    },
  });

