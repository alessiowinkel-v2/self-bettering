import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { darkTheme, lightTheme, type Theme, type ThemeMode } from './index';
import { useThemeStore } from './useThemeStore';

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const override = useThemeStore((s) => s.override);

  const mode: ThemeMode = useMemo(() => {
    if (override === 'dark' || override === 'light') return override;
    return systemScheme === 'light' ? 'light' : 'dark';
  }, [override, systemScheme]);

  const theme = useMemo(() => (mode === 'dark' ? darkTheme : lightTheme), [mode]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }
  return ctx;
}

export function useThemeMode(): ThemeMode {
  return useTheme().mode;
}
