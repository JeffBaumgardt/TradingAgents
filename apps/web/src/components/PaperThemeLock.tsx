/**
 * @file apps/web/src/components/PaperThemeLock.tsx
 * Forces the paper theme on marketing pages before user settings are available.
 */

"use client";

import { useEffect, type ReactNode } from "react";
import { DEFAULT_THEME_ID, getThemeDefinition } from "@/lib/themes";
import { applyThemeToDocument } from "@/lib/theme-store";

interface PaperThemeLockProps {
  children: ReactNode;
}

export default function PaperThemeLock({ children }: PaperThemeLockProps) {
  useEffect(() => {
    const theme = getThemeDefinition(DEFAULT_THEME_ID);
    applyThemeToDocument(DEFAULT_THEME_ID);
    document.documentElement.style.colorScheme = theme.colorScheme;
  }, []);

  return children;
}
