/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
type Density = 'comfortable' | 'compact';

interface ThemeContextType {
  theme: Theme;
  density: Density;
  toggleTheme: () => void;
  toggleDensity: () => void;
  setTheme: (theme: Theme) => void;
  setDensity: (density: Density) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('wren-theme') as Theme;
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const [density, setDensityState] = useState<Density>(() => {
    const saved = localStorage.getItem('wren-density') as Density;
    return saved === 'compact' ? 'compact' : 'comfortable';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('wren-theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-density', density);
    localStorage.setItem('wren-density', density);
  }, [density]);

  const toggleTheme = () => {
    setThemeState(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const toggleDensity = () => {
    setDensityState(prev => (prev === 'comfortable' ? 'compact' : 'comfortable'));
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const setDensity = (newDensity: Density) => {
    setDensityState(newDensity);
  };

  return (
    <ThemeContext.Provider value={{ theme, density, toggleTheme, toggleDensity, setTheme, setDensity }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
