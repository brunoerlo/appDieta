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

  it('updates profile calorie and macronutrient goals', async () => {
    const updated = await repo.updateProfile({
      name: 'Bruno Iron',
      targetCalories: 2600,
      targetProtein: 180,
      targetCarbs: 300,
      targetFat: 75,
      targetWaterMl: 3500,
    });

    expect(updated.name).toBe('Bruno Iron');
    expect(updated.targetCalories).toBe(2600);
    expect(updated.targetProtein).toBe(180);
    expect(updated.targetCarbs).toBe(300);
    expect(updated.targetFat).toBe(75);
    expect(updated.targetWaterMl).toBe(3500);

    const reloaded = await repo.getProfile();
    expect(reloaded.name).toBe('Bruno Iron');
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
});
