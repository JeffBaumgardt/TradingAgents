/**
 * @file apps/web/vitest.config.mts
 * Vitest config for the Next.js web app (happy-dom + React plugin).
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { createReactVitestConfig } from "@tradingagents/vitest-config/react";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default createReactVitestConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "./src"),
    },
  },
  test: {
    setupFiles: ["./src/test/setup.ts"],
  },
});
