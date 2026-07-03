/**
 * @file apps/web/src/context/ThemeContext.tsx
 * Theme selection with localStorage persistence and document attribute sync.
 */

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_THEME_ID,
  getThemeDefinition,
  isThemeId,
  THEME_STORAGE_KEY,
  type ThemeId,
} from "@/lib/themes";

interface ThemeContextValue {
  themeId: ThemeId;
  setThemeId: (id: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredTheme(): ThemeId {
  if (typeof window === "undefined") {
    return DEFAULT_THEME_ID;
  }
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (isThemeId(stored)) {
    return stored;
  }
  return DEFAULT_THEME_ID;
}

function applyThemeToDocument(themeId: ThemeId) {
  const theme = getThemeDefinition(themeId);
  document.documentElement.dataset.theme = themeId;
  document.documentElement.style.colorScheme = theme.colorScheme;
}

function readThemeFromDocument(): ThemeId | null {
  if (typeof document === "undefined") {
    return null;
  }
  const fromDom = document.documentElement.dataset.theme;
  if (isThemeId(fromDom)) {
    return fromDom;
  }
  return null;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<ThemeId>(() => {
    return readThemeFromDocument() ?? DEFAULT_THEME_ID;
  });

  useEffect(() => {
    const stored = readStoredTheme();
    setThemeIdState(stored);
    applyThemeToDocument(stored);
  }, []);

  const setThemeId = useCallback((id: ThemeId) => {
    setThemeIdState(id);
    window.localStorage.setItem(THEME_STORAGE_KEY, id);
    applyThemeToDocument(id);
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
