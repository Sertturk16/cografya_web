import type { Locale } from "@/i18n/routing";
import { isIndexable, type ContentSurface } from "@/lib/seo/indexing";
import { breadcrumbJsonLd, JsonLd } from "@/lib/seo/json-ld";
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
 */
export function Breadcrumbs({ items, locale, surface }: BreadcrumbsProps) {
  return (
    <>
      {isIndexable(locale, surface) && (
        // `item.icon` never reaches this call: the mapped object is built from exactly
        // `{ name, path }`, so a decorative ReactNode has no path into `breadcrumbJsonLd` — it
        // has no business near structured data, which `breadcrumbJsonLd`'s own signature
        // (`{ name, path }`) already enforces without this component doing anything extra.
        <JsonLd
          schema={breadcrumbJsonLd(items.map((item) => ({ name: item.label, path: item.path })))}
        />
      )}
      <BreadcrumbsNav items={items} />
    </>
  );
}
