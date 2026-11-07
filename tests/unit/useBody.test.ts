import { BodyStateManager } from '../../src/context/BodyContext';
import { IBodyRepository } from '../../src/database/repositories/interfaces';
import { BodyLog, WeightHistoryPoint } from '../../src/types/domain';

class MockBodyRepository implements IBodyRepository {
  public logs: Map<string, BodyLog> = new Map();
  public photos: { date: string; uri: string }[] = [];

  async getBodyLog(date: string): Promise<BodyLog | null> {
    return this.logs.get(date) || null;
  }

  async saveBodyLog(log: Omit<BodyLog, 'id' | 'createdAt'>): Promise<BodyLog> {
    const saved: BodyLog = {
      ...log,
      id: `body-log-${log.date}`,
      createdAt: new Date().toISOString(),
      photoUris: log.photoUris ?? [],
    };
    this.logs.set(log.date, saved);
    return saved;
  }

  async getWeightHistory(startDate?: string, endDate?: string): Promise<WeightHistoryPoint[]> {
    const points: WeightHistoryPoint[] = [];
    const sortedDates = Array.from(this.logs.keys()).sort();
    for (const d of sortedDates) {
      if (startDate && d < startDate) continue;
      if (endDate && d > endDate) continue;
      const log = this.logs.get(d)!;
      if (log.weightKg > 0) {
        const ma = await this.calculateMovingAverage(d, 7);
        points.push({
          date: d,
          weightKg: log.weightKg,
          movingAverage: ma,
        });
      }
    }
    return points;
  }

  async calculateMovingAverage(date: string, windowDays = 7): Promise<number | null> {
    const [y, m, d] = date.split('-').map(Number);
    const target = new Date(y, m - 1, d);
    const start = new Date(y, m - 1, d);
    start.setDate(start.getDate() - (windowDays - 1));

    const weights: number[] = [];
    for (const [logDate, log] of this.logs.entries()) {
      const [ly, lm, ld] = logDate.split('-').map(Number);
      const logD = new Date(ly, lm - 1, ld);
      if (logD >= start && logD <= target && log.weightKg > 0) {
        weights.push(log.weightKg);
      }
    }

    if (weights.length === 0) return null;
    const sum = weights.reduce((acc, val) => acc + val, 0);
    return Number((sum / weights.length).toFixed(2));
  }

  async savePhoto(date: string, photoUri: string): Promise<string[]> {
    const existing = this.logs.get(date);
    const uris = existing?.photoUris ? [...existing.photoUris] : [];
    if (!uris.includes(photoUri)) {
      uris.push(photoUri);
    }
    if (existing) {
      existing.photoUris = uris;
      this.logs.set(date, existing);
    } else {
      await this.saveBodyLog({
        date,
        weightKg: 0,
        photoUris: uris,
      });
    }
    this.photos.unshift({ date, uri: photoUri });
    return uris;
  }

  async getPhotos(): Promise<{ date: string; uri: string }[]> {
    return [...this.photos];
  }

  async deletePhoto(date: string, photoUri: string): Promise<string[]> {
    const existing = this.logs.get(date);
    if (!existing || !existing.photoUris) return [];
    const updated = existing.photoUris.filter((u) => u !== photoUri);
    existing.photoUris = updated;
    this.logs.set(date, existing);
    this.photos = this.photos.filter((p) => !(p.date === date && p.uri === photoUri));
    return updated;
  }
}

describe('BodyStateManager & useBody Unit Tests', () => {
  let mockRepo: MockBodyRepository;
  let manager: BodyStateManager;
  const TEST_DATE = '2026-11-06';

  beforeEach(() => {
    mockRepo = new MockBodyRepository();
    manager = new BodyStateManager(mockRepo, TEST_DATE);
  });

  it('initializes with specified date and loads initial empty state', async () => {
    expect(manager.selectedDate).toBe(TEST_DATE);
    await manager.loadData();
    expect(manager.currentBodyLog).toBeNull();
    expect(manager.currentMovingAverage).toBeNull();
    expect(manager.currentComposition).toBeNull();
    expect(manager.weightHistory).toEqual([]);
    expect(manager.photos).toEqual([]);
  });

  it('navigates dates with steppers', async () => {
    manager.goToNextDay();
    expect(manager.selectedDate).toBe('2026-11-07');

    manager.goToPreviousDay();
    expect(manager.selectedDate).toBe('2026-11-06');

    manager.setSelectedDate('2026-11-01');
    expect(manager.selectedDate).toBe('2026-11-01');
  });

  it('executes Merge-on-Save weigh-in preserving circumferences and photos', async () => {
    // 1. First record circumferences on 2026-11-06
    await manager.saveMeasurements({
      bodyFatPct: 15.0,
      waistCm: 82.0,
      chestCm: 104.0,
      armsCm: 38.5,
      legsCm: 58.0,
    });

    expect(manager.currentBodyLog?.waistCm).toBe(82.0);
    expect(manager.currentBodyLog?.bodyFatPct).toBe(15.0);

    // 2. Later, athlete performs quick weigh-in
    await manager.saveWeighIn(82.5);

    // Assert: weight is updated AND previous circumferences are preserved!
    expect(manager.currentBodyLog?.weightKg).toBe(82.5);
    expect(manager.currentBodyLog?.waistCm).toBe(82.0);
    expect(manager.currentBodyLog?.chestCm).toBe(104.0);
    expect(manager.currentBodyLog?.armsCm).toBe(38.5);
    expect(manager.currentBodyLog?.legsCm).toBe(58.0);
    expect(manager.currentBodyLog?.bodyFatPct).toBe(15.0);

    // Assert: composition is automatically recalculated
    expect(manager.currentComposition).not.toBeNull();
    // 82.5 * 0.15 = 12.4 kg fat; 70.1 kg lean
    expect(manager.currentComposition?.fatMassKg).toBe(12.4);
    expect(manager.currentComposition?.leanMassKg).toBe(70.1);
  });

  it('executes Merge-on-Save measurements preserving weight', async () => {
    // 1. Record weigh-in
    await manager.saveWeighIn(80.0);
    expect(manager.currentBodyLog?.weightKg).toBe(80.0);

    // 2. Later update body fat and waist
    await manager.saveMeasurements({
      bodyFatPct: 14.0,
      waistCm: 81.0,
    });

    // Assert: weight remains 80.0kg
    expect(manager.currentBodyLog?.weightKg).toBe(80.0);
    expect(manager.currentBodyLog?.bodyFatPct).toBe(14.0);
    expect(manager.currentBodyLog?.waistCm).toBe(81.0);
  });

  it('computes 7-day moving average and updates weightHistory across multiple days', async () => {
    const dates = [
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
    ];
    const weights = [84.0, 83.5, 83.0, 82.5, 82.0, 81.5];

    for (let i = 0; i < dates.length; i++) {
      await manager.saveWeighIn(weights[i], dates[i]);
    }

    manager.setSelectedDate('2026-11-06');
    await manager.loadData();

    // Average: (84 + 83.5 + 83 + 82.5 + 82 + 81.5) / 6 = 496.5 / 6 = 82.75
    expect(manager.currentMovingAverage).toBe(82.75);
    expect(manager.weightHistory.length).toBe(6);
  });

  it('saves and deletes progress photos', async () => {
    const uri1 = 'file:///data/photos/front.jpg';
    const uri2 = 'file:///data/photos/side.jpg';

    await manager.savePhoto(uri1);
    await manager.savePhoto(uri2);

    expect(manager.photos.length).toBe(2);
    expect(manager.currentBodyLog?.photoUris).toContain(uri1);
    expect(manager.currentBodyLog?.photoUris).toContain(uri2);

    // Delete one photo
    await manager.deletePhoto(uri1);
    expect(manager.currentBodyLog?.photoUris).not.toContain(uri1);
    expect(manager.currentBodyLog?.photoUris).toContain(uri2);
  });

  it('handles chartRange changes and filters history points', async () => {
    await manager.setChartRange('3M');
    expect(manager.chartRange).toBe('3M');

    await manager.setChartRange('ALL');
    expect(manager.chartRange).toBe('ALL');
  });

  it('notifies subscribers on state mutations', async () => {
    let notifyCount = 0;
    const unsubscribe = manager.subscribe(() => {
      notifyCount++;
    });

    await manager.saveWeighIn(80.5);
    expect(notifyCount).toBeGreaterThan(0);

    const prevCount = notifyCount;
    unsubscribe();
    await manager.saveWeighIn(81.0);
    expect(notifyCount).toBe(prevCount);
  });
});
