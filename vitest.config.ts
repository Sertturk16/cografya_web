import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Minimal vitest setup for the web repo's unit tests: the `/dunya` zoom/pan pure geometry
 * (SPEC §8 test plan), the SEO policy layer (`lib/seo/*` — indexing, metadata and
 * sitemap-entry contracts) and the boot-time env validation (`lib/env.server.ts`). Node
 * environment: all of it is DOM-free logic, so no jsdom is pulled in. The `@/…` alias
 * mirrors tsconfig's path mapping so tests can use the same import style as app code.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      // `server-only`'s default entry THROWS on import (that is the whole point of the
      // package). Next resolves its `react-server` condition to an empty module when it
      // compiles a Server Component; vitest sets no such condition, so server modules —
      // `lib/env.server.ts`, i.e. the boot-time env validation — would be untestable. This
      // maps the specifier to an equally empty stub. It cannot weaken the shipped guard:
      // this config is not used by `next build`. See `test/stubs/server-only.ts`.
      "server-only": fileURLToPath(new URL("./test/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "components/**/*.test.{ts,tsx}"],
    server: {
      deps: {
        // The SEO tests exercise the REAL `getPathname` from `i18n/navigation`, which is
        // the only honest way to assert canonical/hreflang URLs. Reaching it pulls in
        // next-intl's `createNavigation`, whose module also imports `next/navigation` for
        // the client hooks it re-exports (`useRouter`, `usePathname` — imported here, never
        // called). Left externalized, Node resolves that bare specifier itself and fails
        // ("Cannot find module …/next/navigation"), because Next's subpath exports need
        // bundler-style resolution. Inlining hands next-intl to Vite, which honours the
        // exports map. This makes the dependency resolvable — it does not stub or weaken
        // anything: the routing table and path building under test stay entirely real.
        inline: ["next-intl"],
      },
    },
  },
});
