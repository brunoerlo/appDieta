import { InMemorySQLiteDatabase, createTestDatabase } from '../helpers/inMemoryDb';
import { SqliteAuthRepository } from '@/database/repositories/SqliteAuthRepository';

describe('AuthRepository Unit Tests', () => {
  let db: InMemorySQLiteDatabase;
  let repo: SqliteAuthRepository;

  beforeEach(async () => {
    db = await createTestDatabase();
    repo = new SqliteAuthRepository(db);
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  it('initializes with default user profile and dark theme', async () => {
    const profile = await repo.getProfile();

    expect(profile).toBeDefined();
    expect(profile.name).toBe('Atleta');
    expect(profile.targetCalories).toBe(2000);
    expect(profile.targetProtein).toBe(150);
    expect(profile.targetCarbs).toBe(200);
    expect(profile.targetFat).toBe(60);
    expect(profile.targetWaterMl).toBe(2500);
    expect(profile.theme).toBe('dark');
  });

  it('updates profile calorie, macronutrient, and physical metrics goals', async () => {
    const updated = await repo.updateProfile({
      name: 'Bruno Iron',
      heightCm: 178,
      targetWeightKg: 82.5,
      trainingGoal: 'hypertrophy',
      activityLevel: 'moderate',
      targetCalories: 2600,
      targetProtein: 180,
      targetCarbs: 300,
      targetFat: 75,
      targetWaterMl: 3500,
    });

    expect(updated.name).toBe('Bruno Iron');
    expect(updated.heightCm).toBe(178);
    expect(updated.targetWeightKg).toBe(82.5);
    expect(updated.trainingGoal).toBe('hypertrophy');
    expect(updated.activityLevel).toBe('moderate');
    expect(updated.targetCalories).toBe(2600);
    expect(updated.targetProtein).toBe(180);
    expect(updated.targetCarbs).toBe(300);
    expect(updated.targetFat).toBe(75);
    expect(updated.targetWaterMl).toBe(3500);

    const reloaded = await repo.getProfile();
    expect(reloaded.name).toBe('Bruno Iron');
    expect(reloaded.heightCm).toBe(178);
    expect(reloaded.targetWeightKg).toBe(82.5);
    expect(reloaded.trainingGoal).toBe('hypertrophy');
    expect(reloaded.activityLevel).toBe('moderate');
    expect(reloaded.targetCalories).toBe(2600);
  });

  it('switches theme between dark and light mode', async () => {
    expect(await repo.getTheme()).toBe('dark');

    await repo.setTheme('light');
    expect(await repo.getTheme()).toBe('light');

    const profile = await repo.getProfile();
    expect(profile.theme).toBe('light');

    await repo.setTheme('dark');
    expect(await repo.getTheme()).toBe('dark');
  });

  describe('SQLite Migration V2 Verifications', () => {
    it('verifies users table contains all V2 columns', async () => {
      const userColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(users);');
      const columnNames = userColumns.map((c) => c.name);

      expect(columnNames).toContain('password');
      expect(columnNames).toContain('is_logged_in');
      expect(columnNames).toContain('onboarding_completed');
      expect(columnNames).toContain('height_cm');
      expect(columnNames).toContain('target_weight_kg');
      expect(columnNames).toContain('training_goal');
      expect(columnNames).toContain('activity_level');
    });

    it('verifies custom_exercises table and indexes exist in database', async () => {
      const tableCheck = await db.getFirstAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='custom_exercises';"
      );
      expect(tableCheck).not.toBeNull();

      const indexes = await db.getAllAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='custom_exercises';"
      );
      const indexNames = indexes.map((i) => i.name);
      expect(indexNames).toContain('idx_custom_exercises_category');
      expect(indexNames).toContain('idx_custom_exercises_name');
    });

    it('verifies ready dishes are seeded into foods table with category Refeições and source recipe', async () => {
      const dishes = await db.getAllAsync<{ id: string; name: string; category: string; source: string }>(
        "SELECT id, name, category, source FROM foods WHERE source = 'recipe' AND category = 'Refeições';"
      );

      expect(dishes.length).toBe(11);
      const names = dishes.map((d) => d.name);
      expect(names).toContain('Espaguete à Carbonara');
      expect(names).toContain('Massa ao Molho Vermelho');
      expect(names).toContain('Massa à Bolonhesa');
      expect(names).toContain('Omelete Simples');
      expect(names).toContain('Omelete com Queijo e Presunto');
      expect(names).toContain('Strogonoff de Frango');
      expect(names).toContain('Tapioca de Frango com Requeijão');
      expect(names).toContain('Crepioca de Queijo');
      expect(names).toContain('Panqueca de Carne');
      expect(names).toContain('Lasanha à Bolonhesa');
      expect(names).toContain('Pão com Ovo');
    });
  });

  describe('User Registration & Authentication Lifecycle', () => {
    it('registers a new user and sets is_logged_in to true', async () => {
      const newUser = await repo.registerUser({
        name: 'Carlos Silva',
        email: 'carlos@example.com',
        password: 'securePassword123!',
      });

      expect(newUser.id).toBeDefined();
      expect(newUser.name).toBe('Carlos Silva');
      expect(newUser.email).toBe('carlos@example.com');
      expect(newUser.isLoggedIn).toBe(true);
      expect(newUser.onboardingCompleted).toBe(false);

      // Verify active session in getProfile
      const active = await repo.getProfile();
      expect(active.id).toBe(newUser.id);
      expect(active.email).toBe('carlos@example.com');
    });

    it('prevents registration with duplicate email (case-insensitive)', async () => {
      await repo.registerUser({
        name: 'Mariana',
        email: 'mariana@example.com',
        password: 'pass',
      });

      await expect(
        repo.registerUser({
          name: 'Mariana Duplicate',
          email: 'MARIANA@EXAMPLE.COM',
          password: 'pass2',
        })
      ).rejects.toThrow('E-mail já cadastrado no aplicativo.');
    });

    it('logs in registered user with correct password', async () => {
      await repo.registerUser({
        name: 'Ana',
        email: 'ana@example.com',
        password: 'mySecretPassword',
      });

      // Log out
      await repo.logoutUser();
      const afterLogout = await repo.getProfile();
      expect(afterLogout.isLoggedIn).toBe(false);

      // Log in again
      const loggedIn = await repo.loginUser({
        email: 'ana@example.com',
        password: 'mySecretPassword',
      });

      expect(loggedIn.isLoggedIn).toBe(true);
      expect(loggedIn.email).toBe('ana@example.com');
    });

    it('rejects login with incorrect password', async () => {
      await repo.registerUser({
        name: 'Roberto',
        email: 'roberto@example.com',
        password: 'correctPassword',
      });

      await expect(
        repo.loginUser({
          email: 'roberto@example.com',
          password: 'wrongPassword',
        })
      ).rejects.toThrow('Senha incorreta.');
    });

    it('rejects login for non-existent email', async () => {
      await expect(
        repo.loginUser({
          email: 'nonexistent@example.com',
          password: 'any',
        })
      ).rejects.toThrow('Usuário não encontrado. Verifique seu e-mail ou crie uma conta.');
    });

    it('completes onboarding and updates target metrics and flags', async () => {
      await repo.registerUser({
        name: 'Luciana',
        email: 'luciana@example.com',
        password: 'pass',
      });

      const completed = await repo.completeOnboarding({
        heightCm: 165,
        targetWeightKg: 60,
        trainingGoal: 'cutting',
        activityLevel: 'moderate',
        targetCalories: 1700,
        targetProtein: 130,
        targetCarbs: 160,
        targetFat: 50,
        targetWaterMl: 2600,
      });

      expect(completed.onboardingCompleted).toBe(true);
      expect(completed.heightCm).toBe(165);
      expect(completed.targetWeightKg).toBe(60);
      expect(completed.trainingGoal).toBe('cutting');
      expect(completed.activityLevel).toBe('moderate');
      expect(completed.targetCalories).toBe(1700);

      const profile = await repo.getProfile();
      expect(profile.onboardingCompleted).toBe(true);
      expect(profile.heightCm).toBe(165);
    });
  });
});
