import React, { createContext, useState, useEffect, useMemo, useCallback } from 'react';
import { UserProfile } from '../types/domain';
import {
  IAuthRepository,
  RegisterUserInput,
  LoginUserInput,
  OnboardingData,
} from '../database/repositories/interfaces';
import { supabase } from '../services/supabaseClient';

export interface ProfileContextValue {
  profile: UserProfile | null;
  isLoading: boolean;
  isBootstrapping: boolean;
  error: string | null;
  isLoggedIn: boolean;
  onboardingCompleted: boolean;
  updateProfile: (updates: Partial<UserProfile>) => Promise<UserProfile>;
  refresh: () => Promise<void>;
  register: (input: RegisterUserInput) => Promise<UserProfile>;
  login: (input: LoginUserInput) => Promise<UserProfile>;
  logout: () => Promise<void>;
  completeOnboarding: (data: OnboardingData) => Promise<UserProfile>;
}

export const ProfileContext = createContext<ProfileContextValue | null>(null);

function createClearedProfile(prev?: UserProfile | null): UserProfile {
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
    theme: prev?.theme || 'dark',
    createdAt: new Date().toISOString(),
  };
}

/**
 * Headless Profile State Manager for decoupled testing and state coordination.
 */
export class ProfileStateManager {
  public profile: UserProfile | null = null;
  public isLoading = false;
  public isBootstrapping = true;
  public error: string | null = null;
  private listeners: (() => void)[] = [];

  constructor(private authRepo: IAuthRepository) {}

  public get isLoggedIn(): boolean {
    return Boolean(this.profile?.isLoggedIn);
  }

  public get onboardingCompleted(): boolean {
    return Boolean(this.profile?.onboardingCompleted);
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    for (const l of this.listeners) {
      try {
        l();
      } catch {
        // Ignore listener error
      }
    }
  }

  public async loadProfile(): Promise<void> {
    this.isLoading = true;
    this.error = null;
    this.notify();
    try {
      this.profile = await this.authRepo.getProfile();
    } catch (err: any) {
      this.error = err?.message || 'Falha ao carregar perfil';
    } finally {
      this.isLoading = false;
      this.isBootstrapping = false;
      this.notify();
    }
  }

  public async updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    this.isLoading = true;
    this.error = null;
    this.notify();
    try {
      const updated = await this.authRepo.updateProfile(updates);
      this.profile = updated;
      return updated;
    } catch (err: any) {
      this.error = err?.message || 'Falha ao atualizar perfil';
      throw err;
    } finally {
      this.isLoading = false;
      this.notify();
    }
  }

  public async register(input: RegisterUserInput): Promise<UserProfile> {
    this.isLoading = true;
    this.error = null;
    this.notify();
    try {
      const user = await this.authRepo.registerUser(input);
      this.profile = user;
      return user;
    } catch (err: any) {
      this.error = err?.message || 'Falha ao cadastrar usuário';
      throw err;
    } finally {
      this.isLoading = false;
      this.notify();
    }
  }

  public async login(input: LoginUserInput): Promise<UserProfile> {
    this.isLoading = true;
    this.error = null;
    this.notify();
    try {
      const user = await this.authRepo.loginUser(input);
      this.profile = user;
      return user;
    } catch (err: any) {
      this.error = err?.message || 'Falha ao realizar login';
      throw err;
    } finally {
      this.isLoading = false;
      this.notify();
    }
  }

  public async logout(): Promise<void> {
    this.isLoading = true;
    this.error = null;
    this.notify();
    try {
      await this.authRepo.logoutUser();
    } catch (err: any) {
      this.error = err?.message || 'Falha ao sair da conta';
      throw err;
    } finally {
      this.profile = createClearedProfile(this.profile);
      this.isLoading = false;
      this.notify();
    }
  }

  public async completeOnboarding(data: OnboardingData): Promise<UserProfile> {
    this.isLoading = true;
    this.error = null;
    this.notify();
    try {
      const updated = await this.authRepo.completeOnboarding(data);
      this.profile = updated;
      return updated;
    } catch (err: any) {
      this.error = err?.message || 'Falha ao concluir onboarding';
      throw err;
    } finally {
      this.isLoading = false;
      this.notify();
    }
  }
}

export const ProfileProvider: React.FC<{
  children: React.ReactNode;
  authRepo: IAuthRepository;
}> = ({ children, authRepo }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isBootstrapping, setIsBootstrapping] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const p = await authRepo.getProfile();
      setProfile(p);
    } catch (err: any) {
      setError(err?.message || 'Falha ao carregar perfil');
    } finally {
      setIsLoading(false);
    }
  }, [authRepo]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const p = await authRepo.getProfile();
        if (active) {
          setProfile(p);
        }
      } catch (err: any) {
        if (active) {
          setError(err?.message || 'Falha ao carregar perfil');
        }
      } finally {
        if (active) {
          setIsLoading(false);
          setIsBootstrapping(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [authRepo]);

  useEffect(() => {
    if (!supabase?.auth || typeof supabase.auth.onAuthStateChange !== 'function') {
      return;
    }
    let active = true;
    const subResult = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === 'SIGNED_OUT' || (!session && event === 'TOKEN_REFRESHED')) {
        setProfile((prev) => createClearedProfile(prev));
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        authRepo
          .getProfile()
          .then((p) => {
            if (active && p) {
              setProfile(p);
            }
          })
          .catch(() => {
            // Preserve current profile if background refresh fails
          });
      }
    });

    return () => {
      active = false;
      subResult?.data?.subscription?.unsubscribe?.();
    };
  }, [authRepo]);

  const updateProfile = useCallback(
    async (updates: Partial<UserProfile>) => {
      setIsLoading(true);
      setError(null);
      try {
        const updated = await authRepo.updateProfile(updates);
        setProfile(updated);
        return updated;
      } catch (err: any) {
        setError(err?.message || 'Falha ao atualizar perfil');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [authRepo]
  );

  const register = useCallback(
    async (input: RegisterUserInput) => {
      setIsLoading(true);
      setError(null);
      try {
        const created = await authRepo.registerUser(input);
        setProfile(created);
        return created;
      } catch (err: any) {
        setError(err?.message || 'Falha ao cadastrar usuário');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [authRepo]
  );

  const login = useCallback(
    async (input: LoginUserInput) => {
      setIsLoading(true);
      setError(null);
      try {
        const user = await authRepo.loginUser(input);
        setProfile(user);
        return user;
      } catch (err: any) {
        setError(err?.message || 'Falha ao realizar login');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [authRepo]
  );

  const logout = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await authRepo.logoutUser();
    } catch (err: any) {
      setError(err?.message || 'Falha ao sair da conta');
      throw err;
    } finally {
      setProfile((prev) => createClearedProfile(prev));
      setIsLoading(false);
    }
  }, [authRepo]);

  const completeOnboarding = useCallback(
    async (data: OnboardingData) => {
      setIsLoading(true);
      setError(null);
      try {
        const updated = await authRepo.completeOnboarding(data);
        setProfile(updated);
        return updated;
      } catch (err: any) {
        setError(err?.message || 'Falha ao concluir onboarding');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [authRepo]
  );

  const value = useMemo<ProfileContextValue>(
    () => ({
      profile,
      isLoading,
      isBootstrapping,
      error,
      isLoggedIn: Boolean(profile?.isLoggedIn),
      onboardingCompleted: Boolean(profile?.onboardingCompleted),
      updateProfile,
      refresh: loadProfile,
      register,
      login,
      logout,
      completeOnboarding,
    }),
    [
      profile,
      isLoading,
      isBootstrapping,
      error,
      updateProfile,
      loadProfile,
      register,
      login,
      logout,
      completeOnboarding,
    ]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
};
