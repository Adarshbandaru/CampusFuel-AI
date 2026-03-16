import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme, Appearance } from 'react-native';
import { secureStorage } from '../storage/secureStorage';

import { Colors } from '../constants/Colors';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: 'light' | 'dark';
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  colors: typeof Colors.light;
  isDark: boolean;
  isSystem: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>('system');

  useEffect(() => {
    async function loadTheme() {
      const savedMode = await secureStorage.getItem('themeMode');
      if (savedMode) {
        setMode(savedMode as ThemeMode);
      }
    }
    loadTheme();
  }, []);

  const changeMode = async (newMode: ThemeMode) => {
    try {
      setMode(newMode);
      await secureStorage.setItem('themeMode', newMode);
    } catch (e) {
      console.error("Failed to save theme preference:", e);
    }
  };

  const theme = mode === 'system' ? (systemColorScheme || 'light') : mode;
  const colors = Colors[theme];
  const isDark = theme === 'dark';
  const isSystem = mode === 'system';

  return (
    <ThemeContext.Provider value={{ theme, mode, setMode: changeMode, colors, isDark, isSystem }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
