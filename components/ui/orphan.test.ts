import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { stripComments } from "@/lib/test-support/strip-comments";

/**
 * EVERY PRIMITIVE HAS A PRODUCT CALL SITE.
 *
 * ## The rule
 *
 * `components/showcase/registry.test.ts` closes one direction: a primitive that exists must
 * have a specimen. This closes the other: a primitive that exists must be REACHED from a page
 * a reader can open. A file whose only consumer is `/design-system` is a component the design
 * system maintains for the design system's sake, and it costs the same review, the same token
 * audit and the same dark-mode sweep as one that ships.
 *
 * `docs/design.md` carries the converse of the specimen rule for this reason.
 *
 * ## Why the closure is TRANSITIVE and not a direct-importer scan
 *
 * `components/ui/skeleton.tsx`'s only non-showcase importer is `components/ui/table.tsx`
 * (`TableSkeleton`), and five live `components/v2` files render that. A direct-importer check
 * would call `skeleton` an orphan and be wrong, and "delete it" would be the worst possible
 * action to take on that answer. So this walks the real import graph from the product surface
 * outward and asks what it reaches.
 *
 * ## What T-036 measured, and deleted
 *
 * Eight primitives were reachable only from the showcase. Each was checked against the product
 * before deleting, and the measurement is recorded here because two of them look like they
 * should have stayed:
 *
 *   - `checkbox` — zero `type="checkbox"` anywhere in the product. No form has one.
 *   - `textarea` — zero `<textarea>` anywhere in the product.
 *   - `popover` — no hand-rolled popper exists. The nearest things, `custom-select.tsx` and
 *     `components/site-search/search-combobox.tsx`, are an ARIA listbox and a combobox, and
 *     both are correct as they are.
 *   - `dropdown-menu` — the three hand-rolled panels in `v2-header.tsx` are LINK LISTS, not
 *     menus. `role="menu"` on a list of links is wrong per the ARIA APG, and the product
 *     contains zero `role="menu"`. Outside-click, Escape and focus return are already
 *     implemented in that file. There is no user menu.
 *   - `switch` — the two call sites want switch SEMANTICS, not switch APPEARANCE, and already
 *     implement them: `components/book/video-progress-controls.tsx` (`<button role="switch"
 *     aria-checked>`, with a deliberate `aria-disabled`-not-`disabled` decision) and
 *     `components/v2/v2-favorite-button.tsx` (a heart toggle). The primitive would only add a
 *     rail and a thumb that neither wants.
 *   - `pagination` — the only paginated list is `v2-leaderboard-modal.tsx`: client-state
 *     paging inside a modal with no URL. The primitive's core design decision is real
 *     `<a href>` anchors, "so middle-click and open-in-new-tab work", which does not fit a
 *     control that navigates nowhere. That call site was fixed in place instead (a named
 *     `<nav>` and an `aria-live` page announcement).
 *   - `avatar` — zero image avatars exist; `avatarUrl`/`profilePhoto` appear nowhere. The one
 *     candidate, `v2-member-hub.tsx`, draws a `rounded-2xl` gradient initial tile, while the
 *     primitive is `rounded-full` with an `after:` ring and a `mix-blend`. Adopting it means
 *     overriding shape, background and ring — fighting the primitive for no gain.
 *   - `separator` — THE ONE WHERE THE OBVIOUS READING IS WRONG IN BOTH DIRECTIONS, so the
 *     numbers are written down rather than summarised.
 *
 *     The task board justified deleting it with "no hand-rolled divider pattern exists",
 *     citing `<hr>` ×0 and `h-px` ×0. That is false. But the opposite conclusion — that a
 *     divider primitive was overdue — is false too, and for a reason no count of `border-t`
 *     can show.
 *
 *     Measured over `app/**` + `components/**` at the time of deletion:
 *       · `border-t border-border`      63 occurrences across 30 files
 *       · standalone one-pixel rules    1  (`v2-turkey-map-explorer.tsx`, a decorative
 *                                          vertical rule between toolbar buttons)
 *       · `<hr>`                        1  (`app/not-found.tsx`, already the right element)
 *       · `role="separator"`            0
 *
 *     All 63 are a border ON a content element — a card footer, a fieldset edge, a list row,
 *     a `CardFooter className="border-t border-border"`. `Separator` renders its OWN element
 *     and cannot replace an element's border; substituting one would ADD a DOM node where a
 *     border already suffices. The two real standalone rules need no primitive either: the
 *     404 page's is already an `<hr>`, and the toolbar's is decorative and now carries
 *     `aria-hidden="true"`.
 *
 *     `separator.tsx`'s own docblock claimed it was "the shape 24 V2 files were hand-rolling
 *     as `border-t border-border`". That is the category error above, stated as the
 *     component's justification: the primitive was built on a misreading of its own grep.
 *
 * Three primitives went the other way in the same task and were ADOPTED rather than deleted,
 * because each closed a real accessibility gap at a real call site: `spinner` (11 raw
 * `<Loader2 … animate-spin>` across 7 files, none with `role="status"` or an `sr-only`
 * label), `progress` (two hand-drawn bars with no `role="progressbar"`) and `tooltip` (one
 * button whose explanatory `title` is `aria-describedby` semantics).
 */

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"] as const;

/**
 * The surface a reader can actually reach. Route groups and the domain component folders,
 * named explicitly: a pattern like "everything under app" would swallow `design-system` and
 * quietly make this test vacuous.
 */
const PRODUCT_ROOTS = [
  // The chrome every product page gets by its directory. It sits ABOVE the two route groups,
  // so a roots list of groups alone misses it — and it is where `Toaster` is mounted, which
  // is the only thing that makes `sonner.tsx` reachable at all.
  "app/[locale]/layout.tsx",
  "app/[locale]/(site)",
  "app/[locale]/(play)",
  "components/v2",
  "components/patterns",
  "components/air",
  "components/book",
  "components/climate",
  "components/earthquake",
  "components/game",
  "components/home",
  "components/map",
  "components/marine",
  "components/site-search",
  "components/tools",
] as const;

/** Reachable only from here does not count as reachable. */
const SHOWCASE_ROOTS = ["app/[locale]/design-system", "components/showcase"] as const;

/** A root may name a directory or a single file. */
function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  if (statSync(dir).isFile()) return [dir];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : walk(full);
    return EXTENSIONS.some((ext) => entry.name.endsWith(ext)) && !entry.name.includes(".test.")
      ? [full]
      : [];
  });
}

/** `"@/components/ui/button"` / `"./table"` → an absolute path on disk, or `null` for a package. */
function resolveSpecifier(fromFile: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) base = join(repoRoot, specifier.slice(2));
  else if (specifier.startsWith(".")) base = resolve(dirname(fromFile), specifier);
  else return null; // node_modules — not our graph

  for (const candidate of [
    ...EXTENSIONS.map((ext) => `${base}${ext}`),
    ...EXTENSIONS.map((ext) => join(base, `index${ext}`)),
  ]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** Static `import`/`export … from` and dynamic `import()`. Comments stripped first. */
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*)["']([^"']+)["']/g;

function importsOf(file: string): string[] {
  const source = stripComments(readFileSync(file, "utf8"));
  return [...source.matchAll(SPECIFIER)]
    .map((match) => resolveSpecifier(file, match[1]!))
    .filter((path): path is string => path !== null);
}

function closureFrom(roots: readonly string[]): Set<string> {
  const seen = new Set<string>();
  const queue = roots.flatMap((rel) => walk(join(repoRoot, rel)));
  for (const file of queue) seen.add(file);
  while (queue.length > 0) {
    for (const next of importsOf(queue.pop()!)) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return seen;
}

const UI_DIR = join(repoRoot, "components/ui");
const PRIMITIVES = readdirSync(UI_DIR)
  .filter((name) => name.endsWith(".tsx") && !name.includes(".test."))
  .map((name) => join(UI_DIR, name));

const productClosure = closureFrom(PRODUCT_ROOTS);
const showcaseClosure = closureFrom(SHOWCASE_ROOTS);

const label = (path: string) => relative(repoRoot, path);

describe("the import closure itself", () => {
  // ANTI-VACUITY. Every assertion below is "X is in this set"; a set built from a broken
  // resolver, an empty walk or a typo'd root would fail them all loudly rather than pass
  // them all silently — but only if something proves the set was really built. These do.
  it("walked the product surface and reached beyond it", () => {
    expect(PRIMITIVES.length).toBeGreaterThan(10);
    expect(productClosure.size).toBeGreaterThan(PRODUCT_ROOTS.length);
    // A file the closure can only have reached by following an import, not by walking a root.
    expect([...productClosure].map(label)).toContain("lib/utils.ts");
  });

  it("reaches a primitive only an intermediate module imports — the transitive case", () => {
    // `skeleton.tsx` has no importer on the product surface at all: `table.tsx` imports it,
    // and five `components/v2` files import `table.tsx`. A direct-importer check would call
    // it an orphan. If this ever goes red, the closure stopped being transitive.
    expect([...productClosure].map(label)).toContain("components/ui/skeleton.tsx");
  });

  it("the showcase closure is real and is a different set", () => {
    expect([...showcaseClosure].map(label)).toContain("components/showcase/registry.ts");
    expect(showcaseClosure.has(join(repoRoot, "components/showcase/specimen.tsx"))).toBe(true);
    expect(productClosure.has(join(repoRoot, "components/showcase/specimen.tsx"))).toBe(false);
  });
});

/**
 * FOUND BY THIS TEST, NOT DECIDED BY T-036.
 *
 * T-036 arrived with a list of eight primitives to delete. Running the closure for the first
 * time turned up a NINTH file in the same state, which was on nobody's list: `tabs.tsx` is
 * imported by `components/showcase/specimens/duzen.tsx` and by nothing else, and no product
 * file renders `<Tabs`, `<TabsList` or `<TabsTrigger` either.
 *
 * It is NOT deleted here, because deleting it is a decision and this was a measurement. It
 * also has the strongest contract test of any primitive in this directory — the
 * `TabsVariantContext` block in `primitives-a11y.test.ts` exists because a real rendering
 * defect shipped through the weaker version of it.
 *
 * ## The decision, so this does not sit open
 *
 * KEEP IT. Unlike the eight that went, `tabs` has four real call sites, in two kinds:
 *
 * ALREADY TABLISTS, hand-rolled and otherwise correct — `v2-auth-dialog.tsx` (login/register)
 * and `v2-member-hub.tsx` (four member panels). Both carry `role="tablist"`, `role="tab"`,
 * `aria-selected`, `aria-controls` and real tabpanels. **But neither implements arrow-key
 * navigation** (`onKeyDown` count: 0 in both; the `ArrowRight` hits in member-hub are the lucide
 * icon). ARIA APG requires Left/Right to move between tabs in a tablist — a keyboard user can
 * reach the widget and cannot move inside it. Base UI's Tabs ships that behaviour, so adopting
 * here removes duplicated ARIA wiring AND closes a live defect.
 *
 * TABLIST-SHAPED WITH NO TAB SEMANTICS — the `viewMode` segmented controls in
 * `v2-turkey-map-explorer.tsx` and `v2-world-map-explorer.tsx`: three mutually exclusive views
 * of the same data (grouped / table / alphabetical index), rendered below, selected state shown
 * only as a background colour. No `role`, no `aria-selected`, no `aria-controls`, so a screen
 * reader announces three unrelated buttons and never says which view is showing.
 *
 * Not done in T-036: the two explorers are ~1,300-line files that the dark-map and
 * page-composition work already opens, and the two dialogs are stateful client components whose
 * panel wiring is not a primitive-deletion refactor's business. Restructuring either inside this
 * PR would put a visible, keyboard-behaviour-changing edit somewhere nobody reviews for one.
 *
 * Recorded as an exact list and asserted as an equality, so it ratchets in both directions: a
 * TENTH showcase-only primitive fails here, and so does resolving this one without shortening
 * the list.
 */
const KNOWN_SHOWCASE_ONLY = ["components/ui/tabs.tsx"];

describe("no primitive is reachable only from the showcase", () => {
  it("the recorded exception list is exactly the set of showcase-only primitives", () => {
    const showcaseOnly = PRIMITIVES.filter(
      (path) => !productClosure.has(path) && showcaseClosure.has(path),
    ).map(label);
    expect(showcaseOnly.sort()).toEqual([...KNOWN_SHOWCASE_ONLY].sort());
  });

  it("every name on the exception list is a real file", () => {
    for (const name of KNOWN_SHOWCASE_ONLY) {
      expect(PRIMITIVES.map(label), `${name} is not a primitive on disk`).toContain(name);
    }
  });

  it.each(
    PRIMITIVES.filter((path) => !KNOWN_SHOWCASE_ONLY.includes(label(path))).map(
      (path) => [label(path), path] as const,
    ),
  )("%s is reached from the product surface", (name, path) => {
    const onlyShowcase = !productClosure.has(path) && showcaseClosure.has(path);
    expect(
      productClosure.has(path),
      onlyShowcase
        ? `${name} is reachable ONLY from /design-system. A primitive with no product call ` +
            `site is deleted, not maintained for the showcase's sake (docs/design.md).`
        : `${name} is reachable from nothing at all — delete it.`,
    ).toBe(true);
  });
});
