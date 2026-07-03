/**
 * @file apps/web/src/lib/themes.ts
 * Theme definitions for the TradingAgents web UI.
 */

export const THEME_STORAGE_KEY = "tradingagents-theme";

export type ThemeId = "midnight" | "ocean" | "terminal" | "slate" | "paper";

export interface ThemeDefinition {
  id: ThemeId;
  label: string;
  description: string;
  colorScheme: "dark" | "light";
}

export const THEMES: ThemeDefinition[] = [
  {
    id: "midnight",
    label: "Midnight",
    description: "Deep navy with blue accents — the default look.",
    colorScheme: "dark",
  },
  {
    id: "ocean",
    label: "Ocean",
    description: "Cool teal tones inspired by market depth charts.",
    colorScheme: "dark",
  },
  {
    id: "terminal",
    label: "Terminal",
    description: "High-contrast green-on-black trading terminal.",
    colorScheme: "dark",
  },
  {
    id: "slate",
    label: "Slate",
    description: "Muted charcoal with soft violet highlights.",
    colorScheme: "dark",
  },
  {
    id: "paper",
    label: "Paper",
    description: "Warm light mode for daytime reading.",
    colorScheme: "light",
  },
];

export const THEME_IDS = THEMES.map((theme) => theme.id);

export const THEME_COLOR_SCHEMES: Record<ThemeId, "dark" | "light"> = {
  midnight: "dark",
  ocean: "dark",
  terminal: "dark",
  slate: "dark",
  paper: "light",
};

export const DEFAULT_THEME_ID: ThemeId = "midnight";

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return THEMES.some((theme) => theme.id === value);
}

export function getThemeDefinition(id: ThemeId): ThemeDefinition {
  return THEMES.find((theme) => theme.id === id) ?? THEMES[0];
}

export function buildThemeBootstrapScript(): string {
  return `
(function () {
  try {
    var key = ${JSON.stringify(THEME_STORAGE_KEY)};
    var fallback = ${JSON.stringify(DEFAULT_THEME_ID)};
    var allowed = ${JSON.stringify(THEME_IDS)};
    var schemes = ${JSON.stringify(THEME_COLOR_SCHEMES)};
    var stored = localStorage.getItem(key);
    var theme = allowed.indexOf(stored) !== -1 ? stored : fallback;
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = schemes[theme] || "dark";
  } catch (e) {}
})();
`.trim();
}
