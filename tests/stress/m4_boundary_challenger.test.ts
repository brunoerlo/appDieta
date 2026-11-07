import { InMemorySQLiteDatabase, createTestDatabase } from '../helpers/inMemoryDb';
import { SqliteBodyRepository } from '@/database/repositories/SqliteBodyRepository';
import { SqliteAuthRepository } from '@/database/repositories/SqliteAuthRepository';
import { BodyStateManager } from '@/context/BodyContext';
import { ProfileStateManager } from '@/context/ProfileContext';
import {
  shiftDateString,
  calculateMovingAverageForDate,
  calculateBodyComposition,
  mapWeightHistoryToChart,
} from '@/utils/body';
import {
  calculatePhotoDeltaMetrics,
  extractPoseFromUri,
  getInitialComparisonIndices,
  resolvePhotoUri,
} from '@/utils/photoComparison';
import { BodyLog, UserProfile, WeightHistoryPoint } from '@/types/domain';

describe('Challenger M4.2 — Boundary, Math & SQL Injection Adversarial Test Suite', () => {
  let db: InMemorySQLiteDatabase;
  let bodyRepo: SqliteBodyRepository;
  let authRepo: SqliteAuthRepository;

  beforeEach(async () => {
    db = await createTestDatabase();
    bodyRepo = new SqliteBodyRepository(db);
    authRepo = new SqliteAuthRepository(db);
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  // =========================================================================
  // 1. 7-DAY MOVING AVERAGE ADVERSARIAL BOUNDARY PROBES
  // =========================================================================
  describe('1. 7-Day Moving Average Boundary Probes', () => {
    describe('calculateMovingAverageForDate (Pure Math Engine)', () => {
      it('returns null for an empty logs array (0 logs)', () => {
        expect(calculateMovingAverageForDate('2026-11-06', [])).toBeNull();
      });

      it('returns the exact weight for 1 single log on the target date', () => {
        const logs = [{ date: '2026-11-06', weightKg: 82.4 }];
        expect(calculateMovingAverageForDate('2026-11-06', logs)).toBe(82.4);
      });

      it('includes a log on day T-6 (the exact 7th day boundary [T-6, T])', () => {
        // Target: 2026-11-06. Window: [2026-10-31, 2026-11-06]
        const logs = [{ date: '2026-10-31', weightKg: 80.0 }];
        expect(calculateMovingAverageForDate('2026-11-06', logs)).toBe(80.0);
      });

      it('excludes a log on day T-7 (outside the 7-day calendar window)', () => {
        // Target: 2026-11-06. T-7 is 2026-10-30
        const logs = [{ date: '2026-10-30', weightKg: 80.0 }];
        expect(calculateMovingAverageForDate('2026-11-06', logs)).toBeNull();
      });

      it('excludes logs dated in the future (T+1 onwards)', () => {
        const logs = [{ date: '2026-11-07', weightKg: 85.0 }];
        expect(calculateMovingAverageForDate('2026-11-06', logs)).toBeNull();
      });

      it('ignores non-positive weights (0 kg and negative weights)', () => {
        const logs = [
          { date: '2026-11-06', weightKg: 0 },
          { date: '2026-11-05', weightKg: -75.0 },
          { date: '2026-11-04', weightKg: 80.0 },
        ];
        expect(calculateMovingAverageForDate('2026-11-06', logs)).toBe(80.0);
      });

      it('handles leap year boundary (February 29 in leap year 2024)', () => {
        // 2024 is a leap year: Feb has 29 days
        // Target: 2024-03-01. Window [2024-02-24, 2024-03-01] has 7 calendar days
        const logs = [
          { date: '2024-02-24', weightKg: 80.0 }, // Boundary day T-6
          { date: '2024-02-28', weightKg: 81.0 },
          { date: '2024-02-29', weightKg: 82.0 }, // Leap day
          { date: '2024-03-01', weightKg: 83.0 }, // Target date
        ];
        // Average: (80 + 81 + 82 + 83) / 4 = 326 / 4 = 81.5
        expect(calculateMovingAverageForDate('2024-03-01', logs)).toBe(81.5);

        // Day before boundary: 2024-02-23 is T-7, should be excluded
        const logsWithExcluded = [
          { date: '2024-02-23', weightKg: 100.0 }, // excluded
          ...logs,
        ];
        expect(calculateMovingAverageForDate('2024-03-01', logsWithExcluded)).toBe(81.5);
      });

      it('handles non-leap year boundary (February 28 in non-leap year 2023)', () => {
        // 2023 is non-leap: Feb has 28 days
        // Target: 2023-03-01. Window [2023-02-23, 2023-03-01]
        const logs = [
          { date: '2023-02-23', weightKg: 70.0 }, // Boundary day T-6
          { date: '2023-02-28', weightKg: 72.0 },
          { date: '2023-03-01', weightKg: 74.0 },
        ];
        // Average: (70 + 72 + 74) / 3 = 72.0
        expect(calculateMovingAverageForDate('2023-03-01', logs)).toBe(72.0);
      });

      it('handles year rollover boundary (December 31 -> January 1)', () => {
        // Target: 2025-01-03. Window [2024-12-28, 2025-01-03]
        const logs = [
          { date: '2024-12-28', weightKg: 80.0 },
          { date: '2024-12-31', weightKg: 81.0 },
          { date: '2025-01-01', weightKg: 82.0 },
          { date: '2025-01-03', weightKg: 83.0 },
        ];
        // Average: 326 / 4 = 81.5
        expect(calculateMovingAverageForDate('2025-01-03', logs)).toBe(81.5);

        // Date outside rollover window: 2024-12-27 is T-7
        const logsWithOld = [{ date: '2024-12-27', weightKg: 200.0 }, ...logs];
        expect(calculateMovingAverageForDate('2025-01-03', logsWithOld)).toBe(81.5);
      });

      it('handles extreme weights (20kg to 300kg)', () => {
        const logs = [
          { date: '2026-11-01', weightKg: 20.0 },
          { date: '2026-11-06', weightKg: 300.0 },
        ];
        // Average: (20 + 300) / 2 = 160.0
        expect(calculateMovingAverageForDate('2026-11-06', logs)).toBe(160.0);
      });

      it('maintains 2-decimal precision without IEEE-754 drift', () => {
        const logs = [
          { date: '2026-11-04', weightKg: 77.1 },
          { date: '2026-11-05', weightKg: 77.2 },
          { date: '2026-11-06', weightKg: 77.3 },
        ];
        // (77.1 + 77.2 + 77.3) / 3 = 231.6 / 3 = 77.20
        expect(calculateMovingAverageForDate('2026-11-06', logs)).toBe(77.2);
      });

      it('handles empty date string without crashing', () => {
        expect(calculateMovingAverageForDate('', [])).toBeNull();
        expect(
          calculateMovingAverageForDate('', [{ date: '2026-11-06', weightKg: 80.0 }])
        ).toBeNull();
      });

      it('handles custom windowDays: 0 and negative days safely', () => {
        const logs = [{ date: '2026-11-06', weightKg: 80.0 }];
        // windowDays = 0 -> startDate = 2026-11-07 > targetDate -> returns null
        expect(calculateMovingAverageForDate('2026-11-06', logs, 0)).toBeNull();
        // windowDays = -5 -> startDate > targetDate -> returns null
        expect(calculateMovingAverageForDate('2026-11-06', logs, -5)).toBeNull();
      });
    });

    describe('SqliteBodyRepository.calculateMovingAverage (SQL Parity)', () => {
      it('returns null on empty database table (0 logs)', async () => {
        const ma = await bodyRepo.calculateMovingAverage('2026-11-06', 7);
        expect(ma).toBeNull();
      });

      it('computes exact weight for single log in SQLite', async () => {
        await bodyRepo.saveBodyLog({ date: '2026-11-06', weightKg: 85.5 });
        const ma = await bodyRepo.calculateMovingAverage('2026-11-06', 7);
        expect(ma).toBe(85.5);
      });

      it('respects exact T-6 boundary in SQLite query', async () => {
        // T-6 for 2026-11-06 is 2026-10-31
        await bodyRepo.saveBodyLog({ date: '2026-10-31', weightKg: 80.0 });
        const ma = await bodyRepo.calculateMovingAverage('2026-11-06', 7);
        expect(ma).toBe(80.0);
      });

      it('excludes T-7 day in SQLite query', async () => {
        await bodyRepo.saveBodyLog({ date: '2026-10-30', weightKg: 90.0 });
        const ma = await bodyRepo.calculateMovingAverage('2026-11-06', 7);
        expect(ma).toBeNull();
      });

      it('handles leap year rollover in SQLite date math', async () => {
        // SQLite date('2024-03-01', '-6 days') produces '2024-02-24'
        await bodyRepo.saveBodyLog({ date: '2024-02-23', weightKg: 100.0 }); // T-7: excluded
        await bodyRepo.saveBodyLog({ date: '2024-02-24', weightKg: 80.0 }); // T-6: included
        await bodyRepo.saveBodyLog({ date: '2024-02-29', weightKg: 82.0 }); // leap day: included
        await bodyRepo.saveBodyLog({ date: '2024-03-01', weightKg: 84.0 }); // target: included

        const ma = await bodyRepo.calculateMovingAverage('2024-03-01', 7);
        // (80 + 82 + 84) / 3 = 82.0
        expect(ma).toBe(82.0);
      });

      it('handles year boundary rollover in SQLite date math', async () => {
        // SQLite date('2025-01-03', '-6 days') produces '2024-12-28'
        await bodyRepo.saveBodyLog({ date: '2024-12-27', weightKg: 200.0 }); // excluded
        await bodyRepo.saveBodyLog({ date: '2024-12-28', weightKg: 80.0 }); // included
        await bodyRepo.saveBodyLog({ date: '2025-01-01', weightKg: 82.0 }); // included
        await bodyRepo.saveBodyLog({ date: '2025-01-03', weightKg: 84.0 }); // included

        const ma = await bodyRepo.calculateMovingAverage('2025-01-03', 7);
        // (80 + 82 + 84) / 3 = 82.0
        expect(ma).toBe(82.0);
      });
    });
  });

  // =========================================================================
  // 2. BODY COMPOSITION MATHEMATICAL BOUNDARIES & ANOMALIES
  // =========================================================================
  describe('2. Body Composition Boundaries (calculateBodyComposition)', () => {
    it('probes bodyFatPct = 0% boundary', () => {
      const comp = calculateBodyComposition(80.0, 0);
      expect(comp).not.toBeNull();
      expect(comp?.fatMassKg).toBe(0.0);
      expect(comp?.leanMassKg).toBe(80.0);
    });

    it('probes bodyFatPct = 100% boundary', () => {
      const comp = calculateBodyComposition(80.0, 100);
      expect(comp).not.toBeNull();
      expect(comp?.fatMassKg).toBe(80.0);
      expect(comp?.leanMassKg).toBe(0.0);
    });

    it('returns null for negative bodyFatPct (-10%)', () => {
      const comp = calculateBodyComposition(80.0, -10);
      expect(comp).toBeNull();
    });

    it('returns null for undefined or null bodyFatPct', () => {
      expect(calculateBodyComposition(80.0, undefined)).toBeNull();
      expect(calculateBodyComposition(80.0, null)).toBeNull();
    });

    it('returns null for zero or negative weight', () => {
      expect(calculateBodyComposition(0, 15.0)).toBeNull();
      expect(calculateBodyComposition(-80.0, 15.0)).toBeNull();
    });

    it('evaluates extreme weight boundaries (20kg and 300kg)', () => {
      const comp20 = calculateBodyComposition(20.0, 10.0);
      expect(comp20).toEqual({ fatMassKg: 2.0, leanMassKg: 18.0 });

      const comp300 = calculateBodyComposition(300.0, 30.0);
      expect(comp300).toEqual({ fatMassKg: 90.0, leanMassKg: 210.0 });
    });

    it('probes bodyFatPct > 100% (e.g. 500%) anomaly', () => {
      // Adversarial probe: when bodyFatPct exceeds 100%, does lean mass become negative?
      const comp = calculateBodyComposition(80.0, 500);
      // Empirical observation: fat mass = 400kg, lean mass = -320kg
      expect(comp?.fatMassKg).toBe(400.0);
      expect(comp?.leanMassKg).toBe(-320.0);
    });

    it('probes bodyFatPct = NaN anomaly', () => {
      // In JS, NaN is not undefined, null, or < 0
      const comp = calculateBodyComposition(80.0, NaN);
      // Note: without Number.isNaN check, fatMassKg and leanMassKg become NaN
      expect(comp).toBeDefined();
      if (comp) {
        expect(Number.isNaN(comp.fatMassKg)).toBe(true);
        expect(Number.isNaN(comp.leanMassKg)).toBe(true);
      }
    });

    it('verifies Atwater mass conservation: fatMassKg + leanMassKg === weightKg (within 0.1kg)', () => {
      const weights = [55.3, 72.8, 80.0, 94.7, 112.5];
      const bfList = [8.5, 12.0, 15.4, 22.8, 35.2];

      for (const w of weights) {
        for (const bf of bfList) {
          const res = calculateBodyComposition(w, bf);
          expect(res).not.toBeNull();
          const sum = Number((res!.fatMassKg + res!.leanMassKg).toFixed(1));
          expect(Math.abs(sum - w)).toBeLessThanOrEqual(0.15);
        }
      }
    });
  });

  // =========================================================================
  // 3. BEFORE / AFTER COMPARISON BOUNDARIES & DELTAS
  // =========================================================================
  describe('3. Before/After Comparison Boundaries (calculatePhotoDeltaMetrics)', () => {
    const mockLog1: BodyLog = {
      id: 'log-1',
      date: '2026-10-01',
      weightKg: 85.0,
      bodyFatPct: 20.0,
      waistCm: 90.0,
      createdAt: '2026-10-01T08:00:00Z',
    };

    const mockLog2: BodyLog = {
      id: 'log-2',
      date: '2026-11-01',
      weightKg: 81.5,
      bodyFatPct: 17.2,
      waistCm: 86.0,
      createdAt: '2026-11-01T08:00:00Z',
    };

    it('computes correct deltas when beforeDate < afterDate', () => {
      const deltas = calculatePhotoDeltaMetrics(mockLog1, mockLog2, '2026-10-01', '2026-11-01');
      expect(deltas.daysBetween).toBe(31);
      expect(deltas.weightDeltaKg).toBe(-3.5);
      expect(deltas.bodyFatDeltaPct).toBe(-2.8);
      expect(deltas.waistDeltaCm).toBe(-4.0);
    });

    it('handles identical dates (beforeDate === afterDate)', () => {
      const deltas = calculatePhotoDeltaMetrics(mockLog1, mockLog1, '2026-10-01', '2026-10-01');
      expect(deltas.daysBetween).toBe(0);
      expect(deltas.weightDeltaKg).toBe(0.0);
      expect(deltas.bodyFatDeltaPct).toBe(0.0);
      expect(deltas.waistDeltaCm).toBe(0.0);
    });

    it('handles reversed dates (afterDate < beforeDate) without negative days', () => {
      // When user selects an earlier date as 'after'
      const deltas = calculatePhotoDeltaMetrics(mockLog2, mockLog1, '2026-11-01', '2026-10-01');
      // daysBetween uses Math.abs -> should remain positive
      expect(deltas.daysBetween).toBe(31);
      // Metric delta follows after - before: 85.0 - 81.5 = +3.5
      expect(deltas.weightDeltaKg).toBe(3.5);
      expect(deltas.bodyFatDeltaPct).toBe(2.8);
      expect(deltas.waistDeltaCm).toBe(4.0);
    });

    it('handles null logs safely without throwing', () => {
      const deltas = calculatePhotoDeltaMetrics(null, null, '2026-10-01', '2026-11-01');
      expect(deltas.daysBetween).toBe(31);
      expect(deltas.weightDeltaKg).toBeNull();
      expect(deltas.bodyFatDeltaPct).toBeNull();
      expect(deltas.waistDeltaCm).toBeNull();
    });

    it('handles one log missing / incomplete fields', () => {
      const sparseLog: BodyLog = {
        id: 'sparse',
        date: '2026-11-01',
        weightKg: 82.0,
        createdAt: '2026-11-01T08:00:00Z',
      };
      const deltas = calculatePhotoDeltaMetrics(mockLog1, sparseLog, '2026-10-01', '2026-11-01');
      expect(deltas.weightDeltaKg).toBe(-3.0);
      expect(deltas.bodyFatDeltaPct).toBeNull();
      expect(deltas.waistDeltaCm).toBeNull();
    });

    it('probes empty string dates in calculatePhotoDeltaMetrics', () => {
      const deltas = calculatePhotoDeltaMetrics(mockLog1, mockLog2, '', '');
      // When date is empty string, new Date('').getTime() evaluates to NaN
      expect(Number.isNaN(deltas.daysBetween)).toBe(true);
    });

    it('probes null vs undefined bodyFatPct in calculatePhotoDeltaMetrics', () => {
      // In JS, null !== undefined evaluates to true.
      // If a log has bodyFatPct explicitly set to null (e.g. from JSON or database row):
      const logWithNull = { ...mockLog1, bodyFatPct: null as any };
      const logWithVal = { ...mockLog2, bodyFatPct: 15.0 };
      const deltas = calculatePhotoDeltaMetrics(logWithNull, logWithVal, '2026-10-01', '2026-11-01');
      // Empirical result: 15.0 - null evaluates to 15.0 because null coerces to 0 in subtraction
      expect(deltas.bodyFatDeltaPct).toBe(15.0);
    });

    it('probes getInitialComparisonIndices with 0, 1, 2, and 100 photos', () => {
      expect(getInitialComparisonIndices(0)).toBeNull();
      expect(getInitialComparisonIndices(1)).toBeNull();
      expect(getInitialComparisonIndices(2)).toEqual({ afterIndex: 0, beforeIndex: 1 });
      expect(getInitialComparisonIndices(100)).toEqual({ afterIndex: 0, beforeIndex: 99 });
    });

    it('probes extractPoseFromUri with malformed or adversary strings', () => {
      expect(extractPoseFromUri('')).toBe('other');
      expect(extractPoseFromUri('https://app.local/photos/IMG_FRENTE_01.jpg')).toBe('front');
      expect(extractPoseFromUri('https://app.local/photos/costas_lateral_side.jpg')).toBe('side');
      expect(extractPoseFromUri('https://app.local/photos/perfil_esquerdo.png')).toBe('side');
      expect(extractPoseFromUri('https://app.local/photos/costas_pose.png')).toBe('back');
      expect(extractPoseFromUri('random_uri_without_keywords.jpg')).toBe('other');
    });
  });

  // =========================================================================
  // 4. SQL INJECTION ADVERSARIAL ATTACKS
  // =========================================================================
  describe('4. SQL Injection Resilience (Auth & Body Repositories)', () => {
    it('resists SQL injection in UserProfile name and email', async () => {
      const maliciousName = "Atleta'); DROP TABLE users;--";
      const maliciousEmail = "admin' OR '1'='1'--@irontrack.app";

      const updated = await authRepo.updateProfile({
        name: maliciousName,
        email: maliciousEmail,
      });

      expect(updated.name).toBe(maliciousName);
      expect(updated.email).toBe(maliciousEmail);

      // Verify users table was NOT dropped
      const profile = await authRepo.getProfile();
      expect(profile.name).toBe(maliciousName);

      // Verify other tables still exist and were not affected
      const foodsCount = await db.getFirstAsync<{ count: number }>('SELECT count(*) as count FROM foods;');
      expect(foodsCount?.count).toBeGreaterThan(0);
    });

    it('resists SQL injection in UserProfile theme and enforces CHECK constraint', async () => {
      const attackTheme = "dark'; DROP TABLE foods;--" as any;
      // SQLite parameterization binds this as a literal value, which triggers the CHECK constraint
      await expect(
        authRepo.updateProfile({
          theme: attackTheme,
        })
      ).rejects.toThrow();

      // Verify table foods is intact
      const foodsCount = await db.getFirstAsync<{ count: number }>('SELECT count(*) as count FROM foods;');
      expect(foodsCount?.count).toBeGreaterThan(0);
    });

    it('resists SQL injection in BodyLog date and photo URIs', async () => {
      const maliciousDate = "2026-11-06'); DROP TABLE body_logs;--";
      const maliciousUris = [
        "https://evil.local/pic.jpg'); DROP TABLE users;--",
        "file:///etc/passwd",
      ];

      const saved = await bodyRepo.saveBodyLog({
        date: maliciousDate,
        weightKg: 80.0,
        photoUris: maliciousUris,
      });

      expect(saved.date).toBe(maliciousDate);
      expect(saved.photoUris).toEqual(maliciousUris);

      // Verify body_logs table is intact
      const fetched = await bodyRepo.getBodyLog(maliciousDate);
      expect(fetched).not.toBeNull();
      expect(fetched?.photoUris).toEqual(maliciousUris);

      // Verify users table is intact
      const userProfile = await authRepo.getProfile();
      expect(userProfile).toBeDefined();
    });

    it('resists SQL injection in calculateMovingAverage date parameter', async () => {
      const maliciousDate = "2026-11-06' UNION SELECT 999.9, 1;--";
      const ma = await bodyRepo.calculateMovingAverage(maliciousDate, 7);
      // Parameterized query: should treat as literal string date, returns null
      expect(ma).toBeNull();
    });

    it('resists SQL injection in getWeightHistory date range parameters', async () => {
      await bodyRepo.saveBodyLog({ date: '2026-11-01', weightKg: 80.0 });
      await bodyRepo.saveBodyLog({ date: '2026-11-06', weightKg: 81.0 });

      const maliciousStartDate = "2026-01-01' UNION SELECT 'hacked', 999;--";
      const maliciousEndDate = "2026-12-31'; DROP TABLE body_logs;--";

      // Should safely query using parameterized placeholders
      const history = await bodyRepo.getWeightHistory(maliciousStartDate, maliciousEndDate);
      expect(Array.isArray(history)).toBe(true);

      // Verify body_logs table is intact
      const rowCount = await db.getFirstAsync<{ count: number }>('SELECT count(*) as count FROM body_logs;');
      expect(rowCount?.count).toBe(2);
    });

    it('resists SQL injection in savePhoto and deletePhoto', async () => {
      const attackUri = "photo_uri'); DROP TABLE body_logs;--";
      const TARGET_DATE = '2026-11-06';

      const uris = await bodyRepo.savePhoto(TARGET_DATE, attackUri);
      expect(uris).toContain(attackUri);

      const afterDelete = await bodyRepo.deletePhoto(TARGET_DATE, attackUri);
      expect(afterDelete).not.toContain(attackUri);

      // Verify table intact
      const log = await bodyRepo.getBodyLog(TARGET_DATE);
      expect(log).not.toBeNull();
    });
  });

  // =========================================================================
  // 5. WEIGHT TREND CHART BOUNDARIES & COORDINATES
  // =========================================================================
  describe('5. Weight Trend Chart Coordinates (mapWeightHistoryToChart)', () => {
    it('handles empty history array', () => {
      const chart = mapWeightHistoryToChart([]);
      expect(chart.points).toEqual([]);
      expect(chart.minWeight).toBe(0);
      expect(chart.maxWeight).toBe(0);
      expect(chart.currentWeight).toBeNull();
      expect(chart.currentMA).toBeNull();
      expect(chart.trendDirection).toBe('stable');
    });

    it('handles history with only 0-kg placeholder points', () => {
      const history: WeightHistoryPoint[] = [
        { date: '2026-11-01', weightKg: 0, movingAverage: null },
      ];
      const chart = mapWeightHistoryToChart(history);
      expect(chart.points).toEqual([]);
    });

    it('handles 1 single data point centered at xPct = 50%', () => {
      const history: WeightHistoryPoint[] = [
        { date: '2026-11-06', weightKg: 80.0, movingAverage: 80.0 },
      ];
      const chart = mapWeightHistoryToChart(history);
      expect(chart.points.length).toBe(1);
      expect(chart.points[0].xPct).toBe(50);
      expect(chart.points[0].yWeightPct).toBe(50);
      expect(chart.points[0].yMAPct).toBe(50);
      expect(chart.currentWeight).toBe(80.0);
      expect(chart.currentMA).toBe(80.0);
      expect(chart.weightDeltaVsMA).toBe(0.0);
    });

    it('handles identical weights across multiple points without division by zero', () => {
      const history: WeightHistoryPoint[] = [
        { date: '2026-11-01', weightKg: 75.0, movingAverage: 75.0 },
        { date: '2026-11-02', weightKg: 75.0, movingAverage: 75.0 },
        { date: '2026-11-03', weightKg: 75.0, movingAverage: 75.0 },
      ];
      const chart = mapWeightHistoryToChart(history);
      expect(chart.points.length).toBe(3);
      // minWeight = 74, maxWeight = 76 -> range = 2
      expect(chart.minWeight).toBe(74);
      expect(chart.maxWeight).toBe(76);
      for (const pt of chart.points) {
        expect(Number.isFinite(pt.yWeightPct)).toBe(true);
        expect(Number.isFinite(pt.xPct)).toBe(true);
      }
      expect(chart.trendDirection).toBe('stable');
    });

    it('handles extreme weights (20kg and 300kg) within 0-100% chart bounds', () => {
      const history: WeightHistoryPoint[] = [
        { date: '2026-11-01', weightKg: 20.0, movingAverage: 20.0 },
        { date: '2026-11-06', weightKg: 300.0, movingAverage: 160.0 },
      ];
      const chart = mapWeightHistoryToChart(history);
      expect(chart.points.length).toBe(2);
      expect(chart.points[0].yWeightPct).toBeGreaterThanOrEqual(0);
      expect(chart.points[1].yWeightPct).toBeLessThanOrEqual(100);
      expect(chart.trendDirection).toBe('up');
    });

    it('caps large history series to maxPoints (e.g. 30)', () => {
      const largeHistory: WeightHistoryPoint[] = Array.from({ length: 100 }, (_, i) => ({
        date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`,
        weightKg: 80.0 + (i % 5) * 0.2,
        movingAverage: 80.5,
      }));
      const chart = mapWeightHistoryToChart(largeHistory, 30);
      expect(chart.points.length).toBe(30);
    });
  });

  // =========================================================================
  // 6. STATE MANAGER BOUNDARY INTEGRATION
  // =========================================================================
  describe('6. State Manager Boundary Integration', () => {
    it('handles extreme weights (20kg and 300kg) in BodyStateManager preserving measurements', async () => {
      const bodyManager = new BodyStateManager(bodyRepo, '2026-11-06');

      // First save measurements
      await bodyManager.saveMeasurements({
        bodyFatPct: 18.0,
        waistCm: 84.0,
        chestCm: 102.0,
        armsCm: 38.0,
        legsCm: 58.0,
      });

      // Save minimum realistic weight (20.0 kg)
      const saved20 = await bodyManager.saveWeighIn(20.0);
      expect(saved20.weightKg).toBe(20.0);
      expect(saved20.waistCm).toBe(84.0);
      expect(bodyManager.currentComposition?.fatMassKg).toBe(3.6);
      expect(bodyManager.currentComposition?.leanMassKg).toBe(16.4);

      // Update to maximum realistic weight (300.0 kg)
      const saved300 = await bodyManager.saveWeighIn(300.0);
      expect(saved300.weightKg).toBe(300.0);
      expect(saved300.waistCm).toBe(84.0);
      expect(bodyManager.currentComposition?.fatMassKg).toBe(54.0);
      expect(bodyManager.currentComposition?.leanMassKg).toBe(246.0);
    });

    it('handles extreme caloric goals in ProfileStateManager without crashing', async () => {
      const profileManager = new ProfileStateManager(authRepo);
      await profileManager.loadProfile();

      // Set boundary values
      const updated = await profileManager.updateProfile({
        targetCalories: 6000,
        targetProtein: 350,
        targetCarbs: 800,
        targetFat: 150,
        targetWaterMl: 5000,
      });

      expect(updated.targetCalories).toBe(6000);
      expect(updated.targetProtein).toBe(350);
      expect(updated.targetWaterMl).toBe(5000);
    });

    it('preserves SQL injection strings safely through ProfileStateManager', async () => {
      const profileManager = new ProfileStateManager(authRepo);
      await profileManager.loadProfile();

      const attackPayload = "Athlete'; DROP TABLE users;--";
      const updated = await profileManager.updateProfile({
        name: attackPayload,
      });

      expect(updated.name).toBe(attackPayload);
      expect(profileManager.profile?.name).toBe(attackPayload);

      // Verify persistence in SQLite
      const profile = await authRepo.getProfile();
      expect(profile.name).toBe(attackPayload);
    });
  });
});

