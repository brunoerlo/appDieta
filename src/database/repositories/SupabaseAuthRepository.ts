import { SupabaseClient } from '@supabase/supabase-js';
import {
  IAuthRepository,
  RegisterUserInput,
  LoginUserInput,
  OnboardingData,
} from './interfaces';
import { UserProfile } from '../../types/domain';
import { supabase as defaultSupabase } from '../../services/supabaseClient';

interface ProfileRow {
  id: string;
  email: string;
  name: string;
  onboarding_completed: boolean;
  height_cm: number | null;
  target_weight_kg: number | null;
  training_goal: string | null;
  activity_level: string | null;
  target_calories: number;
  target_protein: number;
  target_carbs: number;
  target_fat: number;
  target_water_ml: number;
  theme: 'dark' | 'light';
  created_at: string;
  updated_at: string | null;
}

const DEFAULT_GUEST_PROFILE = (): UserProfile => {
  const now = new Date().toISOString();
  return {
    id: '',
    email: '',
    name: 'Atleta',
    isLoggedIn: false,
    onboardingCompleted: false,
    targetCalories: 2000,
    targetProtein: 150,
    targetCarbs: 200,
    targetFat: 60,
    targetWaterMl: 2500,
    theme: 'dark',
    createdAt: now,
    updatedAt: now,
  };
};

export class SupabaseAuthRepository implements IAuthRepository {
  constructor(private client: SupabaseClient = defaultSupabase) {}

  private mapRow(row: ProfileRow, isLoggedIn: boolean): UserProfile {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      isLoggedIn,
      onboardingCompleted: row.onboarding_completed,
      heightCm: row.height_cm ?? undefined,
      targetWeightKg: row.target_weight_kg ?? undefined,
      trainingGoal: row.training_goal ?? undefined,
      activityLevel: row.activity_level ?? undefined,
      targetCalories: row.target_calories,
      targetProtein: row.target_protein,
      targetCarbs: row.target_carbs,
      targetFat: row.target_fat,
      targetWaterMl: row.target_water_ml,
      theme: row.theme,
      createdAt: row.created_at,
      updatedAt: row.updated_at ?? undefined,
    };
  }

  private async getCurrentUserId(): Promise<{ userId: string; email: string } | null> {
    const { data, error } = await this.client.auth.getSession();
    if (error || !data.session?.user) {
      return null;
    }
    return {
      userId: data.session.user.id,
      email: data.session.user.email ?? '',
    };
  }

  private async ensureProfileRow(userId: string, email: string, name = 'Atleta'): Promise<ProfileRow> {
    const { data: existing, error: selectError } = await this.client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle<ProfileRow>();

    if (selectError) {
      throw new Error(selectError.message);
    }

    if (existing) {
      return existing;
    }

    const now = new Date().toISOString();
    const { data: inserted, error: insertError } = await this.client
      .from('profiles')
      .upsert(
        {
          id: userId,
          email,
          name: name || 'Atleta',
          onboarding_completed: false,
          target_calories: 2000,
          target_protein: 150,
          target_carbs: 200,
          target_fat: 60,
          target_water_ml: 2500,
          theme: 'dark',
          created_at: now,
          updated_at: now,
        },
        { onConflict: 'id' }
      )
      .select('*')
      .single<ProfileRow>();

    if (insertError || !inserted) {
      throw new Error(insertError?.message ?? 'Erro ao criar perfil do usuário.');
    }

    return inserted;
  }

  async getProfile(): Promise<UserProfile> {
    const sessionUser = await this.getCurrentUserId();
    if (!sessionUser) {
      return DEFAULT_GUEST_PROFILE();
    }

    const row = await this.ensureProfileRow(sessionUser.userId, sessionUser.email);
    return this.mapRow(row, true);
  }

  async updateProfile(profile: Partial<UserProfile>): Promise<UserProfile> {
    const sessionUser = await this.getCurrentUserId();
    if (!sessionUser) {
      throw new Error('Usuário não autenticado.');
    }

    const now = new Date().toISOString();
    const payload: Record<string, unknown> = {
      updated_at: now,
    };

    if (profile.name !== undefined) payload.name = profile.name;
    if (profile.email !== undefined) payload.email = profile.email;
    if (profile.heightCm !== undefined) payload.height_cm = profile.heightCm ?? null;
    if (profile.targetWeightKg !== undefined) payload.target_weight_kg = profile.targetWeightKg ?? null;
    if (profile.trainingGoal !== undefined) payload.training_goal = profile.trainingGoal ?? null;
    if (profile.activityLevel !== undefined) payload.activity_level = profile.activityLevel ?? null;
    if (profile.onboardingCompleted !== undefined) {
      payload.onboarding_completed = profile.onboardingCompleted;
    }
    if (profile.targetCalories !== undefined) payload.target_calories = profile.targetCalories;
    if (profile.targetProtein !== undefined) payload.target_protein = profile.targetProtein;
    if (profile.targetCarbs !== undefined) payload.target_carbs = profile.targetCarbs;
    if (profile.targetFat !== undefined) payload.target_fat = profile.targetFat;
    if (profile.targetWaterMl !== undefined) payload.target_water_ml = profile.targetWaterMl;
    if (profile.theme !== undefined) payload.theme = profile.theme;

    const { data, error } = await this.client
      .from('profiles')
      .update(payload)
      .eq('id', sessionUser.userId)
      .select('*')
      .single<ProfileRow>();

    if (error || !data) {
      throw new Error(error?.message ?? 'Erro ao atualizar perfil.');
    }

    return this.mapRow(data, true);
  }

  async registerUser(input: RegisterUserInput): Promise<UserProfile> {
    const trimmedEmail = input.email.trim().toLowerCase();
    const trimmedName = input.name.trim() || 'Atleta';

    if (!trimmedEmail) {
      throw new Error('E-mail é obrigatório para cadastro.');
    }
    if (!input.password || input.password.length < 6) {
      throw new Error('A senha deve ter pelo menos 6 caracteres.');
    }

    const { data, error } = await this.client.auth.signUp({
      email: trimmedEmail,
      password: input.password,
      options: {
        data: { name: trimmedName },
      },
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('already registered') || msg.includes('already exists')) {
        throw new Error('E-mail já cadastrado no aplicativo.');
      }
      throw new Error(error.message);
    }

    if (!data.user) {
      throw new Error('Não foi possível criar a conta.');
    }

    if (!data.session) {
      throw new Error(
        'Conta criada! Verifique seu e-mail para confirmar o cadastro antes de entrar.'
      );
    }

    const row = await this.ensureProfileRow(data.user.id, trimmedEmail, trimmedName);
    return this.mapRow(row, true);
  }

  async loginUser(input: LoginUserInput): Promise<UserProfile> {
    const trimmedEmail = input.email.trim().toLowerCase();

    if (!trimmedEmail || !input.password) {
      throw new Error('Informe e-mail e senha.');
    }

    const { data, error } = await this.client.auth.signInWithPassword({
      email: trimmedEmail,
      password: input.password,
    });

    if (error) {
      if (error.message.toLowerCase().includes('invalid login credentials')) {
        throw new Error('E-mail ou senha incorretos.');
      }
      throw new Error(error.message);
    }

    if (!data.user) {
      throw new Error('Usuário não encontrado.');
    }

    const nameFromMeta =
      typeof data.user.user_metadata?.name === 'string'
        ? data.user.user_metadata.name
        : 'Atleta';
    const row = await this.ensureProfileRow(data.user.id, trimmedEmail, nameFromMeta);
    return this.mapRow(row, true);
  }

  async logoutUser(): Promise<void> {
    const { error } = await this.client.auth.signOut();
    if (error) {
      throw new Error(error.message);
    }
  }

  async completeOnboarding(data: OnboardingData): Promise<UserProfile> {
    const current = await this.getProfile();
    if (!current.id) {
      throw new Error('Usuário não autenticado.');
    }

    return this.updateProfile({
      heightCm: data.heightCm,
      targetWeightKg: data.targetWeightKg,
      trainingGoal: data.trainingGoal,
      activityLevel: data.activityLevel,
      targetCalories: data.targetCalories ?? current.targetCalories,
      targetProtein: data.targetProtein ?? current.targetProtein,
      targetCarbs: data.targetCarbs ?? current.targetCarbs,
      targetFat: data.targetFat ?? current.targetFat,
      targetWaterMl: data.targetWaterMl ?? current.targetWaterMl,
      onboardingCompleted: true,
    });
  }

  async setTheme(theme: 'dark' | 'light'): Promise<void> {
    const sessionUser = await this.getCurrentUserId();
    if (!sessionUser) return;

    await this.client
      .from('profiles')
      .update({ theme, updated_at: new Date().toISOString() })
      .eq('id', sessionUser.userId);
  }

  async getTheme(): Promise<'dark' | 'light'> {
    const sessionUser = await this.getCurrentUserId();
    if (!sessionUser) return 'dark';

    const { data } = await this.client
      .from('profiles')
      .select('theme')
      .eq('id', sessionUser.userId)
      .maybeSingle<{ theme: 'dark' | 'light' }>();

    return data?.theme ?? 'dark';
  }
}
