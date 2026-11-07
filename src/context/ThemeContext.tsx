import React, { createContext, useState, useEffect, useMemo, useCallback } from 'react';
import { IAuthRepository } from '../database/repositories/interfaces';
import {
  Theme,
  ThemeColors,
  ThemeMode,
  getTheme,
} from '../constants/theme';


export interface ThemeContextValue {
  themeMode: ThemeMode;
  theme: Theme;
  colors: ThemeColors;
  isDark: boolean;
  setTheme: (mode: ThemeMode) => Promise<void>;
  toggleTheme: () => Promise<void>;
  isLoading: boolean;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Headless Theme State Manager for decoupled unit testing and subscription tracking.
 */
export class ThemeStateManager {
  public themeMode: ThemeMode;
  public isLoading = false;
  private listeners: (() => void)[] = [];

  constructor(
    private authRepo?: IAuthRepository,
    initialTheme: ThemeMode = 'dark'
  ) {
    this.themeMode = initialTheme;
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

  public async loadTheme(): Promise<void> {
    if (!this.authRepo) return;
    this.isLoading = true;
    this.notify();
    try {
      this.themeMode = await this.authRepo.getTheme();
    } catch {
      this.themeMode = 'dark';
    } finally {
      this.isLoading = false;
      this.notify();
    }
  }

  public async setTheme(mode: ThemeMode): Promise<void> {
    this.themeMode = mode;
    this.notify();
    if (this.authRepo) {
      try {
        await this.authRepo.setTheme(mode);
      } catch {
        // Ignore persistence error
      }
    }
  }

  public async toggleTheme(): Promise<void> {
    await this.setTheme(this.themeMode === 'dark' ? 'light' : 'dark');
  }

  public get theme(): Theme {
    return getTheme(this.themeMode);
  }

  public get colors(): ThemeColors {
    return this.theme.colors;
  }

  public get isDark(): boolean {
    return this.themeMode === 'dark';
  }
}

export interface ThemeProviderProps {
  children: React.ReactNode;
  authRepo?: IAuthRepository;
  initialTheme?: ThemeMode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  authRepo,
  initialTheme = 'dark',
}) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(initialTheme);
  const [isLoading, setIsLoading] = useState<boolean>(!!authRepo);

  useEffect(() => {
    let active = true;
    if (authRepo) {
      authRepo
        .getTheme()
        .then((saved) => {
          if (active && saved) {
            setThemeModeState(saved);
            setIsLoading(false);
          }
        })
        .catch(() => {
          if (active) setIsLoading(false);
        });
    }
    return () => {
      active = false;
    };
  }, [authRepo]);

  const setTheme = useCallback(
    async (mode: ThemeMode) => {
      setThemeModeState(mode);
      if (authRepo) {
        await authRepo.setTheme(mode);
      }
    },
    [authRepo]
  );

  const toggleTheme = useCallback(async () => {
    const next = themeMode === 'dark' ? 'light' : 'dark';
    await setTheme(next);
  }, [themeMode, setTheme]);

  const theme = useMemo(() => getTheme(themeMode), [themeMode]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      themeMode,
      theme,
      colors: theme.colors,
      isDark: themeMode === 'dark',
      setTheme,
      toggleTheme,
      isLoading,
    }),
    [themeMode, theme, setTheme, toggleTheme, isLoading]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
