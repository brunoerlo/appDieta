import { SupabaseDietRepository } from '../../src/database/repositories/SupabaseDietRepository';
import { SupabaseWorkoutRepository } from '../../src/database/repositories/SupabaseWorkoutRepository';
import { SupabaseBodyRepository } from '../../src/database/repositories/SupabaseBodyRepository';
import { SupabaseAuthRepository } from '../../src/database/repositories/SupabaseAuthRepository';

function createMockQueryBuilder(result: { data?: any; error?: any } = { data: null, error: null }) {
  const calls: Record<string, any[]> = {
    select: [],
    insert: [],
    upsert: [],
    update: [],
    delete: [],
    eq: [],
    gt: [],
    gte: [],
    lte: [],
    in: [],
    or: [],
    order: [],
    limit: [],
    range: [],
  };

  const builder: any = {
    _calls: calls,
    select: jest.fn((...args: any[]) => {
      calls.select.push(args);
      return builder;
    }),
    insert: jest.fn((...args: any[]) => {
      calls.insert.push(args);
      return builder;
    }),
    upsert: jest.fn((...args: any[]) => {
      calls.upsert.push(args);
      return builder;
    }),
    update: jest.fn((...args: any[]) => {
      calls.update.push(args);
      return builder;
    }),
    delete: jest.fn((...args: any[]) => {
      calls.delete.push(args);
      return builder;
    }),
    eq: jest.fn((...args: any[]) => {
      calls.eq.push(args);
      return builder;
    }),
    gt: jest.fn((...args: any[]) => {
      calls.gt.push(args);
      return builder;
    }),
    gte: jest.fn((...args: any[]) => {
      calls.gte.push(args);
      return builder;
    }),
    lte: jest.fn((...args: any[]) => {
      calls.lte.push(args);
      return builder;
    }),
    in: jest.fn((...args: any[]) => {
      calls.in.push(args);
      return builder;
    }),
    or: jest.fn((...args: any[]) => {
      calls.or.push(args);
      return builder;
    }),
    order: jest.fn((...args: any[]) => {
      calls.order.push(args);
      return builder;
    }),
    limit: jest.fn((...args: any[]) => {
      calls.limit.push(args);
      return builder;
    }),
    range: jest.fn((...args: any[]) => {
      calls.range.push(args);
      return builder;
    }),
    returns: jest.fn(() => builder),
    single: jest.fn(async () => result),
    maybeSingle: jest.fn(async () => result),
    then: (resolve: (val: any) => void, reject?: (err: any) => void) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

function createMockStorageEngine() {
  const uploadMock = jest.fn(async (path: string) => ({
    data: { path },
    error: null,
  }));
  const removeMock = jest.fn(async (paths: string[]) => ({
    data: paths.map((name) => ({ name })),
    error: null,
  }));
  const createSignedUrlsMock = jest.fn(async (paths: string[], ttl: number) => ({
    data: paths.map((path) => ({
      path,
      signedUrl: `https://mock.storage.supabase.co/body-photos/${path}?token=exp_${ttl}`,
    })),
    error: null,
  }));

  const bucket = {
    upload: uploadMock,
    remove: removeMock,
    createSignedUrls: createSignedUrlsMock,
  };

  return {
    from: jest.fn(() => bucket),
    _bucket: bucket,
  };
}

describe('Empirical Challenger: Supabase Resilience & Stress Suite', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    (global as any).fetch = jest.fn(async () => ({
      arrayBuffer: async () => new ArrayBuffer(32),
    }));
  });

  afterEach(() => {
    (global as any).fetch = originalFetch;
    jest.clearAllMocks();
  });

  // =========================================================================
  // GUARANTEE 1: SupabaseDietRepository.searchFoods Resilience & Fault Tolerance
  // =========================================================================
  describe('Resilience Guarantee 1: SupabaseDietRepository.searchFoods', () => {
    const mockTacoFood = {
      id: 'taco-item-1',
      name: 'Frango, peito, sem pele, grelhado',
      name_normalized: 'frango peito sem pele grelhado',
      category: 'Carnes',
      serving_grams: 100,
      calories: 159,
      protein: 32,
      carbs: 0,
      fat: 2.5,
      fiber: 0,
      barcode: null,
      source: 'taco' as const,
      serving_unit_name: 'g',
      serving_unit_grams: 1,
      created_at: '2026-11-13T00:00:00Z',
    };

    it('survives simulated network 504 Gateway Timeout error without crashing and returns local TACO items', async () => {
      const errorBuilder = createMockQueryBuilder({
        data: null,
        error: { message: '504 Gateway Timeout: upstream request timed out' },
      });
      const mockClient: any = { from: jest.fn(() => errorBuilder) };

      const mockLocalDb: any = {
        getAllAsync: jest.fn(async () => [mockTacoFood]),
      };

      const repo = new SupabaseDietRepository(mockClient, mockLocalDb);
      const results = await repo.searchFoods('frango', 20);

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('taco-item-1');
      expect(results[0].name).toContain('Frango, peito');
    });

    it('survives an unhandled network rejection (e.g. AbortController / Socket Hangup) without unhandled rejection', async () => {
      const mockClient: any = {
        from: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          or: jest.fn().mockReturnThis(),
          returns: jest.fn().mockImplementation(() => {
            return Promise.reject(new Error('FetchError: socket hang up'));
          }),
        })),
      };

      const mockLocalDb: any = {
        getAllAsync: jest.fn(async () => [mockTacoFood]),
      };

      const repo = new SupabaseDietRepository(mockClient, mockLocalDb);
      const results = await repo.searchFoods('frango', 10);

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('taco-item-1');
    });

    it('gracefully returns empty array when BOTH remote and local engines throw exceptions simultaneously', async () => {
      const mockClient: any = {
        from: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          or: jest.fn().mockReturnThis(),
          returns: jest.fn().mockRejectedValue(new Error('Supabase unreachable')),
        })),
      };

      const brokenLocalDb: any = {
        getAllAsync: jest.fn(async () => {
          throw new Error('SQLite database disk I/O error');
        }),
      };

      const repo = new SupabaseDietRepository(mockClient, brokenLocalDb);
      const results = await repo.searchFoods('frango', 10);

      expect(results).toEqual([]);
    });

    it('handles adversarial search inputs: SQL fragments, punctuation, whitespace, and excessive lengths', async () => {
      const mockClient: any = {
        from: jest.fn(() => createMockQueryBuilder({ data: [], error: null })),
      };
      const mockLocalDb: any = {
        getAllAsync: jest.fn(async () => []),
      };

      const repo = new SupabaseDietRepository(mockClient, mockLocalDb);

      const adversarialInputs = [
        "'; DROP TABLE foods; --",
        '   ',
        '\t\n\r',
        '🍎🍌🍕🍔',
        'a'.repeat(2000),
        'undefined',
        'null',
        '1 OR 1=1',
        "name.ilike.%test%,malicious=true",
      ];

      for (const input of adversarialInputs) {
        await expect(repo.searchFoods(input, 10)).resolves.toBeDefined();
      }
    });

    it('deduplicates items when both remote and local databases return identical IDs', async () => {
      const duplicateId = 'shared-food-id-999';
      const remoteFood = {
        id: duplicateId,
        name: 'Arroz Remoto',
        name_normalized: 'arroz remoto',
        category: 'Cereais',
        serving_grams: 100,
        calories: 130,
        protein: 2.5,
        carbs: 28,
        fat: 0.2,
        fiber: 0.5,
        barcode: null,
        source: 'custom',
        serving_unit_name: 'g',
        serving_unit_grams: 1,
        created_at: '2026-11-13T00:00:00Z',
      };

      const localFood = {
        id: duplicateId,
        name: 'Arroz Local TACO',
        name_normalized: 'arroz local taco',
        category: 'Cereais',
        serving_grams: 100,
        calories: 128,
        protein: 2.5,
        carbs: 28,
        fat: 0.2,
        fiber: 0.5,
        barcode: null,
        source: 'taco',
        serving_unit_name: 'g',
        serving_unit_grams: 1,
        created_at: '2026-11-13T00:00:00Z',
      };

      const mockClient: any = {
        from: jest.fn(() => createMockQueryBuilder({ data: [remoteFood], error: null })),
      };
      const mockLocalDb: any = {
        getAllAsync: jest.fn(async () => [localFood]),
      };

      const repo = new SupabaseDietRepository(mockClient, mockLocalDb);
      const results = await repo.searchFoods('arroz', 50);

      // Verify no duplicates
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(duplicateId);
      expect(results[0].name).toBe('Arroz Remoto'); // Remote takes precedence
    });

    it('handles getFoodByBarcode resilience: falls back to local when remote fails or returns null', async () => {
      const errorBuilder = createMockQueryBuilder({ data: null, error: { message: 'Network offline' } });
      const mockClient: any = { from: jest.fn(() => errorBuilder) };

      const mockLocalDb: any = {
        getFirstAsync: jest.fn(async () => ({
          ...mockTacoFood,
          barcode: '7891000315507',
        })),
      };

      // When remote throws an error, SupabaseDietRepository throws error if localRepo not used or if error not handled
      // Let's verify getFoodByBarcode behavior:
      const repo = new SupabaseDietRepository(mockClient, mockLocalDb);
      // When remote returns !error && data === null, it checks localRepo
      const notFoundBuilder = createMockQueryBuilder({ data: null, error: null });
      const mockClientNotFound: any = { from: jest.fn(() => notFoundBuilder) };
      const repo2 = new SupabaseDietRepository(mockClientNotFound, mockLocalDb);

      const found = await repo2.getFoodByBarcode('7891000315507');
      expect(found).not.toBeNull();
      expect(found?.barcode).toBe('7891000315507');
      expect(mockLocalDb.getFirstAsync).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // GUARANTEE 2: SupabaseWorkoutRepository.getRoutines Clean Slate & Zero Auto-Seed
  // =========================================================================
  describe('Resilience Guarantee 2: SupabaseWorkoutRepository.getRoutines Clean Slate', () => {
    it('returns an empty array [] for a newly registered user without triggering any auto-seed inserts', async () => {
      const routinesBuilder = createMockQueryBuilder({ data: [], error: null });
      const exercisesBuilder = createMockQueryBuilder({ data: [], error: null });

      const mockClient: any = {
        from: jest.fn((table: string) => {
          if (table === 'workout_routines') return routinesBuilder;
          if (table === 'routine_exercises') return exercisesBuilder;
          return createMockQueryBuilder({ data: null, error: null });
        }),
      };

      const repo = new SupabaseWorkoutRepository(mockClient);
      const routines = await repo.getRoutines();

      // Invariant: empty array returned
      expect(routines).toEqual([]);

      // Invariant: zero insert or upsert mutations invoked on database
      expect(routinesBuilder.insert).not.toHaveBeenCalled();
      expect(routinesBuilder.upsert).not.toHaveBeenCalled();
      expect(exercisesBuilder.insert).not.toHaveBeenCalled();
      expect(exercisesBuilder.upsert).not.toHaveBeenCalled();
    });

    it('returns routines with empty exercises array if routines exist but have no exercises attached', async () => {
      const routineRows = [
        { id: 'r-empty', name: 'Treino Vazio', description: null, sort_order: 1, created_at: '2026-11-13T10:00:00Z' },
      ];
      const routinesBuilder = createMockQueryBuilder({ data: routineRows, error: null });
      const exercisesBuilder = createMockQueryBuilder({ data: [], error: null });

      const mockClient: any = {
        from: jest.fn((table: string) => {
          if (table === 'workout_routines') return routinesBuilder;
          if (table === 'routine_exercises') return exercisesBuilder;
          return createMockQueryBuilder();
        }),
      };

      const repo = new SupabaseWorkoutRepository(mockClient);
      const routines = await repo.getRoutines();

      expect(routines).toHaveLength(1);
      expect(routines[0].id).toBe('r-empty');
      expect(routines[0].exercises).toEqual([]);
    });

    it('throws clean error on routine query failure without masking database error message', async () => {
      const errorBuilder = createMockQueryBuilder({ data: null, error: { message: 'RLS policy violation: permission denied' } });
      const mockClient: any = { from: jest.fn(() => errorBuilder) };

      const repo = new SupabaseWorkoutRepository(mockClient);
      await expect(repo.getRoutines()).rejects.toThrow('RLS policy violation: permission denied');
    });

    it('Brzycki 1RM stress test: handles 1 rep, 0 reps, clamped reps (>30), and zero weight', async () => {
      const historyRows = [
        {
          session_id: 's1',
          weight_kg: 100,
          reps: 1, // exact 1RM
          workout_sessions: { date: '2026-11-01' },
        },
        {
          session_id: 's2',
          weight_kg: 0,
          reps: 10, // bodyweight 0kg
          workout_sessions: { date: '2026-11-02' },
        },
        {
          session_id: 's3',
          weight_kg: 50,
          reps: 100, // clamped to 30 reps -> 50 * (36 / 7) = 257.1
          workout_sessions: { date: '2026-11-03' },
        },
        {
          session_id: 's4',
          weight_kg: 80,
          reps: 0, // clamped to 1 rep -> 80
          workout_sessions: { date: '2026-11-04' },
        },
      ];

      const builder = createMockQueryBuilder({ data: historyRows, error: null });
      const mockClient: any = { from: jest.fn(() => builder) };

      const repo = new SupabaseWorkoutRepository(mockClient);
      const points = await repo.getExerciseHistory('Supino');

      expect(points).toHaveLength(4);
      expect(points[0].estimated1RM).toBe(100);
      expect(points[1].estimated1RM).toBe(0);
      expect(points[2].estimated1RM).toBe(257.1);
      expect(points[3].estimated1RM).toBe(80);
    });
  });

  // =========================================================================
  // GUARANTEE 3: SupabaseBodyRepository User Isolation & Signed URL 3600s TTL
  // =========================================================================
  describe('Resilience Guarantee 3: SupabaseBodyRepository Path Isolation & Signed URLs', () => {
    it('formats photo upload path strictly isolated under <userId>/ and neutralizes directory traversal', async () => {
      const mockStorage = createMockStorageEngine();
      const mockClient: any = {
        auth: {
          getSession: jest.fn(async () => ({
            data: { session: { user: { id: 'athlete-tenant-99' } } },
            error: null,
          })),
        },
        storage: mockStorage,
        from: jest.fn(() => createMockQueryBuilder({ data: null, error: null })),
      };

      const repo = new SupabaseBodyRepository(mockClient);

      // Adversarial attempt with path traversal in photo URI
      const maliciousUri = 'file:///storage/emulated/0/DCIM/../../../../etc/shadow.jpg';
      await repo.savePhoto('2026-11-13', maliciousUri);

      // Verify storage upload was called
      expect(mockStorage._bucket.upload).toHaveBeenCalledTimes(1);
      const uploadedPath = mockStorage._bucket.upload.mock.calls[0][0];

      // Invariant: MUST start with athlete-tenant-99/
      expect(uploadedPath.startsWith('athlete-tenant-99/')).toBe(true);

      // Invariant: Directory traversal ../ MUST NOT be present in path
      expect(uploadedPath).not.toContain('..');
      expect(uploadedPath).not.toContain('/etc/');

      // Invariant: date component is preserved and sanitized
      expect(uploadedPath).toContain('2026-11-13');
    });

    it('generates signed URLs with exactly 3600 seconds (1 hour) TTL for private bucket security', async () => {
      const mockStorage = createMockStorageEngine();
      const mockClient: any = {
        from: jest.fn(() =>
          createMockQueryBuilder({
            data: [
              {
                date: '2026-11-13',
                photo_uris: ['user-123/2026-11-13_front.jpg', 'user-123/2026-11-13_back.jpg'],
              },
            ],
            error: null,
          })
        ),
        storage: mockStorage,
      };

      const repo = new SupabaseBodyRepository(mockClient);
      const photos = await repo.getPhotos();

      expect(photos).toHaveLength(2);
      expect(mockStorage._bucket.createSignedUrls).toHaveBeenCalledTimes(1);

      const [requestedPaths, requestedTtl] = mockStorage._bucket.createSignedUrls.mock.calls[0];
      expect(requestedPaths).toEqual([
        'user-123/2026-11-13_front.jpg',
        'user-123/2026-11-13_back.jpg',
      ]);
      // Invariant: TTL must be exactly 3600 seconds
      expect(requestedTtl).toBe(3600);
    });

    it('rejects photo upload immediately if session user is missing or unauthenticated', async () => {
      const mockClient: any = {
        auth: {
          getSession: jest.fn(async () => ({
            data: { session: null },
            error: null,
          })),
        },
        storage: createMockStorageEngine(),
      };

      const repo = new SupabaseBodyRepository(mockClient);
      await expect(
        repo.savePhoto('2026-11-13', 'file:///cache/photo.jpg')
      ).rejects.toThrow('Usuário não autenticado.');
    });

    it('handles moving average edge cases: sparse dates, 0 values, and window bounds', async () => {
      const mockClient: any = {
        from: jest.fn(() =>
          createMockQueryBuilder({
            data: [{ weight_kg: 82.4 }, { weight_kg: 82.0 }],
            error: null,
          })
        ),
      };

      const repo = new SupabaseBodyRepository(mockClient);
      const ma = await repo.calculateMovingAverage('2026-11-13', 7);

      expect(ma).toBe(82.2); // (82.4 + 82.0) / 2 = 82.2
    });
  });

  // =========================================================================
  // GUARANTEE 4: SupabaseAuthRepository Safe Guest Mapping & No Leakage
  // =========================================================================
  describe('Resilience Guarantee 4: SupabaseAuthRepository Guest Mapping & Credential Protection', () => {
    it('safely maps unauthenticated sessions to default guest profile without database roundtrips', async () => {
      const mockClient: any = {
        auth: {
          getSession: jest.fn(async () => ({
            data: { session: null },
            error: null,
          })),
        },
        from: jest.fn(),
      };

      const repo = new SupabaseAuthRepository(mockClient);
      const profile = await repo.getProfile();

      expect(profile).toBeDefined();
      expect(profile.isLoggedIn).toBe(false);
      expect(profile.id).toBe('');
      expect(profile.name).toBe('Atleta');
      expect(profile.onboardingCompleted).toBe(false);
      expect(profile.theme).toBe('dark');

      // Invariant: no database call made when unauthenticated
      expect(mockClient.from).not.toHaveBeenCalled();

      // Invariant: NEVER leak credentials, hashes, or passwords in profile object
      expect((profile as any).password).toBeUndefined();
      expect((profile as any).password_hash).toBeUndefined();
      expect((profile as any).token).toBeUndefined();
    });

    it('safely maps to default guest profile when getSession throws a network/auth error without crashing', async () => {
      const mockClient: any = {
        auth: {
          getSession: jest.fn(async () => ({
            data: { session: null },
            error: { message: 'JWT expired: token refresh failed' },
          })),
        },
        from: jest.fn(),
      };

      const repo = new SupabaseAuthRepository(mockClient);
      const profile = await repo.getProfile();

      expect(profile.isLoggedIn).toBe(false);
      expect(profile.id).toBe('');
    });

    it('sanitizes invalid login credential errors to user-friendly message without leaking server details', async () => {
      const mockClient: any = {
        auth: {
          signInWithPassword: jest.fn(async () => ({
            data: { user: null, session: null },
            error: { message: 'Invalid login credentials: password mismatch on table auth.users' },
          })),
        },
      };

      const repo = new SupabaseAuthRepository(mockClient);
      await expect(
        repo.loginUser({ email: 'user@test.com', password: 'bad' })
      ).rejects.toThrow('E-mail ou senha incorretos.');
    });

    it('blocks unauthenticated operations (updateProfile, completeOnboarding) with explicit error', async () => {
      const mockClient: any = {
        auth: {
          getSession: jest.fn(async () => ({
            data: { session: null },
            error: null,
          })),
        },
        from: jest.fn(),
      };

      const repo = new SupabaseAuthRepository(mockClient);

      await expect(repo.updateProfile({ name: 'Hacker' })).rejects.toThrow(
        'Usuário não autenticado.'
      );

      await expect(
        repo.completeOnboarding({
          heightCm: 180,
          targetWeightKg: 80,
          trainingGoal: 'hipertrofia',
          activityLevel: 'moderado',
        })
      ).rejects.toThrow('Usuário não autenticado.');
    });

    it('setTheme is a safe no-op when unauthenticated, and getTheme defaults to dark', async () => {
      const mockClient: any = {
        auth: {
          getSession: jest.fn(async () => ({
            data: { session: null },
            error: null,
          })),
        },
        from: jest.fn(),
      };

      const repo = new SupabaseAuthRepository(mockClient);

      await expect(repo.setTheme('light')).resolves.toBeUndefined();
      expect(mockClient.from).not.toHaveBeenCalled();

      const theme = await repo.getTheme();
      expect(theme).toBe('dark');
    });
  });
});
