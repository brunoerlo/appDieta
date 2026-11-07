import { useContext } from 'react';
import { ThemeContext, ThemeContextValue } from '../context/ThemeContext';
import { DarkTheme } from '../constants/theme';

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    // Graceful defensive fallback to DarkTheme
    return {
      themeMode: 'dark',
      theme: DarkTheme,
      colors: DarkTheme.colors,
      isDark: true,
      setTheme: async () => {},
      toggleTheme: async () => {},
      isLoading: false,
    };
  }
  return context;
}
