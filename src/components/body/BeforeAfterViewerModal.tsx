import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Platform,
  Dimensions,
} from 'react-native';
import { BodyLog } from '../../types/domain';
import { useTheme } from '../../hooks/useTheme';
import {
  calculatePhotoDeltaMetrics,
  extractPoseFromUri,
  getInitialComparisonIndices,
  resolvePhotoUri,
} from '../../utils/photoComparison';

export type ComparisonMode = 'sideBySide' | 'slider' | 'flip';

export interface BeforeAfterViewerModalProps {
  visible: boolean;
  photos: { date: string; uri: string }[];
  getBodyLog: (date: string) => Promise<BodyLog | null>;
  onClose: () => void;
}

const POSE_LABELS: Record<string, string> = {
  front: 'Frente',
  side: 'Lado',
  back: 'Costas',
  other: 'Geral',
};

export const BeforeAfterViewerModal: React.FC<BeforeAfterViewerModalProps> = ({
  visible,
  photos,
  getBodyLog,
  onClose,
}) => {
  const { colors } = useTheme();
  const screenWidth = Dimensions.get('window').width;

  const [mode, setMode] = useState<ComparisonMode>('sideBySide');
  const [beforeIdx, setBeforeIdx] = useState<number>(0);
  const [afterIdx, setAfterIdx] = useState<number>(0);

  const [beforeLog, setBeforeLog] = useState<BodyLog | null>(null);
  const [afterLog, setAfterLog] = useState<BodyLog | null>(null);

  // Slider position (percentage 0 to 100)
  const [sliderPct, setSliderPct] = useState<number>(50);
  // Quick flip toggle state: false = Before, true = After
  const [isFlippedToAfter, setIsFlippedToAfter] = useState<boolean>(false);

  // Initialize pairing
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      if (visible && photos.length >= 2) {
        const initial = getInitialComparisonIndices(photos.length);
        if (initial) {
          setAfterIdx(initial.afterIndex);
          setBeforeIdx(initial.beforeIndex);
        }
      }
    });
    return () => {
      active = false;
    };
  }, [visible, photos.length]);


  const beforePhoto = photos[beforeIdx];
  const afterPhoto = photos[afterIdx];

  // Fetch corresponding body logs
  useEffect(() => {
    if (!visible) return;
    let active = true;

    (async () => {
      const bLog = beforePhoto ? await getBodyLog(beforePhoto.date) : null;
      const aLog = afterPhoto ? await getBodyLog(afterPhoto.date) : null;
      if (active) {
        setBeforeLog(bLog);
        setAfterLog(aLog);
      }
    })();

    return () => {
      active = false;
    };
  }, [visible, beforePhoto, afterPhoto, getBodyLog]);


  const deltaMetrics = useMemo(() => {
    if (!beforePhoto || !afterPhoto) {
      return { daysBetween: 0, weightDeltaKg: null, bodyFatDeltaPct: null, waistDeltaCm: null };
    }
    return calculatePhotoDeltaMetrics(beforeLog, afterLog, beforePhoto.date, afterPhoto.date);
  }, [beforeLog, afterLog, beforePhoto, afterPhoto]);

  if (!visible) return null;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateStr;
  };

  const beforePose = beforePhoto ? extractPoseFromUri(beforePhoto.uri) : 'front';
  const afterPose = afterPhoto ? extractPoseFromUri(afterPhoto.uri) : 'front';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Top Header */}
        <View style={[styles.header, { borderBottomColor: colors.cardBorder }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={[styles.closeBtnText, { color: colors.textPrimary }]}>✕ Fechar</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Antes vs. Depois</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Mode Selector Tabs */}
        <View style={[styles.modeTabsRow, { backgroundColor: colors.surfaceMuted }]}>
          <TouchableOpacity
            onPress={() => setMode('sideBySide')}
            style={[styles.modeTab, mode === 'sideBySide' && { backgroundColor: colors.primary }]}
          >
            <Text
              style={[
                styles.modeTabText,
                { color: mode === 'sideBySide' ? '#FFFFFF' : colors.textSecondary },
              ]}
            >
              Lado a Lado
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setMode('slider')}
            style={[styles.modeTab, mode === 'slider' && { backgroundColor: colors.primary }]}
          >
            <Text
              style={[
                styles.modeTabText,
                { color: mode === 'slider' ? '#FFFFFF' : colors.textSecondary },
              ]}
            >
              Deslizante
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setMode('flip')}
            style={[styles.modeTab, mode === 'flip' && { backgroundColor: colors.primary }]}
          >
            <Text
              style={[
                styles.modeTabText,
                { color: mode === 'flip' ? '#FFFFFF' : colors.textSecondary },
              ]}
            >
              Alternar
            </Text>
          </TouchableOpacity>
        </View>

        {/* Delta Metrics Bar */}
        <View style={[styles.metricsBar, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.metricItem}>
            <Text style={[styles.metricLabel, { color: colors.textDimmed }]}>Tempo</Text>
            <Text style={[styles.metricValue, { color: colors.textPrimary }]}>
              {deltaMetrics.daysBetween} dias
            </Text>
          </View>

          <View style={styles.metricItem}>
            <Text style={[styles.metricLabel, { color: colors.textDimmed }]}>Δ Peso</Text>
            <Text
              style={[
                styles.metricValue,
                {
                  color:
                    deltaMetrics.weightDeltaKg === null
                      ? colors.textDimmed
                      : deltaMetrics.weightDeltaKg < 0
                      ? colors.primary
                      : colors.calories,
                },
              ]}
            >
              {deltaMetrics.weightDeltaKg !== null
                ? `${deltaMetrics.weightDeltaKg > 0 ? '+' : ''}${deltaMetrics.weightDeltaKg} kg`
                : '—'}
            </Text>
          </View>

          <View style={styles.metricItem}>
            <Text style={[styles.metricLabel, { color: colors.textDimmed }]}>Δ Gordura</Text>
            <Text
              style={[
                styles.metricValue,
                {
                  color:
                    deltaMetrics.bodyFatDeltaPct === null
                      ? colors.textDimmed
                      : deltaMetrics.bodyFatDeltaPct < 0
                      ? colors.primary
                      : colors.fat,
                },
              ]}
            >
              {deltaMetrics.bodyFatDeltaPct !== null
                ? `${deltaMetrics.bodyFatDeltaPct > 0 ? '+' : ''}${deltaMetrics.bodyFatDeltaPct}%`
                : '—'}
            </Text>
          </View>

          <View style={styles.metricItem}>
            <Text style={[styles.metricLabel, { color: colors.textDimmed }]}>Δ Cintura</Text>
            <Text
              style={[
                styles.metricValue,
                {
                  color:
                    deltaMetrics.waistDeltaCm === null
                      ? colors.textDimmed
                      : deltaMetrics.waistDeltaCm < 0
                      ? colors.primary
                      : colors.textPrimary,
                },
              ]}
            >
              {deltaMetrics.waistDeltaCm !== null
                ? `${deltaMetrics.waistDeltaCm > 0 ? '+' : ''}${deltaMetrics.waistDeltaCm} cm`
                : '—'}
            </Text>
          </View>
        </View>

        {/* Main Comparison Area */}
        <View style={styles.viewerContainer}>
          {photos.length < 2 ? (
            <View style={styles.emptyView}>
              <Text style={[styles.emptyText, { color: colors.textDimmed }]}>
                É necessário ter pelo menos 2 fotos registradas para comparar.
              </Text>
            </View>
          ) : mode === 'sideBySide' ? (
            /* Mode 1: Side by Side */
            <View style={styles.sideBySideRow}>
              {/* Before Column */}
              <View style={[styles.columnCard, { borderColor: colors.cardBorder }]}>
                <View style={[styles.columnHeader, { backgroundColor: colors.surfaceMuted }]}>
                  <Text style={[styles.columnTag, { color: colors.textDimmed }]}>ANTES</Text>
                  <Text style={[styles.columnDate, { color: colors.textPrimary }]}>
                    {formatDate(beforePhoto?.date)}
                  </Text>
                  <Text style={[styles.columnWeight, { color: colors.primary }]}>
                    {beforeLog?.weightKg ? `${beforeLog.weightKg.toFixed(1)} kg` : '—'}
                  </Text>
                </View>

                {beforePhoto && (
                  <Image
                    source={{ uri: resolvePhotoUri(beforePhoto.uri) }}
                    style={styles.fullImage}
                    resizeMode="cover"
                  />
                )}
                <View style={styles.poseBadgeOverlay}>
                  <Text style={styles.poseBadgeText}>{POSE_LABELS[beforePose]}</Text>
                </View>
              </View>

              {/* After Column */}
              <View style={[styles.columnCard, { borderColor: colors.primary }]}>
                <View style={[styles.columnHeader, { backgroundColor: colors.primaryMuted }]}>
                  <Text style={[styles.columnTag, { color: colors.primary }]}>DEPOIS</Text>
                  <Text style={[styles.columnDate, { color: colors.textPrimary }]}>
                    {formatDate(afterPhoto?.date)}
                  </Text>
                  <Text style={[styles.columnWeight, { color: colors.primary }]}>
                    {afterLog?.weightKg ? `${afterLog.weightKg.toFixed(1)} kg` : '—'}
                  </Text>
                </View>

                {afterPhoto && (
                  <Image
                    source={{ uri: resolvePhotoUri(afterPhoto.uri) }}
                    style={styles.fullImage}
                    resizeMode="cover"
                  />
                )}
                <View style={styles.poseBadgeOverlay}>
                  <Text style={styles.poseBadgeText}>{POSE_LABELS[afterPose]}</Text>
                </View>
              </View>
            </View>
          ) : mode === 'slider' ? (
            /* Mode 2: Interactive Slider */
            <View style={[styles.sliderFrame, { borderColor: colors.cardBorder }]}>
              {/* After Image (Background) */}
              {afterPhoto && (
                <Image
                  source={{ uri: resolvePhotoUri(afterPhoto.uri) }}
                  style={styles.sliderFullImage}
                  resizeMode="cover"
                />
              )}

              {/* Before Image (Foreground with dynamic clip width) */}
              {beforePhoto && (
                <View style={[styles.sliderClippedWrapper, { width: `${sliderPct}%` }]}>
                  <Image
                    source={{ uri: resolvePhotoUri(beforePhoto.uri) }}
                    style={[styles.sliderFullImage, { width: screenWidth - 32 }]}
                    resizeMode="cover"
                  />
                </View>
              )}

              {/* Divider Line */}
              <View style={[styles.sliderDivider, { left: `${sliderPct}%` }]}>
                <View style={styles.sliderKnob}>
                  <Text style={styles.sliderKnobText}>‹ ›</Text>
                </View>
              </View>

              {/* Overlay Labels */}
              <View style={styles.sliderLabels}>
                <View style={styles.sliderLabelBadge}>
                  <Text style={styles.sliderLabelText}>
                    Antes: {formatDate(beforePhoto?.date)}
                  </Text>
                </View>
                <View style={styles.sliderLabelBadge}>
                  <Text style={styles.sliderLabelText}>
                    Depois: {formatDate(afterPhoto?.date)}
                  </Text>
                </View>
              </View>

              {/* Quick Sweep Buttons */}
              <View style={styles.sliderControlsRow}>
                <TouchableOpacity
                  onPress={() => setSliderPct(25)}
                  style={[styles.sweepBtn, { backgroundColor: 'rgba(0,0,0,0.6)' }]}
                >
                  <Text style={styles.sweepBtnText}>25%</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setSliderPct(50)}
                  style={[styles.sweepBtn, { backgroundColor: 'rgba(0,0,0,0.6)' }]}
                >
                  <Text style={styles.sweepBtnText}>50%</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setSliderPct(75)}
                  style={[styles.sweepBtn, { backgroundColor: 'rgba(0,0,0,0.6)' }]}
                >
                  <Text style={styles.sweepBtnText}>75%</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* Mode 3: Quick Flip */
            <View style={[styles.flipFrame, { borderColor: colors.cardBorder }]}>
              {/* Render either Before or After based on isFlippedToAfter */}
              <Image
                source={{
                  uri: resolvePhotoUri(
                    isFlippedToAfter ? afterPhoto?.uri || '' : beforePhoto?.uri || ''
                  ),
                }}
                style={styles.fullImage}
                resizeMode="cover"
              />

              <View style={styles.flipOverlay}>
                <View style={styles.flipBadge}>
                  <Text style={styles.flipBadgeTitle}>
                    {isFlippedToAfter ? 'DEPOIS' : 'ANTES'}
                  </Text>
                  <Text style={styles.flipBadgeSubtitle}>
                    {formatDate(isFlippedToAfter ? afterPhoto?.date : beforePhoto?.date)} —{' '}
                    {(isFlippedToAfter ? afterLog?.weightKg : beforeLog?.weightKg)?.toFixed(1) ||
                      '—'}{' '}
                    kg
                  </Text>
                </View>

                {/* Big Flip Button */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setIsFlippedToAfter((prev) => !prev)}
                  style={[styles.flipActionBtn, { backgroundColor: colors.primary }]}
                >
                  <Text style={styles.flipActionText}>
                    🔄 Ver {isFlippedToAfter ? 'Antes' : 'Depois'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Photo Selection Pickers */}
        <View style={[styles.selectorBar, { backgroundColor: colors.card, borderTopColor: colors.cardBorder }]}>
          <Text style={[styles.selectorTitle, { color: colors.textSecondary }]}>
            Selecionar Fotos para Comparação:
          </Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerRow}>
            {photos.map((p, idx) => {
              const isBefore = idx === beforeIdx;
              const isAfter = idx === afterIdx;
              return (
                <TouchableOpacity
                  key={`${p.uri}-${idx}`}
                  activeOpacity={0.7}
                  onPress={() => {
                    if (!isBefore && !isAfter) {
                      setAfterIdx(idx);
                    } else if (isBefore) {
                      setAfterIdx(idx);
                    } else {
                      setBeforeIdx(idx);
                    }
                  }}
                  style={[
                    styles.thumbnailCard,
                    { borderColor: colors.cardBorder },
                    isBefore && { borderColor: colors.textDimmed, borderWidth: 2 },
                    isAfter && { borderColor: colors.primary, borderWidth: 2 },
                  ]}
                >
                  <Image source={{ uri: resolvePhotoUri(p.uri) }} style={styles.thumbnailImg} resizeMode="cover" />
                  <View style={styles.thumbLabel}>
                    <Text style={styles.thumbText}>{formatDate(p.date)}</Text>
                  </View>
                  {(isBefore || isAfter) && (
                    <View
                      style={[
                        styles.selectedTag,
                        { backgroundColor: isAfter ? colors.primary : colors.surfaceMuted },
                      ]}
                    >
                      <Text style={styles.selectedTagText}>{isAfter ? 'Depois' : 'Antes'}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerSpacer: {
    width: 60,
  },
  modeTabsRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 10,
    padding: 3,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  modeTabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  metricsBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    justifyContent: 'space-around',
  },
  metricItem: {
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  viewerContainer: {
    flex: 1,
    marginHorizontal: 16,
    marginVertical: 10,
  },
  emptyView: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  sideBySideRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  columnCard: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',
  },
  columnHeader: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  columnTag: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  columnDate: {
    fontSize: 11,
    fontWeight: '600',
  },
  columnWeight: {
    fontSize: 12,
    fontWeight: '700',
  },
  fullImage: {
    width: '100%',
    flex: 1,
  },
  poseBadgeOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  poseBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  sliderFrame: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',
  },
  sliderFullImage: {
    width: '100%',
    height: '100%',
  },
  sliderClippedWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  sliderDivider: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  sliderKnob: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  sliderKnobText: {
    color: '#0A0A0C',
    fontSize: 14,
    fontWeight: '700',
  },
  sliderLabels: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sliderLabelBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  sliderLabelText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  sliderControlsRow: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  sweepBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  sweepBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  flipFrame: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',
  },
  flipOverlay: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  flipBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  flipBadgeTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  flipBadgeSubtitle: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '500',
  },
  flipActionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  flipActionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  selectorBar: {
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  selectorTitle: {
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 16,
    marginBottom: 8,
  },
  pickerRow: {
    paddingHorizontal: 16,
    gap: 10,
  },
  thumbnailCard: {
    width: 64,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbnailImg: {
    width: '100%',
    height: '100%',
  },
  thumbLabel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 2,
    alignItems: 'center',
  },
  thumbText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '600',
  },
  selectedTag: {
    position: 'absolute',
    top: 2,
    left: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  selectedTagText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '700',
  },
});
