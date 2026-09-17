import { Fragment, type ComponentProps, type ReactNode } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Link } from "@/i18n/navigation";
import type { AppPathname, Locale } from "@/i18n/routing";
import { isIndexable, type ContentSurface } from "@/lib/seo/indexing";
import { breadcrumbJsonLd, JsonLd } from "@/lib/seo/json-ld";

export interface BreadcrumbTrailItem {
  label: string;
  /** Omitted on the last item — the page you are already on is not a link. */
  href?: AppPathname;
  /** Root-relative path for the structured data. Required on the last item, which has no href. */
  path: string;
  /**
   * Optional leading icon (e.g. `<Home className="size-3.5" />` on the first crumb) — the
   * owner ruling on `Card`/`Typography.H1` again: the site's existing markup wins and the
   * primitive adapts. Left optional with no default: most crumbs carry none, and giving every
   * item an icon slot would render an empty one on those.
   *
   * The component, not the caller, makes it `aria-hidden` — wrapped in the same
   * `role="presentation"` + `aria-hidden="true"` shape `BreadcrumbSeparator` already uses
   * (`components/ui/breadcrumb.tsx:74-75`) for its own decorative chevron. Undoing that at
   * every call site would ask 31 surfaces to each remember it; a screen reader that is not
   * told would announce the icon and then the label — the same information twice, on the
   * component whose whole purpose is closing an accessibility gap, not opening a new one.
   */
  icon?: ReactNode;
}

interface BreadcrumbsProps {
  items: readonly BreadcrumbTrailItem[];
  locale: Locale;
  surface: ContentSurface;
}

/**
 * The trail, and the BreadcrumbList that describes it, from ONE array.
 *
 * Measured before this existed: 27 files hand-wrote `<nav aria-label="Breadcrumb">` as a row
 * of spans, and `aria-current` occurred zero times across the whole product surface — 28
 * pages rendered a trail and never told assistive technology which crumb was the current
 * page. Separately, 31 files rendered a visible trail and 11 emitted `breadcrumbJsonLd`, so
 * 24 showed a path to the reader and nothing to a crawler.
 *
 * Both gaps have the same cause: the markup and the structured data were two independent
 * pieces of work, and the second one was optional in practice. Here they are one argument.
 *
 * The indexability gate is COMPUTED from the surface rather than passed as a boolean. A
 * per-page flag is precisely what produced the 24-file gap, and it would reproduce it the
 * first time someone added a page and left the prop off.
 */
export function Breadcrumbs({ items, locale, surface }: BreadcrumbsProps) {
  const last = items.length - 1;

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
      <Breadcrumb>
        <BreadcrumbList className="text-xs">
          {items.map((item, index) => {
            // Decorative only, never announced on its own — see the `icon` field's own
            // docblock above for why the wrapping (not the caller) owns `aria-hidden`.
            const icon = item.icon && (
              <span role="presentation" aria-hidden="true" className="inline-flex">
                {item.icon}
              </span>
            );
            return (
              <Fragment key={item.path}>
                <BreadcrumbItem>
                  {index === last ? (
                    <BreadcrumbPage className="inline-flex items-center gap-1 font-semibold">
                      {icon}
                      {item.label}
                    </BreadcrumbPage>
                  ) : item.href === undefined ? (
                    // A non-last item with no `href`: there is nothing to link it to, but it is
                    // also not the page you are on, so it may not render as `BreadcrumbPage`
                    // either — that primitive is the one thing in this tree that emits
                    // `aria-current="page"`, and reserving it for `index === last` above is what
                    // keeps a gap earlier in the trail from producing a SECOND "current page".
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      {icon}
                      {item.label}
                    </span>
                  ) : (
                    // `render` is Base UI's slot: the primitive's styling merges onto next-intl's
                    // `Link` instead of wrapping it in a second anchor. `AppPathname` also
                    // includes dynamic routes (`"/turkiye/[slug]"`), which `Link`'s typed `href`
                    // only accepts paired with a `params` object — a plain crumb href is always
                    // a concrete, already-interpolated path, so the cast is CLAUDE.md's
                    // sanctioned escape for a typed `Link` rejecting a computed href, not `as any`.
                    <BreadcrumbLink
                      className="inline-flex items-center gap-1"
                      render={
                        <Link
                          href={item.href as unknown as ComponentProps<typeof Link>["href"]}
                          prefetch={false}
                        />
                      }
                    >
                      {icon}
                      {item.label}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {index !== last && <BreadcrumbSeparator />}
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </>
  );
}
