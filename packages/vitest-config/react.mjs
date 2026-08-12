/**
 * Shared Vitest base for React / DOM packages (web).
 * Apps still add framework plugins, path aliases, and setupFiles locally.
 * Plain ESM so Vitest can load this from vitest.config without a build step.
 */

import { defineConfig, mergeConfig } from "vitest/config";

/** Defaults for UI packages using a DOM environment. */
export const reactVitestBase = defineConfig({
  test: {
    environment: "happy-dom",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    passWithNoTests: false,
  },
});

/** Merge package-specific overrides onto the shared React/DOM base. */
export function createReactVitestConfig(overrides = {}) {
  return mergeConfig(reactVitestBase, defineConfig(overrides));
}
