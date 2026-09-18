import type { Locale } from "@/i18n/routing";
import { isIndexable, type ContentSurface } from "@/lib/seo/indexing";
import { breadcrumbJsonLd, type JsonLdSchema, JsonLd } from "@/lib/seo/json-ld";
import { BreadcrumbsNav, type BreadcrumbTrailItem } from "@/components/patterns/breadcrumbs-nav";

// Re-exported so every existing import of `BreadcrumbTrailItem` from THIS path — all 29
// server `page.tsx` call sites, unchanged by this split — keeps resolving. The type itself now
// lives in `breadcrumbs-nav.tsx` (see that file's docblock for why this is two files, not two
// exports in one); this is a type-only re-export, so it adds no runtime import and cannot pull
// `breadcrumbs-nav.tsx`'s module into anything that only ever imports the type.
export type { BreadcrumbTrailItem };

interface BreadcrumbsProps {
  items: readonly BreadcrumbTrailItem[];
  locale: Locale;
  surface: ContentSurface;
}

/**
 * SERVER COMPONENT. `BreadcrumbsNav` (`components/patterns/breadcrumbs-nav.tsx`) plus the
 * BreadcrumbList JSON-LD that matches it, from ONE array — the same guarantee the original
 * unsplit `Breadcrumbs` made, kept exactly: this is still the public API every server page
 * imports, unchanged (verified against all 29 `page.tsx` call sites when this split landed —
 * none needed an edit).
 *
 * This file imports `lib/seo/json-ld` (`server-only`) and `lib/seo/indexing`, so it can ONLY be
 * rendered from a Server Component — see `breadcrumbs-nav.tsx`'s docblock for why that module
 * lives apart from this one rather than merely being a second export here (the first attempt at
 * that shape still failed `pnpm build` identically, because Turbopack's Client/Server boundary
 * check is per FILE, not per export).
 *
 * Measured before either component existed: 27 files hand-wrote `<nav aria-label="Breadcrumb">`
 * as a row of spans, and `aria-current` occurred zero times across the whole product surface —
 * 28 pages rendered a trail and never told assistive technology which crumb was the current
 * page. Separately, 31 files rendered a visible trail and 11 emitted `breadcrumbJsonLd`, so 24
 * showed a path to the reader and nothing to a crawler.
 *
 * Both gaps have the same cause: the markup and the structured data were two independent
 * pieces of work, and the second one was optional in practice. Here they are one argument —
 * for every caller that CAN take the JSON-LD. `BreadcrumbsNav` exists for the callers that
 * cannot: it is not a fallback or a lesser component, it is the half of this one a Client
 * Component is structurally permitted to render.
 *
 * The indexability gate is COMPUTED from the surface rather than passed as a boolean. A
 * per-page flag is precisely what produced the 24-file gap, and it would reproduce it the
 * first time someone added a page and left the prop off.
 *
 * `surface` is hand-typed twice on most callers — once here (or in {@link breadcrumbListSchema}
 * below), once in that same page's `buildMetadata({ surface })`. There are **33** such pairs: 29
 * `<Breadcrumbs surface={…}>` props and 4 `breadcrumbListSchema` third arguments, across the 34
 * `(site)` pages, every one of them but the home page. This docblock used to say 37 and that the
 * pairs "were checked by hand" — 37 is the PAGE count, three of which are `(play)` screens whose
 * trail comes from `V2GameScreen` and takes no surface.
 *
 * `lib/seo/sitemap-surface-symmetry.test.ts` now reads both sides of every pair, resolves a
 * constant through the binding resolver rather than comparing its name, and pins both figures —
 * so the agreement is asserted rather than remembered. `app/[locale]/(site)/araclar/**` and the
 * seven auth pages avoid the duplication outright, each importing one shared constant at both
 * call sites (`TOOLS_SURFACE` in `lib/tools/tool-registry.ts`, `AUTH_SURFACE` in
 * `lib/auth/auth-metadata.ts`) — the pattern to reach for on a page that still types it twice.
 */
export function Breadcrumbs({ items, locale, surface }: BreadcrumbsProps) {
  const schema = breadcrumbListSchema(items, locale, surface);
  return (
    <>
      {/* `schema[0]`, not the array: keeps the rendered JSON-LD a single object, byte-identical
          to what this component emitted before `breadcrumbListSchema` existed. The array shape
          exists for the four `deniz/{akdeniz,ege,karadeniz,marmara}` callers below, which splice
          it into a larger `JsonLd` array alongside other schemas. */}
      {schema[0] && <JsonLd schema={schema[0]} />}
      <BreadcrumbsNav items={items} />
    </>
  );
}

/**
 * The gate `Breadcrumbs` applies internally, extracted so a Client Component that cannot render
 * `Breadcrumbs` itself (it imports `lib/seo/json-ld`, `server-only`) can still get the IDENTICAL
 * gated schema from its own server `page.tsx`.
 *
 * Closes a real drift, not a hypothetical one: `deniz/{akdeniz,ege,karadeniz,marmara}/page.tsx`
 * each reimplemented this exact gate by hand — `isIndexable(locale, "trOnly") ? [breadcrumbJsonLd(
 * items.map(...))] : []` — with `"trOnly"` typed a third time (`buildMetadata({ surface })` is
 * the second) alongside the mapping and the gate that `Breadcrumbs` already owns. Changing the
 * mapping or the gate here would not have reached those four copies. Now there is one
 * implementation and four callers, plus this component itself as the fifth: the four page files
 * import this function instead of `isIndexable` and `breadcrumbJsonLd` directly.
 *
 * Returns an ARRAY — `[schema]` when indexable, `[]` when not — so a caller building a larger
 * `JsonLd` array (the four `deniz/*` pages, which also emit `LearningResource` and `FAQPage`
 * schemas on the same page) can splice it straight in with `...breadcrumbListSchema(...)`
 * rather than re-deriving the `? [x] : []` shape itself.
 */
export function breadcrumbListSchema(
  items: readonly BreadcrumbTrailItem[],
  locale: Locale,
  surface: ContentSurface,
): JsonLdSchema[] {
  return isIndexable(locale, surface)
    ? [
        // `item.icon` never reaches this call: the mapped object is built from exactly
        // `{ name, path }`, so a decorative ReactNode has no path into `breadcrumbJsonLd` — it
        // has no business near structured data, which `breadcrumbJsonLd`'s own signature
        // (`{ name, path }`) already enforces without this function doing anything extra.
        breadcrumbJsonLd(items.map((item) => ({ name: item.label, path: item.path }))),
      ]
    : [];
}
