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
import type { AppPathname } from "@/i18n/routing";

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

interface BreadcrumbsNavProps {
  items: readonly BreadcrumbTrailItem[];
}

/**
 * The visible `<nav>`, and ONLY the visible nav — a SEPARATE FILE from `breadcrumbs.tsx` on
 * purpose, not just a separate export inside it.
 *
 * ## Why a file, not just an export (the Task 6/7 regression, and the first fix attempt that
 * did not actually work)
 *
 * `components/patterns/breadcrumbs.tsx` used to export a single `Breadcrumbs` that rendered
 * this markup AND the matching JSON-LD from `lib/seo/json-ld`, whose first line is `import
 * "server-only"`. That made the single export unusable from a Client Component — three call
 * sites (`v2-game-screen.tsx`, `v2-sea-basin-detail-view.tsx`, the `/design-system` `duzen.tsx`
 * specimen) rendered it anyway, and `'server-only' cannot be imported from a Client Component
 * module` failed `pnpm build` every time, deterministically, because `pnpm build` was not run
 * during those two tasks.
 *
 * The first fix attempt split `Breadcrumbs` into two EXPORTS in the same file — `BreadcrumbsNav`
 * or here, plus a `Breadcrumbs` wrapping it — and `pnpm build` STILL failed with the identical
 * error. Turbopack's Client/Server boundary check works on the MODULE graph, not on which named
 * export a caller actually uses: a file that imports `lib/seo/json-ld` anywhere in it is
 * "reaches server-only" for every consumer of that file, including one that only ever imports
 * the other export. `v2-sea-basin-detail-view.tsx` importing `BreadcrumbsNav` from a file that
 * ALSO contained `Breadcrumbs`' `import { breadcrumbJsonLd, JsonLd } from "@/lib/seo/json-ld"`
 * still dragged that import into the client module graph. Confirmed by running the build, not
 * assumed — the failure output named the exact same three import traces as before the split.
 *
 * So this component lives in its OWN file, with its OWN import list, and that list contains
 * NOTHING from `lib/seo/json-ld` or `lib/seo/indexing` (a client trail has no `surface` to gate
 * on). `breadcrumbs.tsx`'s `Breadcrumbs` imports THIS file and adds the JSON-LD on top, for the
 * many server call sites; the client call sites import this file directly and never touch
 * `breadcrumbs.tsx` at all — so their module graph never reaches it, or `json-ld.tsx`, or
 * `server-only`, through any path. `components/patterns/rsc-boundary.test.ts` asserts that
 * invariant for every `"use client"` file on the product surface, not just these three.
 */
export function BreadcrumbsNav({ items }: BreadcrumbsNavProps) {
  const last = items.length - 1;

  return (
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
  );
}
