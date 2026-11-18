import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { WeightHistoryPoint } from '../../types/domain';
import { ChartRange } from '../../context/BodyContext';
import { mapWeightHistoryToChart, summarizeWeightHistory } from '../../utils/body';
import { useTheme } from '../../hooks/useTheme';

export interface WeightTrendChartProps {
  history: WeightHistoryPoint[];
  selectedRange: ChartRange;
  onSelectRange: (range: ChartRange) => void;
}

const RANGES: { key: ChartRange; label: string }[] = [
  { key: '1M', label: '1M' },
  { key: '3M', label: '3M' },
  { key: '6M', label: '6M' },
  { key: '1Y', label: '1A' },
  { key: 'ALL', label: 'TUDO' },
];

const MAX_CHART_BARS = 7;

export const WeightTrendChart: React.FC<WeightTrendChartProps> = ({
  history,
  selectedRange,
  onSelectRange,
}) => {
  const { colors } = useTheme();
  const validCount = history.filter((p) => p.weightKg > 0).length;
  const isSummarized = validCount > MAX_CHART_BARS;
  const fullData = mapWeightHistoryToChart(history, Math.max(30, history.length));
  const summarizedHistory = summarizeWeightHistory(history, MAX_CHART_BARS);
  const chartData = mapWeightHistoryToChart(summarizedHistory, MAX_CHART_BARS);

  const { currentWeight, currentMA, weightDeltaVsMA, trendDirection } = fullData;
  const { points, yTicks } = chartData;

  const hasData = points.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      {/* Header with Title */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Tendência de Peso</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {isSummarized
            ? 'Média por subperíodo vs Média móvel 7D'
            : 'Pesagem diária vs Média móvel 7D'}
        </Text>
      </View>

      {/* Dedicated Row for Range Chips */}
      <View style={styles.rangeChipsRow}>
        {RANGES.map((r) => {
          const isSelected = selectedRange === r.key;
          return (
            <TouchableOpacity
              key={r.key}
              activeOpacity={0.7}
              onPress={() => onSelectRange(r.key)}
              style={[
                styles.rangeChip,
                {
                  backgroundColor: isSelected ? colors.primary : colors.surfaceMuted,
                  borderColor: isSelected ? colors.primary : colors.cardBorder,
                },
              ]}
            >
              <Text
                style={[
                  styles.rangeText,
                  {
                    color: isSelected ? '#FFFFFF' : colors.textSecondary,
                    fontWeight: isSelected ? '700' : '500',
                  },
                ]}
              >
                {r.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Metrics Row */}
      {hasData && (
        <View style={[styles.metricsRow, { borderBottomColor: colors.cardBorder }]}>
          <View style={styles.metricItem}>
            <Text style={[styles.metricLabel, { color: colors.textDimmed }]}>Último Peso</Text>
            <Text style={[styles.metricValue, { color: colors.textPrimary }]}>
              {currentWeight !== null ? `${currentWeight.toFixed(1)} kg` : '—'}
            </Text>
          </View>

          <View style={styles.metricItem}>
            <Text style={[styles.metricLabel, { color: colors.textDimmed }]}>Média 7D</Text>
            <Text style={[styles.metricValue, { color: colors.primary }]}>
              {currentMA !== null ? `${currentMA.toFixed(1)} kg` : '—'}
            </Text>
          </View>

          <View style={styles.metricItem}>
            <Text style={[styles.metricLabel, { color: colors.textDimmed }]}>Oscilação vs MA</Text>
            <Text
              style={[
                styles.metricValue,
                {
                  color:
                    weightDeltaVsMA === null
                      ? colors.textDimmed
                      : weightDeltaVsMA > 0
                      ? colors.calories
                      : colors.primary,
                },
              ]}
            >
              {weightDeltaVsMA !== null
                ? `${weightDeltaVsMA > 0 ? '+' : ''}${weightDeltaVsMA.toFixed(1)} kg`
                : '—'}
            </Text>
          </View>

          <View style={styles.metricItem}>
            <Text style={[styles.metricLabel, { color: colors.textDimmed }]}>Tendência</Text>
            <View style={[styles.trendBadge, { backgroundColor: colors.surfaceMuted }]}>
              <Text style={[styles.trendText, { color: colors.textPrimary }]}>
                {trendDirection === 'down'
                  ? '📉 Queda'
                  : trendDirection === 'up'
                  ? '📈 Alta'
                  : '➡️ Estável'}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Chart Canvas */}
      {!hasData ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.textDimmed }]}>
            Nenhuma pesagem registrada no período selecionado.
          </Text>
        </View>
      ) : (
        <View style={styles.canvasContainer}>
          {/* Y Axis Ticks */}
          <View style={styles.yAxis}>
            {yTicks.map((val, idx) => (
              <Text key={idx} style={[styles.yTickText, { color: colors.textDimmed }]}>
                {val.toFixed(1)}
              </Text>
            ))}
          </View>

          {/* Plot Area + Synchronized X Axis Labels */}
          <View style={styles.plotAndAxis}>
            <View
              pointerEvents="none"
              style={[styles.plotBackdrop, { borderColor: colors.cardBorder }]}
            >
              <View style={[styles.guideline, { top: '0%', borderColor: colors.cardBorder }]} />
              <View style={[styles.guideline, { top: '33%', borderColor: colors.cardBorder }]} />
              <View style={[styles.guideline, { top: '66%', borderColor: colors.cardBorder }]} />
              <View style={[styles.guideline, { top: '100%', borderColor: colors.cardBorder }]} />
            </View>

            <View style={styles.columnsRow}>
              {points.map((pt, idx) => {
                const isLatest = idx === points.length - 1;
                const heightPct = Math.max(8, Math.min(100, pt.yWeightPct));
                const maBottomPct =
                  pt.yMAPct !== null ? Math.max(4, Math.min(96, pt.yMAPct)) : null;

                return (
                  <View key={`${pt.date}-${idx}`} style={styles.barCol}>
                    <View style={styles.barSlot}>
                      {/* Weight Value above bar */}
                      <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.75}
                        style={[
                          styles.barValueText,
                          {
                            bottom: `${heightPct}%`,
                            color: isLatest ? colors.primary : colors.textSecondary,
                            fontWeight: isLatest ? '700' : '600',
                          },
                        ]}
                      >
                        {pt.weightKg.toFixed(1)}
                      </Text>

                      {/* MA Dot indicator */}
                      {maBottomPct !== null && (
                        <View
                          style={[
                            styles.maIndicator,
                            {
                              bottom: `${maBottomPct}%`,
                              backgroundColor: colors.primary,
                            },
                          ]}
                        />
                      )}

                      {/* Weight Bar */}
                      <View
                        style={[
                          styles.barFill,
                          {
                            height: `${heightPct}%`,
                            backgroundColor: isLatest ? colors.primary : colors.surfaceMuted,
                          },
                        ]}
                      />
                    </View>

                    {/* Date Label directly beneath the registered weight bar */}
                    <View style={styles.xLabelSlot}>
                      <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.75}
                        style={[
                          styles.xLabelText,
                          {
                            color: isLatest ? colors.textPrimary : colors.textDimmed,
                            fontWeight: isLatest ? '700' : '500',
                          },
                        ]}
                      >
                        {pt.label}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      )}

      {/* Legend */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendSquare, { backgroundColor: colors.surfaceMuted }]} />
          <Text style={[styles.legendLabel, { color: colors.textSecondary }]}>
            Pesagem do Dia
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
          <Text style={[styles.legendLabel, { color: colors.textSecondary }]}>
            Média Móvel (7 Dias)
          </Text>
        </View>
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
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  rangeChipsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 6,
  },
  rangeChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  rangeText: {
    fontSize: 11,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
  },
  metricItem: {
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  trendBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
  },
  canvasContainer: {
    flexDirection: 'row',
    height: 200,
    marginTop: 4,
  },
  yAxis: {
    width: 38,
    height: '100%',
    paddingTop: 18,
    paddingBottom: 22,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingRight: 4,
  },
  yTickText: {
    fontSize: 10,
    fontWeight: '500',
  },
  plotAndAxis: {
    flex: 1,
    height: '100%',
    position: 'relative',
  },
  plotBackdrop: {
    position: 'absolute',
    top: 18,
    left: 0,
    right: 0,
    height: 160,
    borderLeftWidth: 1,
    borderBottomWidth: 1,
  },
  guideline: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    opacity: 0.25,
  },
  columnsRow: {
    flex: 1,
    flexDirection: 'row',
    paddingTop: 18,
    paddingHorizontal: 4,
  },
  barCol: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    marginHorizontal: 2,
  },
  barSlot: {
    width: '100%',
    height: 160,
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  barValueText: {
    position: 'absolute',
    left: -2,
    right: -2,
    textAlign: 'center',
    fontSize: 10,
    marginBottom: 3,
    zIndex: 12,
  },
  barFill: {
    width: '65%',
    maxWidth: 20,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  maIndicator: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 3.5,
    zIndex: 10,
  },
  xLabelSlot: {
    width: '100%',
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  xLabelText: {
    fontSize: 10,
    textAlign: 'center',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 10,
    paddingTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendSquare: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
});
