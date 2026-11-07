import {
  shiftDateString,
  calculateMovingAverageForDate,
  calculateBodyComposition,
  mapWeightHistoryToChart,
} from '../../src/utils/body';
import {
  extractPoseFromUri,
  calculatePhotoDeltaMetrics,
  getInitialComparisonIndices,
  resolvePhotoUri,
} from '../../src/utils/photoComparison';
import { BodyLog, WeightHistoryPoint } from '../../src/types/domain';

describe('BodyCalculations & PhotoComparison Unit Tests (Milestone M4)', () => {
  describe('shiftDateString', () => {
    it('shifts days positively within same month', () => {
      expect(shiftDateString('2026-11-01', 5)).toBe('2026-11-06');
    });

    it('shifts days negatively across month boundary', () => {
      expect(shiftDateString('2026-11-01', -1)).toBe('2026-10-31');
    });

    it('shifts across year boundary', () => {
      expect(shiftDateString('2027-01-01', -1)).toBe('2026-12-31');
    });

    it('shifts across February in non-leap year (2026)', () => {
      expect(shiftDateString('2026-02-28', 1)).toBe('2026-03-01');
    });

    it('returns original string if format is invalid', () => {
      expect(shiftDateString('invalid', 1)).toBe('invalid');
    });
  });

  describe('calculateMovingAverageForDate', () => {
    it('calculates exact 7-day average from 7 contiguous daily weigh-ins', () => {
      const logs = [
        { date: '2026-11-01', weightKg: 80.0 },
        { date: '2026-11-02', weightKg: 80.5 },
        { date: '2026-11-03', weightKg: 80.2 },
        { date: '2026-11-04', weightKg: 80.8 },
        { date: '2026-11-05', weightKg: 80.4 },
        { date: '2026-11-06', weightKg: 80.1 },
        { date: '2026-11-07', weightKg: 80.0 },
      ];
      // Sum = 562 / 7 = 80.2857... -> 80.29
      const ma = calculateMovingAverageForDate('2026-11-07', logs, 7);
      expect(ma).toBe(80.29);
    });

    it('calculates average for sparse weigh-ins (e.g. 3 of 7 days)', () => {
      const logs = [
        { date: '2026-11-01', weightKg: 80.0 },
        { date: '2026-11-04', weightKg: 82.0 },
        { date: '2026-11-07', weightKg: 81.0 },
      ];
      // Sum = 243 / 3 = 81.0
      const ma = calculateMovingAverageForDate('2026-11-07', logs, 7);
      expect(ma).toBe(81.0);
    });

    it('returns null if no weigh-ins exist in the 7-day window', () => {
      const logs = [{ date: '2026-10-20', weightKg: 85.0 }];
      const ma = calculateMovingAverageForDate('2026-11-07', logs, 7);
      expect(ma).toBeNull();
    });

    it('dampens 5kg sodium/water retention spike', () => {
      const logs = [
        { date: '2026-11-01', weightKg: 80.0 },
        { date: '2026-11-02', weightKg: 80.1 },
        { date: '2026-11-03', weightKg: 80.2 },
        { date: '2026-11-04', weightKg: 85.0 }, // +5kg spike
        { date: '2026-11-05', weightKg: 80.3 },
        { date: '2026-11-06', weightKg: 80.1 },
        { date: '2026-11-07', weightKg: 80.0 },
      ];
      const ma = calculateMovingAverageForDate('2026-11-07', logs, 7);
      expect(ma).toBeLessThan(81.0);
      expect(ma).toBeGreaterThan(80.5);
    });

    it('strictly clamps to [date - 6 days, date] ignoring weights older than 7 days', () => {
      const logs = [
        { date: '2026-10-31', weightKg: 95.0 }, // 8 days before 2026-11-07 -> ignored!
        { date: '2026-11-01', weightKg: 80.0 }, // 7th day (date - 6) -> included!
        { date: '2026-11-07', weightKg: 80.0 }, // target date -> included!
      ];
      const ma = calculateMovingAverageForDate('2026-11-07', logs, 7);
      expect(ma).toBe(80.0);
    });

    it('ignores entries with weightKg <= 0', () => {
      const logs = [
        { date: '2026-11-01', weightKg: 0 }, // Photo-only placeholder
        { date: '2026-11-07', weightKg: 80.0 },
      ];
      const ma = calculateMovingAverageForDate('2026-11-07', logs, 7);
      expect(ma).toBe(80.0);
    });
  });

  describe('calculateBodyComposition', () => {
    it('computes lean mass and fat mass with 0.1kg precision', () => {
      const comp = calculateBodyComposition(80.0, 15.0);
      expect(comp).not.toBeNull();
      // Fat = 80 * 0.15 = 12.0 kg; Lean = 80 - 12 = 68.0 kg
      expect(comp?.fatMassKg).toBe(12.0);
      expect(comp?.leanMassKg).toBe(68.0);
    });

    it('handles decimal weight and body fat with accurate 1-decimal rounding', () => {
      const comp = calculateBodyComposition(82.7, 14.3);
      expect(comp).not.toBeNull();
      // 82.7 * 0.143 = 11.8261 -> 11.8 kg
      // Lean = 82.7 - 11.8 = 70.9 kg
      expect(comp?.fatMassKg).toBe(11.8);
      expect(comp?.leanMassKg).toBe(70.9);
      expect(Number((comp!.fatMassKg + comp!.leanMassKg).toFixed(1))).toBe(82.7);
    });

    it('returns null for missing, null, or negative body fat percentage', () => {
      expect(calculateBodyComposition(80.0, undefined)).toBeNull();
      expect(calculateBodyComposition(80.0, null)).toBeNull();
      expect(calculateBodyComposition(80.0, -5)).toBeNull();
      expect(calculateBodyComposition(0, 15)).toBeNull();
      expect(calculateBodyComposition(-80, 15)).toBeNull();
    });

    it('handles extreme body fat % (stage lean 5% to high fat 40%)', () => {
      const lean = calculateBodyComposition(75.0, 5.0);
      expect(lean?.fatMassKg).toBe(3.8);
      expect(lean?.leanMassKg).toBe(71.2);

      const highFat = calculateBodyComposition(110.0, 40.0);
      expect(highFat?.fatMassKg).toBe(44.0);
      expect(highFat?.leanMassKg).toBe(66.0);
    });
  });

  describe('mapWeightHistoryToChart', () => {
    it('handles empty weight history gracefully', () => {
      const data = mapWeightHistoryToChart([]);
      expect(data.points).toEqual([]);
      expect(data.currentWeight).toBeNull();
      expect(data.currentMA).toBeNull();
      expect(data.trendDirection).toBe('stable');
    });

    it('maps history points to normalized percentages and computes trend direction', () => {
      const history: WeightHistoryPoint[] = [
        { date: '2026-11-01', weightKg: 85.0, movingAverage: 85.0 },
        { date: '2026-11-02', weightKg: 84.5, movingAverage: 84.8 },
        { date: '2026-11-03', weightKg: 84.0, movingAverage: 84.5 },
        { date: '2026-11-04', weightKg: 83.5, movingAverage: 84.2 },
        { date: '2026-11-05', weightKg: 83.0, movingAverage: 83.9 },
      ];

      const data = mapWeightHistoryToChart(history, 30);
      expect(data.points.length).toBe(5);
      expect(data.currentWeight).toBe(83.0);
      expect(data.currentMA).toBe(83.9);
      expect(data.weightDeltaVsMA).toBe(-0.9);
      expect(data.trendDirection).toBe('down');
      expect(data.yTicks.length).toBe(4);

      // First point xPct = 0%, last point xPct = 100%
      expect(data.points[0].xPct).toBe(0);
      expect(data.points[4].xPct).toBe(100);
    });

    it('detects upward weight trend direction', () => {
      const history: WeightHistoryPoint[] = [
        { date: '2026-11-01', weightKg: 80.0, movingAverage: 80.0 },
        { date: '2026-11-02', weightKg: 81.0, movingAverage: 80.8 },
        { date: '2026-11-03', weightKg: 82.0, movingAverage: 81.5 },
      ];
      const data = mapWeightHistoryToChart(history);
      expect(data.trendDirection).toBe('up');
    });
  });

  describe('photoComparison utilities', () => {
    describe('extractPoseFromUri', () => {
      it('identifies front pose from uri keywords', () => {
        expect(extractPoseFromUri('file:///data/photos/20261101_front_123.jpg')).toBe('front');
        expect(extractPoseFromUri('photo_frente.png')).toBe('front');
      });

      it('identifies side pose from uri keywords', () => {
        expect(extractPoseFromUri('file:///data/photos/20261101_side_123.jpg')).toBe('side');
        expect(extractPoseFromUri('photo_lateral.png')).toBe('side');
        expect(extractPoseFromUri('photo_perfil.png')).toBe('side');
      });

      it('identifies back pose from uri keywords', () => {
        expect(extractPoseFromUri('file:///data/photos/20261101_back_123.jpg')).toBe('back');
        expect(extractPoseFromUri('photo_costas.png')).toBe('back');
      });

      it('returns other for general or unclassified uris', () => {
        expect(extractPoseFromUri('file:///data/photos/20261101_random.jpg')).toBe('other');
        expect(extractPoseFromUri('')).toBe('other');
      });
    });

    describe('calculatePhotoDeltaMetrics', () => {
      it('calculates days between and metric deltas correctly', () => {
        const beforeLog: BodyLog = {
          id: 'log-1',
          date: '2026-10-01',
          weightKg: 85.0,
          bodyFatPct: 18.0,
          waistCm: 88.0,
          createdAt: '2026-10-01T08:00:00Z',
        };

        const afterLog: BodyLog = {
          id: 'log-2',
          date: '2026-11-01',
          weightKg: 81.5,
          bodyFatPct: 14.5,
          waistCm: 83.0,
          createdAt: '2026-11-01T08:00:00Z',
        };

        const deltas = calculatePhotoDeltaMetrics(beforeLog, afterLog, '2026-10-01', '2026-11-01');

        expect(deltas.daysBetween).toBe(31);
        expect(deltas.weightDeltaKg).toBe(-3.5);
        expect(deltas.bodyFatDeltaPct).toBe(-3.5);
        expect(deltas.waistDeltaCm).toBe(-5.0);
      });

      it('returns nulls when logs are missing or measurements not logged', () => {
        const deltas = calculatePhotoDeltaMetrics(null, null, '2026-10-01', '2026-10-15');
        expect(deltas.daysBetween).toBe(14);
        expect(deltas.weightDeltaKg).toBeNull();
        expect(deltas.bodyFatDeltaPct).toBeNull();
        expect(deltas.waistDeltaCm).toBeNull();
      });
    });

    describe('getInitialComparisonIndices', () => {
      it('returns null if photos count is less than 2', () => {
        expect(getInitialComparisonIndices(0)).toBeNull();
        expect(getInitialComparisonIndices(1)).toBeNull();
      });

      it('pairs newest photo (index 0) with oldest baseline (index count - 1)', () => {
        const pairing = getInitialComparisonIndices(5);
        expect(pairing).toEqual({
          afterIndex: 0,
          beforeIndex: 4,
        });
      });
    });

    describe('resolvePhotoUri', () => {
      it('preserves remote http, https, data, and file schemas', () => {
        expect(resolvePhotoUri('https://example.com/photo.jpg')).toBe('https://example.com/photo.jpg');
        expect(resolvePhotoUri('file:///data/photos/1.jpg')).toBe('file:///data/photos/1.jpg');
        expect(resolvePhotoUri('data:image/jpeg;base64,abc')).toBe('data:image/jpeg;base64,abc');
      });

      it('handles empty uri gracefully', () => {
        expect(resolvePhotoUri('')).toBe('');
      });
    });
  });
});
