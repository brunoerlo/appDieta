import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { BodyLog } from '../../types/domain';
import { BodyCompositionResult } from '../../utils/body';
import { useTheme } from '../../hooks/useTheme';

export interface BodyCompositionCardProps {
  currentLog: BodyLog | null;
  composition: BodyCompositionResult | null;
  onOpenMeasurements: () => void;
}

export const BodyCompositionCard: React.FC<BodyCompositionCardProps> = ({
  currentLog,
  composition,
  onOpenMeasurements,
}) => {
  const { colors } = useTheme();

  const bodyFatPct = currentLog?.bodyFatPct;


  const hasBF = bodyFatPct !== undefined && bodyFatPct !== null && bodyFatPct > 0;
  const leanPct = hasBF ? Math.max(0, 100 - bodyFatPct) : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Composição Corporal</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Estimativa de Massa Magra vs Massa Gorda
          </Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onOpenMeasurements}
          style={[styles.editBtn, { backgroundColor: colors.surfaceMuted, borderColor: colors.cardBorder }]}
        >
          <Text style={[styles.editBtnText, { color: colors.primary }]}>
            {hasBF ? 'Editar' : '+ Registrar'}
          </Text>
        </TouchableOpacity>
      </View>

      {!hasBF || !composition ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.textDimmed }]}>
            Percentual de gordura corporal não informado para este dia.
          </Text>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onOpenMeasurements}
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.actionBtnText}>Registrar % de Gordura</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.content}>
          {/* Main BF% Badge */}
          <View style={styles.bfBadgeRow}>
            <Text style={[styles.bfLabel, { color: colors.textSecondary }]}>Gordura Corporal:</Text>
            <Text style={[styles.bfValue, { color: colors.fat }]}>{bodyFatPct.toFixed(1)}%</Text>
          </View>

          {/* Dual Split Cards */}
          <View style={styles.splitRow}>
            {/* Lean Mass */}
            <View
              style={[
                styles.splitCard,
                { backgroundColor: colors.surfaceMuted, borderColor: colors.protein },
              ]}
            >
              <View style={styles.splitHeader}>
                <View style={[styles.colorDot, { backgroundColor: colors.protein }]} />
                <Text style={[styles.splitTitle, { color: colors.textSecondary }]}>
                  Massa Magra
                </Text>
              </View>
              <Text style={[styles.splitNumber, { color: colors.textPrimary }]}>
                {composition.leanMassKg.toFixed(1)}
                <Text style={[styles.splitUnit, { color: colors.textDimmed }]}> kg</Text>
              </Text>
              <Text style={[styles.splitPct, { color: colors.protein }]}>
                {leanPct.toFixed(1)}% do peso
              </Text>
            </View>

            {/* Fat Mass */}
            <View
              style={[
                styles.splitCard,
                { backgroundColor: colors.surfaceMuted, borderColor: colors.fat },
              ]}
            >
              <View style={styles.splitHeader}>
                <View style={[styles.colorDot, { backgroundColor: colors.fat }]} />
                <Text style={[styles.splitTitle, { color: colors.textSecondary }]}>
                  Massa Gorda
                </Text>
              </View>
              <Text style={[styles.splitNumber, { color: colors.textPrimary }]}>
                {composition.fatMassKg.toFixed(1)}
                <Text style={[styles.splitUnit, { color: colors.textDimmed }]}> kg</Text>
              </Text>
              <Text style={[styles.splitPct, { color: colors.fat }]}>
                {bodyFatPct.toFixed(1)}% do peso
              </Text>
            </View>
          </View>

          {/* Visual Proportion Bar */}
          <View style={styles.progressTrackWrapper}>
            <View style={[styles.trackBackground, { backgroundColor: colors.fat }]}>
              <View
                style={[
                  styles.trackFill,
                  {
                    width: `${Math.min(100, Math.max(0, leanPct))}%`,
                    backgroundColor: colors.protein,
                  },
                ]}
              />
            </View>
            <View style={styles.trackLabels}>
              <Text style={[styles.trackSubtext, { color: colors.protein }]}>
                Massa Magra ({leanPct.toFixed(1)}%)
              </Text>
              <Text style={[styles.trackSubtext, { color: colors.fat }]}>
                Massa Gorda ({bodyFatPct.toFixed(1)}%)
              </Text>
            </View>
          </View>
        </View>
      )}
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
  emptyContainer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
  actionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  content: {
    marginTop: 4,
  },
  bfBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  bfLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginRight: 6,
  },
  bfValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  splitRow: {
    flexDirection: 'row',
    gap: 12,
  },
  splitCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  splitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  splitTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  splitNumber: {
    fontSize: 20,
    fontWeight: '700',
  },
  splitUnit: {
    fontSize: 14,
    fontWeight: '500',
  },
  splitPct: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: '600',
  },
  progressTrackWrapper: {
    marginTop: 14,
  },
  trackBackground: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
  },
  trackLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  trackSubtext: {
    fontSize: 10,
    fontWeight: '600',
  },
});
