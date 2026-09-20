"use client";

import * as React from "react";
import { useLocale } from "next-intl";
import { getPathname, RawLink, useRawRouter } from "@/i18n/navigation-primitives";
import { guardNavigation } from "@/lib/forms/unsaved-changes";

type RawLinkProps = React.ComponentProps<typeof RawLink>;
type RawRouter = ReturnType<typeof useRawRouter>;

/**
 * `Link` and `useRouter`, with the unsaved-changes guard in front of them (T-062).
 *
 * ## Why the wrap goes here and not at each form
 *
 * The navigation a member actually takes away from a half-filled form is a HEADER link, and the
 * header renders outside the form's tree — so a guard a form installs around its own links never
 * sees it. `i18n/navigation.ts` is already the single door every link in this repo goes through
 * (56 files import from it; nothing imports `next/link` at all), so wrapping there covers every
 * existing call site without touching one of them.
 *
 * ## Why a click handler and not a router event
 *
 * The App Router publishes no "navigation is starting" event to cancel — `next/navigation` has no
 * equivalent of the Pages Router's `routeChangeStart`. The two places a navigation can begin are
 * an anchor click and a `router.push`/`replace` call, so those are the two places wrapped.
 * Browser back/forward is deliberately NOT caught: the only way is to push a synthetic history
 * entry and re-push it on every popstate, which degrades the back button itself for a case the
 * `beforeunload` warning does not cover either.
 *
 * ## What gets stored is a resolved path
 *
 * The store holds no callbacks (see `lib/forms/unsaved-changes.ts`), so what survives the dialog
 * is `event.currentTarget.href` reduced to a root-relative path — already locale-prefixed by
 * next-intl's own `href` resolution, which is exactly why the dialog pushes it with the raw
 * router. Re-resolving it through next-intl's router would prefix it twice.
 */

/** Same-origin, root-relative form of an anchor's resolved `href`, or `null` if it is external. */
export function samePagePathOf(href: string, origin: string): string | null {
  try {
    const url = new URL(href, origin);
    if (url.origin !== origin) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function Link({ onClick, ...props }: RawLinkProps) {
  const handleClick = React.useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event);
      if (event.defaultPrevented) return;

      // Let the browser have the clicks that are not in-app navigations at all: a new tab, a
      // download, a modified click. Guarding those would pop a dialog for a navigation that
      // never leaves this page.
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        (props.target !== undefined && props.target !== "_self")
      ) {
        return;
      }

      const path = samePagePathOf(event.currentTarget.href, window.location.origin);
      // An external link leaves the site entirely, which is `beforeunload`'s job, not ours.
      if (path === null) return;

      if (!guardNavigation(path)) event.preventDefault();
    },
    [onClick, props.target],
  );

  return <RawLink {...props} onClick={handleClick} />;
}

/**
 * The same guard for programmatic navigation. `push` and `replace` are wrapped; `back`,
 * `forward`, `refresh` and `prefetch` pass through untouched — `refresh` in particular is what
 * the settings cards call after a successful save, and it is not a navigation away from anything.
 */
export function useRouter(): RawRouter {
  const router = useRawRouter();
  const locale = useLocale();

  return React.useMemo(() => {
    // The store parks a PATH, never a callback or an href object, so a typed object href is
    // resolved here through the same function that builds hreflang alternates. Resolving before
    // the guard is what lets the dialog re-issue the navigation from a plain string; the original
    // `href` is what gets pushed when the guard passes, so next-intl behaves exactly as before.
    const resolve = (href: Parameters<RawRouter["push"]>[0]) =>
      getPathname({ locale: locale as Parameters<typeof getPathname>[0]["locale"], href });

    const guardedPush: RawRouter["push"] = (href, options) => {
      if (!guardNavigation(resolve(href))) return;
      router.push(href, options);
    };

    const guardedReplace: RawRouter["replace"] = (href, options) => {
      if (!guardNavigation(resolve(href))) return;
      router.replace(href, options);
    };

    return { ...router, push: guardedPush, replace: guardedReplace };
  }, [router, locale]);
}
