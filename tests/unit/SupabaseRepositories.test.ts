import { SupabaseAuthRepository } from '../../src/database/repositories/SupabaseAuthRepository';
import { SupabaseDietRepository } from '../../src/database/repositories/SupabaseDietRepository';
import { SupabaseWorkoutRepository } from '../../src/database/repositories/SupabaseWorkoutRepository';
import { SupabaseBodyRepository } from '../../src/database/repositories/SupabaseBodyRepository';

function createQueryBuilder(result: { data?: any; error?: any } = { data: null, error: null }) {
  const builder: any = {
    select: jest.fn(() => builder),
    insert: jest.fn(() => builder),
    upsert: jest.fn(() => builder),
    update: jest.fn(() => builder),
    delete: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    gt: jest.fn(() => builder),
    gte: jest.fn(() => builder),
    lte: jest.fn(() => builder),
    in: jest.fn(() => builder),
    or: jest.fn(() => builder),
    order: jest.fn(() => builder),
    limit: jest.fn(() => builder),
    range: jest.fn(() => builder),
    returns: jest.fn(() => builder),
    single: jest.fn(async () => result),
    maybeSingle: jest.fn(async () => result),
    then: (resolve: (val: any) => void, reject?: (err: any) => void) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

describe('Supabase Repositories', () => {
  describe('SupabaseAuthRepository', () => {
    it('returns guest profile when there is no active session', async () => {
      const mockClient: any = {
        auth: {
          getSession: jest.fn(async () => ({ data: { session: null }, error: null })),
        },
        from: jest.fn(),
      };

      const repo = new SupabaseAuthRepository(mockClient);
      const profile = await repo.getProfile();

      expect(profile.isLoggedIn).toBe(false);
      expect(profile.onboardingCompleted).toBe(false);
      expect(profile.theme).toBe('dark');
      expect(mockClient.from).not.toHaveBeenCalled();
    });

    it('registers user and returns mapped profile when session is created', async () => {
      const profileRow = {
        id: 'user-uuid-1',
        email: 'bruno@test.com',
        name: 'Bruno',
        onboarding_completed: false,
        height_cm: null,
        target_weight_kg: null,
        training_goal: null,
        activity_level: null,
        target_calories: 2000,
        target_protein: 150,
        target_carbs: 200,
        target_fat: 60,
        target_water_ml: 2500,
        theme: 'dark',
        created_at: '2026-11-13T18:00:00Z',
        updated_at: '2026-11-13T18:00:00Z',
      };

      const selectBuilder = createQueryBuilder({ data: null, error: null });
      const upsertBuilder = createQueryBuilder({ data: profileRow, error: null });

      let callCount = 0;
      const mockClient: any = {
        auth: {
          signUp: jest.fn(async () => ({
            data: {
              user: { id: 'user-uuid-1', email: 'bruno@test.com' },
              session: { access_token: 'tok' },
            },
            error: null,
          })),
        },
        from: jest.fn(() => {
          callCount += 1;
          return callCount === 1 ? selectBuilder : upsertBuilder;
        }),
      };

      const repo = new SupabaseAuthRepository(mockClient);
      const result = await repo.registerUser({
        name: 'Bruno',
        email: 'Bruno@Test.com',
        password: 'password123',
      });

      expect(result.id).toBe('user-uuid-1');
      expect(result.email).toBe('bruno@test.com');
      expect(result.isLoggedIn).toBe(true);
      expect(result.onboardingCompleted).toBe(false);
    });
  });

  describe('SupabaseDietRepository', () => {
    it('merges remote custom foods and local TACO foods in searchFoods', async () => {
      const remoteFood = {
        id: 'remote-1',
        name: 'Whey Concentrado Custom',
        name_normalized: 'whey concentrado custom',
        category: 'Suplementos',
        serving_grams: 30,
        calories: 120,
        protein: 24,
        carbs: 3,
        fat: 1.5,
        fiber: 0,
        barcode: null,
        source: 'custom',
        serving_unit_name: 'scoop',
        serving_unit_grams: 30,
        created_at: '2026-11-13T18:00:00Z',
      };

      const builder = createQueryBuilder({ data: [remoteFood], error: null });
      const mockClient: any = { from: jest.fn(() => builder) };

      const mockLocalDb: any = {
        getAllAsync: jest.fn(async () => [
          {
            id: 'taco-1',
            name: 'Arroz, integral, cozido',
            name_normalized: 'arroz integral cozido',
            category: 'Cereais',
            serving_grams: 100,
            calories: 124,
            protein: 2.6,
            carbs: 25.8,
            fat: 1.0,
            fiber: 2.7,
            barcode: null,
            source: 'taco',
            serving_unit_name: 'g',
            serving_unit_grams: 1,
            created_at: '2026-11-13T18:00:00Z',
          },
        ]),
        getFirstAsync: jest.fn(),
        runAsync: jest.fn(),
        execAsync: jest.fn(),
        withTransactionAsync: jest.fn(),
      };

      const repo = new SupabaseDietRepository(mockClient, mockLocalDb);
      const results = await repo.searchFoods('whey', 20);

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('remote-1');
      expect(results[1].id).toBe('taco-1');
    });
  });

  describe('SupabaseWorkoutRepository', () => {
    it('computes exercise history with Brzycki 1RM from set_logs', async () => {
      const joinedRows = [
        {
          session_id: 's1',
          weight_kg: 100,
          reps: 5,
          workout_sessions: { date: '2026-11-10' },
        },
        {
          session_id: 's1',
          weight_kg: 80,
          reps: 10,
          workout_sessions: { date: '2026-11-10' },
        },
      ];

      const builder = createQueryBuilder({ data: joinedRows, error: null });
      const mockClient: any = { from: jest.fn(() => builder) };

      const repo = new SupabaseWorkoutRepository(mockClient);
      const history = await repo.getExerciseHistory('Supino Reto');

      expect(history).toHaveLength(1);
      expect(history[0].date).toBe('2026-11-10');
      expect(history[0].maxWeightKg).toBe(100);
      expect(history[0].totalVolumeKg).toBe(1300);
      expect(history[0].bestSetReps).toBe(5);
      // 100 * (36 / (37 - 5)) = 112.5
      expect(history[0].estimated1RM).toBe(112.5);
    });
  });

  describe('SupabaseBodyRepository', () => {
    it('resolves signed URLs for stored photo paths in getPhotos', async () => {
      const rows = [
        {
          date: '2026-11-13',
          photo_uris: ['user-1/2026-11-13_front_123.jpg'],
        },
      ];

      const builder = createQueryBuilder({ data: rows, error: null });
      const mockClient: any = {
        from: jest.fn(() => builder),
        storage: {
          from: jest.fn(() => ({
            createSignedUrls: jest.fn(async () => ({
              data: [
                {
                  path: 'user-1/2026-11-13_front_123.jpg',
                  signedUrl: 'https://example.supabase.co/storage/v1/object/sign/body-photos/user-1/2026-11-13_front_123.jpg?token=abc',
                },
              ],
              error: null,
            })),
          })),
        },
      };

      const repo = new SupabaseBodyRepository(mockClient);
      const photos = await repo.getPhotos();

      expect(photos).toHaveLength(1);
      expect(photos[0].date).toBe('2026-11-13');
      expect(photos[0].uri).toContain('https://example.supabase.co/storage/v1/object/sign/body-photos/');
    });
  });
});
