import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { getSetting, setSetting } from '../db/queries';
import { DEFAULT_THEME, ThemeMode, ThemeName, Themes } from '../constants/theme';
import { Unit } from './units';

type AppSettings = {
  unit: Unit;
  setUnit: (u: Unit) => void;
  kcalTarget: number | null;
  setKcalTarget: (n: number | null) => void;
  showRpe: boolean;
  setShowRpe: (b: boolean) => void;
  goalWeightKg: number | null;
  setGoalWeightKg: (n: number | null) => void;
  themeName: ThemeName;
  setThemeName: (t: ThemeName) => void;
  themeMode: ThemeMode;
  setThemeMode: (m: ThemeMode) => void;
};

const Ctx = createContext<AppSettings>({
  unit: 'kg',
  setUnit: () => {},
  kcalTarget: null,
  setKcalTarget: () => {},
  showRpe: false,
  setShowRpe: () => {},
  goalWeightKg: null,
  setGoalWeightKg: () => {},
  themeName: DEFAULT_THEME,
  setThemeName: () => {},
  themeMode: 'system',
  setThemeMode: () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [unit, setUnitState] = useState<Unit>('kg');
  const [kcalTarget, setKcalTargetState] = useState<number | null>(null);
  const [showRpe, setShowRpeState] = useState(false);
  const [goalWeightKg, setGoalWeightKgState] = useState<number | null>(null);
  const [themeName, setThemeNameState] = useState<ThemeName>(DEFAULT_THEME);
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    (async () => {
      const u = await getSetting(db, 'unit');
      if (u === 'lbs' || u === 'kg') setUnitState(u);
      const t = await getSetting(db, 'kcal_target');
      if (t) setKcalTargetState(Number(t));
      const r = await getSetting(db, 'show_rpe');
      setShowRpeState(r === '1');
      const g = await getSetting(db, 'goal_weight_kg');
      if (g) setGoalWeightKgState(Number(g));
      const th = await getSetting(db, 'theme');
      if (th && th in Themes) setThemeNameState(th as ThemeName);
      const tm = await getSetting(db, 'theme_mode');
      if (tm === 'light' || tm === 'dark' || tm === 'system') setThemeModeState(tm);
    })();
  }, [db]);

  const setUnit = useCallback((u: Unit) => {
    setUnitState(u);
    setSetting(db, 'unit', u);
  }, [db]);

  const setKcalTarget = useCallback((n: number | null) => {
    setKcalTargetState(n);
    setSetting(db, 'kcal_target', n == null ? '' : String(n));
  }, [db]);

  const setShowRpe = useCallback((b: boolean) => {
    setShowRpeState(b);
    setSetting(db, 'show_rpe', b ? '1' : '0');
  }, [db]);

  const setGoalWeightKg = useCallback((n: number | null) => {
    setGoalWeightKgState(n);
    setSetting(db, 'goal_weight_kg', n == null ? '' : String(n));
  }, [db]);

  const setThemeName = useCallback((t: ThemeName) => {
    setThemeNameState(t);
    setSetting(db, 'theme', t);
  }, [db]);

  const setThemeMode = useCallback((m: ThemeMode) => {
    setThemeModeState(m);
    setSetting(db, 'theme_mode', m);
  }, [db]);

  return (
    <Ctx.Provider value={{
      unit, setUnit, kcalTarget, setKcalTarget, showRpe, setShowRpe, goalWeightKg, setGoalWeightKg,
      themeName, setThemeName, themeMode, setThemeMode,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSettings() {
  return useContext(Ctx);
}
