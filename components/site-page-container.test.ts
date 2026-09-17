import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * EVERY `(site)` ROUTE FILE CARRIES ITS OWN LAYOUT CONTAINER.
 *
 * ## The regression this exists to prevent
 *
 * T-032 PR3 centralised the page chrome: `<main id="main-content">` moved out of 24 page files
 * and into `app/[locale]/(site)/layout.tsx`. The landmark travelled. The container did not —
 * those pages had spelled `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 …` on the very `<main>`
 * element they were losing, and `app/globals.css` gives `main { flex: 1 0 auto }` and nothing
 * else: no max-width, no horizontal padding, no vertical rhythm.
 *
 * Thirteen reading pages then shipped for the length of a release rendering their content flush
 * to the viewport edge at every width. On `/deniz` the first child after the ticker was a bare
 * `<div className="space-y-4">`, so a `rounded-3xl border` hero card sat with its border against
 * the screen. Nothing failed. `tsc` cannot see a missing class, eslint has no opinion about one,
 * every existing test stayed green, and the pages still built and rendered — which is precisely
 * why it needed a test and did not have one.
 *
 * The failure mode generalises past that one commit: a container is a class string on a `<div>`
 * nobody re-reads, it is invisible to every static check this repo runs, and the rendered result
 * (text against the edge of a phone) is the kind of thing that reads as "unstyled" rather than
 * "broken" and gets lived with.
 *
 * ## What this test can prove, and what it cannot
 *
 * It reads SOURCE TEXT, because this repo's vitest environment is node with no jsdom and every
 * file under `app/` is an async server component vitest does not even collect. So the honest
 * statement of what passes here is:
 *
 *   PROVED — this route file contains at least one literal `className` that spells a layout
 *   container: centred (`mx-auto`), width-bounded (`max-w-*` or `container`) and
 *   horizontally padded (`px-*`, at any breakpoint).
 *
 *   NOT PROVED — that the container actually WRAPS the page's top-level content. A page that
 *   keeps a correct container string on some inner card while its hero still runs to the edge
 *   passes this test. Proving containment needs a rendered tree, which needs jsdom, which this
 *   repo does not have.
 *
 *   NOT PROVED — that the container is the RIGHT one. The vertical rhythm differs per page by
 *   design (`space-y-12`, `-14`, `-16`, `/dunya`'s `flex-1 w-full pb-16`, `/hesabim`'s `pb-20`)
 *   and pinning each spelling would be a frozen list that fails on correct code. Only the three
 *   structural properties are asserted.
 *
 * It is still the assertion worth having: the regression it guards was a container that was
 * ABSENT, not one that was misplaced, and absence is exactly what a source scan can see.
 *
 * Comments are stripped by parsing — only real `className` attributes are read — so a docblock
 * that quotes a container spelling (this one does, twice) cannot satisfy the check.
 *
 * T-035 added a fourth idiom: `<PageContainer>` (`components/patterns/page-container.tsx`)
 * renders the same three structural properties from inside a component, so a page that calls it
 * spells no container `className` of its own — the literal-string scan below would otherwise
 * read that page as regressing to edge-to-edge content. The detector below treats a real
 * `<PageContainer` JSX element (AST-matched by tag name, the same rigor as the className scan,
 * not a text search) as an equally valid proof. This is the rewrite the block below already
 * called for: PageContainer did not land on the layout's `<main>` — each page still opts in by
 * calling it — so the test still asserts a per-page container, just through a second idiom.
 *

 * ## Scope
 *
 * Every `page.tsx`, `error.tsx` and `not-found.tsx` under `app/[locale]/(site)`. The two
 * non-`page.tsx` files are IN scope deliberately: they are route-segment files that render into
 * the same single `<main>` through the same layout, so they have the identical failure mode, and
 * an error screen flush to the edge of a phone is not a better place to discover it. Both
 * already carry `max-w-2xl mx-auto px-4 sm:px-6 lg:px-8`, so including them costs nothing today
 * and closes the hole for the next one added.
 *
 * The three `(play)` screens are OUT of scope and must stay out: they are fullscreen game
 * surfaces in a sibling route group with their own layout and no shared `<main>`, and they are
 * correctly container-free. The scan asserts that boundary rather than assuming it.
 */

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const siteRoot = join(repoRoot, "app/[locale]/(site)");
const playRoot = join(repoRoot, "app/[locale]/(play)");

/** The route-segment files that render page content into the `(site)` layout's `<main>`. */
const ROUTE_FILES = ["page.tsx", "error.tsx", "not-found.tsx"];

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return ROUTE_FILES.includes(entry.name) ? [full] : [];
  });

/**
 * Every static `className` string in a file, read off the TypeScript AST.
 *
 * Deliberately not a regex over the raw text: a regex matches the same words inside a comment,
 * and that is the trap `components/map/locator-attribution.test.ts` documents — a guard passing
 * on the prose that explains the thing after somebody deleted the thing.
 *
 * Dynamic values (`cn(...)`, template literals with substitutions, variables) are skipped. A
 * page that computes its container instead of spelling it would fail here and need an entry on
 * the exemption list below, with a reason — which is the intended outcome, not a gap.
 */
function classNames(file: string): string[] {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isJsxAttribute(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "className" &&
      node.initializer
    ) {
      const init = node.initializer;
      if (ts.isStringLiteral(init)) found.push(init.text);
      else if (ts.isJsxExpression(init) && init.expression) {
        const expr = init.expression;
        if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
          found.push(expr.text);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(source, visit);
  return found;
}

/**
 * Whether a route file renders a `<PageContainer>` element — the fourth container idiom (see
 * the docblock above). AST tag-name matching, same as `classNames` above: a comment or a string
 * that happens to contain the word "PageContainer" cannot satisfy this, only a real JSX element.
 */
function usesPageContainer(file: string): boolean {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let found = false;
  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName;
      if (ts.isIdentifier(tag) && tag.text === "PageContainer") found = true;
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(source, visit);
  return found;
}

/**
 * The three structural properties a page-level container has, in any of the spellings this
 * codebase actually writes:
 *
 *   `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 …`   — 30 pages, container on the page itself
 *   `container mx-auto px-4 max-w-7xl …`          — 5 detail pages, container inside the hero
 *   `max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 …`   — error.tsx / not-found.tsx
 *
 * Bounded OR `container`: Tailwind's `container` utility is itself a width bound, and the five
 * detail pages stack both.
 */
function isLayoutContainer(className: string): boolean {
  const tokens = className.split(/\s+/).filter(Boolean);
  const centred = tokens.includes("mx-auto");
  const bounded = tokens.includes("container") || tokens.some((t) => t.startsWith("max-w-"));
  const padded = tokens.some((t) => /^(?:[a-z-]+:)?px-/.test(t));
  return centred && bounded && padded;
}

const routeFiles = walk(siteRoot).sort();
const playFiles = walk(playRoot).sort();
const rel = (file: string) => relative(repoRoot, file);

describe("the container detector", () => {
  /**
   * ANTI-VACUITY, the strong half: the predicate is not `() => true`.
   *
   * A scan that classifies everything as a container would report zero missing containers and
   * look exactly like a green suite. These fixtures are real strings lifted from the tree — the
   * three container idioms, and four non-containers including the two near-misses that make the
   * predicate worth writing (centred but unpadded, centred but unbounded).
   */
  it.each([
    "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 space-y-16",
    "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 space-y-14 flex-1 w-full pb-16",
    "container mx-auto px-4 max-w-7xl relative z-10 space-y-6",
    "max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-24 space-y-5",
  ])("accepts %s", (className) => {
    expect(isLayoutContainer(className)).toBe(true);
  });

  it.each([
    "space-y-4",
    "flex items-center gap-2 text-xs text-muted-foreground",
    // Centred and bounded, but no horizontal padding — prose inside a container, not one itself.
    "text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed",
    // Centred and padded, but no width bound — a padded strip, not a container.
    "mx-auto px-4 flex items-center justify-center",
  ])("rejects %s", (className) => {
    expect(isLayoutContainer(className)).toBe(false);
  });
});

describe("(site) route files", () => {
  it("scans a real, correctly bounded set of files", () => {
    // Anti-vacuity: an empty or mis-rooted walk would report no missing containers and pass.
    expect(routeFiles.length, "(site) route files found").toBeGreaterThanOrEqual(30);
    expect(routeFiles.map(rel)).toContain("app/[locale]/(site)/error.tsx");
    expect(routeFiles.map(rel)).toContain("app/[locale]/(site)/not-found.tsx");

    // The className extraction works — if the AST walk silently returned nothing, every file
    // would fail below for the wrong reason, and the diagnosis would start in the wrong place.
    expect(routeFiles.flatMap(classNames).length, "className literals read").toBeGreaterThan(100);

    // The `(play)` boundary is asserted, not assumed. These three fullscreen game screens are
    // correctly container-free; the day one of them moves into `(site)` it must gain a
    // container, and the day the group is emptied this line says so.
    expect(playFiles.length, "(play) route files").toBe(3);
    expect(routeFiles.some((file) => file.includes("(play)"))).toBe(false);
  });

  /**
   * THE RATCHET, closing in both directions.
   *
   * The assertion is an EQUALITY against an exact list, not `toEqual([])`, so it fails on a new
   * `(site)` page that ships with no container AND on an exemption that has stopped being
   * needed. An exemption cannot be added without writing down why, here, in the diff.
   *
   * The list is empty, and that is the point: after the T-032 PR3 regression was undone, every
   * `(site)` route file carries one. There is no page for which edge-to-edge content is the
   * design.
   *
   * Note what this does NOT settle. Hoisting the container onto the layout's `<main>` — so pages
   * stop spelling it at all — would still be a bigger move than T-035 makes: `<PageContainer>`
   * is called PER PAGE, so each route file still opts in, and `usesPageContainer` above is what
   * lets this test see that opt-in once the className moves off the page and into the component.
   */
  const CONTAINERLESS_BY_DESIGN: readonly string[] = [];

  it("each carry a layout container", () => {
    const missing = routeFiles
      .filter((file) => !classNames(file).some(isLayoutContainer) && !usesPageContainer(file))
      .map(rel);
    expect(missing).toEqual([...CONTAINERLESS_BY_DESIGN]);

    // A typo on the exemption list would silently excuse a file that is not even scanned.
    for (const exempt of CONTAINERLESS_BY_DESIGN) {
      expect(routeFiles.map(rel), `${exempt} is not a scanned (site) route file`).toContain(exempt);
    }
  });
});
