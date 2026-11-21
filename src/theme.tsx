import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { getSetting, saveSetting } from './db';

export interface Palette {
  bg: string;
  card: string;
  cardAlt: string;
  line: string;
  text: string;
  muted: string;
  /** Fill colour for primary buttons and highlights */
  primary: string;
  /** Text on top of a primary fill */
  onPrimary: string;
  /** Accent used for text / thin lines (needs contrast on bg) */
  accent: string;
  secondary: string;
  good: string;
  bad: string;
}

export const DARK: Palette = {
  bg: '#101820',
  card: '#1D2933',
  cardAlt: '#16212A',
  line: '#2A3945',
  text: '#F7F9FA',
  muted: '#9BA8B4',
  primary: '#C6F135',
  onPrimary: '#101820',
  accent: '#C6F135',
  secondary: '#19B889',
  good: '#19B889',
  bad: '#FF7A6B',
};

/** Higher contrast for bright sun. Lime fills stay, but text accents darken. */
export const LIGHT: Palette = {
  bg: '#F3F6F5',
  card: '#FFFFFF',
  cardAlt: '#E9EFED',
  line: '#D3DDD9',
  text: '#101820',
  muted: '#52616D',
  primary: '#C6F135',
  onPrimary: '#101820',
  accent: '#0B7A5B',
  secondary: '#0B7A5B',
  good: '#0B7A5B',
  bad: '#B3342B',
};

export type Mode = 'system' | 'dark' | 'light';

interface ThemeCtx {
  c: Palette;
  isDark: boolean;
  mode: Mode;
  setMode: (m: Mode) => void;
}

const Ctx = createContext<ThemeCtx>({ c: DARK, isDark: true, mode: 'system', setMode: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<Mode>('system');

  useEffect(() => {
    getSetting<Mode>('themeMode')
      .then((m) => m && setModeState(m))
      .catch(() => {});
  }, []);

  const value = useMemo<ThemeCtx>(() => {
    // Dark-first: only go light when the user, or the phone, asks for it.
    const isDark = mode === 'system' ? system !== 'light' : mode === 'dark';
    return {
      c: isDark ? DARK : LIGHT,
      isDark,
      mode,
      setMode: (m) => {
        setModeState(m);
        saveSetting('themeMode', m).catch(() => {});
      },
    };
  }, [mode, system]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

/** Minimum touch target for one-handed use outdoors. */
export const TAP = 52;
