/**
 * @file apps/web/src/components/ThemeScript.tsx
 * Inline script to apply stored theme before paint and avoid flash.
 */

import { DEFAULT_THEME_ID, THEME_STORAGE_KEY } from "@/lib/themes";

const THEME_SCRIPT = `
(function () {
  try {
    var key = ${JSON.stringify(THEME_STORAGE_KEY)};
    var fallback = ${JSON.stringify(DEFAULT_THEME_ID)};
    var allowed = ["midnight", "ocean", "terminal", "slate", "paper"];
    var stored = localStorage.getItem(key);
    var theme = allowed.indexOf(stored) !== -1 ? stored : fallback;
    document.documentElement.dataset.theme = theme;
    var schemes = { midnight: "dark", ocean: "dark", terminal: "dark", slate: "dark", paper: "light" };
    document.documentElement.style.colorScheme = schemes[theme] || "dark";
  } catch (e) {}
})();
`;

export default function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />;
}
