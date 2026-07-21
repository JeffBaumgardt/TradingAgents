/**
 * @file apps/web/src/components/ThemePicker.tsx
 * Control for switching visual themes (header inline or Clerk settings panel).
 */

"use client";

import { useId } from "react";
import { useTheme } from "@/context/ThemeContext";
import { THEMES } from "@/lib/themes";
import styles from "./ThemePicker.module.css";

interface ThemePickerProps {
  /** `inline` for compact chrome; `panel` for Clerk account settings. */
  variant?: "inline" | "panel";
}

export default function ThemePicker({ variant = "inline" }: ThemePickerProps) {
  const { themeId, setThemeId } = useTheme();
  const selectId = useId();

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    setThemeId(event.target.value as (typeof THEMES)[number]["id"]);
  }

  return (
    <div className={variant === "panel" ? styles.panelControl : styles.wrapper}>
      <label className={styles.label} htmlFor={selectId}>
        Theme
      </label>
      <select
        id={selectId}
        className={variant === "panel" ? styles.panelSelect : styles.select}
        value={themeId}
        onChange={handleChange}
        aria-label="Color theme"
        suppressHydrationWarning
      >
        {THEMES.map((theme) => (
          <option key={theme.id} value={theme.id} title={theme.description}>
            {theme.label}
          </option>
        ))}
      </select>
    </div>
  );
}
