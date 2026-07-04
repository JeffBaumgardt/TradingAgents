/**
 * @file apps/web/src/context/ThemeContext.tsx
 * Theme selection with localStorage persistence and document attribute sync.
 */

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  getServerThemeSnapshot,
  readStoredThemeId,
  subscribeToThemeChanges,
  writeStoredThemeId,
} from "@/lib/theme-store";
import type { ThemeId } from "@/lib/themes";

interface ThemeContextValue {
  themeId: ThemeId;
  setThemeId: (id: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const themeId = useSyncExternalStore(
    subscribeToThemeChanges,
    readStoredThemeId,
    getServerThemeSnapshot,
  );

  const setThemeId = useCallback((id: ThemeId) => {
    writeStoredThemeId(id);
  }, []);

  const value = useMemo(
    () => ({
      themeId,
      setThemeId,
    }),
    [themeId, setThemeId],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
