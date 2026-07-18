import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Minimal vitest setup for the web repo's unit tests: the `/dunya` zoom/pan pure geometry
 * (SPEC §8 test plan) and the SEO policy layer (`lib/seo/*` — indexing, metadata and
 * sitemap-entry contracts). Node environment: all of it is DOM-free logic, so no jsdom is
 * pulled in. The `@/…` alias mirrors tsconfig's path mapping so tests can use the same
 * import style as app code.
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
