import React, { createContext, useState, useEffect, useMemo, useCallback } from 'react';
import { UserProfile } from '../types/domain';
import { IAuthRepository } from '../database/repositories/interfaces';

export interface ProfileContextValue {
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  updateProfile: (updates: Partial<UserProfile>) => Promise<UserProfile>;
  refresh: () => Promise<void>;
}

export const ProfileContext = createContext<ProfileContextValue | null>(null);

/**
 * Headless Profile State Manager for decoupled testing and state coordination.
 */
export class ProfileStateManager {
  public profile: UserProfile | null = null;
  public isLoading = false;
  public error: string | null = null;
  private listeners: (() => void)[] = [];

  constructor(private authRepo: IAuthRepository) {}

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
}

export const ProfileProvider: React.FC<{
  children: React.ReactNode;
  authRepo: IAuthRepository;
}> = ({ children, authRepo }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
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
          setIsLoading(false);
        }
      } catch (err: any) {
        if (active) {
          setError(err?.message || 'Falha ao carregar perfil');
          setIsLoading(false);
        }
      }
    })();
    return () => {
      active = false;
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

  const value = useMemo<ProfileContextValue>(
    () => ({
      profile,
      isLoading,
      error,
      updateProfile,
      refresh: loadProfile,
    }),
    [profile, isLoading, error, updateProfile, loadProfile]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
};
