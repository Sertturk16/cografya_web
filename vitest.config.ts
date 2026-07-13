import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Minimal vitest setup for the web repo's first unit tests (the `/dunya` zoom/pan pure
 * geometry — SPEC §8 test plan). Node environment: the tested logic is DOM-free math, so
 * no jsdom is pulled in. The `@/…` alias mirrors tsconfig's path mapping so tests can use
 * the same import style as app code.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "components/**/*.test.{ts,tsx}"],
  },
});
