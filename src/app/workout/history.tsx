import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ThemeColors, spacing, borderRadius } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { useWorkout } from '../../hooks/useWorkout';
import {
  mapExerciseHistoryToChart,
} from '../../utils/workout';
import { formatDatePortuguese } from '../../utils/date';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';

export default function WorkoutHistoryScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { historySessions, loadHistory, loadExerciseHistory } = useWorkout();

  const [activeTab, setActiveTab] = useState<'sessions' | 'progression'>('sessions');
  const [selectedExerciseName, setSelectedExerciseName] = useState<string>('');
  const [exerciseHistoryPoints, setExerciseHistoryPoints] = useState<any[]>([]);
  const [isLoadingPoints, setIsLoadingPoints] = useState<boolean>(false);

  useEffect(() => {
    loadHistory(50, 0);
  }, [loadHistory]);

  // Aggregate overall stats
  const totalVolumeAllSessions = useMemo(() => {
    return historySessions.reduce((acc, s) => acc + (s.totalVolumeKg || 0), 0);
  }, [historySessions]);

  const totalSetsAllSessions = useMemo(() => {
    return historySessions.reduce(
      (acc, s) => acc + (s.sets?.filter((st) => st.completed).length || 0),
      0
    );
  }, [historySessions]);

  // Extract distinct exercises performed across history
  const distinctExercises = useMemo(() => {
    const set = new Set<string>();
    for (const s of historySessions) {
      if (s.sets) {
        for (const setLog of s.sets) {
          if (setLog.exerciseName) {
            set.add(setLog.exerciseName);
          }
        }
      }
    }
    // Default classics if history is fresh
    if (set.size === 0) {
      return ['Supino Reto com Barra', 'Agachamento Livre com Barra', 'Levantamento Terra'];
    }
    return Array.from(set);
  }, [historySessions]);

  const activeExercise = selectedExerciseName || (distinctExercises[0] ?? '');

  // Load progression history for active exercise
  useEffect(() => {
    let active = true;
    if (activeExercise) {
      loadExerciseHistory(activeExercise)
        .then((pts) => {
          if (active) {
            setExerciseHistoryPoints(pts);
            setIsLoadingPoints(false);
          }
        })
        .catch(() => {
          if (active) {
            setIsLoadingPoints(false);
          }
        });
    }
    return () => {
      active = false;
    };
  }, [activeExercise, loadExerciseHistory]);

  const chartData = useMemo(() => {
    return mapExerciseHistoryToChart(exerciseHistoryPoints);
  }, [exerciseHistoryPoints]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <Text style={styles.backBtnText}>‹ Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Histórico de Treinos</Text>
        <View style={styles.backBtnPlaceholder} />
      </View>

      {/* Stats Summary Banner */}
      <View style={styles.statsBanner}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>TREINOS</Text>
          <Text style={styles.statValue}>{historySessions.length}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>VOLUME TOTAL</Text>
          <Text style={styles.statValue}>
            {totalVolumeAllSessions.toLocaleString('pt-BR')} kg
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>SÉRIES REGISTRADAS</Text>
          <Text style={styles.statValue}>
            {totalSetsAllSessions}
          </Text>
        </View>
      </View>

      {/* Segmented Control */}
      <View style={styles.segmentedContainer}>
        <TouchableOpacity
          style={[
            styles.segmentBtn,
            activeTab === 'sessions' && styles.segmentBtnActive,
          ]}
          onPress={() => setActiveTab('sessions')}
          accessibilityRole="button"
          accessibilityLabel="Aba de sessões recentes"
        >
          <Text
            style={[
              styles.segmentText,
              activeTab === 'sessions' && styles.segmentTextActive,
            ]}
          >
            Sessões Recentes ({historySessions.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.segmentBtn,
            activeTab === 'progression' && styles.segmentBtnActive,
          ]}
          onPress={() => setActiveTab('progression')}
          accessibilityRole="button"
          accessibilityLabel="Aba de evolução de cargas e 1RM"
        >
          <Text
            style={[
              styles.segmentText,
              activeTab === 'progression' && styles.segmentTextActive,
            ]}
          >
            Evolução de Cargas & 1RM
          </Text>
        </TouchableOpacity>
      </View>

      {/* TAB 1: SESSÕES RECENTES */}
      {activeTab === 'sessions' ? (
        <FlatList
          data={historySessions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const completedCount =
              item.sets?.filter((s) => s.completed).length || 0;

            // Group sets by exercise
            const grouped = new Map<string, string[]>();
            if (item.sets) {
              for (const s of item.sets) {
                if (s.completed) {
                  const list = grouped.get(s.exerciseName) || [];
                  list.push(`${s.weightKg}kg × ${s.reps}`);
                  grouped.set(s.exerciseName, list);
                }
              }
            }

            return (
              <Card style={styles.sessionCard}>
                <View style={styles.sessionHeaderRow}>
                  <Text style={styles.sessionDate}>
                    📅 {formatDatePortuguese(item.date)} ({item.date})
                  </Text>
                  <Badge
                    label={`${completedCount} ${completedCount === 1 ? 'série' : 'séries'}`}
                    color={colors.primary}
                    backgroundColor={colors.primaryMuted}
                  />
                </View>

                <Text style={styles.sessionRoutineName}>{item.routineName}</Text>

                <View style={styles.sessionMetricsRow}>
                  <Text style={styles.sessionMetricText}>
                    Volume: <Text style={styles.metricHighlight}>{(item.totalVolumeKg || 0).toLocaleString('pt-BR')} kg</Text>
                  </Text>
                  <Text style={styles.metricDot}>•</Text>
                  <Text style={styles.sessionMetricText}>
                    {grouped.size} {grouped.size === 1 ? 'exercício' : 'exercícios'}
                  </Text>
                </View>

                {grouped.size > 0 && (
                  <View style={styles.sessionExercisesBlock}>
                    {Array.from(grouped.entries()).map(([name, setStrs]) => (
                      <View key={name} style={styles.sessionExerciseLine}>
                        <Text style={styles.sessionExName}>• {name}:</Text>
                        <Text style={styles.sessionExSets}>
                          {setStrs.join(', ')}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {item.notes ? (
                  <View style={styles.sessionNotesBox}>
                    <Text style={styles.sessionNotesText}>
                      &quot;{item.notes}&quot;
                    </Text>
                  </View>
                ) : null}
              </Card>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🏋️</Text>
              <Text style={styles.emptyTitle}>Nenhum treino registrado ainda</Text>
              <Text style={styles.emptySubtitle}>
                Inicie e finalize um treino na aba Treinos para acompanhar seu histórico aqui.
              </Text>
            </View>
          }
        />
      ) : (
        /* TAB 2: EVOLUÇÃO DE CARGAS & 1RM */
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Exercise Selector Chips */}
          <Text style={styles.sectionHeader}>SELECIONAR EXERCÍCIO</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsScroll}
          >
            {distinctExercises.map((exName) => (
              <TouchableOpacity
                key={exName}
                style={[
                  styles.exChip,
                  activeExercise === exName && styles.exChipActive,
                ]}
                onPress={() => setSelectedExerciseName(exName)}
                accessibilityRole="button"
                accessibilityLabel={`Visualizar evolução de ${exName}`}
              >
                <Text
                  style={[
                    styles.exChipText,
                    activeExercise === exName && styles.exChipTextActive,
                  ]}
                >
                  {exName}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* PR Banner */}
          <Card style={styles.prCard}>
            <View style={styles.prHeader}>
              <Text style={styles.prIcon}>⭐</Text>
              <Text style={styles.prTitle}>RECORDE PESSOAL (PR)</Text>
            </View>
            <View style={styles.prGrid}>
              <View style={styles.prItem}>
                <Text style={styles.prLabel}>CARGA MÁXIMA</Text>
                <Text style={styles.prValue}>
                  {chartData.personalRecord.maxWeight} kg
                </Text>
              </View>
              <View style={styles.prItem}>
                <Text style={styles.prLabel}>1RM ESTIMADO</Text>
                <Text style={styles.prValue}>
                  {chartData.personalRecord.max1RM} kg
                </Text>
              </View>
              <View style={styles.prItem}>
                <Text style={styles.prLabel}>DATA DO RECORDE</Text>
                <Text style={styles.prValue}>
                  {chartData.personalRecord.prDate || '—'}
                </Text>
              </View>
            </View>
          </Card>

          {/* Progression Bar Chart */}
          <Text style={styles.sectionHeader}>PROGRESSÃO ESTIMADA DE 1RM (KG)</Text>
          <Card style={styles.chartCard}>
            {chartData.labels.length > 0 ? (
              <View style={styles.barsContainer}>
                {chartData.labels.map((dateLabel, idx) => {
                  const est1RM = chartData.estimated1RMs[idx];
                  const maxEst = Math.max(...chartData.estimated1RMs, 10);
                  const heightPct = Math.max(15, Math.round((est1RM / maxEst) * 100));
                  const isPR = est1RM === chartData.personalRecord.max1RM;

                  return (
                    <View key={`${dateLabel}-${idx}`} style={styles.barCol}>
                      <Text style={styles.barValue}>{est1RM}</Text>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            { height: `${heightPct}%` },
                            isPR && styles.barFillPR,
                          ]}
                        />
                      </View>
                      <Text style={styles.barDate}>{dateLabel}</Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyChart}>
                <Text style={styles.emptyChartText}>
                  {isLoadingPoints
                    ? 'Carregando dados...'
                    : 'Sem histórico registrado para este exercício.'}
                </Text>
              </View>
            )}
          </Card>

          {/* Historical Data Table */}
          <Text style={styles.sectionHeader}>HISTÓRICO DE SESSÕES</Text>
          <Card style={styles.tableCard}>
            <View style={styles.tableHead}>
              <Text style={[styles.th, styles.thDate]}>Data</Text>
              <Text style={[styles.th, styles.thWeight]}>Carga Máx</Text>
              <Text style={[styles.th, styles.th1RM]}>1RM Est.</Text>
              <Text style={[styles.th, styles.thVol]}>Volume</Text>
            </View>

            {exerciseHistoryPoints.map((pt, idx) => (
              <View key={`${pt.date}-${idx}`} style={styles.tableRow}>
                <Text style={[styles.td, styles.thDate]}>{pt.date}</Text>
                <Text style={[styles.td, styles.thWeight]}>{pt.maxWeightKg} kg</Text>
                <Text style={[styles.td, styles.th1RM, styles.tdEmerald]}>
                  {pt.estimated1RM} kg
                </Text>
                <Text style={[styles.td, styles.thVol]}>{pt.totalVolumeKg} kg</Text>
              </View>
            ))}

            {exerciseHistoryPoints.length === 0 && (
              <Text style={styles.emptyTableText}>Nenhum registro encontrado.</Text>
            )}
          </Card>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    topHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    backBtn: {
      minWidth: 44,
      minHeight: 44,
      justifyContent: 'center',
    },
    backBtnText: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: '600',
    },
    headerTitle: {
      color: colors.textPrimary,
      fontSize: 17,
      fontWeight: '700',
    },
    backBtnPlaceholder: {
      minWidth: 44,
    },
    statsBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
      paddingVertical: spacing.md,
    },
    statBox: {
      alignItems: 'center',
      flex: 1,
    },
    statLabel: {
      color: colors.textDimmed,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    statValue: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: '800',
    },
    statDivider: {
      width: 1,
      height: 24,
      backgroundColor: colors.cardBorder,
    },
    segmentedContainer: {
      flexDirection: 'row',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      backgroundColor: colors.background,
      gap: spacing.sm,
    },
    segmentBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: borderRadius.md,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 44,
    },
    segmentBtnActive: {
      backgroundColor: colors.primaryMuted,
      borderColor: colors.primary,
    },
    segmentText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
    segmentTextActive: {
      color: colors.primary,
    },
    listContent: {
      padding: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    sessionCard: {
      marginBottom: spacing.md,
      backgroundColor: colors.card,
      borderColor: colors.cardBorder,
      borderWidth: 1,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
    },
    sessionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    sessionDate: {
      color: colors.textDimmed,
      fontSize: 12,
      fontWeight: '500',
    },
    sessionRoutineName: {
      color: colors.textPrimary,
      fontSize: 17,
      fontWeight: '700',
      marginBottom: 6,
    },
    sessionMetricsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: spacing.sm,
    },
    sessionMetricText: {
      color: colors.textSecondary,
      fontSize: 13,
    },
    metricHighlight: {
      color: colors.primary,
      fontWeight: '700',
    },
    metricDot: {
      color: colors.textDimmed,
    },
    sessionExercisesBlock: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: borderRadius.sm,
      padding: spacing.sm,
      marginTop: 4,
    },
    sessionExerciseLine: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 4,
    },
    sessionExName: {
      color: colors.textPrimary,
      fontSize: 12,
      fontWeight: '600',
      width: 140,
    },
    sessionExSets: {
      color: colors.textDimmed,
      fontSize: 12,
      flex: 1,
    },
    sessionNotesBox: {
      marginTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.cardBorder,
      paddingTop: 6,
    },
    sessionNotesText: {
      color: colors.textDimmed,
      fontSize: 12,
      fontStyle: 'italic',
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.xxl,
    },
    emptyIcon: {
      fontSize: 48,
      marginBottom: 12,
    },
    emptyTitle: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 6,
    },
    emptySubtitle: {
      color: colors.textSecondary,
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 18,
      paddingHorizontal: spacing.xl,
    },
    sectionHeader: {
      color: colors.textDimmed,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1,
      marginBottom: spacing.sm,
      marginTop: spacing.md,
    },
    chipsScroll: {
      gap: 8,
      paddingBottom: spacing.xs,
    },
    exChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: borderRadius.full,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      minHeight: 36,
      justifyContent: 'center',
    },
    exChipActive: {
      backgroundColor: colors.primaryMuted,
      borderColor: colors.primary,
    },
    exChipText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
    exChipTextActive: {
      color: colors.primary,
    },
    prCard: {
      backgroundColor: colors.card,
      borderColor: colors.cardBorder,
      borderWidth: 1,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      marginTop: spacing.sm,
      marginBottom: spacing.md,
    },
    prHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: spacing.sm,
    },
    prIcon: {
      fontSize: 16,
    },
    prTitle: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    prGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    prItem: {
      flex: 1,
    },
    prLabel: {
      color: colors.textDimmed,
      fontSize: 10,
      fontWeight: '600',
      marginBottom: 2,
    },
    prValue: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: '800',
    },
    chartCard: {
      backgroundColor: colors.card,
      borderColor: colors.cardBorder,
      borderWidth: 1,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      minHeight: 180,
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    barsContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-around',
      height: 140,
    },
    barCol: {
      alignItems: 'center',
      flex: 1,
      height: '100%',
      justifyContent: 'flex-end',
    },
    barValue: {
      color: colors.textSecondary,
      fontSize: 10,
      fontWeight: '700',
      marginBottom: 4,
    },
    barTrack: {
      width: 24,
      height: 90,
      backgroundColor: colors.surfaceMuted,
      borderRadius: 4,
      justifyContent: 'flex-end',
      overflow: 'hidden',
    },
    barFill: {
      width: '100%',
      backgroundColor: colors.primary,
      borderRadius: 4,
    },
    barFillPR: {
      backgroundColor: colors.calories,
    },
    barDate: {
      color: colors.textDimmed,
      fontSize: 10,
      marginTop: 6,
    },
    emptyChart: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    emptyChartText: {
      color: colors.textDimmed,
      fontSize: 13,
    },
    tableCard: {
      backgroundColor: colors.card,
      borderColor: colors.cardBorder,
      borderWidth: 1,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
    },
    tableHead: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
      paddingBottom: 6,
      marginBottom: 6,
    },
    th: {
      color: colors.textDimmed,
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    thDate: {
      flex: 1.2,
    },
    thWeight: {
      flex: 1,
      textAlign: 'center',
    },
    th1RM: {
      flex: 1,
      textAlign: 'center',
    },
    thVol: {
      flex: 1,
      textAlign: 'right',
    },
    tableRow: {
      flexDirection: 'row',
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceMuted,
    },
    td: {
      color: colors.textPrimary,
      fontSize: 12,
    },
    tdEmerald: {
      color: colors.primary,
      fontWeight: '700',
    },
    emptyTableText: {
      color: colors.textDimmed,
      fontSize: 12,
      textAlign: 'center',
      paddingVertical: 12,
    },
  });
