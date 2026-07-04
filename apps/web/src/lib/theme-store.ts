/**
 * @file apps/web/src/lib/theme-store.ts
 * Client-side theme persistence and subscription for useSyncExternalStore.
 */

import {
  DEFAULT_THEME_ID,
  getThemeDefinition,
  isThemeId,
  THEME_STORAGE_KEY,
  type ThemeId,
} from "@/lib/themes";

const themeListeners = new Set<() => void>();

export function applyThemeToDocument(themeId: ThemeId) {
  if (typeof document === "undefined") {
    return;
  }

  const theme = getThemeDefinition(themeId);
  document.documentElement.dataset.theme = themeId;
  document.documentElement.style.colorScheme = theme.colorScheme;
}

/** Read the user's saved theme preference from localStorage. */
export function readStoredThemeId(): ThemeId {
  if (typeof window === "undefined") {
    return DEFAULT_THEME_ID;
  }

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (isThemeId(stored)) {
    return stored;
  }

  return DEFAULT_THEME_ID;
}

export function getServerThemeSnapshot(): ThemeId {
  return DEFAULT_THEME_ID;
}

export function subscribeToThemeChanges(listener: () => void) {
  themeListeners.add(listener);

  if (typeof window !== "undefined") {
    window.addEventListener("storage", listener);
  }

  return () => {
    themeListeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", listener);
    }
  };
}

export function notifyThemeChange() {
  for (const listener of themeListeners) {
    listener();
  }
}

export function writeStoredThemeId(themeId: ThemeId) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(THEME_STORAGE_KEY, themeId);
  applyThemeToDocument(themeId);
  notifyThemeChange();
}
