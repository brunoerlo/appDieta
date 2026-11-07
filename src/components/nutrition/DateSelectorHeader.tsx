import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { DarkTheme } from '../../constants/theme';
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
      </View>

      <TouchableOpacity
        accessibilityLabel="Próximo dia"
        onPress={handleNextDay}
        style={styles.arrowButton}
        activeOpacity={0.7}
      >
        <Text style={styles.arrowText}>›</Text>
      </TouchableOpacity>

      {!isToday && (
        <TouchableOpacity
          accessibilityLabel="Ir para hoje"
          onPress={onResetToToday}
          style={styles.todayButton}
          activeOpacity={0.7}
        >
          <Text style={styles.todayButtonText}>Hoje</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: DarkTheme.spacing.md,
    paddingVertical: DarkTheme.spacing.sm,
    backgroundColor: DarkTheme.colors.background,
  },
  arrowButton: {
    width: 38,
    height: 38,
    borderRadius: DarkTheme.borderRadius.full,
    backgroundColor: DarkTheme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: {
    color: DarkTheme.colors.textPrimary,
    fontSize: 24,
    fontWeight: '600',
    marginTop: -2,
  },
  centerSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: DarkTheme.spacing.sm,
  },
  dateText: {
    color: DarkTheme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  todayButton: {
    position: 'absolute',
    right: DarkTheme.spacing.md,
    backgroundColor: DarkTheme.colors.primaryMuted,
    borderColor: DarkTheme.colors.primary,
    borderWidth: 1,
    borderRadius: DarkTheme.borderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  todayButtonText: {
    color: DarkTheme.colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
});
