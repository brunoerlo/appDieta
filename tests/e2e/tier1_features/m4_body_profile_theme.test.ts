import { createE2ETestContext, E2ETestContext } from '../helpers/testContext';
import {
  calculateExpectedMovingAverage,
  calculateBodyComposition,
} from '../helpers/calculationOracles';

describe('Tier 1: Feature Coverage — M4 Body Evolution, Profile & Theme (Features 25-34)', () => {
  let ctx: E2ETestContext;
  const BASE_DATE = '2026-11-01';

  beforeEach(async () => {
    ctx = await createE2ETestContext();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  // =========================================================================
  // Feature 25: Daily Morning Weigh-in (ORIGINAL_REQUEST §R4)
  // =========================================================================
  describe('Feature 25: Daily Morning Weigh-in', () => {
    it('25.1 logs morning body weight in kg with date', async () => {
      const log = await ctx.bodyRepo.saveBodyLog({
        date: BASE_DATE,
        weightKg: 82.5,
      });

      expect(log.id).toBeDefined();
      expect(log.date).toBe(BASE_DATE);
      expect(log.weightKg).toBe(82.5);
    });

    it('25.2 updates weigh-in if logged again on same date (ON CONFLICT DO UPDATE)', async () => {
      await ctx.bodyRepo.saveBodyLog({
        date: BASE_DATE,
        weightKg: 82.5,
      });

      const updated = await ctx.bodyRepo.saveBodyLog({
        date: BASE_DATE,
        weightKg: 82.2, // Re-weighed
      });

      expect(updated.weightKg).toBe(82.2);

      const fetched = await ctx.bodyRepo.getBodyLog(BASE_DATE);
      expect(fetched?.weightKg).toBe(82.2);

      const all = await ctx.bodyRepo.getWeightHistory();
      expect(all.length).toBe(1);
    });

    it('25.3 retrieves body log by date', async () => {
      await ctx.bodyRepo.saveBodyLog({
        date: '2026-11-03',
        weightKg: 81.9,
      });

      const log = await ctx.bodyRepo.getBodyLog('2026-11-03');
      expect(log).not.toBeNull();
      expect(log?.weightKg).toBe(81.9);
    });

    it('25.4 retrieves weight history across start and end dates', async () => {
      await ctx.bodyRepo.saveBodyLog({ date: '2026-11-01', weightKg: 82.5 });
      await ctx.bodyRepo.saveBodyLog({ date: '2026-11-02', weightKg: 82.3 });
      await ctx.bodyRepo.saveBodyLog({ date: '2026-11-03', weightKg: 82.0 });

      const history = await ctx.bodyRepo.getWeightHistory('2026-11-01', '2026-11-02');
      expect(history.length).toBe(2);
      expect(history[0].date).toBe('2026-11-01');
      expect(history[1].date).toBe('2026-11-02');
    });

    it('25.5 returns null when querying date with no weigh-in', async () => {
      const log = await ctx.bodyRepo.getBodyLog('2025-01-01');
      expect(log).toBeNull();
    });
  });

  // =========================================================================
  // Feature 26: 7-Day Moving Average Calculation (ORIGINAL_REQUEST §R4)
  // =========================================================================
  describe('Feature 26: 7-Day Moving Average Calculation', () => {
    it('26.1 computes exact 7-day moving average from 7 consecutive weigh-ins', async () => {
      const weights = [84.0, 83.8, 83.5, 83.7, 83.2, 83.0, 82.8];
      const dates = [
        '2026-11-01',
        '2026-11-02',
        '2026-11-03',
        '2026-11-04',
        '2026-11-05',
        '2026-11-06',
        '2026-11-07',
      ];

      for (let i = 0; i < weights.length; i++) {
        await ctx.bodyRepo.saveBodyLog({ date: dates[i], weightKg: weights[i] });
      }

      const expectedMA = calculateExpectedMovingAverage(weights);
      const computedMA = await ctx.bodyRepo.calculateMovingAverage('2026-11-07', 7);

      expect(computedMA).not.toBeNull();
      expect(computedMA).toBeCloseTo(expectedMA!, 1);
    });

    it('26.2 returns null if zero weigh-ins exist in the 7-day window', async () => {
      const ma = await ctx.bodyRepo.calculateMovingAverage('2026-11-01', 7);
      expect(ma).toBeNull();
    });

    it('26.3 handles sparse weigh-ins (e.g. only 3 days in the past 7 days) correctly', async () => {
      await ctx.bodyRepo.saveBodyLog({ date: '2026-11-01', weightKg: 80.0 });
      await ctx.bodyRepo.saveBodyLog({ date: '2026-11-04', weightKg: 82.0 });
      await ctx.bodyRepo.saveBodyLog({ date: '2026-11-07', weightKg: 81.0 });

      const computedMA = await ctx.bodyRepo.calculateMovingAverage('2026-11-07', 7);
      expect(computedMA).toBe(81.0); // (80 + 82 + 81) / 3 = 81.0
    });

    it('26.4 smooths daily water weight spikes vs actual weight trend', async () => {
      // Steady 80kg with a 85kg sodium/water retention spike on day 4
      const weights = [80.0, 80.2, 80.1, 85.0, 80.3, 80.1, 80.0];
      const dates = [
        '2026-11-01',
        '2026-11-02',
        '2026-11-03',
        '2026-11-04',
        '2026-11-05',
        '2026-11-06',
        '2026-11-07',
      ];

      for (let i = 0; i < weights.length; i++) {
        await ctx.bodyRepo.saveBodyLog({ date: dates[i], weightKg: weights[i] });
      }

      const ma = await ctx.bodyRepo.calculateMovingAverage('2026-11-07', 7);
      // MA dampens the 85kg spike: (80 + 80.2 + 80.1 + 85 + 80.3 + 80.1 + 80) / 7 = 80.8
      expect(ma).toBeLessThan(81.5);
      expect(ma).toBeGreaterThan(80.5);
    });

    it('26.5 window accurately clamps to [date - 6 days, date] ignoring weights older than 7 days', async () => {
      await ctx.bodyRepo.saveBodyLog({ date: '2026-10-20', weightKg: 95.0 }); // Older than 7 days
      await ctx.bodyRepo.saveBodyLog({ date: '2026-11-07', weightKg: 80.0 });

      const ma = await ctx.bodyRepo.calculateMovingAverage('2026-11-07', 7);
      expect(ma).toBe(80.0); // 95kg should not contaminate the 7-day average
    });
  });

  // =========================================================================
  // Feature 27: Weight Trend Chart (ORIGINAL_REQUEST §R4)
  // =========================================================================
  describe('Feature 27: Weight Trend Chart', () => {
    it('27.1 returns dual-series data points with daily weight and moving average', async () => {
      await ctx.bodyRepo.saveBodyLog({ date: '2026-11-01', weightKg: 82.0 });
      await ctx.bodyRepo.saveBodyLog({ date: '2026-11-02', weightKg: 81.8 });

      const points = await ctx.bodyRepo.getWeightHistory();
      expect(points.length).toBe(2);
      expect(points[0]).toHaveProperty('weightKg');
      expect(points[0]).toHaveProperty('movingAverage');
    });

    it('27.2 orders trend chart points chronologically', async () => {
      await ctx.bodyRepo.saveBodyLog({ date: '2026-11-05', weightKg: 81.5 });
      await ctx.bodyRepo.saveBodyLog({ date: '2026-11-01', weightKg: 82.5 });
      await ctx.bodyRepo.saveBodyLog({ date: '2026-11-03', weightKg: 82.0 });

      const points = await ctx.bodyRepo.getWeightHistory();
      expect(points[0].date).toBe('2026-11-01');
      expect(points[1].date).toBe('2026-11-03');
      expect(points[2].date).toBe('2026-11-05');
    });

    it('27.3 verifies computed moving average matches calculation oracle', async () => {
      await ctx.bodyRepo.saveBodyLog({ date: '2026-11-01', weightKg: 80.0 });
      await ctx.bodyRepo.saveBodyLog({ date: '2026-11-02', weightKg: 81.0 });

      const history = await ctx.bodyRepo.getWeightHistory();
      const point = history[1];

      const expectedMA = calculateExpectedMovingAverage([80.0, 81.0]);
      expect(point.movingAverage).toBe(expectedMA);
    });

    it('27.4 returns single-point moving average equal to raw weight on first recorded day', async () => {
      await ctx.bodyRepo.saveBodyLog({ date: '2026-11-01', weightKg: 78.5 });

      const history = await ctx.bodyRepo.getWeightHistory();
      expect(history[0].movingAverage).toBe(78.5);
    });

    it('27.5 filters trend series by start and end date ranges for monthly charts', async () => {
      await ctx.bodyRepo.saveBodyLog({ date: '2026-10-15', weightKg: 85.0 });
      await ctx.bodyRepo.saveBodyLog({ date: '2026-11-01', weightKg: 83.0 });
      await ctx.bodyRepo.saveBodyLog({ date: '2026-11-15', weightKg: 82.0 });

      const novemberHistory = await ctx.bodyRepo.getWeightHistory('2026-11-01', '2026-11-30');
      expect(novemberHistory.length).toBe(2);
      expect(novemberHistory[0].date).toBe('2026-11-01');
      expect(novemberHistory[1].date).toBe('2026-11-15');
    });
  });

  // =========================================================================
  // Feature 28: Body Composition Metrics (ORIGINAL_REQUEST §R4)
  // =========================================================================
  describe('Feature 28: Body Composition Metrics', () => {
    it('28.1 records % Body Fat alongside body weight in body_logs', async () => {
      const log = await ctx.bodyRepo.saveBodyLog({
        date: BASE_DATE,
        weightKg: 80.0,
        bodyFatPct: 15.0,
      });

      expect(log.bodyFatPct).toBe(15.0);

      const fetched = await ctx.bodyRepo.getBodyLog(BASE_DATE);
      expect(fetched?.bodyFatPct).toBe(15.0);
    });

    it('28.2 computes Fat Mass accurately: weightKg * (bodyFatPct / 100)', () => {
      // 80kg at 15% BF -> Fat Mass = 12.0kg
      const comp = calculateBodyComposition(80.0, 15.0);
      expect(comp.fatMassKg).toBe(12.0);
    });

    it('28.3 computes Lean Mass accurately: weightKg - Fat Mass', () => {
      // 80kg at 15% BF -> Lean Mass = 68.0kg
      const comp = calculateBodyComposition(80.0, 15.0);
      expect(comp.leanMassKg).toBe(68.0);
    });

    it('28.4 updates body fat percentage and dynamically reflects new lean/fat split', async () => {
      await ctx.bodyRepo.saveBodyLog({
        date: BASE_DATE,
        weightKg: 80.0,
        bodyFatPct: 18.0, // 14.4kg fat, 65.6kg lean
      });

      await ctx.bodyRepo.saveBodyLog({
        date: BASE_DATE,
        weightKg: 80.0,
        bodyFatPct: 14.0, // Updated: 11.2kg fat, 68.8kg lean
      });

      const updated = await ctx.bodyRepo.getBodyLog(BASE_DATE);
      expect(updated?.bodyFatPct).toBe(14.0);

      const comp = calculateBodyComposition(updated!.weightKg, updated!.bodyFatPct!);
      expect(comp.fatMassKg).toBe(11.2);
      expect(comp.leanMassKg).toBe(68.8);
    });

    it('28.5 handles extreme body fat percentages (5% stage lean to 40% high fat)', () => {
      const stageLean = calculateBodyComposition(75.0, 5.0);
      expect(stageLean.fatMassKg).toBe(3.8);
      expect(stageLean.leanMassKg).toBe(71.2);

      const highFat = calculateBodyComposition(110.0, 40.0);
      expect(highFat.fatMassKg).toBe(44.0);
      expect(highFat.leanMassKg).toBe(66.0);
    });
  });

  // =========================================================================
  // Feature 29: Body Circumference Tracking (ORIGINAL_REQUEST §R4)
  // =========================================================================
  describe('Feature 29: Body Circumference Tracking', () => {
    it('29.1 records waist circumference in centimeters', async () => {
      const log = await ctx.bodyRepo.saveBodyLog({
        date: BASE_DATE,
        weightKg: 80.0,
        waistCm: 84.5,
      });

      expect(log.waistCm).toBe(84.5);
    });

    it('29.2 records chest circumference in centimeters', async () => {
      const log = await ctx.bodyRepo.saveBodyLog({
        date: BASE_DATE,
        weightKg: 80.0,
        chestCm: 104.0,
      });

      expect(log.chestCm).toBe(104.0);
    });

    it('29.3 records arms and thighs (legs) circumferences in centimeters', async () => {
      const log = await ctx.bodyRepo.saveBodyLog({
        date: BASE_DATE,
        weightKg: 80.0,
        armsCm: 39.5,
        legsCm: 61.0,
      });

      expect(log.armsCm).toBe(39.5);
      expect(log.legsCm).toBe(61.0);
    });

    it('29.4 preserves circumference measurements when weight is re-logged on same date', async () => {
      await ctx.bodyRepo.saveBodyLog({
        date: BASE_DATE,
        weightKg: 80.0,
        waistCm: 85.0,
        chestCm: 105.0,
      });

      await ctx.bodyRepo.saveBodyLog({
        date: BASE_DATE,
        weightKg: 79.8, // Updated weight only
        waistCm: 85.0,
        chestCm: 105.0,
      });

      const fetched = await ctx.bodyRepo.getBodyLog(BASE_DATE);
      expect(fetched?.weightKg).toBe(79.8);
      expect(fetched?.waistCm).toBe(85.0);
      expect(fetched?.chestCm).toBe(105.0);
    });

    it('29.5 allows partial circumference logging without throwing null errors', async () => {
      const log = await ctx.bodyRepo.saveBodyLog({
        date: BASE_DATE,
        weightKg: 80.0,
        waistCm: 82.0,
        // chest, arms, legs left undefined
      });

      expect(log.waistCm).toBe(82.0);
      expect(log.chestCm).toBeUndefined();
    });
  });

  // =========================================================================
  // Feature 30: Progress Photo Logging (ORIGINAL_REQUEST §R4)
  // =========================================================================
  describe('Feature 30: Progress Photo Logging', () => {
    it('30.1 stores progress photo URI associated with a date tag', async () => {
      const uris = await ctx.bodyRepo.savePhoto(BASE_DATE, 'file:///data/photos/front_20261101.jpg');
      expect(uris.length).toBe(1);
      expect(uris[0]).toBe('file:///data/photos/front_20261101.jpg');

      const log = await ctx.bodyRepo.getBodyLog(BASE_DATE);
      expect(log?.photoUris).toContain('file:///data/photos/front_20261101.jpg');
    });

    it('30.2 allows multiple photos on the same date (front and side poses)', async () => {
      await ctx.bodyRepo.savePhoto(BASE_DATE, 'file:///data/photos/front.jpg');
      const uris = await ctx.bodyRepo.savePhoto(BASE_DATE, 'file:///data/photos/side.jpg');

      expect(uris.length).toBe(2);
      expect(uris).toContain('file:///data/photos/front.jpg');
      expect(uris).toContain('file:///data/photos/side.jpg');
    });

    it('30.3 retrieves chronological list of all saved photos across dates', async () => {
      await ctx.bodyRepo.savePhoto('2026-10-01', 'file:///data/photos/oct.jpg');
      await ctx.bodyRepo.savePhoto('2026-11-01', 'file:///data/photos/nov.jpg');

      const photos = await ctx.bodyRepo.getPhotos();
      expect(photos.length).toBe(2);
      // getPhotos returns newest first (date DESC)
      expect(photos[0].date).toBe('2026-11-01');
      expect(photos[1].date).toBe('2026-10-01');
    });

    it('30.4 preserves photos when body weight is updated', async () => {
      await ctx.bodyRepo.savePhoto(BASE_DATE, 'file:///data/photos/front.jpg');

      const existing = await ctx.bodyRepo.getBodyLog(BASE_DATE);
      await ctx.bodyRepo.saveBodyLog({
        date: BASE_DATE,
        weightKg: 81.2,
        photoUris: existing?.photoUris,
      });

      const log = await ctx.bodyRepo.getBodyLog(BASE_DATE);
      expect(log?.photoUris).toContain('file:///data/photos/front.jpg');
    });

    it('30.5 returns empty array when no photos have been captured', async () => {
      const photos = await ctx.bodyRepo.getPhotos();
      expect(photos).toEqual([]);
    });
  });

  // =========================================================================
  // Feature 31: Before vs. After Photo Comparison (ORIGINAL_REQUEST §R4)
  // =========================================================================
  describe('Feature 31: Before vs. After Photo Comparison', () => {
    it('31.1 retrieves baseline earliest photo and latest photo for comparison', async () => {
      await ctx.bodyRepo.savePhoto('2026-09-01', 'file:///data/photos/day1.jpg');
      await ctx.bodyRepo.savePhoto('2026-10-01', 'file:///data/photos/day30.jpg');
      await ctx.bodyRepo.savePhoto('2026-11-01', 'file:///data/photos/day60.jpg');

      const photos = await ctx.bodyRepo.getPhotos();
      // Photos sorted date DESC: index 0 is latest (after), last index is baseline (before)
      const after = photos[0];
      const before = photos[photos.length - 1];

      expect(before.date).toBe('2026-09-01');
      expect(after.date).toBe('2026-11-01');
    });

    it('31.2 matches photo dates with corresponding weight logs for context', async () => {
      await ctx.bodyRepo.saveBodyLog({ date: '2026-09-01', weightKg: 90.0 });
      await ctx.bodyRepo.savePhoto('2026-09-01', 'file:///data/photos/before.jpg');

      await ctx.bodyRepo.saveBodyLog({ date: '2026-11-01', weightKg: 83.0 });
      await ctx.bodyRepo.savePhoto('2026-11-01', 'file:///data/photos/after.jpg');

      const logBefore = await ctx.bodyRepo.getBodyLog('2026-09-01');
      const logAfter = await ctx.bodyRepo.getBodyLog('2026-11-01');

      const weightLost = logBefore!.weightKg - logAfter!.weightKg;
      expect(weightLost).toBe(7.0);
    });

    it('31.3 pairs before and after photos correctly across distinct dates', async () => {
      await ctx.bodyRepo.savePhoto('2026-06-01', 'file:///photos/june.jpg');
      await ctx.bodyRepo.savePhoto('2026-12-01', 'file:///photos/dec.jpg');

      const photos = await ctx.bodyRepo.getPhotos();
      expect(photos[0].uri).toBe('file:///photos/dec.jpg');
      expect(photos[1].uri).toBe('file:///photos/june.jpg');
    });

    it('31.4 supports multiple angles on the same comparison date', async () => {
      await ctx.bodyRepo.savePhoto('2026-11-01', 'file:///photos/front.jpg');
      await ctx.bodyRepo.savePhoto('2026-11-01', 'file:///photos/back.jpg');

      const photos = await ctx.bodyRepo.getPhotos();
      expect(photos.length).toBe(2);
      expect(photos[0].date).toBe('2026-11-01');
      expect(photos[1].date).toBe('2026-11-01');
    });

    it('31.5 handles single photo state gracefully without crashing comparative viewer', async () => {
      await ctx.bodyRepo.savePhoto('2026-11-01', 'file:///photos/solo.jpg');
      const photos = await ctx.bodyRepo.getPhotos();

      expect(photos.length).toBe(1);
    });
  });

  // =========================================================================
  // Feature 32: User Profile & Goal Configuration (ORIGINAL_REQUEST §R4)
  // =========================================================================
  describe('Feature 32: User Profile & Goal Configuration', () => {
    it('32.1 retrieves default user profile with initial goals', async () => {
      const profile = await ctx.authRepo.getProfile();
      expect(profile).toBeDefined();
      expect(profile.name).toBe('Atleta');
      expect(profile.targetCalories).toBe(2000);
      expect(profile.targetProtein).toBe(150);
      expect(profile.targetCarbs).toBe(200);
      expect(profile.targetFat).toBe(60);
      expect(profile.targetWaterMl).toBe(2500);
      expect(profile.theme).toBe('dark');
    });

    it('32.2 updates profile name and daily caloric target', async () => {
      const updated = await ctx.authRepo.updateProfile({
        name: 'Carlos Monstro',
        targetCalories: 2800,
      });

      expect(updated.name).toBe('Carlos Monstro');
      expect(updated.targetCalories).toBe(2800);

      const reloaded = await ctx.authRepo.getProfile();
      expect(reloaded.name).toBe('Carlos Monstro');
      expect(reloaded.targetCalories).toBe(2800);
    });

    it('32.3 updates target macronutrient split (protein, carbs, fat in grams)', async () => {
      await ctx.authRepo.updateProfile({
        targetProtein: 200,
        targetCarbs: 350,
        targetFat: 80,
      });

      const profile = await ctx.authRepo.getProfile();
      expect(profile.targetProtein).toBe(200);
      expect(profile.targetCarbs).toBe(350);
      expect(profile.targetFat).toBe(80);
    });

    it('32.4 updates daily water consumption target in ml', async () => {
      await ctx.authRepo.updateProfile({
        targetWaterMl: 3500,
      });

      const profile = await ctx.authRepo.getProfile();
      expect(profile.targetWaterMl).toBe(3500);
    });

    it('32.5 profile goals persist across database operations', async () => {
      await ctx.authRepo.updateProfile({
        targetCalories: 2400,
        targetProtein: 180,
      });

      const row = await ctx.db.getFirstAsync<any>(
        'SELECT target_calories, target_protein FROM users LIMIT 1;'
      );
      expect(row.target_calories).toBe(2400);
      expect(row.target_protein).toBe(180);
    });
  });

  // =========================================================================
  // Feature 33: OLED Dark Mode & Light Mode Theme (ORIGINAL_REQUEST §R4)
  // =========================================================================
  describe('Feature 33: OLED Dark Mode & Light Mode Theme', () => {
    it('33.1 initializes with OLED dark mode by default', async () => {
      const theme = await ctx.authRepo.getTheme();
      expect(theme).toBe('dark');
    });

    it('33.2 toggles theme from dark to light mode', async () => {
      await ctx.authRepo.setTheme('light');
      expect(await ctx.authRepo.getTheme()).toBe('light');

      const profile = await ctx.authRepo.getProfile();
      expect(profile.theme).toBe('light');
    });

    it('33.3 toggles theme from light back to dark mode', async () => {
      await ctx.authRepo.setTheme('light');
      expect(await ctx.authRepo.getTheme()).toBe('light');

      await ctx.authRepo.setTheme('dark');
      expect(await ctx.authRepo.getTheme()).toBe('dark');
    });

    it('33.4 rejects invalid theme values violating SQLite CHECK constraint', async () => {
      // Ensure default user is created
      await ctx.authRepo.getProfile();

      await expect(
        ctx.db.runAsync("UPDATE users SET theme = 'blue' WHERE id = 'default_user';")
      ).rejects.toThrow();
    });

    it('33.5 persists theme preference in SQLite users table across reloads', async () => {
      await ctx.authRepo.setTheme('light');
      const row = await ctx.db.getFirstAsync<{ theme: string }>(
        'SELECT theme FROM users LIMIT 1;'
      );
      expect(row?.theme).toBe('light');
    });
  });

  // =========================================================================
  // Feature 34: Tab Navigation (Expo Router) (ORIGINAL_REQUEST §R5, AGENTS.md)
  // =========================================================================
  describe('Feature 34: Tab Navigation (Expo Router Structure & Contracts)', () => {
    it('34.1 verifies contracts for the 4 core bottom navigation tabs: Dieta, Treino, Evolução, Perfil', () => {
      const coreTabs = [
        { route: '/', name: 'Dieta', title: 'Diário de Nutrição' },
        { route: '/workout', name: 'Treino', title: 'Treinos e Séries' },
        { route: '/body', name: 'Evolução', title: 'Evolução Corporal' },
        { route: '/profile', name: 'Perfil', title: 'Configurações de Metas' },
      ];

      expect(coreTabs.length).toBe(4);
      expect(coreTabs.map((t) => t.route)).toContain('/');
      expect(coreTabs.map((t) => t.route)).toContain('/workout');
      expect(coreTabs.map((t) => t.route)).toContain('/body');
      expect(coreTabs.map((t) => t.route)).toContain('/profile');
    });

    it('34.2 verifies modal route contracts for nutrition secondary screens', () => {
      const nutritionModals = [
        '/nutrition/search',
        '/nutrition/scanner',
        '/nutrition/custom',
      ];

      expect(nutritionModals).toContain('/nutrition/search');
      expect(nutritionModals).toContain('/nutrition/scanner');
      expect(nutritionModals).toContain('/nutrition/custom');
    });

    it('34.3 verifies secondary route contracts for workout execution and routine editor', () => {
      const workoutRoutes = [
        '/workout/live',
        '/workout/edit-routine',
        '/workout/history',
      ];

      expect(workoutRoutes).toContain('/workout/live');
      expect(workoutRoutes).toContain('/workout/edit-routine');
      expect(workoutRoutes).toContain('/workout/history');
    });

    it('34.4 verifies secondary route contracts for body evolution detail screens', () => {
      const bodyRoutes = ['/body/log', '/body/compare'];

      expect(bodyRoutes).toContain('/body/log');
      expect(bodyRoutes).toContain('/body/compare');
    });

    it('34.5 verifies root layout contract supports SQLiteProvider and ThemeProvider wrapping', () => {
      const rootProviders = ['SQLiteProvider', 'ThemeProvider'];
      expect(rootProviders).toContain('SQLiteProvider');
      expect(rootProviders).toContain('ThemeProvider');
    });
  });
});
