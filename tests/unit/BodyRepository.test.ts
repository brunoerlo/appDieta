import { InMemorySQLiteDatabase, createTestDatabase } from '../helpers/inMemoryDb';
import { SqliteBodyRepository } from '@/database/repositories/SqliteBodyRepository';

describe('BodyRepository Unit Tests', () => {
  let db: InMemorySQLiteDatabase;
  let repo: SqliteBodyRepository;

  beforeEach(async () => {
    db = await createTestDatabase();
    repo = new SqliteBodyRepository(db);
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  describe('Weight Logging & Upsert', () => {
    it('saves daily weigh-in and updates on conflict for the same calendar date', async () => {
      const date = '2026-11-06';
      await repo.saveBodyLog({
        date,
        weightKg: 82.5,
      });

      let log = await repo.getBodyLog(date);
      expect(log).not.toBeNull();
      expect(log!.weightKg).toBe(82.5);

      // Re-log on the same date (e.g. user corrected weight)
      await repo.saveBodyLog({
        date,
        weightKg: 82.1,
      });

      log = await repo.getBodyLog(date);
      expect(log!.weightKg).toBe(82.1);
    });
  });

  describe('7-Day Moving Average Calculation', () => {
    it('calculates 7-day moving average accurately with consecutive days', async () => {
      // 7 consecutive days of logging
      const weights = [80.0, 80.5, 79.5, 81.0, 80.0, 79.0, 80.0];
      const dates = [
        '2026-11-01',
        '2026-11-02',
        '2026-11-03',
        '2026-11-04',
        '2026-11-05',
        '2026-11-06',
        '2026-11-07',
      ];

      for (let i = 0; i < 7; i++) {
        await repo.saveBodyLog({ date: dates[i], weightKg: weights[i] });
      }

      // Sum = 560.0 / 7 = 80.0 kg
      const ma = await repo.calculateMovingAverage('2026-11-07', 7);
      expect(ma).toBe(80.0);
    });

    it('divides only by recorded days when days are missed in the 7-day window', async () => {
      // Only 3 weigh-ins within the 7-day window [2026-11-01 to 2026-11-07]
      await repo.saveBodyLog({ date: '2026-11-01', weightKg: 80.0 });
      await repo.saveBodyLog({ date: '2026-11-04', weightKg: 82.0 });
      await repo.saveBodyLog({ date: '2026-11-07', weightKg: 81.0 });

      // Sum: 80 + 82 + 81 = 243. Count = 3. Average = 81.0 kg (does not divide by 7)
      const ma = await repo.calculateMovingAverage('2026-11-07', 7);
      expect(ma).toBe(81.0);
    });

    it('excludes weigh-ins older than the 7-day rolling window', async () => {
      // Day -10 (2026-10-28): 90.0 kg (outside window)
      // Day 0   (2026-11-07): 80.0 kg
      await repo.saveBodyLog({ date: '2026-10-28', weightKg: 90.0 });
      await repo.saveBodyLog({ date: '2026-11-07', weightKg: 80.0 });

      const ma = await repo.calculateMovingAverage('2026-11-07', 7);
      expect(ma).toBe(80.0);
    });

    it('returns null when no weigh-ins exist in window', async () => {
      const ma = await repo.calculateMovingAverage('2026-11-07', 7);
      expect(ma).toBeNull();
    });

    it('generates chronological weight history points with moving averages', async () => {
      await repo.saveBodyLog({ date: '2026-11-01', weightKg: 82.0 });
      await repo.saveBodyLog({ date: '2026-11-02', weightKg: 81.0 });
      await repo.saveBodyLog({ date: '2026-11-03', weightKg: 80.0 });

      const history = await repo.getWeightHistory('2026-11-01', '2026-11-03');
      expect(history).toHaveLength(3);
      expect(history[0].date).toBe('2026-11-01');
      expect(history[0].weightKg).toBe(82.0);
      expect(history[0].movingAverage).toBe(82.0);

      expect(history[1].date).toBe('2026-11-02');
      expect(history[1].weightKg).toBe(81.0);
      expect(history[1].movingAverage).toBe(81.5);

      expect(history[2].date).toBe('2026-11-03');
      expect(history[2].weightKg).toBe(80.0);
      expect(history[2].movingAverage).toBe(81.0);
    });
  });

  describe('Body Composition & Circumferences', () => {
    it('records body fat percentage and body circumferences', async () => {
      const date = '2026-11-06';
      await repo.saveBodyLog({
        date,
        weightKg: 80.0,
        bodyFatPct: 15.0,
        waistCm: 82.5,
        chestCm: 104.0,
        armsCm: 38.5,
        legsCm: 60.0,
      });

      const log = await repo.getBodyLog(date);
      expect(log).not.toBeNull();
      expect(log!.bodyFatPct).toBe(15.0);
      expect(log!.waistCm).toBe(82.5);
      expect(log!.chestCm).toBe(104.0);
      expect(log!.armsCm).toBe(38.5);
      expect(log!.legsCm).toBe(60.0);

      // Verify composition formulas
      const fatMass = log!.weightKg * (log!.bodyFatPct! / 100);
      const leanMass = log!.weightKg - fatMass;
      expect(fatMass).toBeCloseTo(12.0, 1);
      expect(leanMass).toBeCloseTo(68.0, 1);
    });

    it('saves progress photo URIs and retrieves photo gallery', async () => {
      const date1 = '2026-11-01';
      const date2 = '2026-11-06';

      await repo.savePhoto(date1, 'file:///photos/2026-11-01-front.jpg');
      await repo.savePhoto(date1, 'file:///photos/2026-11-01-side.jpg');
      await repo.savePhoto(date2, 'file:///photos/2026-11-06-front.jpg');

      const log1 = await repo.getBodyLog(date1);
      expect(log1!.photoUris).toHaveLength(2);
      expect(log1!.photoUris).toContain('file:///photos/2026-11-01-front.jpg');
      expect(log1!.photoUris).toContain('file:///photos/2026-11-01-side.jpg');

      const photos = await repo.getPhotos();
      expect(photos).toHaveLength(3);
    });
  });
});
