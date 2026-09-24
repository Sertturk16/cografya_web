import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  label,
  repoRoot,
  sourceOf,
  surfaceFiles,
  walkLoadingFiles,
  walkPages,
} from "@/lib/test-support/composition-scan";

/**
 * T-037's three pins. `sourceOf` strips comments, so a docblock quoting `await getX(` or
 * `animate-pulse` cannot answer for the code.
 *
 * Ruling A (task-14-addendum.md): a rendered `loading.tsx` commits the response to 200 the moment
 * it renders, so a route whose page decides `notFound()` or `redirect()` before its first return
 * must never carry one — a later 404/307 would only ever reach the reader as a `<meta>` tag. Only
 * `force-dynamic` routes that commit no such status are owed a loading file.
 */

/** Routes that are `force-dynamic` and decide neither `notFound()` nor `redirect()`. */
const ROUTES_OWED_A_LOADING_FILE = [
  "app/[locale]/(site)/turkiye/page.tsx",
  "app/[locale]/(site)/dunya/page.tsx",
  "app/[locale]/(site)/kayit/page.tsx",
] as const;

function defaultExportBody(source: string): string {
  const start = source.indexOf("export default async function");
  if (start === -1) return "";
  const match = /return\s*[(<]/.exec(source.slice(start));
  return match === null ? source.slice(start) : source.slice(start, start + match.index);
}

/** force-dynamic, AND the default export neither calls notFound() nor redirect() before its first return. */
function isOwedALoadingFile(page: string): boolean {
  const source = sourceOf(page);
  if (!/export const dynamic = "force-dynamic"/.test(source)) return false;
  const body = defaultExportBody(source);
  return !/\bnotFound\(\)/.test(body) && !/\bredirect\(/.test(body);
}

/** A route whose page commits a status before its first return must NOT carry a loading.tsx. */
function mustNotHaveLoadingFile(page: string): boolean {
  const body = defaultExportBody(sourceOf(page));
  return /\bnotFound\(\)/.test(body) || /\bredirect\(/.test(body);
}

describe("loading.tsx coverage", () => {
  it("every force-dynamic route that commits no 404/redirect before its first return has a loading.tsx", () => {
    const missing = walkPages()
      .filter(isOwedALoadingFile)
      .filter((page) => !existsSync(join(dirname(page), "loading.tsx")))
      .map(label);
    expect(missing).toEqual([]);
  });

  it("the owed population is exactly the three routes the spec names", () => {
    const owed = walkPages().filter(isOwedALoadingFile).map(label).sort();
    expect(owed).toEqual([...ROUTES_OWED_A_LOADING_FILE].sort());
  });

  it("no other route carries a loading.tsx — a full-page skeleton on a static route is a flash, not a state", () => {
    const extra = walkLoadingFiles()
      .map((file) => join(dirname(file), "page.tsx"))
      .filter((page) => !isOwedALoadingFile(page))
      .map(label);
    expect(extra).toEqual([]);
  });

  it("no route that decides a 404 or a redirect before its first return carries a loading.tsx", () => {
    const offenders = walkLoadingFiles()
      .map((file) => join(dirname(file), "page.tsx"))
      .filter(mustNotHaveLoadingFile)
      .map(label);
    expect(offenders).toEqual([]);
  });

  it("the predicate sees a real force-dynamic route and a real 404/redirect hazard — anti-vacuity", () => {
    expect(isOwedALoadingFile(join(repoRoot, "app/[locale]/(site)/turkiye/page.tsx"))).toBe(true);
    // force-dynamic, but redirects an unauthenticated reader before its first return.
    expect(isOwedALoadingFile(join(repoRoot, "app/[locale]/(site)/hesabim/page.tsx"))).toBe(false);
    expect(
      mustNotHaveLoadingFile(join(repoRoot, "app/[locale]/(site)/turkiye/[slug]/page.tsx")),
    ).toBe(true);
  });
});

describe("every loading.tsx is one PageSkeleton", () => {
  it("imports and renders PageSkeleton and nothing else", () => {
    for (const file of walkLoadingFiles()) {
      const source = sourceOf(file);
      expect(source, label(file)).toMatch(
        /import \{ PageSkeleton \} from "@\/components\/patterns\/page-skeleton"/,
      );
      expect(source, label(file)).toMatch(
        /return <PageSkeleton shape="(hub|auth|play)"( plate="(map|continent|game|turkey|world)")? \/>;/,
      );
      expect(source, label(file)).not.toMatch(/<Skeleton\b|animate-pulse/);
    }
  });
});

describe("skeleton spellings live in one place", () => {
  it("no page or v2 component renders the Skeleton primitive directly", () => {
    const offenders = surfaceFiles()
      .filter((file) => /<Skeleton\b/.test(sourceOf(file)))
      .map(label);
    expect(offenders).toEqual([]);
  });

  /**
   * Three client components pulse their OWN pending indicators (a ticker value, a map tile, a
   * game overlay) and predate T-037; they are not route skeletons. Pinned by name so a fourth —
   * a page writing its own fallback instead of reaching for `page-skeleton.tsx` — goes red.
   */
  it("animate-pulse outside components/patterns is the measured three", () => {
    const pulsing = surfaceFiles()
      .filter((file) => /animate-pulse/.test(sourceOf(file)))
      .map(label)
      .sort();
    expect(pulsing).toEqual([
      "components/v2/v2-game-screen.tsx",
      "components/v2/v2-live-ticker.tsx",
      "components/v2/v2-marine-map-explorer.tsx",
    ]);
  });
});
