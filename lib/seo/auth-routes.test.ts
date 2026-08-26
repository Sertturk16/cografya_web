import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { AUTH_PATHNAMES, AUTH_SURFACE, buildAuthMetadata } from "@/lib/auth/auth-metadata";
import { indexableLocales } from "./indexing";
import { sitemapEntriesFor } from "./sitemap-entries";

/**
 * G1 (plan §9, `Owner's Inbox/uyelik-ve-giris-yol-haritasi/UYELIK-04-web-plan.md`): every
 * auth route is de-indexed, out of the sitemap and out of every hreflang cluster.
 *
 * `metadata.test.ts` / `sitemap-entries.test.ts` already prove the `"noindex"` POLICY
 * itself against a real route (`NOINDEX_ROUTE`, plan §3.5) — this file does not re-prove
 * the policy; it proves the auth pages actually REACH it.
 */

function fileSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

/**
 * DERIVED from `AUTH_PATHNAMES`, not hand-maintained (review `TEST85-M1`/`C3`; plan header
 * item 5, `Owner's Inbox/uyelik-ve-giris-yol-haritasi/UYELIK-04-web-plan.md`). This mapping
 * is exact, not a heuristic: `i18n/routing.ts`'s own rule is "the App Router directory is
 * the TR (key) path in every case" (plan §4.1), so `/kayit` → `app/[locale]/kayit/page.tsx`
 * always holds. A hand list silently stopped covering a new auth route the moment one
 * shipped without a matching edit here — this can no longer happen: an entry added to
 * `AUTH_PATHNAMES` produces its own scan target automatically.
 */
const AUTH_PAGE_FILES = AUTH_PATHNAMES.map((pathname) => `../../app/[locale]${pathname}/page.tsx`);

describe("AUTH_PATHNAMES", () => {
  it("is non-empty", () => {
    expect(AUTH_PATHNAMES.length).toBeGreaterThan(0);
  });

  it.each(AUTH_PATHNAMES)("%s is a real routing.pathnames key", (pathname) => {
    expect(Object.keys(routing.pathnames)).toContain(pathname);
  });
});

describe("buildAuthMetadata — de-indexing mechanism", () => {
  it("AUTH_SURFACE keeps every locale out of the index", () => {
    expect(indexableLocales(AUTH_SURFACE)).toEqual([]);
  });

  for (const locale of routing.locales) {
    it.each(AUTH_PATHNAMES)(
      `emits noindex,follow, self-canonical, no languages — %s (${locale})`,
      (pathname) => {
        const meta = buildAuthMetadata({
          locale,
          pathname,
          title: "Fixture title",
          description: "Fixture description",
        });
        expect(meta.robots).toEqual({ index: false, follow: true });
        // The expected canonical is COMPUTED through the same `getPathname` call
        // `buildAlternates` itself uses (the `metadata.test.ts` pattern) — never the raw
        // `pathname` key literal, which is the TR/canonical side of the pair and is NOT
        // the correct `en` URL (e.g. the key `/giris` resolves to `/en/login` under `en`).
        expect(meta.alternates?.canonical).toBe(getPathname({ locale, href: pathname }));
        expect(meta.alternates?.languages).toBeUndefined();
      },
    );
  }
});

describe("sitemapEntriesFor(AUTH_SURFACE) — never produces a sitemap entry", () => {
  it.each(AUTH_PATHNAMES)("%s", (pathname) => {
    const entries = sitemapEntriesFor(() => pathname, new Date(), 0.1, AUTH_SURFACE);
    expect(entries).toEqual([]);
  });
});

describe("app/sitemap.ts never lists an auth pathname", () => {
  const sitemapSource = fileSource("../../app/sitemap.ts");

  it("positive control — the source is a real, non-trivial read", () => {
    // The same file DOES enumerate other real pathnames, so an empty match on the auth
    // pathnames below is proof of absence rather than proof of a broken read.
    expect(sitemapSource).toMatch(/turkiye/);
  });

  it.each(AUTH_PATHNAMES)("does not mention %s", (pathname) => {
    expect(sitemapSource).not.toContain(pathname);
  });
});

describe("every auth page calls buildAuthMetadata, never buildMetadata directly", () => {
  it("AUTH_PAGE_FILES has one entry per AUTH_PATHNAMES — the derivation actually ran", () => {
    expect(AUTH_PAGE_FILES).toHaveLength(AUTH_PATHNAMES.length);
  });

  it.each(AUTH_PAGE_FILES)("%s", (relativePath) => {
    const source = fileSource(relativePath);
    expect(source).toMatch(/buildAuthMetadata\(/);
    // A bare `buildMetadata(` call would bypass AUTH_SURFACE entirely. The negative
    // lookbehind excludes the `buildAuthMetadata(` occurrence itself (the char sequence
    // immediately before a genuine bypass's `buildMetadata(` is never "Auth").
    expect(source).not.toMatch(/(?<!Auth)buildMetadata\(/);
  });
});
