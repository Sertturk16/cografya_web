import { describe, expect, it } from "vitest";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

/**
 * THE TWO BOOK ROUTES RESOLVE TO THESE URLS, LITERALLY (→ PR #61 review `CODE61-M5`).
 *
 * The two `pathnames` entries W0 added were the only new production behaviour no test
 * touched, and everything crawl-facing about the book tier derives from them: the canonical,
 * the hreflang cluster, the sitemap `<url>`, the breadcrumb, the nav link and every internal
 * link are built by passing these pathnames through `getPathname`. A wrong table is not a
 * wrong link — it is the same wrong link everywhere at once, and changing a published URL
 * later owes a redirect.
 *
 * WHY A LITERAL AND NOT A DERIVATION, which is the opposite of what most tests in this
 * directory do. The policy tests (`metadata.test.ts`, `sitemap-entries.test.ts`) recompute
 * their expectations from `getPathname` using the same expression the implementation uses,
 * because what they assert is a RELATIONSHIP between two surfaces. That shape cannot see a
 * broken table: the validator proved it during the W0 review by deleting the localized EN
 * segment and watching every structural assertion stay green. The only guard that fails
 * under that defect is one that names the string.
 *
 * WHAT THIS DOES NOT COVER, said plainly so nobody reads more coverage into it than exists:
 * `/en/about`, `/en/sea` and `/en/game` have the same gap and are NOT guarded here. That is
 * pre-existing, it is Atlas's to schedule, and widening this file to cover it was outside
 * this PR's scope — a row added here for those three would be the fix, not a bigger table.
 */

const ROUTE_URLS: ReadonlyArray<{
  readonly label: string;
  readonly locale: Locale;
  readonly href: Parameters<typeof getPathname>[0]["href"];
  readonly url: string;
}> = [
  { label: "TR hub", locale: "tr", href: "/kitaplar", url: "/kitaplar" },
  // The href is the SOURCE pathname in both rows — that is how next-intl's table works, and
  // it is the point: the EN URL below is produced by the routing config, never written by a
  // caller.
  { label: "EN hub", locale: "en", href: "/kitaplar", url: "/en/books" },
  {
    label: "TR detail",
    locale: "tr",
    href: { pathname: "/kitaplar/[slug]", params: { slug: "fixture-book-tr" } },
    url: "/kitaplar/fixture-book-tr",
  },
  {
    label: "EN detail",
    locale: "en",
    href: { pathname: "/kitaplar/[slug]", params: { slug: "fixture-book-en" } },
    url: "/en/books/fixture-book-en",
  },
];

describe("book route table", () => {
  it.each(ROUTE_URLS.map((route) => [route.label, route] as const))(
    "resolves the %s to its published URL",
    (_label, route) => {
      expect(getPathname({ locale: route.locale, href: route.href })).toBe(route.url);
    },
  );

  it("keeps the localized EN segment, which is the half a structural test cannot see", () => {
    // `/kitaplar` ↔ `/books`, on the `/hakkimizda ↔ /en/about` and `/deniz ↔ /en/sea`
    // precedent rather than the untranslated `/turkiye`/`/dunya` one: "kitaplar" does not
    // read as English. Drop the localized entry and next-intl falls back to the source
    // segment, producing `/en/kitaplar` — still a valid, symmetric, one-URL-per-locale
    // result, which is exactly why nothing else fails.
    expect(getPathname({ locale: "en", href: "/kitaplar" })).not.toContain("/kitaplar");
  });

  it("carries the slug it is given per locale, deriving neither from the other", () => {
    // `SEO-POLICY.md` §B4 4.5 (BLOCKER). Today's only book holds the same string in both
    // columns — a consequence of a product name not being translated, not a rule — so the
    // two values here differ deliberately: a consumer that returned `slugTr` for both
    // locales would be invisible against real data and fails here.
    const tr = getPathname({
      locale: "tr",
      href: { pathname: "/kitaplar/[slug]", params: { slug: "kitap-tr" } },
    });
    const en = getPathname({
      locale: "en",
      href: { pathname: "/kitaplar/[slug]", params: { slug: "kitap-en" } },
    });

    expect(tr).toBe("/kitaplar/kitap-tr");
    expect(en).toBe("/en/books/kitap-en");
  });
});
