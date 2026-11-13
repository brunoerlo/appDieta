import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBody } from '../../hooks/useBody';
import { useTheme } from '../../hooks/useTheme';
import { DateSelectorHeader } from '../../components/nutrition/DateSelectorHeader';
import { WeightTrendChart } from '../../components/body/WeightTrendChart';
import { BodyCompositionCard } from '../../components/body/BodyCompositionCard';
import { CircumferenceCard } from '../../components/body/CircumferenceCard';
import { PhotoGalleryCard } from '../../components/body/PhotoGalleryCard';
import { WeighInModal } from '../../components/body/WeighInModal';
import { MeasurementsModal } from '../../components/body/MeasurementsModal';
import { PhotoCaptureModal } from '../../components/body/PhotoCaptureModal';
import { BeforeAfterViewerModal } from '../../components/body/BeforeAfterViewerModal';

export default function BodyScreen() {
  const { colors } = useTheme();

  const {
    selectedDate,
    setSelectedDate,
    goToToday,
    currentBodyLog,
    currentMovingAverage,
    currentComposition,
    weightHistory,
    chartRange,
    setChartRange,
    photos,
    isRefreshing,
    saveWeighIn,
    saveMeasurements,
    savePhoto,
    deletePhoto,
    refresh,
    getBodyLog,
  } = useBody();

  const [weighInVisible, setWeighInVisible] = useState(false);
  const [measurementsVisible, setMeasurementsVisible] = useState(false);
  const [photoCaptureVisible, setPhotoCaptureVisible] = useState(false);
  const [compareVisible, setCompareVisible] = useState(false);

  const weightKg = currentBodyLog?.weightKg;
  const hasWeight = weightKg !== undefined && weightKg > 0;
  const deltaVsMA =
    hasWeight && currentMovingAverage !== null
      ? Math.round((weightKg - currentMovingAverage) * 10) / 10
      : null;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Date Header */}
      <DateSelectorHeader
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        onResetToToday={goToToday}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        {/* Hero Weigh-in Card */}
        <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.heroTop}>
            <View>
              <Text style={[styles.heroLabel, { color: colors.textSecondary }]}>
                Pesagem Matinal
              </Text>
              <View style={styles.weightDisplayRow}>
                <Text style={[styles.weightBig, { color: colors.textPrimary }]}>
                  {hasWeight ? weightKg.toFixed(1) : '—'}
                </Text>
                <Text style={[styles.weightUnit, { color: colors.textDimmed }]}> kg</Text>
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setWeighInVisible(true)}
              style={[styles.weighInBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.weighInBtnText}>{hasWeight ? 'Editar Peso' : '+ Pesar'}</Text>
            </TouchableOpacity>
          </View>

          {/* 7-Day Moving Average & Fluctuations Badge */}
          <View style={[styles.maRow, { borderTopColor: colors.cardBorder }]}>
            <View style={[styles.maBadge, { backgroundColor: colors.primaryMuted, borderColor: colors.primary }]}>
              <Text style={[styles.maBadgeText, { color: colors.primary }]}>
                Média 7D: {currentMovingAverage !== null ? `${currentMovingAverage.toFixed(1)} kg` : 'Sem dados'}
              </Text>
            </View>

            {deltaVsMA !== null && (
              <Text style={[styles.deltaText, { color: deltaVsMA > 0 ? colors.calories : colors.primary }]}>
                {deltaVsMA > 0 ? `+${deltaVsMA.toFixed(1)}` : deltaVsMA.toFixed(1)} kg vs média
              </Text>
            )}
          </View>
        </View>

        {/* Weight Trend Chart */}
        <WeightTrendChart
          history={weightHistory}
          selectedRange={chartRange}
          onSelectRange={setChartRange}
        />

        {/* Body Composition Card */}
        <BodyCompositionCard
          currentLog={currentBodyLog}
          composition={currentComposition}
          onOpenMeasurements={() => setMeasurementsVisible(true)}
        />

        {/* Circumference Tape Measurements Card */}
        <CircumferenceCard
          currentLog={currentBodyLog}
          onOpenMeasurements={() => setMeasurementsVisible(true)}
        />

        {/* Photo Gallery Card */}
        <PhotoGalleryCard
          photos={photos}
          onAddPhoto={() => setPhotoCaptureVisible(true)}
          onCompare={() => setCompareVisible(true)}
          onDeletePhoto={(uri, date) => deletePhoto(uri, date)}
        />
      </ScrollView>

      {/* Modals */}
      <WeighInModal
        visible={weighInVisible}
        initialWeight={currentBodyLog?.weightKg}
        date={selectedDate}
        onClose={() => setWeighInVisible(false)}
        onSave={async (w) => {
          await saveWeighIn(w);
        }}
      />

      <MeasurementsModal
        visible={measurementsVisible}
        currentLog={currentBodyLog}
        date={selectedDate}
        onClose={() => setMeasurementsVisible(false)}
        onSave={async (m) => {
          await saveMeasurements(m);
        }}
      />

      <PhotoCaptureModal
        visible={photoCaptureVisible}
        date={selectedDate}
        onClose={() => setPhotoCaptureVisible(false)}
        onPhotoSaved={async (uri) => {
          await savePhoto(uri);
        }}
      />

      <BeforeAfterViewerModal
        visible={compareVisible}
        photos={photos}
        getBodyLog={getBodyLog}
        onClose={() => setCompareVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  heroCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    marginBottom: 8,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  weightDisplayRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 4,
  },
  weightBig: {
    fontSize: 36,
    fontWeight: '800',
  },
  weightUnit: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 4,
  },
  weighInBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  weighInBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  maRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  maBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  maBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  deltaText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
