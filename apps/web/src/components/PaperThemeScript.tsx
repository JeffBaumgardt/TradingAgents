/**
 * @file apps/web/src/components/PaperThemeScript.tsx
 * Inline script to force the paper theme before paint on marketing pages.
 */

import { DEFAULT_THEME_ID, getThemeDefinition } from "@/lib/themes";

export default function PaperThemeScript() {
  const theme = getThemeDefinition(DEFAULT_THEME_ID);
  const script = `(function(){try{document.documentElement.dataset.theme="${DEFAULT_THEME_ID}";document.documentElement.style.colorScheme="${theme.colorScheme}";}catch(e){}})();`;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
