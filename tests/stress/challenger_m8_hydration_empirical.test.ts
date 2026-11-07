import fs from 'fs';
import path from 'path';
import { InMemorySQLiteDatabase, createTestDatabase } from '../helpers/inMemoryDb';
import { SqliteDietRepository } from '@/database/repositories/SqliteDietRepository';
import { SqliteAuthRepository } from '@/database/repositories/SqliteAuthRepository';
import { SqliteBodyRepository } from '@/database/repositories/SqliteBodyRepository';
import { DietStateManager } from '@/context/DietContext';
import { BodyStateManager } from '@/context/BodyContext';

describe('Empirical Challenger M8: Hydration Jitter Elimination & Concurrency', () => {
  let db: InMemorySQLiteDatabase;
  let dietRepo: SqliteDietRepository;
  let authRepo: SqliteAuthRepository;
  let bodyRepo: SqliteBodyRepository;
  let dietManager: DietStateManager;
  let bodyManager: BodyStateManager;
  const TEST_DATE = '2026-11-07';

  beforeEach(async () => {
    db = await createTestDatabase();
    dietRepo = new SqliteDietRepository(db);
    authRepo = new SqliteAuthRepository(db);
    bodyRepo = new SqliteBodyRepository(db);

    dietManager = new DietStateManager(dietRepo, authRepo, TEST_DATE);
    bodyManager = new BodyStateManager(bodyRepo, TEST_DATE);

    await dietManager.loadData();
    await bodyManager.loadData();
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  // =========================================================================
  // Requirement 1: Synchronous & Optimistic Updates
  // =========================================================================
  describe('1. Synchronous and Optimistic Updates (addWater, decrementWater, resetWater)', () => {
    it('1.1 addWater updates waterTotalMl and dailySummary synchronously before awaiting DB', async () => {
      expect(dietManager.waterTotalMl).toBe(0);
      expect(dietManager.dailySummary.totalWaterMl).toBe(0);
      expect(dietManager.isLoading).toBe(false);

      // Trigger mutation without awaiting
      const promise = dietManager.addWater(250);

      // Immediate synchronous assertion
      expect(dietManager.waterTotalMl).toBe(250);
      expect(dietManager.dailySummary.totalWaterMl).toBe(250);
      expect(dietManager.isLoading).toBe(false);

      await promise;

      // Assertion after promise resolution
      expect(dietManager.waterTotalMl).toBe(250);
      expect(dietManager.dailySummary.totalWaterMl).toBe(250);
      expect(dietManager.isLoading).toBe(false);

      // Direct DB verification
      const dbTotal = await dietRepo.getDailyWaterTotal(TEST_DATE);
      expect(dbTotal).toBe(250);
    });

    it('1.2 decrementWater updates state synchronously and clamps at 0', async () => {
      await dietManager.addWater(500);
      expect(dietManager.waterTotalMl).toBe(500);

      // Decrement 200ml synchronously
      const promise1 = dietManager.decrementWater(200);
      expect(dietManager.waterTotalMl).toBe(300);
      expect(dietManager.dailySummary.totalWaterMl).toBe(300);
      expect(dietManager.isLoading).toBe(false);
      await promise1;
      expect(dietManager.waterTotalMl).toBe(300);

      // Decrement 500ml (more than available) -> clamps to 0 immediately
      const promise2 = dietManager.decrementWater(500);
      expect(dietManager.waterTotalMl).toBe(0);
      expect(dietManager.dailySummary.totalWaterMl).toBe(0);
      expect(dietManager.isLoading).toBe(false);
      await promise2;
      expect(dietManager.waterTotalMl).toBe(0);

      const dbTotal = await dietRepo.getDailyWaterTotal(TEST_DATE);
      expect(dbTotal).toBe(0);
    });

    it('1.3 resetWater updates waterTotalMl to 0 synchronously and clears waterLogs', async () => {
      await dietManager.addWater(300);
      await dietManager.addWater(400);
      expect(dietManager.waterTotalMl).toBe(700);
      expect(dietManager.waterLogs.length).toBe(2);

      const promise = dietManager.resetWater();
      // Synchronous checks
      expect(dietManager.waterTotalMl).toBe(0);
      expect(dietManager.dailySummary.totalWaterMl).toBe(0);
      expect(dietManager.waterLogs).toEqual([]);
      expect(dietManager.isLoading).toBe(false);

      await promise;
      expect(dietManager.waterTotalMl).toBe(0);
      expect(dietManager.waterLogs).toEqual([]);

      const dbTotal = await dietRepo.getDailyWaterTotal(TEST_DATE);
      expect(dbTotal).toBe(0);
      const dbLogs = await dietRepo.getWaterLogs(TEST_DATE);
      expect(dbLogs.length).toBe(0);
    });
  });

  // =========================================================================
  // Requirement 2: loadData with silent: true never sets isLoading = true
  // =========================================================================
  describe('2. loadData with silent: true isLoading Invariance', () => {
    it('2.1 loadData with silent: true never sets isLoading = true across all subscriber notifications', async () => {
      let isLoadingObserved = false;
      let notificationCount = 0;

      const unsubscribe = dietManager.subscribe(() => {
        notificationCount++;
        if (dietManager.isLoading) {
          isLoadingObserved = true;
        }
      });

      expect(dietManager.isLoading).toBe(false);
      await dietManager.loadData({ silent: true });
      unsubscribe();

      expect(notificationCount).toBeGreaterThan(0);
      expect(isLoadingObserved).toBe(false);
      expect(dietManager.isLoading).toBe(false);
    });

    it('2.2 contrast: loadData without silent: true DOES set isLoading = true during execution', async () => {
      let sawLoadingTrue = false;
      let finalLoadingState = true;

      const unsubscribe = dietManager.subscribe(() => {
        if (dietManager.isLoading) {
          sawLoadingTrue = true;
        }
        finalLoadingState = dietManager.isLoading;
      });

      await dietManager.loadData(); // default is not silent
      unsubscribe();

      expect(sawLoadingTrue).toBe(true);
      expect(finalLoadingState).toBe(false);
    });

    it('2.3 BodyStateManager loadData with silent: true also never sets isLoading = true', async () => {
      let isLoadingObserved = false;
      const unsubscribe = bodyManager.subscribe(() => {
        if (bodyManager.isLoading) {
          isLoadingObserved = true;
        }
      });

      await bodyManager.loadData({ silent: true });
      unsubscribe();

      expect(isLoadingObserved).toBe(false);
      expect(bodyManager.isLoading).toBe(false);
    });
  });

  // =========================================================================
  // Requirement 3: RefreshControl is controlled by isRefreshing and NOT by isLoading
  // =========================================================================
  describe('3. RefreshControl Decoupling in (tabs)/index.tsx and (tabs)/body.tsx', () => {
    it('3.1 (tabs)/index.tsx wires RefreshControl to isRefreshing and never to isLoading', () => {
      const filePath = path.resolve(__dirname, '../../src/app/(tabs)/index.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      // RefreshControl must exist
      expect(content).toContain('<RefreshControl');

      // RefreshControl must be bound to isRefreshing
      expect(content).toMatch(/<RefreshControl[\s\S]*?refreshing=\{isRefreshing\}/);

      // RefreshControl must NOT be bound to isLoading
      expect(content).not.toMatch(/<RefreshControl[\s\S]*?refreshing=\{isLoading\}/);

      // Verify useDiet destructuring includes isRefreshing and NOT isLoading
      const useDietBlock = content.match(/const\s*\{([\s\S]*?)\}\s*=\s*useDiet\(\);/);
      expect(useDietBlock).not.toBeNull();
      const destructured = useDietBlock![1];
      expect(destructured).toContain('isRefreshing');
      expect(destructured).not.toContain('isLoading');
    });

    it('3.2 (tabs)/body.tsx wires RefreshControl to isRefreshing and never to isLoading', () => {
      const filePath = path.resolve(__dirname, '../../src/app/(tabs)/body.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      // RefreshControl must exist
      expect(content).toContain('RefreshControl');

      // RefreshControl must be bound to isRefreshing
      expect(content).toMatch(/<RefreshControl[\s\S]*?refreshing=\{isRefreshing\}/);

      // RefreshControl must NOT be bound to isLoading
      expect(content).not.toMatch(/<RefreshControl[\s\S]*?refreshing=\{isLoading\}/);

      // Verify useBody destructuring includes isRefreshing and NOT isLoading
      const useBodyBlock = content.match(/const\s*\{([\s\S]*?)\}\s*=\s*useBody\(\);/);
      expect(useBodyBlock).not.toBeNull();
      const destructured = useBodyBlock![1];
      expect(destructured).toContain('isRefreshing');
      expect(destructured).not.toContain('isLoading');
    });
  });

  // =========================================================================
  // Requirement 4: Stress test 100 rapid concurrent water increments
  // =========================================================================
  describe('4. 100 Rapid Concurrent Water Increments Stress Test', () => {
    it('4.1 handles 100 concurrent water increments with 0 unhandled rejections, exact DB volume, and 0 isLoading spikes', async () => {
      const INCREMENTS = 100;
      const ML_PER_INCREMENT = 250;
      const EXPECTED_TOTAL_ML = INCREMENTS * ML_PER_INCREMENT; // 25,000 ml

      let isLoadingSpikes = 0;
      let totalNotifications = 0;

      // Subscribe to monitor loading spikes
      const unsubscribe = dietManager.subscribe(() => {
        totalNotifications++;
        if (dietManager.isLoading) {
          isLoadingSpikes++;
        }
      });

      const startTime = performance.now();

      // Launch 100 rapid concurrent increments
      const incrementPromises = Array.from({ length: INCREMENTS }, () =>
        dietManager.addWater(ML_PER_INCREMENT)
      );

      // Immediate synchronous state should equal total volume
      expect(dietManager.waterTotalMl).toBe(EXPECTED_TOTAL_ML);
      expect(dietManager.dailySummary.totalWaterMl).toBe(EXPECTED_TOTAL_ML);
      expect(dietManager.isLoading).toBe(false);

      // Wait for all 100 background reconciliations to settle
      const results = await Promise.allSettled(incrementPromises);
      const elapsed = performance.now() - startTime;
      unsubscribe();

      // 1. Assert 0 unhandled rejections / rejected promises
      const rejections = results.filter((r) => r.status === 'rejected');
      expect(rejections).toHaveLength(0);

      // 2. Assert zero isLoading toggle spikes
      expect(isLoadingSpikes).toBe(0);
      expect(dietManager.isLoading).toBe(false);

      // 3. Assert manager state
      expect(dietManager.waterTotalMl).toBe(EXPECTED_TOTAL_ML);
      expect(dietManager.dailySummary.totalWaterMl).toBe(EXPECTED_TOTAL_ML);
      expect(dietManager.error).toBeNull();

      // 4. Assert exact accumulated volume in SQLite raw table
      const rawCountRow = await db.getFirstAsync<{ count: number; total: number }>(
        `SELECT COUNT(*) as count, SUM(amount_ml) as total FROM water_logs WHERE date = ?;`,
        TEST_DATE
      );
      expect(rawCountRow?.count).toBe(INCREMENTS);
      expect(rawCountRow?.total).toBe(EXPECTED_TOTAL_ML);

      // 5. Assert getDailyWaterTotal matches exact accumulated volume
      const repoTotal = await dietRepo.getDailyWaterTotal(TEST_DATE);
      expect(repoTotal).toBe(EXPECTED_TOTAL_ML);

      console.log(`[STRESS 4.1] 100 rapid concurrent water increments completed in ${elapsed.toFixed(2)}ms.`);
      console.log(`[STRESS 4.1] Notifications: ${totalNotifications}, isLoading spikes: ${isLoadingSpikes}, DB Volume: ${rawCountRow?.total}ml`);
    });

    it('4.2 handles 50 rapid concurrent water decrements without negative balances or loading spikes', async () => {
      // Start with 10,000ml in DB and manager
      await dietManager.addWater(10000);
      expect(dietManager.waterTotalMl).toBe(10000);

      let isLoadingSpikes = 0;
      const unsubscribe = dietManager.subscribe(() => {
        if (dietManager.isLoading) {
          isLoadingSpikes++;
        }
      });

      // Launch 50 rapid concurrent decrements of 100ml = -5,000ml
      const DECREMENTS = 50;
      const ML_PER_DECREMENT = 100;
      const decrementPromises = Array.from({ length: DECREMENTS }, () =>
        dietManager.decrementWater(ML_PER_DECREMENT)
      );

      // Settle all decrements
      const results = await Promise.allSettled(decrementPromises);
      unsubscribe();

      const rejections = results.filter((r) => r.status === 'rejected');
      expect(rejections).toHaveLength(0);
      expect(isLoadingSpikes).toBe(0);

      // Check SQLite exact balance
      const repoTotal = await dietRepo.getDailyWaterTotal(TEST_DATE);
      expect(repoTotal).toBe(5000);
      expect(dietManager.waterTotalMl).toBe(5000);
    });

    it('4.3 database failure during addWater handles error gracefully without setting isLoading = true', async () => {
      const failingDietRepo: any = {
        addWaterLog: jest.fn().mockRejectedValue(new Error('SQLite lock busy')),
        getDailyNutritionSummary: jest.fn().mockResolvedValue({
          date: TEST_DATE,
          totalCalories: 0,
          totalProtein: 0,
          totalCarbs: 0,
          totalFat: 0,
          totalWaterMl: 0,
          meals: { breakfast: [], lunch: [], snack: [], dinner: [], supper: [] },
        }),
        getDailyWaterTotal: jest.fn().mockResolvedValue(0),
        getWaterLogs: jest.fn().mockResolvedValue([]),
      };

      const failManager = new DietStateManager(failingDietRepo, authRepo, TEST_DATE);
      let sawLoading = false;
      failManager.subscribe(() => {
        if (failManager.isLoading) sawLoading = true;
      });

      // Calling addWater with failing DB
      await failManager.addWater(250);

      expect(sawLoading).toBe(false);
      expect(failManager.isLoading).toBe(false);
      expect(failManager.error).toBe('SQLite lock busy');
    });
  });
});
