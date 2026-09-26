import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  repoRoot,
  walk,
  closureFrom,
  PRODUCT_ROOTS,
  SHOWCASE_ROUTE,
  WIDER_ENTRY_ROOTS,
} from "@/lib/test-support/import-closure";

/**
 * EVERY COMPONENT IN THIS REPO HAS A CALL SITE A READER CAN REACH.
 *
 * ## The rule
 *
 * `components/showcase/registry.test.ts` closes one direction: a primitive that exists must
 * have a specimen. This closes the other: a component that exists must be REACHED from a page
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
 * ## T-042: THE TWO HOLES THIS TEST SHIPPED WITH, AND WHAT THEY HID
 *
 * Both are in the same sentence of the old version — "walk from `PRODUCT_ROOTS` and see what is
 * reachable" — and each turned a reachability question into a tautology.
 *
 *   1. **A ROOT IS NOT AUDITABLE.** `PRODUCT_ROOTS` used to list `components/v2`,
 *      `components/patterns`, `components/tools` and seven more DIRECTORIES beside the three app
 *      entries. {@link closureFrom} seeds its queue with every file under a root, so each of
 *      those 118 files was "reachable" by being walked, never by being imported. The test
 *      genuinely audited `components/ui` and nothing else — and `components/ui` is the one
 *      directory whose files a wrong answer would have been noticed in.
 *
 *      A directory is now EITHER a root OR audited, never both. The roots are the three entries
 *      Next.js itself renders from ({@link PRODUCT_ROOTS}); everything under `components/` is
 *      audited, including `components/showcase` — see {@link SHOWCASE_ROUTE}.
 *
 *   2. **A TYPE-ONLY IMPORT IS NOT A CALL SITE.** The walk followed every `from "…"` specifier,
 *      `import type` included. `components/tools/tool-island.tsx` (1226 lines) had exactly two
 *      importers left, both `import type { ProvinceArea }` — a clause TypeScript erases, which
 *      builds no bundler edge and renders nothing. Following it kept the island alive, and
 *      through it `tool-measurement-list.tsx`, `tool-measurement-save.tsx`, `tool-png.ts` and
 *      `tools.module.css`: 2447 lines no page could load. `closureFrom` now walks
 *      `runtimeImportsOf`, and that module's own docblock records the claim this falsified.
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

/**
 * Everything under here is audited. Never a root — see hole 1.
 *
 * `components/**` AND NOTHING ELSE, which is what an empty {@link KNOWN_UNREACHABLE} does and
 * does not say: `lib/**` and `app/**` are not audited, so an unreachable helper under `lib/`
 * or an unrendered file under `app/` is outside this test's claim entirely. It says every
 * COMPONENT has a call site a reader can reach, not that the repo holds no dead code.
 */
const AUDITED_ROOT = "components";

/** Showcase infrastructure: audited, but answerable by the design-system route. */
const SHOWCASE_INFRA = "components/showcase/";

const label = (path: string) => relative(repoRoot, path);

const AUDITED = walk(join(repoRoot, AUDITED_ROOT)).sort();

const productClosure = closureFrom(PRODUCT_ROOTS);
const showcaseClosure = closureFrom(SHOWCASE_ROUTE);

type Verdict = "product" | "showcase-infrastructure" | "showcase-only" | "unreachable";

/**
 * A PURE function of one path and the two closures, so the controls below can ask it about a
 * file that does not exist. A classifier that can only be run over the tree cannot be shown to
 * work: every answer it gives is also the answer the tree happens to want.
 */
function classify(
  file: string,
  product: ReadonlySet<string>,
  showcase: ReadonlySet<string>,
): Verdict {
  if (product.has(file)) return "product";
  if (!showcase.has(file)) return "unreachable";
  return label(file).startsWith(SHOWCASE_INFRA) ? "showcase-infrastructure" : "showcase-only";
}

const verdictsOf = (files: readonly string[], verdict: Verdict): string[] =>
  files
    .filter((file) => classify(file, productClosure, showcaseClosure) === verdict)
    .map(label)
    .sort();

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
 * further showcase-only file fails here, and so does resolving this one without shortening
 * the list.
 *
 * ## The five T-042 pins
 *
 * Closing the two holes above turned up five MORE files in this state, none of them ever seen by
 * the old walk. They were pinned here in their defective state first, on their own commit, so the
 * deletion that follows is a measured change and not a claim — the shape T-046 settled on.
 *
 * Two of the five left this list without being deleted, because neither was what it looked like:
 *
 *   - `patterns/theme-pair.tsx` MOVED to `components/showcase/theme-pair.tsx`.
 *     `showcase/specimen.tsx` wraps every specimen in it, so it is the machinery the
 *     `/design-system` route is built out of. Deleting it as a showcase-only pattern would have
 *     taken the whole design system down;
 *   - `patterns/map-attribution.tsx` was replaced in place. That file (66 lines) had four
 *     showcase consumers and no product one, while `components/v2/v2-map-attribution.tsx`
 *     (102 lines) rendered the same mandatory ODbL credit for TEN product surfaces — and
 *     `docs/design.md` named the orphan as the patterns component. The live one moved in under
 *     that name and the orphan died with it.
 *
 * The other three — `callout`, `empty-state` and `map-legend` — were deleted, with their
 * specimens, their registry entries and their two `patterns-contract.test.ts` blocks. Each was
 * a component the design system had argued about at length and no page had ever rendered.
 *
 * ## `tabs.tsx` left this list — T-031d Task 15
 *
 * The decision recorded above ("KEEP IT") is now acted on. All four call sites this docblock
 * named — `v2-auth-dialog.tsx`, `v2-member-hub.tsx`, `v2-turkey-map-explorer.tsx` and
 * `v2-world-map-explorer.tsx` — render `<Tabs`/`<TabsList`/`<TabsTrigger`/`<TabsContent` now, all
 * four already inside `PRODUCT_ROOTS`'s closure, so `tabs.tsx` classifies as `product` and the
 * list below is empty. `components/v2/tablist-adoption.test.ts` is what keeps a hand-rolled
 * tablist from coming back; this list empty is what would catch the primitive itself being
 * orphaned again.
 */
const KNOWN_SHOWCASE_ONLY: string[] = [];

/**
 * REACHED FROM NOTHING AT ALL — not the product, not even the showcase. **EMPTY, AND THE EMPTY
 * LIST IS THE POINT.**
 *
 * Six files when this first ran, every one of them called live by the old walk:
 *
 *   - the four `components/tools` files — the measurement island and its three helpers, 2447
 *     lines held up by two `import type { ProvinceArea }` clauses;
 *   - `components/home/featured-cards.tsx` — reached by one clause, `import type
 *     { FeaturedCardItem }` in `app/[locale]/(site)/page.tsx`. That page shapes its own two card
 *     arrays with the type and draws the grids in its own inline markup; `<FeaturedCards`
 *     appeared nowhere in the tree. The TYPE is live and moved to `lib/home/featured.ts`, beside
 *     the two functions that feed it; the component and `components/home/home.module.css`, whose
 *     only importer it was, are gone and so is the directory;
 *   - `components/lock-icon.tsx` — a CASCADE: its one runtime importer was
 *     `components/tools/tool-measurement-save.tsx`, so it became unreachable through this task
 *     rather than before it, and it went in the same task's second round.
 *
 * Ruling CL settled the question the first round left open, and it is the rule `docs/design.md`
 * already stated: no product call site means DELETE — never kept alive for the showcase, and
 * never kept alive because a test imports it. A file is not live because something asserts about
 * it; `components/lock-icon.test.tsx` was the only thing still naming `LockIcon` and it went with
 * its subject.
 *
 * So the list is empty, and an equality against an empty list is the strictest form this pin can
 * take: the NEXT file to arrive here fails immediately, with no precedent to be filed under.
 */
const KNOWN_UNREACHABLE: readonly string[] = [
  // T-121 in progress: the workbench renders it from the wiring task on, which empties this list.
  "components/v2/area-result-panel.tsx",
  "components/v2/coordinate-result-panel.tsx",
];

describe("the import closure itself", () => {
  // ANTI-VACUITY. Every assertion below is "X is in this set"; a set built from a broken
  // resolver, an empty walk or a typo'd root would fail them all loudly rather than pass
  // them all silently — but only if something proves the set was really built. These do.
  it("walked the product surface and reached beyond it", () => {
    expect(AUDITED.length).toBeGreaterThan(100);
    expect(productClosure.size).toBeGreaterThan(PRODUCT_ROOTS.length);
    // THE PARSER ANCHOR, inherited from `components/orphan-stylesheets.test.ts` when T-033 task 9
    // deleted that file with the last `*.module.css`. It is a floor on the RESOLVER, not on this
    // file's population: a closure that resolved nothing would still be "bigger than the root
    // list" and every reachability verdict below would then be an accident. This is now the only
    // place the graph is read, so the anchor lives here.
    expect(productClosure.size, "files reachable from a route").toBeGreaterThan(100);
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

  it("the other Next.js entry points reach no audited file the three roots miss", () => {
    // The "not widened" claim in `PRODUCT_ROOTS`'s own docblock, executed. `app/api`, `app/maps`,
    // the sitemap/robots handlers, the app-root special files and `middleware.ts` reach data and
    // route handlers rather than components, so adding them as roots must move no verdict — and
    // each one added would be a directory that could no longer be audited. If this ever goes red,
    // a component became reachable ONLY through one of them and the roots list owes it an entry.
    const widened = closureFrom([...PRODUCT_ROOTS, ...WIDER_ENTRY_ROOTS]);
    const moved = AUDITED.filter(
      (file) =>
        classify(file, widened, showcaseClosure) !==
        classify(file, productClosure, showcaseClosure),
    ).map(label);
    expect(moved, "audited files whose verdict a wider root list would change").toEqual([]);
  });

  it("no audited file is also a root — hole 1, asserted rather than remembered", () => {
    const rootPaths = [...PRODUCT_ROOTS, ...SHOWCASE_ROUTE].map((rel) => join(repoRoot, rel));
    const seeded = AUDITED.filter((file) => rootPaths.some((root) => file.startsWith(root)));
    expect(seeded.map(label), "audited files the walk would seed into the closure").toEqual([]);
  });

  it("does not count a type-only import as a call site — hole 2", () => {
    // THE LIVE PROOF, and it is chosen to outlive every deletion this rule causes: the two files
    // it names are not orphans and cannot become any, so the control cannot be resolved away.
    //
    // `lib/auth/submit.client.ts` is `"use client"` and IS reached from the product surface.
    // The only thing it binds from `lib/auth/transport.server.ts` is `import type
    // { AuthBffCode }`, and `transport.server.ts` carries `import "server-only"` — so if this
    // walk followed type edges, a `server-only` module would enter the product closure through a
    // client component, which `pnpm build` proves is not a real edge at all.
    const client = join(repoRoot, "lib/auth/submit.client.ts");
    const server = join(repoRoot, "lib/auth/transport.server.ts");
    expect(productClosure.has(client), "the client module is reached").toBe(true);
    expect(productClosure.has(server), "its type-only target is NOT").toBe(false);
  });
});

describe("the classifier answers about a file, not about the tree", () => {
  const ghost = join(repoRoot, "components/__probe__/ghost.tsx");

  it("calls a file in neither closure unreachable", () => {
    expect(classify(ghost, productClosure, showcaseClosure)).toBe("unreachable");
  });

  it("calls a showcase-reachable file OUTSIDE components/showcase showcase-only", () => {
    expect(classify(ghost, new Set(), new Set([ghost]))).toBe("showcase-only");
  });

  it("calls a showcase-reachable file INSIDE components/showcase infrastructure", () => {
    const infra = join(repoRoot, "components/showcase/__probe__/ghost.tsx");
    expect(classify(infra, new Set(), new Set([infra]))).toBe("showcase-infrastructure");
  });

  it("lets the product closure win over both", () => {
    expect(classify(ghost, new Set([ghost]), new Set([ghost]))).toBe("product");
  });
});

describe("no component is reachable only from the showcase, or from nothing", () => {
  it("the recorded showcase-only list is exactly the measured set", () => {
    expect(verdictsOf(AUDITED, "showcase-only")).toEqual([...KNOWN_SHOWCASE_ONLY].sort());
  });

  it("the recorded unreachable list is exactly the measured set", () => {
    expect(verdictsOf(AUDITED, "unreachable")).toEqual([...KNOWN_UNREACHABLE].sort());
  });

  /**
   * THE PIN IS MUTATION-CHECKED AT ITS VALUE, not merely stated.
   *
   * A list pinned by equality is only a ratchet if an added orphan moves it. One file that no
   * importer names is injected into the audited population, and both equalities above must then
   * FAIL — which is the property "an orphan cannot be added silently", executed rather than
   * asserted about.
   */
  it("a file under the audited root with no importer breaks both pins — the probe", () => {
    const ghost = join(repoRoot, "components/__probe__/ghost.tsx");
    const probed = [...AUDITED, ghost];
    expect(verdictsOf(probed, "unreachable")).not.toEqual([...KNOWN_UNREACHABLE].sort());
    expect(verdictsOf(probed, "unreachable")).toContain("components/__probe__/ghost.tsx");
  });

  it("every name on both lists is a real file", () => {
    for (const name of [...KNOWN_SHOWCASE_ONLY, ...KNOWN_UNREACHABLE]) {
      expect(AUDITED.map(label), `${name} is not an audited file on disk`).toContain(name);
    }
  });

  it.each(
    AUDITED.filter(
      (path) =>
        !KNOWN_SHOWCASE_ONLY.includes(label(path)) && !KNOWN_UNREACHABLE.includes(label(path)),
    ).map((path) => [label(path), path] as const),
  )("%s is reached from a route", (name, path) => {
    const verdict = classify(path, productClosure, showcaseClosure);
    expect(
      verdict === "product" || verdict === "showcase-infrastructure",
      verdict === "showcase-only"
        ? `${name} is reachable ONLY from /design-system. A component with no product call ` +
            `site is deleted, not maintained for the showcase's sake (docs/design.md).`
        : `${name} is reachable from nothing at all — delete it.`,
    ).toBe(true);
  });
});
