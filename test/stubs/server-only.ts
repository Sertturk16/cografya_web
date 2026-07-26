/**
 * Test-only stand-in for the `server-only` marker package.
 *
 * `server-only`'s default entry point throws on import BY DESIGN: it is a build-time
 * tripwire that turns "a client module imported a server module" into a bundler error. The
 * package itself ships an EMPTY module for the `react-server` export condition (see
 * `node_modules/server-only/empty.js`), which is what Next resolves when it compiles a
 * Server Component. Vitest is not a bundler and sets no `react-server` condition, so
 * without this alias a unit test could never import `lib/env.server.ts` — the module whose
 * validation we most need to pin (`vitest.config.ts` maps the specifier here).
 *
 * This does NOT weaken the shipped guard: `vitest.config.ts` is not used by `next build`,
 * so the real tripwire still fires in the app bundle. `lib/env.server.test.ts` additionally
 * asserts that the `import "server-only"` line is still present in the source, so removing
 * the guard fails CI rather than silently passing under this stub.
 */
export {};
