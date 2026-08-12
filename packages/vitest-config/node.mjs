/**
 * Shared Vitest base for Node packages (API, utils, etc.).
 * Plain ESM so Vitest can load this from vitest.config without a build step.
 */

import { defineConfig, mergeConfig } from "vitest/config";

/** Defaults for backend / library packages (no DOM). */
export const nodeVitestBase = defineConfig({
  test: {
    environment: "node",
    // Prefer forks for isolation when tests mutate process.env.
    pool: "forks",
    include: ["src/**/*.{test,spec}.ts"],
    passWithNoTests: false,
  },
});

/** Merge package-specific overrides onto the shared Node base. */
export function createNodeVitestConfig(overrides = {}) {
  return mergeConfig(nodeVitestBase, defineConfig(overrides));
}
