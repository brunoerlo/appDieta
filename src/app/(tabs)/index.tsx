import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AppTopBar } from '../../components/ui/AppTopBar';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { useDiet } from '../../hooks/useDiet';
import { useWorkout } from '../../hooks/useWorkout';
import { useProfile } from '../../hooks/useProfile';
import { useBody } from '../../hooks/useBody';
import { useTheme } from '../../hooks/useTheme';
import { formatElapsedSeconds } from '../../utils/workout';

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { profile } = useProfile();
  const {
    dailySummary,
    waterTotalMl,
    addWater,
    isRefreshing,
    refresh,
  } = useDiet();
  const { routines, activeSession, startWorkout } = useWorkout();
  const { currentBodyLog, currentMovingAverage } = useBody();

  const targetKcal = profile?.targetCalories ?? 2000;
  const consumedKcal = dailySummary.totalCalories;
  const kcalProgress = targetKcal > 0 ? Math.min(1, consumedKcal / targetKcal) : 0;

  const targetWater = profile?.targetWaterMl ?? 2500;
  const waterProgress = targetWater > 0 ? Math.min(1, waterTotalMl / targetWater) : 0;

  // Next routine or first available routine
  const suggestedRoutine = routines.length > 0 ? routines[0] : null;

  const handleStartWorkout = () => {
    if (activeSession) {
      router.push('/workout/live');
    } else if (suggestedRoutine) {
      startWorkout(suggestedRoutine);
      router.push({
        pathname: '/workout/live',
        params: { routineId: suggestedRoutine.id },
      });
    } else {
      router.push('/workout/live');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['left', 'right']}>
      {/* Instagram Header with IronTrack centered */}
      <AppTopBar isLogoInstagram={true} showBorderBottom={true} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Welcome Athlete Greeting */}
        <View style={styles.greetingSection}>
          <Text style={[styles.greetingSub, { color: colors.textSecondary }]}>BEM-VINDO DE VOLTA</Text>
          <Text style={[styles.greetingName, { color: colors.textPrimary }]}>
            {profile?.name ? `Olá, ${profile.name}!` : 'Olá, Atleta!'}
          </Text>
        </View>

        {/* 1. Daily Calorie & Nutrition Snapshot Card */}
        <Card style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={[styles.cardTag, { color: colors.textSecondary }]}>NUTRIÇÃO DE HOJE</Text>
              <Text style={[styles.cardMainMetric, { color: colors.calories }]}>
                {Math.round(consumedKcal)}{' '}
                <Text style={[styles.cardMetricSub, { color: colors.textDimmed }]}>/ {targetKcal} kcal</Text>
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.smallActionBtn, { backgroundColor: colors.primaryMuted, borderColor: colors.primary }]}
              onPress={() => router.push('/(tabs)/diet')}
              activeOpacity={0.7}
            >
              <Text style={[styles.smallActionBtnText, { color: colors.primary }]}>Ver Dieta ›</Text>
            </TouchableOpacity>
          </View>

          <ProgressBar
            progress={kcalProgress}
            color={colors.calories}
            trackColor={colors.caloriesTrack}
            height={8}
            style={styles.progressBar}
          />

          <View style={styles.macrosRow}>
            <View style={styles.macroBadge}>
              <Text style={[styles.macroLabel, { color: colors.protein }]}>Proteína</Text>
              <Text style={[styles.macroValue, { color: colors.textPrimary }]}>
                {Math.round(dailySummary.totalProtein)}g{' '}
                <Text style={{ color: colors.textDimmed, fontSize: 11 }}>/ {profile?.targetProtein ?? 150}g</Text>
              </Text>
            </View>
            <View style={styles.macroBadge}>
              <Text style={[styles.macroLabel, { color: colors.carbs }]}>Carbos</Text>
              <Text style={[styles.macroValue, { color: colors.textPrimary }]}>
                {Math.round(dailySummary.totalCarbs)}g{' '}
                <Text style={{ color: colors.textDimmed, fontSize: 11 }}>/ {profile?.targetCarbs ?? 200}g</Text>
              </Text>
            </View>
            <View style={styles.macroBadge}>
              <Text style={[styles.macroLabel, { color: colors.fat }]}>Gorduras</Text>
              <Text style={[styles.macroValue, { color: colors.textPrimary }]}>
                {Math.round(dailySummary.totalFat)}g{' '}
                <Text style={{ color: colors.textDimmed, fontSize: 11 }}>/ {profile?.targetFat ?? 60}g</Text>
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.quickAddFoodBtn, { backgroundColor: colors.surfaceMuted, borderColor: colors.cardBorder }]}
            onPress={() =>
              router.push({
                pathname: '/nutrition/search',
                params: { mealType: 'lunch' },
              })
            }
            activeOpacity={0.7}
          >
            <Text style={[styles.quickAddFoodText, { color: colors.primary }]}>+ Registrar Alimento ou Refeição</Text>
          </TouchableOpacity>
        </Card>

        {/* 2. Quick Hydration Snapshot Card */}
        <Card style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={[styles.cardTag, { color: colors.textSecondary }]}>HIDRATAÇÃO RÁPIDA 💧</Text>
              <Text style={[styles.cardMainMetric, { color: colors.water }]}>
                {waterTotalMl.toLocaleString('pt-BR')}{' '}
                <Text style={[styles.cardMetricSub, { color: colors.textDimmed }]}>/ {targetWater.toLocaleString('pt-BR')} ml</Text>
              </Text>
            </View>
            <Text style={[styles.percentLabel, { color: colors.water }]}>
              {Math.round(waterProgress * 100)}%
            </Text>
          </View>

          <ProgressBar
            progress={waterProgress}
            color={colors.water}
            trackColor={colors.waterTrack}
            height={8}
            style={styles.progressBar}
          />

          <View style={styles.waterQuickRow}>
            <TouchableOpacity
              style={[styles.waterQuickBtn, { backgroundColor: colors.surfaceMuted, borderColor: colors.cardBorder }]}
              onPress={() => addWater(250)}
              activeOpacity={0.7}
            >
              <Text style={[styles.waterQuickText, { color: colors.textPrimary }]}>+250ml</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.waterQuickBtn, { backgroundColor: colors.surfaceMuted, borderColor: colors.cardBorder }]}
              onPress={() => addWater(500)}
              activeOpacity={0.7}
            >
              <Text style={[styles.waterQuickText, { color: colors.textPrimary }]}>+500ml</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.waterQuickBtn, { backgroundColor: colors.surfaceMuted, borderColor: colors.cardBorder }]}
              onPress={() => router.push('/(tabs)/diet')}
              activeOpacity={0.7}
            >
              <Text style={[styles.waterQuickText, { color: colors.textSecondary }]}>Detalhes ›</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* 3. Workout of the Day or Active Session */}
        <Card
          style={[
            styles.card,
            activeSession && { borderColor: colors.primary, borderWidth: 1.5, backgroundColor: '#17231E' },
          ]}
        >
          <View style={styles.cardHeader}>
            <View>
              <Text style={[styles.cardTag, activeSession ? { color: colors.primary } : { color: colors.textSecondary }]}>
                {activeSession ? 'TREINO EM ANDAMENTO ⏱' : 'TREINO DO DIA 🏋️'}
              </Text>
              <Text style={[styles.cardRoutineTitle, { color: colors.textPrimary }]}>
                {activeSession ? activeSession.routineName : suggestedRoutine ? suggestedRoutine.name : 'Treino Livre'}
              </Text>
            </View>
            {activeSession && (
              <Text style={[styles.activeElapsedTimer, { color: colors.primary }]}>
                {formatElapsedSeconds(activeSession.elapsedSeconds)}
              </Text>
            )}
          </View>

          <Text style={[styles.workoutDescText, { color: colors.textSecondary }]}>
            {activeSession
              ? `${activeSession.exercises.reduce((acc, e) => acc + e.sets.filter((s) => s.completed).length, 0)} séries concluídas`
              : suggestedRoutine?.description || `${suggestedRoutine?.exercises?.length || 0} exercícios planejados`}
          </Text>

          <Button
            title={activeSession ? '▶ Retomar Treino' : '▶ Iniciar Treino'}
            onPress={handleStartWorkout}
            variant="primary"
            size="md"
            style={styles.workoutActionBtn}
          />
        </Card>

        {/* 4. Body Weight & Evolution Snapshot */}
        <Card style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={[styles.cardTag, { color: colors.textSecondary }]}>EVOLUÇÃO CORPORAL 📈</Text>
              <Text style={[styles.cardMainMetric, { color: colors.textPrimary }]}>
                {currentBodyLog?.weightKg ? `${currentBodyLog.weightKg.toFixed(1)} kg` : '—'}{' '}
                {currentMovingAverage !== null && (
                  <Text style={[styles.cardMetricSub, { color: colors.textDimmed }]}>
                    (Média: {currentMovingAverage.toFixed(1)} kg)
                  </Text>
                )}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.smallActionBtn, { backgroundColor: colors.surfaceMuted, borderColor: colors.cardBorder }]}
              onPress={() => router.push('/body/log')}
              activeOpacity={0.7}
            >
              <Text style={[styles.smallActionBtnText, { color: colors.textPrimary }]}>+ Pesar</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.evolutionLink}
            onPress={() => router.push('/(tabs)/body')}
            activeOpacity={0.7}
          >
            <Text style={[styles.evolutionLinkText, { color: colors.primary }]}>
              Acessar gráficos, medidas e fotos de evolução ›
            </Text>
          </TouchableOpacity>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 14,
  },
  greetingSection: {
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  greetingSub: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  greetingName: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  cardTag: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  cardMainMetric: {
    fontSize: 22,
    fontWeight: '800',
  },
  cardMetricSub: {
    fontSize: 13,
    fontWeight: '500',
  },
  cardRoutineTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  smallActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  smallActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  progressBar: {
    marginVertical: 10,
  },
  macrosRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 6,
    marginBottom: 12,
  },
  macroBadge: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  macroLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
  },
  macroValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  quickAddFoodBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
  },
  quickAddFoodText: {
    fontSize: 13,
    fontWeight: '700',
  },
  percentLabel: {
    fontSize: 16,
    fontWeight: '800',
  },
  waterQuickRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  waterQuickBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waterQuickText: {
    fontSize: 12,
    fontWeight: '700',
  },
  activeElapsedTimer: {
    fontSize: 16,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  workoutDescText: {
    fontSize: 13,
    marginBottom: 14,
  },
  workoutActionBtn: {
    width: '100%',
  },
  evolutionLink: {
    marginTop: 10,
    paddingTop: 8,
  },
  evolutionLinkText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
