import type * as RoutingModule from "@/i18n/routing";

/**
 * `i18n/routing.ts` as it would be with `ENGLISH_ENABLED` set to `englishEnabled` (T-105).
 *
 * The switch is a module constant and `routing.locales` is computed from it at load, so a test
 * cannot flip it at run time. What it can do is mock the module, which is what this builds:
 *
 * ```ts
 * vi.mock("@/i18n/routing", async (importOriginal) => {
 *   const { routingWithEnglish } = await import("@/lib/test-support/english-switch");
 *   return routingWithEnglish(await importOriginal(), true);
 * });
 * ```
 *
 * Everything that reads `routing` — `getPathname`, `buildAlternates`, the sitemap builders,
 * `proxy.ts` — then sees that position, so each switch position is tested against the real
 * code rather than a re-implementation of it.
 */
export function routingWithEnglish(
  actual: typeof RoutingModule,
  englishEnabled: boolean,
): typeof RoutingModule {
  return {
    ...actual,
    ENGLISH_ENABLED: englishEnabled,
    routing: {
      ...actual.routing,
      locales: englishEnabled ? actual.ALL_LOCALES : ["tr"],
    },
  };
}
