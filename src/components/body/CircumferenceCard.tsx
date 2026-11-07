import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { BodyLog } from '../../types/domain';
import { useTheme } from '../../hooks/useTheme';

export interface CircumferenceCardProps {
  currentLog: BodyLog | null;
  onOpenMeasurements: () => void;
}

export const CircumferenceCard: React.FC<CircumferenceCardProps> = ({
  currentLog,
  onOpenMeasurements,
}) => {
  const { colors } = useTheme();

  const measurements = [
    { label: 'Cintura', value: currentLog?.waistCm, icon: '📏' },
    { label: 'Tórax', value: currentLog?.chestCm, icon: '📐' },
    { label: 'Braço', value: currentLog?.armsCm, icon: '💪' },
    { label: 'Coxa', value: currentLog?.legsCm, icon: '🦵' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Medidas Corporais</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Circunferências em centímetros (cm)
          </Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onOpenMeasurements}
          style={[styles.editBtn, { backgroundColor: colors.surfaceMuted, borderColor: colors.cardBorder }]}
        >
          <Text style={[styles.editBtnText, { color: colors.primary }]}>Atualizar</Text>
        </TouchableOpacity>
      </View>

      {/* Grid of Measurements */}
      <View style={styles.grid}>
        {measurements.map((item, idx) => (
          <View
            key={idx}
            style={[
              styles.gridItem,
              { backgroundColor: colors.surfaceMuted, borderColor: colors.cardBorder },
            ]}
          >
            <View style={styles.itemHeader}>
              <Text style={styles.itemIcon}>{item.icon}</Text>
              <Text style={[styles.itemLabel, { color: colors.textSecondary }]}>{item.label}</Text>
            </View>
            <Text style={[styles.itemValue, { color: colors.textPrimary }]}>
              {item.value !== undefined && item.value !== null ? `${item.value.toFixed(1)}` : '—'}
              <Text style={[styles.itemUnit, { color: colors.textDimmed }]}> cm</Text>
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  editBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gridItem: {
    width: '48%',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  itemIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  itemLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  itemValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  itemUnit: {
    fontSize: 13,
    fontWeight: '500',
  },
});
