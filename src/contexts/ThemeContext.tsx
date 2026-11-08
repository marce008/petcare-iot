import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_STORAGE_KEY = '@petcare/isDarkMode';

export type AppPalette = {
  background: string;
  surface: string;
  card: string;
  text: string;
  muted: string;
  border: string;
  secondaryBackground: string;
  input: string;
  positive: string;
};

const LIGHT_PALETTE: AppPalette = {
  background: '#F8FAFC',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  text: '#111827',
  muted: '#6B7280',
  border: '#E5E7EB',
  secondaryBackground: '#F2F4F8',
  input: '#FFFFFF',
  positive: '#047857',
};

const DARK_PALETTE: AppPalette = {
  background: '#121212',
  surface: '#1E1E1E',
  card: '#1E1E1E',
  text: '#FFFFFF',
  muted: '#B0B0B0',
  border: '#383838',
  secondaryBackground: '#181818',
  input: '#262626',
  positive: '#047857',
};

type ThemeContextValue = {
  isDarkMode: boolean;
  isThemeReady: boolean;
  palette: AppPalette;
  setDarkMode: (enabled: boolean) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: React.PropsWithChildren) {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isThemeReady, setIsThemeReady] = useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((storedValue) => {
        if (active && storedValue !== null) {
          setIsDarkMode(storedValue === 'true');
        }
      })
      .catch((error) => {
        console.error('No se pudo recuperar la preferencia de tema:', error);
      })
      .finally(() => {
        if (active) setIsThemeReady(true);
      });

    return () => {
      active = false;
    };
  }, []);

  const setDarkMode = useCallback(async (enabled: boolean) => {
    await AsyncStorage.setItem(THEME_STORAGE_KEY, String(enabled));
    setIsDarkMode(enabled);
  }, []);

  const value = useMemo(
    () => ({
      isDarkMode,
      isThemeReady,
      palette: isDarkMode ? DARK_PALETTE : LIGHT_PALETTE,
      setDarkMode,
    }),
    [isDarkMode, isThemeReady, setDarkMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAppTheme debe utilizarse dentro de ThemeProvider.');
  }
  return context;
}
