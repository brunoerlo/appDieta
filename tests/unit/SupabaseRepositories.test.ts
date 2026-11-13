import { SupabaseAuthRepository } from '../../src/database/repositories/SupabaseAuthRepository';
import { SupabaseDietRepository } from '../../src/database/repositories/SupabaseDietRepository';
import { SupabaseWorkoutRepository } from '../../src/database/repositories/SupabaseWorkoutRepository';
import { SupabaseBodyRepository } from '../../src/database/repositories/SupabaseBodyRepository';
import { BodyStateManager } from '../../src/context/BodyContext';
import { DietStateManager } from '../../src/context/DietContext';

function createQueryBuilder(result: { data?: any; error?: any } = { data: null, error: null }) {
  const builder: any = {
    _calls: {
      select: [] as any[],
      insert: [] as any[],
      upsert: [] as any[],
      update: [] as any[],
      delete: [] as any[],
      eq: [] as any[],
      gt: [] as any[],
      gte: [] as any[],
      lte: [] as any[],
      in: [] as any[],
      or: [] as any[],
      order: [] as any[],
      limit: [] as any[],
      range: [] as any[],
    },
    select: jest.fn((...args: any[]) => {
      builder._calls.select.push(args);
      return builder;
    }),
    insert: jest.fn((...args: any[]) => {
      builder._calls.insert.push(args);
      return builder;
    }),
    upsert: jest.fn((...args: any[]) => {
      builder._calls.upsert.push(args);
      return builder;
    }),
    update: jest.fn((...args: any[]) => {
      builder._calls.update.push(args);
      return builder;
    }),
    delete: jest.fn((...args: any[]) => {
      builder._calls.delete.push(args);
      return builder;
    }),
    eq: jest.fn((...args: any[]) => {
      builder._calls.eq.push(args);
      return builder;
    }),
    gt: jest.fn((...args: any[]) => {
      builder._calls.gt.push(args);
      return builder;
    }),
    gte: jest.fn((...args: any[]) => {
      builder._calls.gte.push(args);
      return builder;
    }),
    lte: jest.fn((...args: any[]) => {
      builder._calls.lte.push(args);
      return builder;
    }),
    in: jest.fn((...args: any[]) => {
      builder._calls.in.push(args);
      return builder;
    }),
    or: jest.fn((...args: any[]) => {
      builder._calls.or.push(args);
      return builder;
    }),
    order: jest.fn((...args: any[]) => {
      builder._calls.order.push(args);
      return builder;
    }),
    limit: jest.fn((...args: any[]) => {
      builder._calls.limit.push(args);
      return builder;
    }),
    range: jest.fn((...args: any[]) => {
      builder._calls.range.push(args);
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

function createMockStorage() {
  const uploadMock = jest.fn(async (path: string) => ({
    data: { path },
    error: null,
  }));
  const removeMock = jest.fn(async (paths: string[]) => ({
    data: paths.map((name) => ({ name })),
    error: null,
  }));
  const createSignedUrlsMock = jest.fn(async (paths: string[], _ttl: number) => ({
    data: paths.map((path) => ({
      path,
      signedUrl: `https://mock.storage.supabase.co/body-photos/${path}?token=signed_1h`,
    })),
    error: null,
  }));

  const bucketObj = {
    upload: uploadMock,
    remove: removeMock,
    createSignedUrls: createSignedUrlsMock,
  };

  return {
    from: jest.fn(() => bucketObj),
    _bucket: bucketObj,
  };
}

describe('Supabase Repositories', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    (global as any).fetch = jest.fn(async () => ({
      arrayBuffer: async () => new ArrayBuffer(16),
    }));
  });

  afterEach(() => {
    (global as any).fetch = originalFetch;
  });

  describe('SupabaseAuthRepository', () => {
    const sampleProfileRow = {
      id: 'user-uuid-1',
      email: 'bruno@test.com',
      name: 'Bruno',
      onboarding_completed: true,
      height_cm: 180,
      target_weight_kg: 78,
      training_goal: 'hipertrofia',
      activity_level: 'moderado',
      target_calories: 2200,
      target_protein: 160,
      target_carbs: 220,
      target_fat: 65,
      target_water_ml: 3000,
      theme: 'dark' as const,
      created_at: '2026-11-13T18:00:00Z',
      updated_at: '2026-11-13T18:00:00Z',
    };

    it('returns default guest profile when session is null / unauthenticated', async () => {
      const mockClient: any = {
        auth: {
          getSession: jest.fn(async () => ({ data: { session: null }, error: null })),
        },
        from: jest.fn(),
      };

      const repo = new SupabaseAuthRepository(mockClient);
      const profile = await repo.getProfile();

      expect(profile.id).toBe('');
      expect(profile.isLoggedIn).toBe(false);
      expect(profile.onboardingCompleted).toBe(false);
      expect(profile.theme).toBe('dark');
      expect(profile.name).toBe('Atleta');
      expect(mockClient.from).not.toHaveBeenCalled();
    });

    it('returns default guest profile when getSession returns an error', async () => {
      const mockClient: any = {
        auth: {
          getSession: jest.fn(async () => ({
            data: { session: null },
            error: { message: 'Session expired' },
          })),
        },
        from: jest.fn(),
      };

      const repo = new SupabaseAuthRepository(mockClient);
      const profile = await repo.getProfile();

      expect(profile.isLoggedIn).toBe(false);
      expect(profile.onboardingCompleted).toBe(false);
      expect(mockClient.from).not.toHaveBeenCalled();
    });

    it('returns mapped profile when session user exists and profile is found in database', async () => {
      const profileBuilder = createQueryBuilder({ data: sampleProfileRow, error: null });
      const mockClient: any = {
        auth: {
          getSession: jest.fn(async () => ({
            data: {
              session: {
                user: { id: 'user-uuid-1', email: 'bruno@test.com' },
              },
            },
            error: null,
          })),
        },
        from: jest.fn(() => profileBuilder),
      };

      const repo = new SupabaseAuthRepository(mockClient);
      const profile = await repo.getProfile();

      expect(profile.id).toBe('user-uuid-1');
      expect(profile.email).toBe('bruno@test.com');
      expect(profile.isLoggedIn).toBe(true);
      expect(profile.onboardingCompleted).toBe(true);
      expect(profile.heightCm).toBe(180);
      expect(profile.targetWeightKg).toBe(78);
      expect(profile.trainingGoal).toBe('hipertrofia');
      expect(profile.targetCalories).toBe(2200);
      expect(profileBuilder.eq).toHaveBeenCalledWith('id', 'user-uuid-1');
    });

    it('upserts default profile and returns it when session user exists but profile row is missing', async () => {
      const selectBuilder = createQueryBuilder({ data: null, error: null });
      const upsertBuilder = createQueryBuilder({
        data: {
          ...sampleProfileRow,
          onboarding_completed: false,
          name: 'Atleta',
        },
        error: null,
      });

      let callCount = 0;
      const mockClient: any = {
        auth: {
          getSession: jest.fn(async () => ({
            data: {
              session: {
                user: { id: 'user-uuid-1', email: 'bruno@test.com' },
              },
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
      const profile = await repo.getProfile();

      expect(profile.id).toBe('user-uuid-1');
      expect(profile.isLoggedIn).toBe(true);
      expect(profile.onboardingCompleted).toBe(false);
      expect(upsertBuilder.upsert).toHaveBeenCalled();
    });

    it('throws error when ensureProfileRow select fails with database error', async () => {
      const errorBuilder = createQueryBuilder({ data: null, error: { message: 'Database connection failed' } });
      const mockClient: any = {
        auth: {
          getSession: jest.fn(async () => ({
            data: {
              session: { user: { id: 'user-1', email: 'test@example.com' } },
            },
            error: null,
          })),
        },
        from: jest.fn(() => errorBuilder),
      };

      const repo = new SupabaseAuthRepository(mockClient);
      await expect(repo.getProfile()).rejects.toThrow('Database connection failed');
    });

    it('loginUser throws error when email or password is missing or blank', async () => {
      const mockClient: any = { auth: { signInWithPassword: jest.fn() } };
      const repo = new SupabaseAuthRepository(mockClient);

      await expect(repo.loginUser({ email: '', password: '123' })).rejects.toThrow('Informe e-mail e senha.');
      await expect(repo.loginUser({ email: 'test@test.com', password: '' })).rejects.toThrow('Informe e-mail e senha.');
      expect(mockClient.auth.signInWithPassword).not.toHaveBeenCalled();
    });

    it('loginUser throws clean error on invalid login credentials', async () => {
      const mockClient: any = {
        auth: {
          signInWithPassword: jest.fn(async () => ({
            data: { user: null, session: null },
            error: { message: 'Invalid login credentials' },
          })),
        },
      };

      const repo = new SupabaseAuthRepository(mockClient);
      await expect(
        repo.loginUser({ email: 'wrong@test.com', password: 'badpassword' })
      ).rejects.toThrow('E-mail ou senha incorretos.');
    });

    it('loginUser propagates raw error message for other Supabase auth errors', async () => {
      const mockClient: any = {
        auth: {
          signInWithPassword: jest.fn(async () => ({
            data: { user: null, session: null },
            error: { message: 'Rate limit exceeded' },
          })),
        },
      };

      const repo = new SupabaseAuthRepository(mockClient);
      await expect(
        repo.loginUser({ email: 'atleta@test.com', password: 'password123' })
      ).rejects.toThrow('Rate limit exceeded');
    });

    it('loginUser throws error when signIn succeeds but user is null', async () => {
      const mockClient: any = {
        auth: {
          signInWithPassword: jest.fn(async () => ({
            data: { user: null, session: {} },
            error: null,
          })),
        },
      };

      const repo = new SupabaseAuthRepository(mockClient);
      await expect(
        repo.loginUser({ email: 'atleta@test.com', password: 'password123' })
      ).rejects.toThrow('Usuário não encontrado.');
    });

    it('loginUser succeeds and loads profile on valid credentials', async () => {
      const profileBuilder = createQueryBuilder({ data: sampleProfileRow, error: null });
      const mockClient: any = {
        auth: {
          signInWithPassword: jest.fn(async () => ({
            data: {
              user: {
                id: 'user-uuid-1',
                email: 'bruno@test.com',
                user_metadata: { name: 'Bruno' },
              },
              session: { access_token: 'valid-jwt' },
            },
            error: null,
          })),
        },
        from: jest.fn(() => profileBuilder),
      };

      const repo = new SupabaseAuthRepository(mockClient);
      const result = await repo.loginUser({ email: 'bruno@test.com', password: 'secretpassword' });

      expect(result.id).toBe('user-uuid-1');
      expect(result.email).toBe('bruno@test.com');
      expect(result.isLoggedIn).toBe(true);
      expect(result.name).toBe('Bruno');
    });

    it('logoutUser invokes signOut cleanly without errors', async () => {
      const mockClient: any = {
        auth: {
          signOut: jest.fn(async () => ({ error: null })),
        },
      };

      const repo = new SupabaseAuthRepository(mockClient);
      await expect(repo.logoutUser()).resolves.toBeUndefined();
      expect(mockClient.auth.signOut).toHaveBeenCalled();
    });

    it('logoutUser throws error if signOut returns an error', async () => {
      const mockClient: any = {
        auth: {
          signOut: jest.fn(async () => ({ error: { message: 'Network error during sign out' } })),
        },
      };

      const repo = new SupabaseAuthRepository(mockClient);
      await expect(repo.logoutUser()).rejects.toThrow('Network error during sign out');
    });

    it('completeOnboarding throws error when user is not authenticated', async () => {
      const mockClient: any = {
        auth: {
          getSession: jest.fn(async () => ({ data: { session: null }, error: null })),
        },
      };

      const repo = new SupabaseAuthRepository(mockClient);
      await expect(
        repo.completeOnboarding({
          heightCm: 180,
          targetWeightKg: 80,
          trainingGoal: 'hipertrofia',
          activityLevel: 'moderado',
        })
      ).rejects.toThrow('Usuário não autenticado.');
    });

    it('completeOnboarding updates biometrics and sets onboarding_completed to true', async () => {
      const existingProfile = { ...sampleProfileRow, onboarding_completed: false };
      const updatedProfileRow = {
        ...sampleProfileRow,
        onboarding_completed: true,
        height_cm: 185,
        target_weight_kg: 82,
        training_goal: 'forca',
        activity_level: 'intenso',
      };

      const selectBuilder = createQueryBuilder({ data: existingProfile, error: null });
      const updateBuilder = createQueryBuilder({ data: updatedProfileRow, error: null });

      let fromCall = 0;
      const mockClient: any = {
        auth: {
          getSession: jest.fn(async () => ({
            data: {
              session: { user: { id: 'user-uuid-1', email: 'bruno@test.com' } },
            },
            error: null,
          })),
        },
        from: jest.fn(() => {
          fromCall += 1;
          return fromCall === 1 ? selectBuilder : updateBuilder;
        }),
      };

      const repo = new SupabaseAuthRepository(mockClient);
      const result = await repo.completeOnboarding({
        heightCm: 185,
        targetWeightKg: 82,
        trainingGoal: 'forca',
        activityLevel: 'intenso',
      });

      expect(result.onboardingCompleted).toBe(true);
      expect(result.heightCm).toBe(185);
      expect(result.targetWeightKg).toBe(82);
      expect(result.trainingGoal).toBe('forca');
      expect(result.activityLevel).toBe('intenso');

      expect(updateBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          onboarding_completed: true,
          height_cm: 185,
          target_weight_kg: 82,
          training_goal: 'forca',
          activity_level: 'intenso',
        })
      );
    });

    it('getTheme returns dark when session is null / unauthenticated', async () => {
      const mockClient: any = {
        auth: { getSession: jest.fn(async () => ({ data: { session: null }, error: null })) },
        from: jest.fn(),
      };

      const repo = new SupabaseAuthRepository(mockClient);
      const theme = await repo.getTheme();

      expect(theme).toBe('dark');
      expect(mockClient.from).not.toHaveBeenCalled();
    });

    it('getTheme retrieves stored theme from profile when session exists', async () => {
      const themeBuilder = createQueryBuilder({ data: { theme: 'light' }, error: null });
      const mockClient: any = {
        auth: {
          getSession: jest.fn(async () => ({
            data: { session: { user: { id: 'u1', email: 'test@example.com' } } },
            error: null,
          })),
        },
        from: jest.fn(() => themeBuilder),
      };

      const repo = new SupabaseAuthRepository(mockClient);
      const theme = await repo.getTheme();

      expect(theme).toBe('light');
      expect(themeBuilder.select).toHaveBeenCalledWith('theme');
      expect(themeBuilder.eq).toHaveBeenCalledWith('id', 'u1');
    });

    it('getTheme falls back to dark when profile row has null theme', async () => {
      const themeBuilder = createQueryBuilder({ data: null, error: null });
      const mockClient: any = {
        auth: {
          getSession: jest.fn(async () => ({
            data: { session: { user: { id: 'u1', email: 'test@example.com' } } },
            error: null,
          })),
        },
        from: jest.fn(() => themeBuilder),
      };

      const repo = new SupabaseAuthRepository(mockClient);
      const theme = await repo.getTheme();

      expect(theme).toBe('dark');
    });

    it('setTheme updates theme in profiles table when user is authenticated', async () => {
      const updateBuilder = createQueryBuilder({ data: null, error: null });
      const mockClient: any = {
        auth: {
          getSession: jest.fn(async () => ({
            data: { session: { user: { id: 'u1', email: 'test@example.com' } } },
            error: null,
          })),
        },
        from: jest.fn(() => updateBuilder),
      };

      const repo = new SupabaseAuthRepository(mockClient);
      await repo.setTheme('light');

      expect(mockClient.from).toHaveBeenCalledWith('profiles');
      expect(updateBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({ theme: 'light' })
      );
      expect(updateBuilder.eq).toHaveBeenCalledWith('id', 'u1');
    });

    it('setTheme does nothing and does not throw when user is unauthenticated', async () => {
      const mockClient: any = {
        auth: { getSession: jest.fn(async () => ({ data: { session: null }, error: null })) },
        from: jest.fn(),
      };

      const repo = new SupabaseAuthRepository(mockClient);
      await expect(repo.setTheme('light')).resolves.toBeUndefined();
      expect(mockClient.from).not.toHaveBeenCalled();
    });

    it('updateProfile throws error when user is unauthenticated', async () => {
      const mockClient: any = {
        auth: { getSession: jest.fn(async () => ({ data: { session: null }, error: null })) },
      };

      const repo = new SupabaseAuthRepository(mockClient);
      await expect(repo.updateProfile({ name: 'Novo Nome' })).rejects.toThrow('Usuário não autenticado.');
    });

    it('registerUser validates required email and password length', async () => {
      const mockClient: any = { auth: { signUp: jest.fn() } };
      const repo = new SupabaseAuthRepository(mockClient);

      await expect(
        repo.registerUser({ name: 'Bruno', email: '', password: 'password123' })
      ).rejects.toThrow('E-mail é obrigatório para cadastro.');

      await expect(
        repo.registerUser({ name: 'Bruno', email: 'b@test.com', password: '123' })
      ).rejects.toThrow('A senha deve ter pelo menos 6 caracteres.');

      expect(mockClient.auth.signUp).not.toHaveBeenCalled();
    });

    it('registerUser throws user-friendly error if email is already registered', async () => {
      const mockClient: any = {
        auth: {
          signUp: jest.fn(async () => ({
            data: { user: null, session: null },
            error: { message: 'User already registered' },
          })),
        },
      };

      const repo = new SupabaseAuthRepository(mockClient);
      await expect(
        repo.registerUser({ name: 'Bruno', email: 'already@test.com', password: 'password123' })
      ).rejects.toThrow('E-mail já cadastrado no aplicativo.');
    });

    it('registerUser throws verification notice if session is null after signup', async () => {
      const mockClient: any = {
        auth: {
          signUp: jest.fn(async () => ({
            data: { user: { id: 'u1' }, session: null },
            error: null,
          })),
        },
      };

      const repo = new SupabaseAuthRepository(mockClient);
      await expect(
        repo.registerUser({ name: 'Bruno', email: 'new@test.com', password: 'password123' })
      ).rejects.toThrow('Conta criada! Verifique seu e-mail para confirmar o cadastro antes de entrar.');
    });

    it('registerUser registers user and returns mapped profile when session is created', async () => {
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
        theme: 'dark' as const,
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
    const mockDietRow = {
      id: 'log-1',
      date: '2026-11-13',
      meal_type: 'breakfast' as const,
      food_id: 'food-1',
      food_name: 'Omelete Simples',
      serving_grams: 150,
      calories: 250,
      protein: 18,
      carbs: 2,
      fat: 19,
      created_at: '2026-11-13T08:00:00Z',
    };

    it('getDailyLogs maps rows correctly and returns empty array on empty results', async () => {
      const emptyBuilder = createQueryBuilder({ data: [], error: null });
      const mockClient: any = { from: jest.fn(() => emptyBuilder) };

      const repo = new SupabaseDietRepository(mockClient);
      const result = await repo.getDailyLogs('2026-11-13');

      expect(result).toEqual([]);
      expect(mockClient.from).toHaveBeenCalledWith('diet_logs');
      expect(emptyBuilder.eq).toHaveBeenCalledWith('date', '2026-11-13');
    });

    it('getDailyLogs maps rows into DietLogEntry objects correctly', async () => {
      const dataBuilder = createQueryBuilder({ data: [mockDietRow], error: null });
      const mockClient: any = { from: jest.fn(() => dataBuilder) };

      const repo = new SupabaseDietRepository(mockClient);
      const logs = await repo.getDailyLogs('2026-11-13');

      expect(logs).toHaveLength(1);
      expect(logs[0].id).toBe('log-1');
      expect(logs[0].mealType).toBe('breakfast');
      expect(logs[0].foodName).toBe('Omelete Simples');
      expect(logs[0].calories).toBe(250);
      expect(logs[0].protein).toBe(18);
    });

    it('getDailyLogs throws an error if Supabase query returns an error', async () => {
      const errorBuilder = createQueryBuilder({ data: null, error: { message: 'Database read timeout' } });
      const mockClient: any = { from: jest.fn(() => errorBuilder) };

      const repo = new SupabaseDietRepository(mockClient);
      await expect(repo.getDailyLogs('2026-11-13')).rejects.toThrow('Database read timeout');
    });

    it('addDietLog persists meal and returns mapped entry', async () => {
      const insertBuilder = createQueryBuilder({ data: mockDietRow, error: null });
      const mockClient: any = { from: jest.fn(() => insertBuilder) };

      const repo = new SupabaseDietRepository(mockClient);
      const result = await repo.addDietLog({
        date: '2026-11-13',
        mealType: 'breakfast',
        foodId: 'food-1',
        foodName: 'Omelete Simples',
        servingGrams: 150,
        calories: 250,
        protein: 18,
        carbs: 2,
        fat: 19,
      });

      expect(result.id).toBe('log-1');
      expect(result.foodName).toBe('Omelete Simples');
      expect(insertBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          date: '2026-11-13',
          meal_type: 'breakfast',
          food_name: 'Omelete Simples',
          serving_grams: 150,
        })
      );
    });

    it('addDietLog throws error on DB failure', async () => {
      const errorBuilder = createQueryBuilder({ data: null, error: { message: 'Insert constraint error' } });
      const mockClient: any = { from: jest.fn(() => errorBuilder) };

      const repo = new SupabaseDietRepository(mockClient);
      await expect(
        repo.addDietLog({
          date: '2026-11-13',
          mealType: 'lunch',
          foodName: 'Frango',
          servingGrams: 100,
          calories: 160,
          protein: 30,
          carbs: 0,
          fat: 3,
        })
      ).rejects.toThrow('Insert constraint error');
    });

    it('updateDietLog updates specified fields in diet_logs', async () => {
      const updateBuilder = createQueryBuilder({ data: null, error: null });
      const mockClient: any = { from: jest.fn(() => updateBuilder) };

      const repo = new SupabaseDietRepository(mockClient);
      await repo.updateDietLog('log-1', {
        servingGrams: 200,
        calories: 320,
        protein: 24,
      });

      expect(updateBuilder.update).toHaveBeenCalledWith({
        serving_grams: 200,
        calories: 320,
        protein: 24,
      });
      expect(updateBuilder.eq).toHaveBeenCalledWith('id', 'log-1');
    });

    it('updateDietLog does nothing when update payload is empty', async () => {
      const updateBuilder = createQueryBuilder({ data: null, error: null });
      const mockClient: any = { from: jest.fn(() => updateBuilder) };

      const repo = new SupabaseDietRepository(mockClient);
      await repo.updateDietLog('log-1', {});

      expect(updateBuilder.update).not.toHaveBeenCalled();
    });

    it('deleteDietLog deletes entry by ID', async () => {
      const deleteBuilder = createQueryBuilder({ data: null, error: null });
      const mockClient: any = { from: jest.fn(() => deleteBuilder) };

      const repo = new SupabaseDietRepository(mockClient);
      await repo.deleteDietLog('log-1');

      expect(mockClient.from).toHaveBeenCalledWith('diet_logs');
      expect(deleteBuilder.delete).toHaveBeenCalled();
      expect(deleteBuilder.eq).toHaveBeenCalledWith('id', 'log-1');
    });

    it('searchFoods merges remote custom foods with local TACO items and deduplicates by ID', async () => {
      const remoteFood = {
        id: 'dup-1',
        name: 'Arroz Branco Remoto',
        name_normalized: 'arroz branco remoto',
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
        created_at: '2026-11-13T18:00:00Z',
      };

      const builder = createQueryBuilder({ data: [remoteFood], error: null });
      const mockClient: any = { from: jest.fn(() => builder) };

      const mockLocalDb: any = {
        getAllAsync: jest.fn(async () => [
          {
            id: 'dup-1', // duplicate id with remote
            name: 'Arroz Branco Local TACO',
            name_normalized: 'arroz branco local taco',
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
            created_at: '2026-11-13T18:00:00Z',
          },
          {
            id: 'unique-2',
            name: 'Feijao Carioca',
            name_normalized: 'feijao carioca',
            category: 'Leguminosas',
            serving_grams: 100,
            calories: 76,
            protein: 4.8,
            carbs: 13.6,
            fat: 0.5,
            fiber: 8.5,
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
      const results = await repo.searchFoods('arroz', 10);

      // Should deduplicate dup-1 (prefer remote first) and include unique-2
      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('dup-1');
      expect(results[0].name).toBe('Arroz Branco Remoto');
      expect(results[1].id).toBe('unique-2');
    });

    it('searchFoods respects limit parameter across merged sources', async () => {
      const remoteFood = {
        id: 'remote-1',
        name: 'Whey',
        name_normalized: 'whey',
        category: 'Suplementos',
        serving_grams: 30,
        calories: 120,
        protein: 24,
        carbs: 2,
        fat: 1,
        source: 'custom',
        created_at: '2026-11-13T18:00:00Z',
      };

      const builder = createQueryBuilder({ data: [remoteFood], error: null });
      const mockClient: any = { from: jest.fn(() => builder) };
      const mockLocalDb: any = {
        getAllAsync: jest.fn(async () => [
          {
            id: 'local-2',
            name: 'Creatina',
            name_normalized: 'creatina',
            category: 'Suplementos',
            serving_grams: 5,
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0,
            source: 'taco',
            created_at: '2026-11-13T18:00:00Z',
          },
        ]),
      };

      const repo = new SupabaseDietRepository(mockClient, mockLocalDb);
      const results = await repo.searchFoods('suplemento', 1);

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('remote-1');
    });

    it('searchFoods returns local TACO items when remote query returns an error (offline fallback)', async () => {
      const errorBuilder = createQueryBuilder({ data: null, error: { message: 'Network request failed' } });
      const mockClient: any = { from: jest.fn(() => errorBuilder) };

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
      const results = await repo.searchFoods('arroz', 20);

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('taco-1');
    });

    it('searchFoods returns empty array when remote query fails and local database has no matches without throwing', async () => {
      const errorBuilder = createQueryBuilder({ data: null, error: { message: 'Connection timeout' } });
      const mockClient: any = { from: jest.fn(() => errorBuilder) };

      const mockLocalDb: any = {
        getAllAsync: jest.fn(async () => []),
        getFirstAsync: jest.fn(),
        runAsync: jest.fn(),
        execAsync: jest.fn(),
        withTransactionAsync: jest.fn(),
      };

      const repo = new SupabaseDietRepository(mockClient, mockLocalDb);
      await expect(repo.searchFoods('inexistente', 20)).resolves.toEqual([]);
    });

    it('searchFoods returns local TACO items when remote query rejects with an offline exception', async () => {
      const mockClient: any = {
        from: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          or: jest.fn().mockReturnThis(),
          returns: jest.fn().mockRejectedValue(new Error('Device offline')),
        })),
      };

      const mockLocalDb: any = {
        getAllAsync: jest.fn(async () => [
          {
            id: 'taco-1',
            name: 'Feijao preto',
            name_normalized: 'feijao preto',
            category: 'Leguminosas',
            serving_grams: 100,
            calories: 77,
            protein: 4.5,
            carbs: 14.0,
            fat: 0.5,
            fiber: 8.4,
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
      const results = await repo.searchFoods('feijao', 20);

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('taco-1');
    });

    it('getFoodByBarcode queries remote custom foods first and returns if found', async () => {
      const remoteFood = {
        id: 'barcode-1',
        name: 'Barra de Proteina',
        name_normalized: 'barra de proteina',
        category: 'Snacks',
        serving_grams: 40,
        calories: 150,
        protein: 15,
        carbs: 10,
        fat: 5,
        barcode: '7891234567890',
        source: 'custom',
        created_at: '2026-11-13T18:00:00Z',
      };

      const builder = createQueryBuilder({ data: remoteFood, error: null });
      const mockClient: any = { from: jest.fn(() => builder) };
      const mockLocalDb: any = { getFirstAsync: jest.fn() };

      const repo = new SupabaseDietRepository(mockClient, mockLocalDb);
      const result = await repo.getFoodByBarcode('7891234567890');

      expect(result?.id).toBe('barcode-1');
      expect(result?.name).toBe('Barra de Proteina');
      expect(mockLocalDb.getFirstAsync).not.toHaveBeenCalled();
    });

    it('getFoodByBarcode falls back to local TACO foods when remote food is not found', async () => {
      const notFoundBuilder = createQueryBuilder({ data: null, error: null });
      const mockClient: any = { from: jest.fn(() => notFoundBuilder) };

      const mockLocalDb: any = {
        getFirstAsync: jest.fn(async () => ({
          id: 'taco-barcode-1',
          name: 'Iogurte Natural',
          name_normalized: 'iogurte natural',
          category: 'Laticinios',
          serving_grams: 170,
          calories: 120,
          protein: 8,
          carbs: 12,
          fat: 4,
          barcode: '7899999999999',
          source: 'taco',
          created_at: '2026-11-13T18:00:00Z',
        })),
      };

      const repo = new SupabaseDietRepository(mockClient, mockLocalDb);
      const result = await repo.getFoodByBarcode('7899999999999');

      expect(result?.id).toBe('taco-barcode-1');
      expect(result?.name).toBe('Iogurte Natural');
      expect(mockLocalDb.getFirstAsync).toHaveBeenCalled();
    });

    it('getFoodByBarcode returns null when food is not found in either source', async () => {
      const notFoundBuilder = createQueryBuilder({ data: null, error: null });
      const mockClient: any = { from: jest.fn(() => notFoundBuilder) };
      const mockLocalDb: any = { getFirstAsync: jest.fn(async () => null) };

      const repo = new SupabaseDietRepository(mockClient, mockLocalDb);
      const result = await repo.getFoodByBarcode('0000000000000');

      expect(result).toBeNull();
    });

    it('getWaterLogs retrieves and maps water logs for date', async () => {
      const waterRows = [
        { id: 'w1', date: '2026-11-13', amount_ml: 500, created_at: '2026-11-13T09:00:00Z' },
        { id: 'w2', date: '2026-11-13', amount_ml: 300, created_at: '2026-11-13T11:00:00Z' },
      ];
      const builder = createQueryBuilder({ data: waterRows, error: null });
      const mockClient: any = { from: jest.fn(() => builder) };

      const repo = new SupabaseDietRepository(mockClient);
      const logs = await repo.getWaterLogs('2026-11-13');

      expect(logs).toHaveLength(2);
      expect(logs[0].amountMl).toBe(500);
      expect(logs[1].amountMl).toBe(300);
    });

    it('addWaterLog inserts and returns mapped entry', async () => {
      const newWaterRow = {
        id: 'w3',
        date: '2026-11-13',
        amount_ml: 250,
        created_at: '2026-11-13T14:00:00Z',
      };
      const builder = createQueryBuilder({ data: newWaterRow, error: null });
      const mockClient: any = { from: jest.fn(() => builder) };

      const repo = new SupabaseDietRepository(mockClient);
      const result = await repo.addWaterLog('2026-11-13', 250);

      expect(result.id).toBe('w3');
      expect(result.amountMl).toBe(250);
      expect(builder.insert).toHaveBeenCalledWith({ date: '2026-11-13', amount_ml: 250 });
    });

    it('resetWaterLogs deletes all water logs for a given date', async () => {
      const deleteBuilder = createQueryBuilder({ data: null, error: null });
      const mockClient: any = { from: jest.fn(() => deleteBuilder) };

      const repo = new SupabaseDietRepository(mockClient);
      await repo.resetWaterLogs('2026-11-13');

      expect(mockClient.from).toHaveBeenCalledWith('water_logs');
      expect(deleteBuilder.delete).toHaveBeenCalled();
      expect(deleteBuilder.eq).toHaveBeenCalledWith('date', '2026-11-13');
    });

    it('decrementWaterLog subtracts amount or returns null when water total is 0', async () => {
      const selectBuilder = createQueryBuilder({
        data: [{ id: 'w1', date: '2026-11-13', amount_ml: 500, created_at: '...' }],
        error: null,
      });
      const insertBuilder = createQueryBuilder({
        data: { id: 'w2', date: '2026-11-13', amount_ml: -250, created_at: '...' },
        error: null,
      });

      let callCount = 0;
      const mockClient: any = {
        from: jest.fn(() => {
          callCount += 1;
          return callCount === 1 ? selectBuilder : insertBuilder;
        }),
      };

      const repo = new SupabaseDietRepository(mockClient);
      const result = await repo.decrementWaterLog('2026-11-13', 250);

      expect(result?.amountMl).toBe(-250);

      // Now test with 0 water
      const zeroBuilder = createQueryBuilder({ data: [], error: null });
      const mockClientZero: any = { from: jest.fn(() => zeroBuilder) };
      const repoZero = new SupabaseDietRepository(mockClientZero);
      const zeroResult = await repoZero.decrementWaterLog('2026-11-13', 250);

      expect(zeroResult).toBeNull();
    });

    it('getDailyNutritionSummary computes totals and categorizes meals by type', async () => {
      const dietLogs = [
        {
          id: 'd1',
          date: '2026-11-13',
          meal_type: 'breakfast',
          food_id: 'f1',
          food_name: 'Pão com Ovo',
          serving_grams: 100,
          calories: 300,
          protein: 15,
          carbs: 30,
          fat: 12,
          created_at: '2026-11-13T08:00:00Z',
        },
        {
          id: 'd2',
          date: '2026-11-13',
          meal_type: 'lunch',
          food_id: 'f2',
          food_name: 'Arroz e Frango',
          serving_grams: 300,
          calories: 500,
          protein: 40,
          carbs: 60,
          fat: 10,
          created_at: '2026-11-13T12:30:00Z',
        },
      ];

      const waterLogs = [
        { id: 'w1', date: '2026-11-13', amount_ml: 1200, created_at: '2026-11-13T10:00:00Z' },
      ];

      const dietBuilder = createQueryBuilder({ data: dietLogs, error: null });
      const waterBuilder = createQueryBuilder({ data: waterLogs, error: null });

      const mockClient: any = {
        from: jest.fn((table: string) => {
          if (table === 'diet_logs') return dietBuilder;
          if (table === 'water_logs') return waterBuilder;
          return createQueryBuilder();
        }),
      };

      const repo = new SupabaseDietRepository(mockClient);
      const summary = await repo.getDailyNutritionSummary('2026-11-13');

      expect(summary.totalCalories).toBe(800);
      expect(summary.totalProtein).toBe(55);
      expect(summary.totalCarbs).toBe(90);
      expect(summary.totalFat).toBe(22);
      expect(summary.totalWaterMl).toBe(1200);
      expect(summary.meals.breakfast).toHaveLength(1);
      expect(summary.meals.lunch).toHaveLength(1);
      expect(summary.meals.dinner).toEqual([]);
    });

    it('deleteWaterLog deletes water log by id', async () => {
      const deleteBuilder = createQueryBuilder({ data: null, error: null });
      const mockClient: any = { from: jest.fn(() => deleteBuilder) };

      const repo = new SupabaseDietRepository(mockClient);
      await repo.deleteWaterLog('w-to-delete');

      expect(mockClient.from).toHaveBeenCalledWith('water_logs');
      expect(deleteBuilder.delete).toHaveBeenCalled();
      expect(deleteBuilder.eq).toHaveBeenCalledWith('id', 'w-to-delete');
    });

    it('createFood inserts food with normalized name and returns mapped item', async () => {
      const foodRow = {
        id: 'new-food-1',
        name: 'Whey Protein Isolado',
        name_normalized: 'whey protein isolado',
        category: 'Suplementos',
        serving_grams: 30,
        calories: 110,
        protein: 27,
        carbs: 0.5,
        fat: 0.5,
        fiber: 0,
        barcode: '1234567890123',
        source: 'custom',
        serving_unit_name: 'scoop',
        serving_unit_grams: 30,
        created_at: '2026-11-13T18:00:00Z',
      };

      const insertBuilder = createQueryBuilder({ data: foodRow, error: null });
      const mockClient: any = { from: jest.fn(() => insertBuilder) };

      const repo = new SupabaseDietRepository(mockClient);
      const result = await repo.createFood({
        name: 'Whey Protein Isolado',
        category: 'Suplementos',
        servingGrams: 30,
        calories: 110,
        protein: 27,
        carbs: 0.5,
        fat: 0.5,
        source: 'custom',
        barcode: '1234567890123',
        servingUnitName: 'scoop',
        servingUnitGrams: 30,
      });

      expect(result.id).toBe('new-food-1');
      expect(result.name).toBe('Whey Protein Isolado');
      expect(insertBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Whey Protein Isolado',
          name_normalized: 'whey protein isolado',
        })
      );
    });
  });

  describe('SupabaseWorkoutRepository', () => {
    it('getRoutines returns an empty array [] for new users without any auto-seeding', async () => {
      const routinesBuilder = createQueryBuilder({ data: [], error: null });
      const exercisesBuilder = createQueryBuilder({ data: [], error: null });

      const mockClient: any = {
        from: jest.fn((table: string) => {
          if (table === 'workout_routines') return routinesBuilder;
          if (table === 'routine_exercises') return exercisesBuilder;
          return createQueryBuilder();
        }),
      };

      const repo = new SupabaseWorkoutRepository(mockClient);
      const routines = await repo.getRoutines();

      expect(routines).toEqual([]);
      expect(routinesBuilder.insert).not.toHaveBeenCalled();
      expect(exercisesBuilder.insert).not.toHaveBeenCalled();
    });

    it('getRoutines maps routines and nests associated routine_exercises correctly', async () => {
      const routineRows = [
        { id: 'r1', name: 'Treino A - Peito', description: 'Foco superior', sort_order: 1, created_at: '2026-11-13T10:00:00Z' },
      ];
      const exerciseRows = [
        {
          id: 're1',
          routine_id: 'r1',
          name: 'Supino Inclinado com Halteres',
          muscle_group: 'Peito',
          target_sets: 4,
          default_rest_seconds: 90,
          sort_order: 1,
          created_at: '2026-11-13T10:00:00Z',
        },
      ];

      const routinesBuilder = createQueryBuilder({ data: routineRows, error: null });
      const exercisesBuilder = createQueryBuilder({ data: exerciseRows, error: null });

      const mockClient: any = {
        from: jest.fn((table: string) => {
          if (table === 'workout_routines') return routinesBuilder;
          if (table === 'routine_exercises') return exercisesBuilder;
          return createQueryBuilder();
        }),
      };

      const repo = new SupabaseWorkoutRepository(mockClient);
      const routines = await repo.getRoutines();

      expect(routines).toHaveLength(1);
      expect(routines[0].id).toBe('r1');
      expect(routines[0].exercises).toHaveLength(1);
      expect(routines[0].exercises?.[0]?.name).toBe('Supino Inclinado com Halteres');
      expect(routines[0].exercises?.[0]?.targetSets).toBe(4);
    });

    it('getRoutineById returns routine with exercises or null if not found', async () => {
      const routinesBuilder = createQueryBuilder({ data: null, error: null });
      const exercisesBuilder = createQueryBuilder({ data: [], error: null });

      const mockClient: any = {
        from: jest.fn((table: string) => {
          if (table === 'workout_routines') return routinesBuilder;
          return exercisesBuilder;
        }),
      };

      const repo = new SupabaseWorkoutRepository(mockClient);
      const notFound = await repo.getRoutineById('missing-routine');
      expect(notFound).toBeNull();
    });

    it('createRoutine inserts routine and associated routine_exercises', async () => {
      const createdRoutineRow = {
        id: 'r-new',
        name: 'Treino B - Costas',
        description: 'Foco puxadas',
        sort_order: 2,
        created_at: '2026-11-13T12:00:00Z',
      };
      const createdExerciseRows = [
        {
          id: 're-new',
          routine_id: 'r-new',
          name: 'Puxada Frontal',
          muscle_group: 'Costas',
          target_sets: 4,
          default_rest_seconds: 75,
          sort_order: 1,
          created_at: '2026-11-13T12:00:00Z',
        },
      ];

      const routineBuilder = createQueryBuilder({ data: createdRoutineRow, error: null });
      const exerciseBuilder = createQueryBuilder({ data: createdExerciseRows, error: null });

      const mockClient: any = {
        from: jest.fn((table: string) => {
          if (table === 'workout_routines') return routineBuilder;
          if (table === 'routine_exercises') return exerciseBuilder;
          return createQueryBuilder();
        }),
      };

      const repo = new SupabaseWorkoutRepository(mockClient);
      const created = await repo.createRoutine(
        { name: 'Treino B - Costas', description: 'Foco puxadas', sortOrder: 2 },
        [
          {
            name: 'Puxada Frontal',
            muscleGroup: 'Costas',
            targetSets: 4,
            defaultRestSeconds: 75,
            sortOrder: 1,
          },
        ]
      );

      expect(created.id).toBe('r-new');
      expect(created.name).toBe('Treino B - Costas');
      expect(created.exercises).toHaveLength(1);
      expect(created.exercises?.[0]?.name).toBe('Puxada Frontal');

      expect(routineBuilder.insert).toHaveBeenCalledWith({
        name: 'Treino B - Costas',
        description: 'Foco puxadas',
        sort_order: 2,
      });
      expect(exerciseBuilder.insert).toHaveBeenCalledWith([
        {
          routine_id: 'r-new',
          name: 'Puxada Frontal',
          muscle_group: 'Costas',
          target_sets: 4,
          default_rest_seconds: 75,
          sort_order: 1,
        },
      ]);
    });

    it('updateRoutine updates routine fields and replaces exercises', async () => {
      const routineBuilder = createQueryBuilder({ data: null, error: null });
      const exerciseDeleteBuilder = createQueryBuilder({ data: null, error: null });
      const exerciseInsertBuilder = createQueryBuilder({ data: null, error: null });

      let exerciseCall = 0;
      const mockClient: any = {
        from: jest.fn((table: string) => {
          if (table === 'workout_routines') return routineBuilder;
          if (table === 'routine_exercises') {
            exerciseCall += 1;
            return exerciseCall === 1 ? exerciseDeleteBuilder : exerciseInsertBuilder;
          }
          return createQueryBuilder();
        }),
      };

      const repo = new SupabaseWorkoutRepository(mockClient);
      await repo.updateRoutine(
        'r1',
        { name: 'Treino A Atualizado' },
        [
          {
            id: 'ex1',
            routineId: 'r1',
            name: 'Supino Reto',
            targetSets: 4,
            defaultRestSeconds: 90,
            sortOrder: 1,
          },
        ]
      );

      expect(routineBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Treino A Atualizado' })
      );
      expect(exerciseDeleteBuilder.delete).toHaveBeenCalled();
      expect(exerciseDeleteBuilder.eq).toHaveBeenCalledWith('routine_id', 'r1');
      expect(exerciseInsertBuilder.insert).toHaveBeenCalled();
    });

    it('deleteRoutine deletes the routine', async () => {
      const deleteBuilder = createQueryBuilder({ data: null, error: null });
      const mockClient: any = { from: jest.fn(() => deleteBuilder) };

      const repo = new SupabaseWorkoutRepository(mockClient);
      await repo.deleteRoutine('r1');

      expect(mockClient.from).toHaveBeenCalledWith('workout_routines');
      expect(deleteBuilder.delete).toHaveBeenCalled();
      expect(deleteBuilder.eq).toHaveBeenCalledWith('id', 'r1');
    });

    it('saveWorkoutSession persists session header and child set_logs with volume calculation', async () => {
      const createdSessionRow = {
        id: 'session-100',
        routine_id: 'r1',
        routine_name: 'Treino Peito',
        date: '2026-11-13',
        start_time: '18:00',
        end_time: '19:00',
        duration_minutes: 60,
        total_volume_kg: 2400,
        notes: 'Ótimo treino',
        created_at: '2026-11-13T19:00:00Z',
      };

      const createdSetRows = [
        {
          id: 'set-1',
          session_id: 'session-100',
          exercise_id: 'e1',
          exercise_name: 'Supino',
          set_number: 1,
          weight_kg: 80,
          reps: 10,
          completed: true,
          created_at: '2026-11-13T18:15:00Z',
        },
        {
          id: 'set-2',
          session_id: 'session-100',
          exercise_id: 'e1',
          exercise_name: 'Supino',
          set_number: 2,
          weight_kg: 80,
          reps: 10,
          completed: false, // uncompleted sets not counted towards calculated volume
          created_at: '2026-11-13T18:20:00Z',
        },
      ];

      const sessionBuilder = createQueryBuilder({ data: createdSessionRow, error: null });
      const setBuilder = createQueryBuilder({ data: createdSetRows, error: null });

      const mockClient: any = {
        from: jest.fn((table: string) => {
          if (table === 'workout_sessions') return sessionBuilder;
          if (table === 'set_logs') return setBuilder;
          return createQueryBuilder();
        }),
      };

      const repo = new SupabaseWorkoutRepository(mockClient);
      const session = await repo.saveWorkoutSession({
        routineId: 'r1',
        routineName: 'Treino Peito',
        date: '2026-11-13',
        durationMinutes: 60,
        sets: [
          { exerciseName: 'Supino', exerciseId: 'e1', setNumber: 1, weightKg: 80, reps: 10, completed: true },
          { exerciseName: 'Supino', exerciseId: 'e1', setNumber: 2, weightKg: 80, reps: 10, completed: false },
        ],
      });

      expect(session.id).toBe('session-100');
      expect(session.sets).toHaveLength(2);
      expect(sessionBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          routine_name: 'Treino Peito',
          total_volume_kg: 800, // calculated from completed set 1 (80 * 10)
        })
      );
      expect(setBuilder.insert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ session_id: 'session-100', set_number: 1 }),
        ])
      );
    });

    it('getWorkoutSessions retrieves sessions with pagination and maps sets', async () => {
      const sessionRows = [
        {
          id: 'sess-1',
          routine_id: 'r1',
          routine_name: 'Treino A',
          date: '2026-11-13',
          start_time: '18:00',
          end_time: '18:50',
          duration_minutes: 50,
          total_volume_kg: 1500,
          notes: null,
          created_at: '2026-11-13T18:50:00Z',
        },
      ];
      const setRows = [
        {
          id: 'set-1',
          session_id: 'sess-1',
          exercise_id: null,
          exercise_name: 'Agachamento',
          set_number: 1,
          weight_kg: 100,
          reps: 10,
          completed: true,
          created_at: '2026-11-13T18:20:00Z',
        },
      ];

      const sessionsBuilder = createQueryBuilder({ data: sessionRows, error: null });
      const setsBuilder = createQueryBuilder({ data: setRows, error: null });

      const mockClient: any = {
        from: jest.fn((table: string) => {
          if (table === 'workout_sessions') return sessionsBuilder;
          if (table === 'set_logs') return setsBuilder;
          return createQueryBuilder();
        }),
      };

      const repo = new SupabaseWorkoutRepository(mockClient);
      const results = await repo.getWorkoutSessions(10, 0);

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('sess-1');
      expect(results[0].sets).toHaveLength(1);
      expect(results[0].sets?.[0]?.exerciseName).toBe('Agachamento');
      expect(sessionsBuilder.range).toHaveBeenCalledWith(0, 9);
      expect(setsBuilder.in).toHaveBeenCalledWith('session_id', ['sess-1']);
    });

    it('getWorkoutSessions returns empty array when no sessions exist without querying sets', async () => {
      const sessionsBuilder = createQueryBuilder({ data: [], error: null });
      const setsBuilder = createQueryBuilder({ data: [], error: null });

      const mockClient: any = {
        from: jest.fn((table: string) => {
          if (table === 'workout_sessions') return sessionsBuilder;
          return setsBuilder;
        }),
      };

      const repo = new SupabaseWorkoutRepository(mockClient);
      const results = await repo.getWorkoutSessions(10, 0);

      expect(results).toEqual([]);
      expect(setsBuilder.in).not.toHaveBeenCalled();
    });

    it('getExerciseHistory computes Brzycki 1RM with reps clamped between 1 and 30', async () => {
      const joinedRows = [
        {
          session_id: 's1',
          weight_kg: 100,
          reps: 1, // reps === 1 -> 1RM equals weight_kg exactly
          workout_sessions: { date: '2026-11-01' },
        },
        {
          session_id: 's2',
          weight_kg: 100,
          reps: 5, // 100 * (36 / (37 - 5)) = 112.5
          workout_sessions: { date: '2026-11-05' },
        },
        {
          session_id: 's3',
          weight_kg: 70,
          reps: 45, // clamped to 30 -> 70 * (36 / (37 - 30)) = 360
          workout_sessions: { date: '2026-11-10' },
        },
      ];

      const builder = createQueryBuilder({ data: joinedRows, error: null });
      const mockClient: any = { from: jest.fn(() => builder) };

      const repo = new SupabaseWorkoutRepository(mockClient);
      const history = await repo.getExerciseHistory('Supino');

      expect(history).toHaveLength(3);
      expect(history[0].date).toBe('2026-11-01');
      expect(history[0].estimated1RM).toBe(100);

      expect(history[1].date).toBe('2026-11-05');
      expect(history[1].estimated1RM).toBe(112.5);

      expect(history[2].date).toBe('2026-11-10');
      expect(history[2].estimated1RM).toBe(360);
    });

    it('getCustomExercises and createCustomExercise manage custom exercises', async () => {
      const customRows = [
        {
          id: 'ce-1',
          name: 'Elevação Lateral na Polia',
          category: 'Ombros',
          default_sets: 4,
          default_rest_seconds: 60,
          created_at: '2026-11-13T10:00:00Z',
        },
      ];
      const selectBuilder = createQueryBuilder({ data: customRows, error: null });
      const insertBuilder = createQueryBuilder({ data: customRows[0], error: null });

      let fromCount = 0;
      const mockClient: any = {
        from: jest.fn(() => {
          fromCount += 1;
          return fromCount === 1 ? selectBuilder : insertBuilder;
        }),
      };

      const repo = new SupabaseWorkoutRepository(mockClient);
      const list = await repo.getCustomExercises();
      expect(list).toHaveLength(1);
      expect(list[0].name).toBe('Elevação Lateral na Polia');

      const created = await repo.createCustomExercise({
        name: 'Elevação Lateral na Polia',
        category: 'Ombros',
        defaultSets: 4,
        defaultRestSeconds: 60,
      });

      expect(created.id).toBe('ce-1');
      expect(insertBuilder.insert).toHaveBeenCalledWith({
        name: 'Elevação Lateral na Polia',
        category: 'Ombros',
        default_sets: 4,
        default_rest_seconds: 60,
      });
    });

    it('getSessionDetails returns session with sets or null if not found', async () => {
      const sessionRow = {
        id: 'sess-detail',
        routine_id: 'r1',
        routine_name: 'Treino A',
        date: '2026-11-13',
        start_time: '14:00',
        end_time: '15:00',
        duration_minutes: 60,
        total_volume_kg: 1200,
        notes: null,
        created_at: '2026-11-13T15:00:00Z',
      };
      const setRow = {
        id: 'set-d1',
        session_id: 'sess-detail',
        exercise_id: null,
        exercise_name: 'Leg Press',
        set_number: 1,
        weight_kg: 200,
        reps: 6,
        completed: true,
        created_at: '2026-11-13T14:30:00Z',
      };

      const sessionBuilder = createQueryBuilder({ data: sessionRow, error: null });
      const setBuilder = createQueryBuilder({ data: [setRow], error: null });

      const mockClient: any = {
        from: jest.fn((table: string) => {
          if (table === 'workout_sessions') return sessionBuilder;
          return setBuilder;
        }),
      };

      const repo = new SupabaseWorkoutRepository(mockClient);
      const detail = await repo.getSessionDetails('sess-detail');

      expect(detail?.id).toBe('sess-detail');
      expect(detail?.sets).toHaveLength(1);
      expect(detail?.sets?.[0]?.exerciseName).toBe('Leg Press');

      const notFoundBuilder = createQueryBuilder({ data: null, error: null });
      const mockClientNotFound: any = {
        from: jest.fn((table: string) => {
          if (table === 'workout_sessions') return notFoundBuilder;
          return setBuilder;
        }),
      };
      const repoNotFound = new SupabaseWorkoutRepository(mockClientNotFound);
      expect(await repoNotFound.getSessionDetails('missing')).toBeNull();
    });

    it('getPreviousExerciseSets retrieves latest completed sets or empty array', async () => {
      const latestSessionBuilder = createQueryBuilder({
        data: [{ session_id: 'sess-latest' }],
        error: null,
      });
      const setsBuilder = createQueryBuilder({
        data: [
          {
            id: 'set-prev-1',
            session_id: 'sess-latest',
            exercise_id: null,
            exercise_name: 'Supino',
            set_number: 1,
            weight_kg: 90,
            reps: 8,
            completed: true,
            created_at: '2026-11-10T10:00:00Z',
          },
        ],
        error: null,
      });

      let callCount = 0;
      const mockClient: any = {
        from: jest.fn(() => {
          callCount += 1;
          return callCount === 1 ? latestSessionBuilder : setsBuilder;
        }),
      };

      const repo = new SupabaseWorkoutRepository(mockClient);
      const prevSets = await repo.getPreviousExerciseSets('Supino', 5);

      expect(prevSets).toHaveLength(1);
      expect(prevSets[0].weightKg).toBe(90);
      expect(prevSets[0].reps).toBe(8);

      // When no previous session exists
      const emptyLatestBuilder = createQueryBuilder({ data: [], error: null });
      const mockClientEmpty: any = { from: jest.fn(() => emptyLatestBuilder) };
      const repoEmpty = new SupabaseWorkoutRepository(mockClientEmpty);
      const emptyResult = await repoEmpty.getPreviousExerciseSets('Inexistente');
      expect(emptyResult).toEqual([]);
    });
  });

  describe('SupabaseBodyRepository', () => {
    const sampleBodyLogRow = {
      id: 'body-1',
      date: '2026-11-13',
      weight_kg: 78.5,
      body_fat_pct: 14.5,
      waist_cm: 82,
      chest_cm: 104,
      arms_cm: 39,
      legs_cm: 58,
      photo_uris: ['user-1/2026-11-13_front.jpg'],
      created_at: '2026-11-13T09:00:00Z',
    };

    it('getBodyLog retrieves and maps body log with resolved photo signed URLs', async () => {
      const selectBuilder = createQueryBuilder({ data: sampleBodyLogRow, error: null });
      const mockStorage = createMockStorage();
      const mockClient: any = {
        from: jest.fn(() => selectBuilder),
        storage: mockStorage,
      };

      const repo = new SupabaseBodyRepository(mockClient);
      const result = await repo.getBodyLog('2026-11-13');

      expect(result?.id).toBe('body-1');
      expect(result?.weightKg).toBe(78.5);
      expect(result?.bodyFatPct).toBe(14.5);
      expect(result?.photoUris?.[0]).toContain('https://mock.storage.supabase.co/body-photos/');
      expect(selectBuilder.eq).toHaveBeenCalledWith('date', '2026-11-13');
    });

    it('getBodyLog returns null when no body log exists for date', async () => {
      const selectBuilder = createQueryBuilder({ data: null, error: null });
      const mockClient: any = {
        from: jest.fn(() => selectBuilder),
        storage: createMockStorage(),
      };

      const repo = new SupabaseBodyRepository(mockClient);
      const result = await repo.getBodyLog('2026-11-10');

      expect(result).toBeNull();
    });

    it('saveBodyLog throws error when user is unauthenticated', async () => {
      const mockClient: any = {
        auth: { getSession: jest.fn(async () => ({ data: { session: null }, error: null })) },
      };

      const repo = new SupabaseBodyRepository(mockClient);
      await expect(
        repo.saveBodyLog({
          date: '2026-11-13',
          weightKg: 80,
          photoUris: [],
        })
      ).rejects.toThrow('Usuário não autenticado.');
    });

    it('saveBodyLog upserts body log on conflict (user_id, date)', async () => {
      const upsertBuilder = createQueryBuilder({ data: sampleBodyLogRow, error: null });
      const mockStorage = createMockStorage();
      const mockClient: any = {
        auth: {
          getSession: jest.fn(async () => ({
            data: { session: { user: { id: 'user-1' } } },
            error: null,
          })),
        },
        from: jest.fn(() => upsertBuilder),
        storage: mockStorage,
      };

      const repo = new SupabaseBodyRepository(mockClient);
      const result = await repo.saveBodyLog({
        date: '2026-11-13',
        weightKg: 78.5,
        bodyFatPct: 14.5,
        waistCm: 82,
        photoUris: ['user-1/2026-11-13_front.jpg'],
      });

      expect(result.id).toBe('body-1');
      expect(upsertBuilder.upsert).toHaveBeenCalledWith(
        {
          user_id: 'user-1',
          date: '2026-11-13',
          weight_kg: 78.5,
          body_fat_pct: 14.5,
          waist_cm: 82,
          chest_cm: null,
          arms_cm: null,
          legs_cm: null,
          photo_uris: ['user-1/2026-11-13_front.jpg'],
        },
        { onConflict: 'user_id,date' }
      );
    });

    it('calculateMovingAverage calculates 7-day moving average correctly', async () => {
      const logs = [
        { weight_kg: 80.0 },
        { weight_kg: 80.5 },
        { weight_kg: 81.0 },
        { weight_kg: 80.2 },
        { weight_kg: 79.8 },
        { weight_kg: 80.4 },
        { weight_kg: 80.1 },
      ];
      // Sum = 562.0 / 7 = 80.2857 -> 80.29
      const builder = createQueryBuilder({ data: logs, error: null });
      const mockClient: any = { from: jest.fn(() => builder) };

      const repo = new SupabaseBodyRepository(mockClient);
      const avg = await repo.calculateMovingAverage('2026-11-13', 7);

      expect(avg).toBe(80.29);
      expect(builder.gt).toHaveBeenCalledWith('weight_kg', 0);
      expect(builder.gte).toHaveBeenCalledWith('date', '2026-11-07');
      expect(builder.lte).toHaveBeenCalledWith('date', '2026-11-13');
    });

    it('calculateMovingAverage handles cases with fewer than 7 days correctly', async () => {
      const logs = [
        { weight_kg: 75.0 },
        { weight_kg: 76.5 },
        { weight_kg: 75.6 },
      ];
      // Sum = 227.1 / 3 = 75.7
      const builder = createQueryBuilder({ data: logs, error: null });
      const mockClient: any = { from: jest.fn(() => builder) };

      const repo = new SupabaseBodyRepository(mockClient);
      const avg = await repo.calculateMovingAverage('2026-11-13', 7);

      expect(avg).toBe(75.7);
    });

    it('calculateMovingAverage returns null when no weigh-in logs exist', async () => {
      const builder = createQueryBuilder({ data: [], error: null });
      const mockClient: any = { from: jest.fn(() => builder) };

      const repo = new SupabaseBodyRepository(mockClient);
      const avg = await repo.calculateMovingAverage('2026-11-13', 7);

      expect(avg).toBeNull();
    });

    it('getWeightHistory filters logs within date range and computes moving average', async () => {
      const rows = [
        { date: '2026-11-01', weight_kg: 80.0 },
        { date: '2026-11-02', weight_kg: 82.0 },
        { date: '2026-11-15', weight_kg: 85.0 }, // gap > 6 days from previous point
      ];

      const builder = createQueryBuilder({ data: rows, error: null });
      const mockClient: any = { from: jest.fn(() => builder) };

      const repo = new SupabaseBodyRepository(mockClient);
      const history = await repo.getWeightHistory('2026-11-01', '2026-11-30');

      expect(history).toHaveLength(3);
      expect(history[0].date).toBe('2026-11-01');
      expect(history[0].movingAverage).toBe(80.0);

      expect(history[1].date).toBe('2026-11-02');
      expect(history[1].movingAverage).toBe(81.0); // (80 + 82) / 2

      expect(history[2].date).toBe('2026-11-15');
      expect(history[2].movingAverage).toBe(85.0); // outside window of prior days

      expect(builder.gte).toHaveBeenCalledWith('date', '2026-11-01');
      expect(builder.lte).toHaveBeenCalledWith('date', '2026-11-30');
    });

    it('savePhoto uploads photo to body-photos bucket and updates body_logs row', async () => {
      const existingRow = {
        id: 'body-row-1',
        weight_kg: 78.5,
        photo_uris: ['user-1/existing_front.jpg'],
      };

      const selectBuilder = createQueryBuilder({ data: existingRow, error: null });
      const updateBuilder = createQueryBuilder({ data: null, error: null });
      const mockStorage = createMockStorage();

      let fromCall = 0;
      const mockClient: any = {
        auth: {
          getSession: jest.fn(async () => ({
            data: { session: { user: { id: 'user-uuid-1' } } },
            error: null,
          })),
        },
        storage: mockStorage,
        from: jest.fn(() => {
          fromCall += 1;
          return fromCall === 1 ? selectBuilder : updateBuilder;
        }),
      };

      const repo = new SupabaseBodyRepository(mockClient);
      const result = await repo.savePhoto('2026-11-13', 'file:///data/user/0/cache/new_pose.jpg');

      expect(result).toHaveLength(2);
      expect(mockStorage._bucket.upload).toHaveBeenCalledWith(
        expect.stringMatching(/^user-uuid-1\/2026-11-13_\d+_new_pose\.jpg$/),
        expect.any(ArrayBuffer),
        { contentType: 'image/jpeg', upsert: true }
      );
      expect(updateBuilder.update).toHaveBeenCalledWith({
        photo_uris: expect.arrayContaining(['user-1/existing_front.jpg']),
      });
    });

    it('getPhotos batches photo paths and resolves signed URLs with 1-hour TTL', async () => {
      const rows = [
        { date: '2026-11-13', photo_uris: ['user-1/front.jpg', 'user-1/back.jpg'] },
        { date: '2026-11-12', photo_uris: ['user-1/side.jpg'] },
      ];

      const builder = createQueryBuilder({ data: rows, error: null });
      const mockStorage = createMockStorage();
      const mockClient: any = {
        from: jest.fn(() => builder),
        storage: mockStorage,
      };

      const repo = new SupabaseBodyRepository(mockClient);
      const photos = await repo.getPhotos();

      expect(photos).toHaveLength(3);
      expect(photos[0].date).toBe('2026-11-13');
      expect(photos[0].uri).toContain('https://mock.storage.supabase.co/body-photos/user-1/front.jpg');
      expect(mockStorage._bucket.createSignedUrls).toHaveBeenCalledWith(
        ['user-1/front.jpg', 'user-1/back.jpg', 'user-1/side.jpg'],
        3600
      );
    });

    it('deletePhoto removes photo path from body_logs and deletes photo object from body-photos bucket', async () => {
      const existingRow = {
        id: 'body-row-1',
        photo_uris: ['user-1/front.jpg', 'user-1/side.jpg'],
      };

      const selectBuilder = createQueryBuilder({ data: existingRow, error: null });
      const updateBuilder = createQueryBuilder({ data: null, error: null });
      const mockStorage = createMockStorage();

      let fromCall = 0;
      const mockClient: any = {
        storage: mockStorage,
        from: jest.fn(() => {
          fromCall += 1;
          return fromCall === 1 ? selectBuilder : updateBuilder;
        }),
      };

      const repo = new SupabaseBodyRepository(mockClient);
      const remaining = await repo.deletePhoto('2026-11-13', 'user-1/front.jpg');

      expect(remaining).toHaveLength(1);
      expect(updateBuilder.update).toHaveBeenCalledWith({
        photo_uris: ['user-1/side.jpg'],
      });
      expect(mockStorage._bucket.remove).toHaveBeenCalledWith(['user-1/front.jpg']);
    });

    it('deletePhoto does not call storage.remove for external http URLs', async () => {
      const existingRow = {
        id: 'body-row-1',
        photo_uris: ['https://example.com/external-photo.jpg', 'user-1/local.jpg'],
      };

      const selectBuilder = createQueryBuilder({ data: existingRow, error: null });
      const updateBuilder = createQueryBuilder({ data: null, error: null });
      const mockStorage = createMockStorage();

      let fromCall = 0;
      const mockClient: any = {
        storage: mockStorage,
        from: jest.fn(() => {
          fromCall += 1;
          return fromCall === 1 ? selectBuilder : updateBuilder;
        }),
      };

      const repo = new SupabaseBodyRepository(mockClient);
      const remaining = await repo.deletePhoto('2026-11-13', 'https://example.com/external-photo.jpg');

      expect(remaining).toHaveLength(1);
      expect(mockStorage._bucket.remove).not.toHaveBeenCalled();
    });

    it('deletePhoto returns empty array if body log does not exist for date', async () => {
      const selectBuilder = createQueryBuilder({ data: null, error: null });
      const mockClient: any = {
        storage: createMockStorage(),
        from: jest.fn(() => selectBuilder),
      };

      const repo = new SupabaseBodyRepository(mockClient);
      const result = await repo.deletePhoto('2026-11-10', 'user-1/front.jpg');

      expect(result).toEqual([]);
    });

    it('savePhoto creates new body log row when no log exists for date', async () => {
      const selectBuilder = createQueryBuilder({ data: null, error: null });
      const insertBuilder = createQueryBuilder({ data: null, error: null });
      const mockStorage = createMockStorage();

      let fromCall = 0;
      const mockClient: any = {
        auth: {
          getSession: jest.fn(async () => ({
            data: { session: { user: { id: 'user-uuid-1' } } },
            error: null,
          })),
        },
        storage: mockStorage,
        from: jest.fn(() => {
          fromCall += 1;
          return fromCall === 1 ? selectBuilder : insertBuilder;
        }),
      };

      const repo = new SupabaseBodyRepository(mockClient);
      const result = await repo.savePhoto('2026-11-13', 'file:///cache/first_photo.jpg');

      expect(result).toHaveLength(1);
      expect(insertBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-uuid-1',
          date: '2026-11-13',
          weight_kg: 0,
        })
      );
    });
  });

  describe('Context Hook Repository Delegation', () => {
    it('BodyStateManager delegates getBodyLog to bodyRepo.getBodyLog', async () => {
      const mockLog = {
        id: 'log-1',
        date: '2026-11-13',
        weightKg: 78.5,
        bodyFatPct: 15,
        photoUris: [],
        createdAt: '2026-11-13T18:00:00Z',
      };
      const mockRepo: any = {
        getBodyLog: jest.fn(async () => mockLog),
        calculateMovingAverage: jest.fn(async () => 78.5),
        getPhotos: jest.fn(async () => []),
        getWeightHistory: jest.fn(async () => []),
      };

      const manager = new BodyStateManager(mockRepo, '2026-11-13');
      const result = await manager.getBodyLog('2026-11-13');

      expect(mockRepo.getBodyLog).toHaveBeenCalledWith('2026-11-13');
      expect(result).toBe(mockLog);
    });

    it('DietStateManager delegates getFoodByBarcode to dietRepo.getFoodByBarcode', async () => {
      const mockFood = {
        id: 'food-1',
        name: 'Whey Protein',
        category: 'Suplemento',
        servingGrams: 30,
        calories: 120,
        protein: 24,
        carbs: 2,
        fat: 1,
        fiber: 0,
        barcode: '7891234567890',
        source: 'custom' as const,
        createdAt: '2026-11-13T18:00:00Z',
      };
      const mockDietRepo: any = {
        getFoodByBarcode: jest.fn(async () => mockFood),
      };
      const mockAuthRepo: any = {};

      const manager = new DietStateManager(mockDietRepo, mockAuthRepo);
      const result = await manager.getFoodByBarcode('7891234567890');

      expect(mockDietRepo.getFoodByBarcode).toHaveBeenCalledWith('7891234567890');
      expect(result).toBe(mockFood);
    });
  });
});
