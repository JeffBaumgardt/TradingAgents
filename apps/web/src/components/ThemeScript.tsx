/**
 * @file apps/web/src/components/ThemeScript.tsx
 * Inline script to apply stored theme before paint and avoid flash.
 */

import { buildThemeBootstrapScript } from "@/lib/themes";

export default function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: buildThemeBootstrapScript() }} />;
}
