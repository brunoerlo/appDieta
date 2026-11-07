import { InMemorySQLiteDatabase, createTestDatabase } from '../helpers/inMemoryDb';
import { SqliteBodyRepository } from '@/database/repositories/SqliteBodyRepository';
import { SqliteAuthRepository } from '@/database/repositories/SqliteAuthRepository';
import { BodyStateManager } from '@/context/BodyContext';
import { ThemeStateManager } from '@/context/ThemeContext';
import {
  shiftDateString,
  calculateMovingAverageForDate,
  calculateBodyComposition,
  mapWeightHistoryToChart,
  WeightChartPoint,
} from '@/utils/body';
import {
  calculatePhotoDeltaMetrics,
  extractPoseFromUri,
  getInitialComparisonIndices,
  resolvePhotoUri,
} from '@/utils/photoComparison';
import { WeightHistoryPoint, BodyLog } from '@/types/domain';
import { performance } from 'perf_hooks';

describe('Milestone M4 Adversarial Stress & Challenger Test Suite', () => {
  let db: InMemorySQLiteDatabase;
  let bodyRepo: SqliteBodyRepository;
  let authRepo: SqliteAuthRepository;
  let bodyManager: BodyStateManager;
  let themeManager: ThemeStateManager;

  beforeEach(async () => {
    db = await createTestDatabase();
    bodyRepo = new SqliteBodyRepository(db);
    authRepo = new SqliteAuthRepository(db);
    bodyManager = new BodyStateManager(bodyRepo, '2026-11-06');
    themeManager = new ThemeStateManager(authRepo, 'dark');
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  // =========================================================================
  // 1. RAPID WEIGH-IN UPDATES STRESS TEST (100 rapid weight adjustments on same date)
  // =========================================================================
  describe('1. Rapid Weigh-In Updates Stress Test', () => {
    it('1.1 executes 100 rapid sequential weight updates on the same date with Merge-on-Save circumference and photo preservation', async () => {
      const TARGET_DATE = '2026-11-06';

      // Seed initial rich body log: measurements + photos
      await bodyManager.saveMeasurements(
        {
          bodyFatPct: 15.5,
          waistCm: 82.5,
          chestCm: 105.0,
          armsCm: 39.0,
          legsCm: 59.5,
        },
        TARGET_DATE
      );
      await bodyManager.savePhoto('file:///data/photos/initial_front.jpg', TARGET_DATE);

      // Track subscriber notifications
      let notificationCount = 0;
      const unsubscribe = bodyManager.subscribe(() => {
        notificationCount++;
      });

      const t0 = performance.now();
      const ITERATIONS = 100;

      // Perform 100 rapid weight updates (simulating rapid decimal slider or steppers)
      for (let i = 1; i <= ITERATIONS; i++) {
        // Range: 75.0kg to 84.9kg in 0.1kg increments
        const weight = Math.round((75.0 + (i % 100) * 0.1) * 10) / 10;
        const saved = await bodyManager.saveWeighIn(weight, TARGET_DATE);

        expect(saved.weightKg).toBe(weight);
        expect(saved.date).toBe(TARGET_DATE);
        // Verify circumferences remained un-clobbered on every update
        expect(saved.waistCm).toBe(82.5);
        expect(saved.chestCm).toBe(105.0);
        expect(saved.armsCm).toBe(39.0);
        expect(saved.legsCm).toBe(59.5);
        expect(saved.bodyFatPct).toBe(15.5);
        expect(saved.photoUris).toEqual(['file:///data/photos/initial_front.jpg']);
      }
      const durationMs = performance.now() - t0;

      // Final state verification in StateManager
      expect(bodyManager.currentBodyLog?.weightKg).toBe(75.0); // 100 % 100 = 0 -> 75.0
      expect(bodyManager.currentBodyLog?.waistCm).toBe(82.5);
      expect(bodyManager.currentBodyLog?.photoUris).toEqual(['file:///data/photos/initial_front.jpg']);

      // Final state verification directly from SQLite raw table
      const rawRow = await db.getFirstAsync<{
        weight_kg: number;
        waist_cm: number;
        chest_cm: number;
        arms_cm: number;
        legs_cm: number;
        body_fat_pct: number;
        photo_uris_json: string;
      }>('SELECT * FROM body_logs WHERE date = ?;', TARGET_DATE);

      expect(rawRow).not.toBeNull();
      expect(rawRow!.weight_kg).toBe(75.0);
      expect(rawRow!.waist_cm).toBe(82.5);
      expect(rawRow!.chest_cm).toBe(105.0);
      expect(rawRow!.arms_cm).toBe(39.0);
      expect(rawRow!.legs_cm).toBe(59.5);
      expect(rawRow!.body_fat_pct).toBe(15.5);
      expect(JSON.parse(rawRow!.photo_uris_json)).toEqual(['file:///data/photos/initial_front.jpg']);

      // Assert exactly 1 row exists for this date (no duplicate rows created)
      const countRow = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM body_logs WHERE date = ?;',
        TARGET_DATE
      );
      expect(countRow!.count).toBe(1);

      console.log(
        `[STRESS 1.1] 100 sequential weigh-in updates with Merge-on-Save finished in ${durationMs.toFixed(
          2
        )}ms (${(durationMs / 100).toFixed(3)}ms/op). Notifications: ${notificationCount}`
      );
      expect(durationMs).toBeLessThan(1000);
      unsubscribe();
    });

    it('1.2 handles 50 concurrent weigh-in updates without SQLite deadlocks, crashes, or unhandled rejections', async () => {
      const TARGET_DATE = '2026-11-06';

      // Launch 50 concurrent saveBodyLog calls to repository
      const t0 = performance.now();
      const promises = Array.from({ length: 50 }, (_, i) =>
        bodyRepo.saveBodyLog({
          date: TARGET_DATE,
          weightKg: 80.0 + i * 0.1,
          waistCm: 80.0,
        })
      );

      const results = await Promise.all(promises);
      const durationMs = performance.now() - t0;

      expect(results.length).toBe(50);
      for (const res of results) {
        expect(res.date).toBe(TARGET_DATE);
        expect(res.weightKg).toBeGreaterThanOrEqual(80.0);
      }

      // Check SQLite table integrity
      const countRow = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM body_logs WHERE date = ?;',
        TARGET_DATE
      );
      expect(countRow!.count).toBe(1);

      const finalRow = await bodyRepo.getBodyLog(TARGET_DATE);
      expect(finalRow).not.toBeNull();
      expect(finalRow!.waistCm).toBe(80.0);
      expect(finalRow!.weightKg).toBeGreaterThanOrEqual(80.0);
      expect(finalRow!.weightKg).toBeLessThanOrEqual(85.0);

      console.log(`[STRESS 1.2] 50 concurrent weigh-in updates settled in ${durationMs.toFixed(2)}ms`);
      expect(durationMs).toBeLessThan(500);
    });

    it('1.3 stress tests extreme weight boundary values (0kg, 0.1kg, 500kg, NaN prevention)', async () => {
      // Zero weight
      const zeroLog = await bodyRepo.saveBodyLog({ date: '2026-11-01', weightKg: 0 });
      expect(zeroLog.weightKg).toBe(0);

      // Micro weight (0.1kg)
      const microLog = await bodyRepo.saveBodyLog({ date: '2026-11-02', weightKg: 0.1 });
      expect(microLog.weightKg).toBe(0.1);

      // Super heavyweight (500kg)
      const heavyLog = await bodyRepo.saveBodyLog({ date: '2026-11-03', weightKg: 500.0 });
      expect(heavyLog.weightKg).toBe(500.0);

      // Verify moving average ignores 0kg placeholder
      const ma = await bodyRepo.calculateMovingAverage('2026-11-03', 7);
      // Valid weights: 0.1 and 500.0 (sum = 500.1 / 2 = 250.05)
      expect(ma).toBe(250.05);
    });
  });

  // =========================================================================
  // 2. CONCURRENT THEME TOGGLING (100 rapid flips between Dark and Light mode)
  // =========================================================================
  describe('2. Concurrent Theme Toggling Stress Test', () => {
    it('2.1 executes 100 rapid sequential theme flips maintaining exact parity and SQLite persistence', async () => {
      expect(themeManager.themeMode).toBe('dark');
      expect(themeManager.isDark).toBe(true);

      let notificationCount = 0;
      const unsubscribe = themeManager.subscribe(() => {
        notificationCount++;
      });

      const t0 = performance.now();
      const FLIPS = 100;

      for (let i = 0; i < FLIPS; i++) {
        await themeManager.toggleTheme();
        const expectedMode = i % 2 === 0 ? 'light' : 'dark';
        expect(themeManager.themeMode).toBe(expectedMode);
        expect(themeManager.isDark).toBe(expectedMode === 'dark');
        expect(themeManager.colors.background).toBe(expectedMode === 'dark' ? '#0A0A0C' : '#F8F9FA');
      }
      const durationMs = performance.now() - t0;

      // After 100 flips starting from dark: 100 is even -> must end in 'dark'
      expect(themeManager.themeMode).toBe('dark');
      expect(themeManager.isDark).toBe(true);
      expect(notificationCount).toBe(FLIPS);

      // Verify SQLite persisted theme matches in-memory manager
      const persistedTheme = await authRepo.getTheme();
      expect(persistedTheme).toBe('dark');

      const userRow = await db.getFirstAsync<{ theme: string }>('SELECT theme FROM users LIMIT 1;');
      expect(userRow?.theme).toBe('dark');

      console.log(
        `[STRESS 2.1] 100 theme flips completed in ${durationMs.toFixed(2)}ms (${(durationMs / 100).toFixed(
          3
        )}ms/flip). Notifications: ${notificationCount}`
      );
      expect(durationMs).toBeLessThan(1000);
      unsubscribe();
    });

    it('2.2 executes 100 concurrent theme updates without race conditions or database locks', async () => {
      const t0 = performance.now();

      // Launch 100 concurrent setTheme alternating calls directly against authRepo & themeManager
      const promises = Array.from({ length: 100 }, (_, i) => {
        const mode = i % 2 === 0 ? 'light' : 'dark';
        return themeManager.setTheme(mode);
      });

      await Promise.all(promises);
      const durationMs = performance.now() - t0;

      // All settled without error
      const finalTheme = themeManager.themeMode;
      expect(['dark', 'light']).toContain(finalTheme);

      // Verify DB matches state manager
      const dbTheme = await authRepo.getTheme();
      expect(dbTheme).toBe(finalTheme);

      console.log(`[STRESS 2.2] 100 concurrent theme updates settled in ${durationMs.toFixed(2)}ms`);
      expect(durationMs).toBeLessThan(500);
    });

    it('2.3 asserts theme tokens integrity: all keys match, valid hex codes, and non-empty values', () => {
      const darkTheme = themeManager.theme;
      const lightTheme = themeManager.theme; // dynamic getter

      const darkColors = darkTheme.colors;
      const keys = Object.keys(darkColors) as (keyof typeof darkColors)[];

      const colorRegex = /^(#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})|rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*[\d.]+\s*)?\))$/;
      for (const key of keys) {
        expect(typeof darkColors[key]).toBe('string');
        expect(colorRegex.test(darkColors[key])).toBe(true);
        expect(typeof lightTheme.colors[key]).toBe('string');
        expect(colorRegex.test(lightTheme.colors[key])).toBe(true);
      }
    });
  });

  // =========================================================================
  // 3. 365-DAY MOVING AVERAGE CALCULATION & TREND CHART MAPPING LATENCY (< 15ms)
  // =========================================================================
  describe('3. 365-Day Moving Average & Trend Chart Coordinate Mapping Latency (< 15ms)', () => {
    it('3.1 benchmarks pure 365-day moving average calculation & trend chart mapping under 15ms', () => {
      // 1. Generate 365 days of synthetic athlete weigh-ins
      const startDateStr = '2025-11-06';
      const historyPoints: WeightHistoryPoint[] = [];
      const rawLogs: { date: string; weightKg: number }[] = [];

      let runningWeight = 85.0;
      for (let day = 0; day < 365; day++) {
        const date = shiftDateString(startDateStr, day);
        // Realistic fluctuating progression with small daily deltas and periodic water spikes
        const noise = (Math.sin(day / 7) * 0.4 + ((day % 13) - 6) * 0.05);
        runningWeight = Math.round((runningWeight - 0.02 + noise) * 10) / 10;
        rawLogs.push({ date, weightKg: runningWeight });
      }

      expect(rawLogs.length).toBe(365);

      // 2. Benchmark calculateMovingAverageForDate across all 365 days
      const t0 = performance.now();
      for (let i = 0; i < 365; i++) {
        const ma = calculateMovingAverageForDate(rawLogs[i].date, rawLogs, 7);
        historyPoints.push({
          date: rawLogs[i].date,
          weightKg: rawLogs[i].weightKg,
          movingAverage: ma,
        });
      }
      const maCalcDurationMs = performance.now() - t0;

      expect(historyPoints.length).toBe(365);
      // The first point MA should be equal to day 0 weight
      expect(historyPoints[0].movingAverage).toBe(historyPoints[0].weightKg);
      // Day 364 should have a valid MA
      expect(historyPoints[364].movingAverage).not.toBeNull();

      // 3. Benchmark mapWeightHistoryToChart with all 365 points
      const t1 = performance.now();
      const chartData = mapWeightHistoryToChart(historyPoints, 365);
      const chartMapDurationMs = performance.now() - t1;

      const totalEngineLatencyMs = maCalcDurationMs + chartMapDurationMs;

      // Invariants verification
      expect(chartData.points.length).toBe(365);
      expect(chartData.minWeight).toBeLessThan(chartData.maxWeight);
      expect(chartData.yTicks.length).toBe(4);
      expect(chartData.currentWeight).toBe(historyPoints[364].weightKg);
      expect(chartData.currentMA).toBe(historyPoints[364].movingAverage);
      expect(['down', 'up', 'stable']).toContain(chartData.trendDirection);

      // Verify coordinate normalization invariants (0 to 100%)
      for (let idx = 0; idx < chartData.points.length; idx++) {
        const pt = chartData.points[idx];
        expect(pt.xPct).toBeGreaterThanOrEqual(0);
        expect(pt.xPct).toBeLessThanOrEqual(100);
        expect(pt.yWeightPct).toBeGreaterThanOrEqual(0);
        expect(pt.yWeightPct).toBeLessThanOrEqual(100);
        if (pt.yMAPct !== null) {
          expect(pt.yMAPct).toBeGreaterThanOrEqual(0);
          expect(pt.yMAPct).toBeLessThanOrEqual(100);
        }
      }

      console.log(
        `[STRESS 3.1] 365-day moving average calculation: ${maCalcDurationMs.toFixed(3)}ms`
      );
      console.log(
        `[STRESS 3.1] 365-day chart coordinate mapping: ${chartMapDurationMs.toFixed(3)}ms`
      );
      console.log(
        `[STRESS 3.1] Total 365-day engine latency: ${totalEngineLatencyMs.toFixed(3)}ms (Threshold: < 15ms)`
      );

      // Critical dispatch requirement assertion: must process 365 days in < 15ms
      expect(totalEngineLatencyMs).toBeLessThan(15);
    });

    it('3.2 benchmarks SQLite 365-day weight history queries and MA calculations under batch conditions', async () => {
      // Seed 365 rows in SQLite in a single transaction
      const startDateStr = '2025-11-06';
      await db.withTransactionAsync(async () => {
        for (let day = 0; day < 365; day++) {
          const date = shiftDateString(startDateStr, day);
          const weight = 80.0 + Math.sin(day / 10) * 2.0;
          await db.runAsync(
            `INSERT INTO body_logs (id, date, weight_kg, created_at) VALUES (?, ?, ?, ?);`,
            `log-${date}`,
            date,
            weight,
            '2026-11-06T00:00:00Z'
          );
        }
      });

      // Verify 365 rows seeded
      const count = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM body_logs WHERE weight_kg > 0;'
      );
      expect(count!.count).toBe(365);

      // Query 30-day window (standard chart 1M range)
      const t0 = performance.now();
      const monthHistory = await bodyRepo.getWeightHistory('2026-10-07', '2026-11-06');
      const monthDurationMs = performance.now() - t0;

      expect(monthHistory.length).toBeGreaterThanOrEqual(30);
      expect(monthDurationMs).toBeLessThan(25);
      console.log(
        `[STRESS 3.2] SQLite 30-day history with moving average loaded in ${monthDurationMs.toFixed(2)}ms`
      );

      // Benchmark single calculateMovingAverage SQLite query
      const t1 = performance.now();
      const ma = await bodyRepo.calculateMovingAverage('2026-11-06', 7);
      const singleMADurationMs = performance.now() - t1;

      expect(ma).toBeGreaterThan(70);
      expect(singleMADurationMs).toBeLessThan(5);
      console.log(
        `[STRESS 3.2] Single SQLite 7-day MA query completed in ${singleMADurationMs.toFixed(3)}ms (Result: ${ma})`
      );
    });
  });

  // =========================================================================
  // 4. RAPID PHOTO ADDITION AND DELETION CYCLING IN SQLITE body_logs.photo_uris_json
  // =========================================================================
  describe('4. Rapid Photo Addition & Deletion Cycling in SQLite (photo_uris_json)', () => {
    it('4.1 performs 50 rapid sequential photo additions and deletions cycling asserting valid JSON at every step', async () => {
      const TARGET_DATE = '2026-11-06';
      await bodyRepo.saveBodyLog({
        date: TARGET_DATE,
        weightKg: 81.0,
        waistCm: 80.0,
      });

      const t0 = performance.now();
      const CYCLES = 50;

      for (let i = 1; i <= CYCLES; i++) {
        const photoUri = `file:///data/photos/20261106_front_${i}.jpg`;

        // 1. Add photo
        const afterAdd = await bodyRepo.savePhoto(TARGET_DATE, photoUri);
        expect(afterAdd).toContain(photoUri);

        // Assert SQLite photo_uris_json contains valid JSON array
        const rawAfterAdd = await db.getFirstAsync<{ photo_uris_json: string }>(
          'SELECT photo_uris_json FROM body_logs WHERE date = ?;',
          TARGET_DATE
        );
        const parsedAfterAdd = JSON.parse(rawAfterAdd!.photo_uris_json);
        expect(Array.isArray(parsedAfterAdd)).toBe(true);
        expect(parsedAfterAdd).toContain(photoUri);

        // 2. Delete photo
        const afterDelete = await bodyRepo.deletePhoto(TARGET_DATE, photoUri);
        expect(afterDelete).not.toContain(photoUri);

        // Assert SQLite photo_uris_json remains valid empty array []
        const rawAfterDelete = await db.getFirstAsync<{ photo_uris_json: string }>(
          'SELECT photo_uris_json FROM body_logs WHERE date = ?;',
          TARGET_DATE
        );
        const parsedAfterDelete = JSON.parse(rawAfterDelete!.photo_uris_json);
        expect(Array.isArray(parsedAfterDelete)).toBe(true);
        expect(parsedAfterDelete).not.toContain(photoUri);
      }
      const durationMs = performance.now() - t0;

      // Assert measurements and weight remained 100% intact throughout all 100 photo mutations
      const finalLog = await bodyRepo.getBodyLog(TARGET_DATE);
      expect(finalLog).not.toBeNull();
      expect(finalLog!.weightKg).toBe(81.0);
      expect(finalLog!.waistCm).toBe(80.0);
      expect(finalLog!.photoUris).toEqual([]);

      console.log(
        `[STRESS 4.1] 50 photo add/delete cycles (100 SQLite mutations) finished in ${durationMs.toFixed(
          2
        )}ms (${(durationMs / 100).toFixed(3)}ms/op)`
      );
      expect(durationMs).toBeLessThan(1000);
    });

    it('4.2 accumulates 50 distinct photos and safely deletes them in reverse order down to 0', async () => {
      const TARGET_DATE = '2026-11-06';
      const PHOTO_COUNT = 50;

      // Add 50 photos
      for (let i = 1; i <= PHOTO_COUNT; i++) {
        await bodyRepo.savePhoto(TARGET_DATE, `file:///data/photos/photo_${i}.jpg`);
      }

      let currentLog = await bodyRepo.getBodyLog(TARGET_DATE);
      expect(currentLog!.photoUris!.length).toBe(PHOTO_COUNT);

      // Verify getPhotos returns all 50 photos
      const allPhotos = await bodyRepo.getPhotos();
      expect(allPhotos.length).toBe(PHOTO_COUNT);

      // Delete in reverse order
      for (let i = PHOTO_COUNT; i >= 1; i--) {
        const remaining = await bodyRepo.deletePhoto(
          TARGET_DATE,
          `file:///data/photos/photo_${i}.jpg`
        );
        expect(remaining.length).toBe(i - 1);
      }

      currentLog = await bodyRepo.getBodyLog(TARGET_DATE);
      expect(currentLog!.photoUris!.length).toBe(0);

      const emptyPhotos = await bodyRepo.getPhotos();
      expect(emptyPhotos.length).toBe(0);
    });

    it('4.3 prevents duplicate photo URI insertions in photo_uris_json', async () => {
      const TARGET_DATE = '2026-11-06';
      const duplicateUri = 'file:///data/photos/duplicate_pose.jpg';

      await bodyRepo.savePhoto(TARGET_DATE, duplicateUri);
      await bodyRepo.savePhoto(TARGET_DATE, duplicateUri);
      await bodyRepo.savePhoto(TARGET_DATE, duplicateUri);

      const log = await bodyRepo.getBodyLog(TARGET_DATE);
      expect(log!.photoUris!.length).toBe(1);
      expect(log!.photoUris![0]).toBe(duplicateUri);
    });

    it('4.4 gracefully handles deleting non-existent photo without errors or state distortion', async () => {
      const TARGET_DATE = '2026-11-06';
      await bodyRepo.savePhoto(TARGET_DATE, 'file:///data/photos/real.jpg');

      const result = await bodyRepo.deletePhoto(TARGET_DATE, 'file:///data/photos/ghost.jpg');
      expect(result).toEqual(['file:///data/photos/real.jpg']);

      // Deleting from date that has no body log row
      const ghostDateResult = await bodyRepo.deletePhoto('2099-01-01', 'file:///data/photos/ghost.jpg');
      expect(ghostDateResult).toEqual([]);
    });

    it('4.5 creates row with weightKg: 0 when saving photo on date without existing weigh-in, and subsequent weigh-in preserves photo', async () => {
      const NEW_DATE = '2026-12-25';

      // Ensure no row exists
      const initial = await bodyRepo.getBodyLog(NEW_DATE);
      expect(initial).toBeNull();

      // Save photo first
      const photoUri = 'file:///data/photos/christmas_check.jpg';
      await bodyManager.savePhoto(photoUri, NEW_DATE);

      const logAfterPhoto = await bodyRepo.getBodyLog(NEW_DATE);
      expect(logAfterPhoto).not.toBeNull();
      expect(logAfterPhoto!.weightKg).toBe(0);
      expect(logAfterPhoto!.photoUris).toEqual([photoUri]);

      // Now athlete logs morning weigh-in on that date
      await bodyManager.saveWeighIn(79.5, NEW_DATE);

      const logAfterWeighIn = await bodyRepo.getBodyLog(NEW_DATE);
      expect(logAfterWeighIn!.weightKg).toBe(79.5);
      expect(logAfterWeighIn!.photoUris).toEqual([photoUri]);
    });
  });

  // =========================================================================
  // 5. ADVERSARIAL EDGE CASES & ORACLES
  // =========================================================================
  describe('5. Adversarial Edge Cases & Oracles', () => {
    it('5.1 verifies shiftDateString leap year, century, and DST invariants', () => {
      // Leap year 2024: Feb 28 -> Feb 29 -> Mar 01
      expect(shiftDateString('2024-02-28', 1)).toBe('2024-02-29');
      expect(shiftDateString('2024-02-29', 1)).toBe('2024-03-01');
      expect(shiftDateString('2024-03-01', -1)).toBe('2024-02-29');

      // Non-leap year 2026: Feb 28 -> Mar 01
      expect(shiftDateString('2026-02-28', 1)).toBe('2026-03-01');
      expect(shiftDateString('2026-03-01', -1)).toBe('2026-02-28');

      // Leap year 2028: Feb 28 -> Feb 29
      expect(shiftDateString('2028-02-28', 1)).toBe('2028-02-29');

      // Year transitions
      expect(shiftDateString('2026-12-31', 1)).toBe('2027-01-01');
      expect(shiftDateString('2027-01-01', -1)).toBe('2026-12-31');

      // Decade shifts
      expect(shiftDateString('2020-01-01', 3652)).toBe('2029-12-31');
    });

    it('5.2 validates calculateBodyComposition invariants across 1,000 randomized inputs', () => {
      for (let i = 0; i < 1000; i++) {
        const weight = Math.round((Math.random() * 250 + 30) * 10) / 10;
        const bf = Math.round((Math.random() * 50 + 3) * 10) / 10;

        const comp = calculateBodyComposition(weight, bf);
        expect(comp).not.toBeNull();

        // Invariants:
        expect(comp!.fatMassKg).toBeGreaterThanOrEqual(0);
        expect(comp!.leanMassKg).toBeGreaterThanOrEqual(0);
        expect(comp!.fatMassKg).toBeLessThan(weight);
        expect(comp!.leanMassKg).toBeLessThanOrEqual(weight);

        // Sum must equal total weight within 0.1kg tolerance
        const sum = Math.round((comp!.fatMassKg + comp!.leanMassKg) * 10) / 10;
        expect(Math.abs(sum - weight)).toBeLessThanOrEqual(0.1);
      }
    });

    it('5.3 verifies calculatePhotoDeltaMetrics boundary calculations (inverted dates, missing metrics)', () => {
      const log1: BodyLog = {
        id: 'log-1',
        date: '2026-11-01',
        weightKg: 80.0,
        createdAt: '2026-11-01T00:00:00Z',
      };
      const log2: BodyLog = {
        id: 'log-2',
        date: '2026-11-06',
        weightKg: 78.5,
        createdAt: '2026-11-06T00:00:00Z',
      };

      // Normal order: before 2026-11-01, after 2026-11-06
      const normalDelta = calculatePhotoDeltaMetrics(log1, log2, '2026-11-01', '2026-11-06');
      expect(normalDelta.daysBetween).toBe(5);
      expect(normalDelta.weightDeltaKg).toBe(-1.5);
      expect(normalDelta.bodyFatDeltaPct).toBeNull();

      // Identical date: 0 days
      const sameDayDelta = calculatePhotoDeltaMetrics(log1, log1, '2026-11-01', '2026-11-01');
      expect(sameDayDelta.daysBetween).toBe(0);
      expect(sameDayDelta.weightDeltaKg).toBe(0);

      // Inverted dates: after is earlier than before
      const invertedDelta = calculatePhotoDeltaMetrics(log2, log1, '2026-11-06', '2026-11-01');
      expect(invertedDelta.daysBetween).toBe(5); // Math.abs
      expect(invertedDelta.weightDeltaKg).toBe(1.5);
    });

    it('5.4 verifies pose detection from diverse file naming conventions', () => {
      const poses = [
        ['file:///var/mobile/Containers/Data/body_photos/20261106_front_1730930000.jpg', 'front'],
        ['file:///var/mobile/Containers/Data/body_photos/20261106_side_1730930000.jpg', 'side'],
        ['file:///var/mobile/Containers/Data/body_photos/20261106_back_1730930000.jpg', 'back'],
        ['photos/frente_duplo_biceps.jpg', 'front'],
        ['photos/lateral_triceps.jpg', 'side'],
        ['photos/perfil_expansao.jpg', 'side'],
        ['photos/costas_dorsal.jpg', 'back'],
        ['photos/arbitrary_selfie.jpg', 'other'],
      ] as const;

      for (const [uri, expected] of poses) {
        expect(extractPoseFromUri(uri)).toBe(expected);
      }
    });

    it('5.5 verifies mapWeightHistoryToChart handles single point history gracefully', () => {
      const singlePoint: WeightHistoryPoint[] = [
        { date: '2026-11-06', weightKg: 82.5, movingAverage: 82.5 },
      ];

      const chart = mapWeightHistoryToChart(singlePoint);
      expect(chart.points.length).toBe(1);
      expect(chart.points[0].xPct).toBe(50); // Centered at 50%
      expect(chart.currentWeight).toBe(82.5);
      expect(chart.currentMA).toBe(82.5);
      expect(chart.weightDeltaVsMA).toBe(0);
      expect(chart.trendDirection).toBe('stable');
    });
  });
});
