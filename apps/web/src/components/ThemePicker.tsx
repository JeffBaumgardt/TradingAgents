/**
 * @file apps/web/src/components/ThemePicker.tsx
 * Header control for switching visual themes.
 */

"use client";

import { useId } from "react";
import { useTheme } from "@/context/ThemeContext";
import { THEMES } from "@/lib/themes";
import styles from "./ThemePicker.module.css";

export default function ThemePicker() {
  const { themeId, setThemeId } = useTheme();
  const selectId = useId();

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    setThemeId(event.target.value as (typeof THEMES)[number]["id"]);
  }

  return (
    <div className={styles.wrapper}>
      <label className={styles.label} htmlFor={selectId}>
        Theme
      </label>
      <select
        id={selectId}
        className={styles.select}
        value={themeId}
        onChange={handleChange}
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
