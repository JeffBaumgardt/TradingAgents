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

export const DEFAULT_THEME_ID: ThemeId = "midnight";

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return THEMES.some((theme) => theme.id === value);
}

export function getThemeDefinition(id: ThemeId): ThemeDefinition {
  return THEMES.find((theme) => theme.id === id) ?? THEMES[0];
}
