import { ThemeStateManager } from '../../src/context/ThemeContext';
import { ProfileStateManager } from '../../src/context/ProfileContext';
import { IAuthRepository } from '../../src/database/repositories/interfaces';
import { UserProfile } from '../../src/types/domain';
import { DarkTheme, LightTheme, getTheme } from '../../src/constants/theme';

class MockAuthRepository implements IAuthRepository {
  public profile: UserProfile = {
    id: 'user-1',
    email: 'atleta@irontrack.app',
    name: 'Atleta Pro',
    targetCalories: 2500,
    targetProtein: 180,
    targetCarbs: 250,
    targetFat: 70,
    targetWaterMl: 3000,
    theme: 'dark',
    createdAt: '2026-11-01T00:00:00Z',
  };

  public shouldFail = false;

  async getProfile(): Promise<UserProfile> {
    if (this.shouldFail) throw new Error('DB Connection Failed');
    return { ...this.profile };
  }

  async updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    if (this.shouldFail) throw new Error('DB Update Failed');
    this.profile = {
      ...this.profile,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    return { ...this.profile };
  }

  async setTheme(theme: 'dark' | 'light'): Promise<void> {
    if (this.shouldFail) throw new Error('DB Set Theme Failed');
    this.profile.theme = theme;
  }

  async getTheme(): Promise<'dark' | 'light'> {
    if (this.shouldFail) throw new Error('DB Get Theme Failed');
    return this.profile.theme;
  }

  async registerUser(input: any): Promise<UserProfile> {
    if (this.shouldFail) throw new Error('DB Register Failed');
    this.profile = {
      ...this.profile,
      id: 'registered-user',
      name: input.name,
      email: input.email,
      isLoggedIn: true,
      onboardingCompleted: false,
    };
    return { ...this.profile };
  }

  async loginUser(input: any): Promise<UserProfile> {
    if (this.shouldFail) throw new Error('DB Login Failed');
    this.profile = {
      ...this.profile,
      email: input.email,
      isLoggedIn: true,
    };
    return { ...this.profile };
  }

  async logoutUser(): Promise<void> {
    if (this.shouldFail) throw new Error('DB Logout Failed');
    this.profile.isLoggedIn = false;
  }

  async completeOnboarding(data: any): Promise<UserProfile> {
    if (this.shouldFail) throw new Error('DB Onboarding Failed');
    this.profile = {
      ...this.profile,
      heightCm: data.heightCm,
      targetWeightKg: data.targetWeightKg,
      trainingGoal: data.trainingGoal,
      activityLevel: data.activityLevel,
      targetCalories: data.targetCalories ?? this.profile.targetCalories,
      targetProtein: data.targetProtein ?? this.profile.targetProtein,
      targetCarbs: data.targetCarbs ?? this.profile.targetCarbs,
      targetFat: data.targetFat ?? this.profile.targetFat,
      targetWaterMl: data.targetWaterMl ?? this.profile.targetWaterMl,
      onboardingCompleted: true,
    };
    return { ...this.profile };
  }
}

describe('ThemeStateManager & ProfileStateManager Unit Tests (Milestone M4)', () => {
  describe('Theme Tokens and Resolution', () => {
    it('DarkTheme provides deep OLED #0A0A0C background and emerald primary', () => {
      expect(DarkTheme.colors.background).toBe('#0A0A0C');
      expect(DarkTheme.colors.primary).toBe('#10B981');
      expect(DarkTheme.colors.textPrimary).toBe('#FFFFFF');
    });

    it('LightTheme provides crisp off-white #F8F9FA surface and high-contrast text', () => {
      expect(LightTheme.colors.background).toBe('#F8F9FA');
      expect(LightTheme.colors.textPrimary).toBe('#0F172A');
      expect(LightTheme.colors.card).toBe('#FFFFFF');
    });

    it('DarkTheme and LightTheme share identical token keys', () => {
      const darkKeys = Object.keys(DarkTheme.colors).sort();
      const lightKeys = Object.keys(LightTheme.colors).sort();
      expect(darkKeys).toEqual(lightKeys);
    });

    it('getTheme resolves correct theme by mode', () => {
      expect(getTheme('dark').mode).toBe('dark');
      expect(getTheme('light').mode).toBe('light');
    });
  });

  describe('ThemeStateManager', () => {
    let mockAuthRepo: MockAuthRepository;
    let themeManager: ThemeStateManager;

    beforeEach(() => {
      mockAuthRepo = new MockAuthRepository();
      themeManager = new ThemeStateManager(mockAuthRepo, 'dark');
    });

    it('initializes with dark theme by default', () => {
      expect(themeManager.themeMode).toBe('dark');
      expect(themeManager.isDark).toBe(true);
      expect(themeManager.colors.background).toBe('#0A0A0C');
    });

    it('toggles theme to light mode and updates colors', async () => {
      await themeManager.toggleTheme();
      expect(themeManager.themeMode).toBe('light');
      expect(themeManager.isDark).toBe(false);
      expect(themeManager.colors.background).toBe('#F8F9FA');

      // Check persistence
      expect(mockAuthRepo.profile.theme).toBe('light');
    });

    it('toggles back to dark mode', async () => {
      await themeManager.setTheme('light');
      await themeManager.toggleTheme();
      expect(themeManager.themeMode).toBe('dark');
      expect(themeManager.isDark).toBe(true);
      expect(mockAuthRepo.profile.theme).toBe('dark');
    });

    it('loads persisted theme from auth repository', async () => {
      mockAuthRepo.profile.theme = 'light';
      await themeManager.loadTheme();
      expect(themeManager.themeMode).toBe('light');
      expect(themeManager.isDark).toBe(false);
    });

    it('notifies subscribers on theme change', async () => {
      let notified = 0;
      const unsubscribe = themeManager.subscribe(() => {
        notified++;
      });

      await themeManager.setTheme('light');
      expect(notified).toBe(1);

      unsubscribe();
      await themeManager.setTheme('dark');
      expect(notified).toBe(1);
    });
  });

  describe('ProfileStateManager', () => {
    let mockAuthRepo: MockAuthRepository;
    let profileManager: ProfileStateManager;

    beforeEach(() => {
      mockAuthRepo = new MockAuthRepository();
      profileManager = new ProfileStateManager(mockAuthRepo);
    });

    it('loads user profile successfully', async () => {
      await profileManager.loadProfile();
      expect(profileManager.profile).not.toBeNull();
      expect(profileManager.profile?.name).toBe('Atleta Pro');
      expect(profileManager.profile?.targetCalories).toBe(2500);
      expect(profileManager.profile?.targetWaterMl).toBe(3000);
      expect(profileManager.isLoading).toBe(false);
      expect(profileManager.error).toBeNull();
    });

    it('updates nutritional and hydration targets', async () => {
      await profileManager.loadProfile();

      const updated = await profileManager.updateProfile({
        targetCalories: 2800,
        targetProtein: 200,
        targetWaterMl: 3500,
      });

      expect(updated.targetCalories).toBe(2800);
      expect(updated.targetProtein).toBe(200);
      expect(updated.targetWaterMl).toBe(3500);
      expect(profileManager.profile?.targetCalories).toBe(2800);
    });

    it('handles repository failure and exposes error', async () => {
      mockAuthRepo.shouldFail = true;
      await profileManager.loadProfile();
      expect(profileManager.error).toContain('DB Connection Failed');
      expect(profileManager.isLoading).toBe(false);
    });

    it('notifies subscribers on profile load and update', async () => {
      let notifyCount = 0;
      const unsubscribe = profileManager.subscribe(() => {
        notifyCount++;
      });

      await profileManager.loadProfile();
      expect(notifyCount).toBeGreaterThan(0);

      const beforeUpdate = notifyCount;
      await profileManager.updateProfile({ name: 'Campeão' });
      expect(notifyCount).toBeGreaterThan(beforeUpdate);

      unsubscribe();
    });
  });
});
