import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { basename, join, relative } from "node:path";
import { stripComments } from "@/lib/test-support/strip-comments";
import { resolveSpecifier } from "@/lib/test-support/import-closure";

/**
 * THE SHARED SCANNER BEHIND THE THREE `page-composition-*.test.ts` FILES.
 *
 * T-035 shipped its four PRs into ONE 5352-line test module, and by PR4 that module held **two
 * independent JSX scanners with different semantics**: PR3's regex-plus-{@link maskLiterals} path
 * and PR4's brace-balancing tree. Two counters could read the same `className` by two different
 * rules, and nothing reconciled them — which is exactly where a counter can hide. PR4 added a
 * cross-scanner guard and it found a real disagreement: 22 `<div>`s, all template-hole classNames,
 * where PR3's side was not merely verbose but MANGLED (see {@link literalsIn}).
 *
 * T-045 extracted this module and there is now ONE extractor, one injection harness and one
 * binding resolver. The three test files own their own counters, docblocks, mutation records and
 * exemption tables; they own no scanning of their own.
 *
 * NOT A TEST FILE. Vitest's globs are `lib/**`, `components/**` and `tools/**`, so this module is
 * picked up by its own `composition-scan.test.ts` beside it and by nothing else.
 */
export const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

export const label = (path: string) => relative(repoRoot, path);

/* ---------------------------------------------------------------------------------------------
 * THE WALKERS
 * ------------------------------------------------------------------------------------------ */

/**
 * The reading and play surfaces. `design-system` is deliberately absent: it is internal
 * tooling that brings its own chrome, and including it would let showcase markup answer for
 * product markup — the shape of vacuity `components/ui/orphan.test.ts` guards against by
 * naming its roots instead of globbing `app/`.
 */
export const PAGE_ROOTS = ["app/[locale]/(site)", "app/[locale]/(play)"] as const;

export function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  if (statSync(dir).isFile()) return [dir];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith(".tsx") && !entry.name.includes(".test.") ? [full] : [];
  });
}

export function walkPages(): string[] {
  return PAGE_ROOTS.flatMap((rel) => walk(join(repoRoot, rel)))
    .filter((path) => path.endsWith("page.tsx"))
    .sort();
}

/**
 * EVERY FILE UNDER `PAGE_ROOTS` THAT RENDERS A FULL SCREEN TO A READER — `page.tsx` plus the two
 * Next.js special files that take over the viewport in its place, `error.tsx` and `not-found.tsx`.
 *
 * A SECOND walker rather than a wider `walkPages()`, deliberately. Three counters from PR1 and
 * PR2 (`PAGE_BODY_SPELLINGS`, `HAND_WRITTEN_BREADCRUMBS` and the two derived from it, all in
 * `components/v2/page-composition-containers.test.ts`) are pinned at values measured over
 * `page.tsx` ONLY; widening that function would move their scope silently, which is the exact
 * failure mode this whole programme exists to stop. `walkPages()` is untouched and still returns
 * 37 — asserted in the headings file, so this split cannot rot.
 *
 * Used ONLY by the heading counters in `components/v2/page-composition-headings.test.ts`, for a
 * reason specific to them: a reader who lands on a thrown error or an unknown slug sees a real
 * page with a real `<h1>`, so a counter named `PAGES_WITHOUT_H1` that cannot see those two files
 * would claim more than it measures. `app/[locale]/(site)/error.tsx` and
 * `app/[locale]/(site)/not-found.tsx` are the only two in the tree today; there is no `(play)`
 * equivalent and no `loading.tsx` or `template.tsx` anywhere.
 *
 * NOT WIDENED PAST `PAGE_ROOTS`. `app/global-error.tsx` and `app/not-found.tsx` are app-ROOT
 * special files that sit ABOVE `app/[locale]`, outside both roots — the same placement
 * `components/patterns/rsc-boundary.test.ts` handles with a separate `ROOT_LEVEL_ROOTS` list
 * rather than by stretching a root. Reaching them would take a third root, and would add two more
 * spellings that no locale-scoped surface shares: `app/not-found.tsx`'s
 * `font-heading text-3xl font-bold` (no `text-foreground` — it renders outside the locale layout
 * and its providers) and `app/global-error.tsx`'s `<h1>` with an inline `style` and NO `className`
 * at all, which would enter the count as the `(no className attribute)` marker. Both are
 * last-resort shells with different constraints from a reading page, so folding them into a
 * "converge the page heading" counter would give the adoption task two targets it cannot
 * legitimately move onto the hub/detail tiers. Left out on purpose, named here so the omission is
 * a decision and not an oversight.
 */
const RENDER_ROOT_FILENAMES = ["page.tsx", "error.tsx", "not-found.tsx"] as const;

/**
 * WHOLE BASENAME, never a suffix. `endsWith("page.tsx")` would swallow a `my-page.tsx` helper and
 * `endsWith("not-found.tsx")` a `shared-not-found.tsx`, silently moving every counter downstream.
 * Its own test runs on synthetic paths rather than on the walk's output, because an assertion made
 * over files that already passed this filter re-derives the filter and cannot fail.
 */
export function isRenderRootPath(path: string): boolean {
  return RENDER_ROOT_FILENAMES.some((name) => basename(path) === name);
}

export function walkRenderRoots(): string[] {
  return PAGE_ROOTS.flatMap((rel) => walk(join(repoRoot, rel)))
    .filter(isRenderRootPath)
    .sort();
}

/**
 * The primitive is where the breadcrumb nav is SUPPOSED to be written, so it is excluded from the
 * surface a "hand-written nav" counter scans.
 *
 * `components/patterns/breadcrumbs.tsx` (Task 6) is deliberately NOT listed here, though it
 * was reserved as a placeholder before that task existed. This exemption exists for files
 * that legitimately WRITE the `<nav aria-label="…">` markup themselves; `Breadcrumbs`
 * delegates that entirely to `Breadcrumb` (`components/ui/breadcrumb.tsx:9`), which already
 * owns the exemption above. Its own source contains no `aria-label` literal at all — adding
 * one there would be markup written only to keep this list's liveness check green, not
 * because the component needs it. Since `components/patterns/breadcrumbs.tsx` sits outside
 * {@link SURFACE_ROOTS} anyway, leaving it off this list changes nothing about what the
 * counters scan.
 *
 * Lives here rather than beside the breadcrumb counters because {@link surfaceFiles} — which the
 * heading tier-switch premise check also uses — is defined in terms of it.
 */
export const BREADCRUMB_OWNERS = ["components/ui/breadcrumb.tsx"] as const;

/**
 * The reading/play page roots plus every `components/v2` file — a wider walk than
 * {@link walkPages}, which visits only `page.tsx`. Two `components/v2` files render the breadcrumb
 * nav on behalf of seven pages that never write it themselves: `v2-sea-basin-detail-view.tsx`
 * (the four `deniz/{akdeniz,karadeniz,marmara,ege}` basin pages) and `v2-game-screen.tsx` (the
 * three `(play)/oyun/*` screens). A scan limited to `page.tsx` would silently miss the nav on
 * all seven of those pages; walking `components/v2` too is how it is still seen.
 */
export const SURFACE_ROOTS = [...PAGE_ROOTS, "components/v2"] as const;

export function surfaceFiles(): string[] {
  return SURFACE_ROOTS.flatMap((rel) => walk(join(repoRoot, rel)))
    .filter((path) => !BREADCRUMB_OWNERS.some((owner) => path.endsWith(owner)))
    .sort();
}

export function pageRootFiles(): string[] {
  return PAGE_ROOTS.flatMap((rel) => walk(join(repoRoot, rel))).sort();
}

/**
 * THE CARD SURFACE — wider than {@link PAGE_ROOTS} on purpose, and a THIRD walker rather than a
 * widening of either existing one.
 *
 * A card is not a page-level thing. The clear majority of the elements the card counters find live
 * under `components/` rather than `app/[locale]/` (252 of 409 when this was written, before Tasks
 * 5 and 6 removed 141 of them); `components/v2/v2-member-hub.tsx` alone holds 29 and
 * `components/v2/v2-tool-educational-content.tsx` 26, neither of them reachable by a `page.tsx`
 * scan. Widening `walkPages()` or `walkRenderRoots()` to reach them would move PR1/PR2/PR3's
 * pinned counters, which is the failure this programme exists to prevent — so this is its own
 * function and the two above are untouched.
 *
 * Excluded, and each exclusion is a number a later task can check:
 *
 *   - **`components/ui/**` — THE DESIGN SYSTEM ITSELF, and the exclusion the card section got wrong
 *     first time round.** A primitive's own implementation is never a hand-drawn card, and four
 *     of them were inside the count: `card.tsx`'s own root `<div>` (the `Card` primitive, counted
 *     as a card), `accordion.tsx`'s item shell, and `custom-select.tsx`'s trigger `<button>` and
 *     popover `<div>`. Task 5 rewrites `card.tsx` to add variants, and the standard shape for
 *     that is a `cva()` base — at which point the literal stops being a JSX `className` and
 *     `HAND_DRAWN_CARDS` falls by one with nothing migrated. A ratchet the design-system task can
 *     lower for free is not a ratchet. Excluding the directory re-pinned 308 → 305, 182 → 181 and
 *     77 → 74 files. The eight primitives named in `CARD_SHAPED_PRIMITIVES` are counted at their
 *     USE sites in `components/v2` and are unaffected.
 *   - `components/showcase/**` — specimen markup answering for product markup. Including it,
 *     `design-system` and `components/ui` together read 492 / 79 files / 256 spellings against
 *     that section's 486 / 74 / 250 — both measured at Task 4, before Task 5's adoption.
 *   - `app/[locale]/design-system/**` — the same argument, internal tooling.
 *   - `*.test.tsx` and `*.generated.*` — {@link walk} already drops the first; there is no
 *     generated `.tsx` under either root today, and the filter is here so the first one cannot
 *     enter.
 *
 * `.tsx` only: a `.ts` file cannot hold JSX, so a `.ts` scan would read class strings out of
 * helpers and constants and credit them to no element at all.
 */
export const CARD_SCAN_ROOTS = ["app/[locale]", "components"] as const;

export const CARD_SCAN_EXCLUSIONS = [
  "components/showcase/",
  "components/ui/",
  "app/[locale]/design-system/",
] as const;

export function walkCardSurface(): string[] {
  const excluded = CARD_SCAN_EXCLUSIONS.map((rel) => join(repoRoot, rel));
  return CARD_SCAN_ROOTS.flatMap((rel) => walk(join(repoRoot, rel)))
    .filter((path) => !path.includes(".generated."))
    .filter((path) => !excluded.some((prefix) => path.startsWith(prefix)))
    .sort();
}

/* ---------------------------------------------------------------------------------------------
 * SOURCE ACCESS AND THE INJECTION HARNESS
 * ------------------------------------------------------------------------------------------ */

/** Comments stripped: a docblock quoting a className must not answer for the markup. */
export function sourceOf(path: string): string {
  return stripComments(readFileSync(path, "utf8"));
}

/**
 * Source as every scanner here sees it: comment-stripped, and overridable so a test can ask
 * "what would the counters read if this page had one more import" without touching the tree.
 * {@link withInjectedSource} is the only writer.
 */
let sourceOverrides: ReadonlyMap<string, string> | null = null;

export function readSource(file: string): string {
  const override = sourceOverrides?.get(file);
  return override === undefined ? sourceOf(file) : stripComments(override);
}

/**
 * CACHE REGISTRATION IS THE MECHANISM, NOT A HABIT.
 *
 * {@link withInjectedSource} used to name its caches by hand — six of them, in two separate
 * places, and PR4 had to REMEMBER to add `cardElementCache` to both. It did. That is not a
 * guarantee for the next one: a memo added without a matching line here would serve stale
 * analysis to every injected test, and every such test would pass while measuring the file on
 * disk instead of the file it injected.
 *
 * So a cache cannot be created except through {@link perFileCache} or {@link graphCache}, and
 * both register what they hand back. The harness iterates the registers; forgetting is not a
 * thing that can happen, because there is no unregistered cache to forget. The three test files
 * declare their own caches through the same two factories, and `composition-scan.test.ts` pins
 * that no module-scope cache in any of the four files is built any other way — so the escape
 * hatch (`const fooCache = new Map()`) fails the suite rather than silently opting out.
 *
 * TWO REGISTERS, because the two invalidation rules are genuinely different:
 *
 *   - a PER-FILE cache is a pure function of one file's own {@link readSource}, so only the
 *     OVERRIDDEN files' entries are dropped. Clearing everything made each injected walk re-read
 *     and re-mask all ~180 reachable files; the whole-surface control does three walks and timed
 *     out at vitest's 5s default under full-suite parallelism while passing comfortably when the
 *     file ran alone. A test that depends on machine load is worse than no test.
 *   - a GRAPH cache depends on the WHOLE graph (or is an accumulator across a walk), so it is
 *     dropped in full. `h1SitesOf`'s memo and `fallbacksSeen` are of this kind.
 */
const perFileCaches: Array<Map<string, unknown>> = [];
const graphCaches: Array<Map<string, unknown>> = [];

/** A memo keyed by file path, holding a pure function of that file's own source. */
export function perFileCache<V>(): Map<string, V> {
  const cache = new Map<string, V>();
  perFileCaches.push(cache as Map<string, unknown>);
  return cache;
}

/** A memo of the whole graph, or an accumulator across one walk. Dropped in full on injection. */
export function graphCache<V>(): Map<string, V> {
  const cache = new Map<string, V>();
  graphCaches.push(cache as Map<string, unknown>);
  return cache;
}

/** Every registered cache, so a test can assert the harness reaches all of them. */
export function registeredCaches(): {
  readonly perFile: ReadonlyArray<Map<string, unknown>>;
  readonly graph: ReadonlyArray<Map<string, unknown>>;
} {
  return { perFile: perFileCaches, graph: graphCaches };
}

export function resetScannerCaches(): void {
  for (const cache of perFileCaches) cache.clear();
  for (const cache of graphCaches) cache.clear();
}

/**
 * Runs `fn` with each named file's source replaced.
 *
 * Only the OVERRIDDEN files' per-file entries are dropped, either side — not the whole register.
 * Graph caches are dropped in full. See {@link perFileCache} for why the split is worth having and
 * why neither list is written out by hand any more.
 */
export function withInjectedSource<T>(
  overrides: ReadonlyArray<readonly [string, string]>,
  fn: () => T,
): T {
  const touched = overrides.map(([file]) => file);
  const invalidate = () => {
    for (const cache of perFileCaches) {
      for (const file of touched) cache.delete(file);
    }
    for (const cache of graphCaches) cache.clear();
  };
  invalidate();
  sourceOverrides = new Map(overrides);
  try {
    return fn();
  } finally {
    sourceOverrides = null;
    invalidate();
  }
}

/**
 * THE FIXTURE ROOTS. Scanner controls run against synthetic source at a path that does not exist
 * on disk, instead of injecting on top of a real page.
 *
 * PR3's controls used to be built on `giris/page.tsx`, and each assumed that file renders no
 * `<h1>`. `giris` is one of the five files `PAGES_WITHOUT_H1` exists to drive to zero, so the
 * moment Task 3 gave it a heading — which it had to — five scanner controls would have gone red
 * alongside the two counters that are SUPPOSED to move, and the cheapest green would be to delete
 * them. One of the five is the standing guard against the original HIGH. That is how a guard
 * actually dies: not disabled on purpose, but rewritten by the task it was pointed at.
 *
 * PR4 hit the same thing one PR later and restated it as a rule: **no control may depend on markup
 * a later task in the plan is contracted to delete.**
 *
 * Both paths sit under `(site)` so `@/`-relative resolution behaves identically, but
 * {@link walkRenderRoots} and {@link walkCardSurface} list the real directories and never see
 * them, so nothing injected here can leak into a counter. The modules a fixture imports are REAL
 * (`typography.tsx`, `v2-hero.tsx`), which is what keeps these controls exercising production code
 * rather than a toy graph.
 */
export const FIXTURE_ROOT = join(repoRoot, "app/[locale]/(site)/__scanner-fixture__/page.tsx");

export const CARD_FIXTURE = join(repoRoot, "app/[locale]/(site)/__card-fixture__/page.tsx");

/* ---------------------------------------------------------------------------------------------
 * LITERAL MASKING
 * ------------------------------------------------------------------------------------------ */

/**
 * The same text with the CONTENTS of every string, template and regex literal blanked to spaces —
 * same length, so every index into it still addresses the original source.
 *
 * {@link readSource} strips comments but copies literals through verbatim, by design (a `//` inside
 * a URL is not a comment). That leaves prose-shaped text in the scan surface, which is the oldest
 * failure in this repo's test suite: `docs/conventions.md` records four independent arrivals at
 * "a docblock quoting the thing you grep for satisfies the grep". A JSX name is the same shape one
 * door over — `const USAGE = "<PageHero title={x} />"` credited that module's `<h1>` to a page that
 * renders nothing, because the heading walk's JSX pattern ran over the raw text. Latent, not live:
 * no string literal in `app/`, `components/` or `lib/` contains a JSX-looking component name today.
 *
 * Also what makes {@link TOP_LEVEL_BOUNDARY}'s column-0 rule true rather than nearly true — see
 * that constant's own docblock for the template-literal case it used to get wrong.
 */
export function maskLiterals(source: string): string {
  const out = source.split("");
  let i = 0;
  let previous = "";
  while (i < source.length) {
    const ch = source[i]!;
    const opensRegex =
      ch === "/" &&
      source[i + 1] !== "/" &&
      source[i + 1] !== "*" &&
      "(,=:[!&|?;{+-*%^~".includes(previous);
    if (ch !== '"' && ch !== "'" && ch !== "`" && !opensRegex) {
      if (!/\s/.test(ch)) previous = ch;
      i += 1;
      continue;
    }
    const quote = ch;
    let j = i + 1;
    let inClass = false;
    while (j < source.length) {
      const inner = source[j]!;
      if (inner === "\\") {
        out[j] = " ";
        if (j + 1 < source.length) out[j + 1] = " ";
        j += 2;
        continue;
      }
      if (opensRegex) {
        if (inner === "\n") break;
        if (inClass) {
          if (inner === "]") inClass = false;
        } else if (inner === "[") inClass = true;
        else if (inner === "/") break;
      } else if (inner === quote) {
        break;
      }
      out[j] = " ";
      j += 1;
    }
    i = j + 1;
    previous = quote;
  }
  return out.join("");
}

const maskedCache = perFileCache<string>();

export function maskedSource(file: string): string {
  const hit = maskedCache.get(file);
  if (hit !== undefined) return hit;
  const masked = maskLiterals(readSource(file));
  maskedCache.set(file, masked);
  return masked;
}

/* ---------------------------------------------------------------------------------------------
 * THE ONE LITERAL EXTRACTOR
 * ------------------------------------------------------------------------------------------ */

/**
 * Two markers, not one, so an element with no class list and an element with a FULLY COMPUTED one
 * never merge into a single "spelling". They are different defects with different fixes — the
 * first is an unstyled element, the second is one whose treatment this scanner cannot read at all
 * — and collapsing them would let a computed `<h1 className={headingClass}>` hide inside the same
 * bucket as a genuinely bare one, so `H1_SPELLINGS` would report one where the real answer is two
 * distinct treatments.
 */
export const NO_CLASSNAME = "(no className attribute)";
export const COMPUTED_CLASSNAME = "(className with no string literal)";

/** What a template hole reduces to in a spelling. See {@link literalsIn}. */
export const HOLE_MARKER = "${…}";

/**
 * EVERY STRING/TEMPLATE LITERAL'S CONTENTS INSIDE AN ATTRIBUTE EXPRESSION — the file's ONE
 * extractor, after T-045 merged two that disagreed.
 *
 * ## What `balanceHoles` decides, and why `true` is not a preference
 *
 * With `balanceHoles: true` a `${…}` hole is SKIPPED, balanced, and replaced by the single marker
 * {@link HOLE_MARKER}. A computed class then reads as its own distinct, obviously-unconverged
 * spelling instead of welding its neighbours together: `deprem/fay-hatlari/page.tsx` writes
 * `` `rounded-3xl border ${fault.borderClass} bg-card …` `` and must not be credited with a
 * `border-border` it may not have.
 *
 * With `balanceHoles: false` the hole is not special, so a quote or backtick INSIDE it terminates
 * the surrounding literal and the scan resumes mid-expression. That is what PR3's
 * `classNameLiteralsIn` did, and the T-035 PR4 cross-scanner guard measured the damage on the live
 * tree: the two extractors disagreed on exactly **22 `<div>`s**, every one of them a template-hole
 * className, and PR3's side was not merely verbose — it was MANGLED. Three recorded shapes, all
 * still reproducible through this flag and all pinned in `composition-scan.test.ts`:
 *
 *   - `components/v2/v2-turkey-map-explorer.tsx` — the hole holds a NESTED template literal, so the
 *     outer literal ends at its backtick and the inner `"cursor-grabbing"` / `"cursor-grab"`
 *     branches are re-read as class fragments: the quotes vanish and BOTH BRANCHES ARE WELDED
 *     TOGETHER into `cursor-grabbing cursor-grab`. `v2-world-map-explorer.tsx` the same.
 *   - `components/v2/v2-game-history-stats.tsx` — same nested-template shape, and here a whole
 *     BRANCH IS SILENTLY DELETED: the hole reduces to a bare `? :`.
 *   - `components/v2/v2-sources-section.tsx` — a conditional `"lg:grid-cols-3"` is carried through
 *     as if UNCONDITIONAL, and `grid-cols-*` is exactly the token the stat-grid predicate keys on.
 *
 * So `true` is the implementation of the contract PR3's own docblock already stated ("a computed
 * class reads as its own distinct, obviously-unconverged spelling rather than collapsing into a
 * neighbouring one") and which its code achieved neither half of. Every production caller passes
 * `true`; `false` survives ONLY so the three mangling shapes above stay executable evidence rather
 * than prose, and `composition-scan.test.ts` asserts that no caller outside its own tests passes
 * it. The merge cost zero: 0 of the 13 `H1_SPELLINGS` rows contains a hole, which that file's
 * headings suite still asserts.
 */
export function literalsIn(expression: string, balanceHoles: boolean): string[] {
  const literals: string[] = [];
  let i = 0;
  while (i < expression.length) {
    const ch = expression[i]!;
    if (ch !== '"' && ch !== "'" && ch !== "`") {
      i += 1;
      continue;
    }
    let j = i + 1;
    let buffer = "";
    while (j < expression.length) {
      const inner = expression[j]!;
      if (inner === "\\") {
        buffer += inner + (expression[j + 1] ?? "");
        j += 2;
        continue;
      }
      if (balanceHoles && ch === "`" && inner === "$" && expression[j + 1] === "{") {
        let depth = 0;
        let k = j + 1;
        while (k < expression.length) {
          const c = expression[k]!;
          if (c === "{") depth += 1;
          else if (c === "}") {
            depth -= 1;
            if (depth === 0) break;
          }
          k += 1;
        }
        buffer += HOLE_MARKER;
        j = k + 1;
        continue;
      }
      if (inner === ch) break;
      buffer += inner;
      j += 1;
    }
    literals.push(buffer);
    i = j + 1;
  }
  return literals;
}

/* ---------------------------------------------------------------------------------------------
 * THE TAG-AT-A-TIME READER (PR3's entry point into the extractor)
 * ------------------------------------------------------------------------------------------ */

/**
 * Reads the `className` off a `<tag …>`, in ALL THREE forms this surface writes.
 *
 * A `className="…"` regex is not enough here, and that is not a hypothetical: it is the mistake
 * that produced a wrong figure twice during PR1 and PR2. All three forms are live on the pages the
 * heading walk visits, each provable against a real file:
 *
 *   - `className="…"`          — `app/[locale]/(site)/araclar/page.tsx`, and 25 more `<h1>`s;
 *   - `className={cn("…", …)}` — `components/patterns/typography.tsx`, the `H1` component
 *                                `app/[locale]/(site)/hakkimizda/page.tsx` renders. This is the
 *                                page whose heading a literal-only scan cannot see AT ALL;
 *   - ``className={`…`}``      — `app/[locale]/(site)/dunya/kita/[slug]/page.tsx`. No `<h1>`
 *                                wears this form TODAY (it is on a `<section>` there), which is
 *                                exactly why the extractor must already handle it: the idiom is
 *                                native to these files, so the first heading written in it would
 *                                otherwise drop silently out of every heading count.
 *
 * Mechanics, in two passes rather than one regex, because a regex cannot balance braces:
 * {@link tagTextAt} walks from `<tag` to the `>` that closes it, tracking brace depth and string
 * state so a `>` inside `{…}` (an arrow function, a comparison in a template hole) does not end
 * the tag early; {@link literalsIn} then pulls every string/template literal out of the attribute
 * value and joins them. For `cn("a b", className)` that yields `"a b"` — the fixed part, which is
 * the spelling being counted; the caller-supplied `className` argument is a variable and
 * contributes nothing, correctly.
 */
export function tagTextAt(source: string, start: number): string {
  let depth = 0;
  let quote: string | null = null;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i]!;
    if (quote !== null) {
      if (ch === "\\") i += 1;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") quote = ch;
    else if (ch === "{") depth += 1;
    else if (ch === "}") depth -= 1;
    else if (ch === ">" && depth === 0) return source.slice(start, i + 1);
  }
  return source.slice(start);
}

export function classNameOfTag(tag: string): string {
  // THE SAME NAME BOUNDARY `readHeader` USES. A bare `indexOf("className=")` also matches the tail
  // of `data-className=`, and PR5's `data-className` control caught the two entry points
  // disagreeing about exactly that the moment `readHeader` learned to read whole attribute names —
  // which is the cross-scanner guard in `composition-scan.test.ts` doing the job it was built for.
  // Inert on today's tree, and asserted to be.
  const at = tag.search(/(?<![A-Za-z0-9_$:.-])className=/);
  if (at === -1) return NO_CLASSNAME;
  let i = at + "className=".length;
  while (i < tag.length && /\s/.test(tag[i]!)) i += 1;
  const opener = tag[i];

  if (opener === '"' || opener === "'") {
    const end = tag.indexOf(opener, i + 1);
    return tag.slice(i + 1, end === -1 ? tag.length : end);
  }

  if (opener === "{") {
    let depth = 0;
    let quote: string | null = null;
    let j = i;
    for (; j < tag.length; j += 1) {
      const ch = tag[j]!;
      if (quote !== null) {
        if (ch === "\\") j += 1;
        else if (ch === quote) quote = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "`") quote = ch;
      else if (ch === "{") depth += 1;
      else if (ch === "}" && (depth -= 1) === 0) break;
    }
    const literals = literalsIn(tag.slice(i + 1, j), true);
    return literals.length > 0 ? literals.join(" ") : COMPUTED_CLASSNAME;
  }

  return COMPUTED_CLASSNAME;
}

/** One normalised spelling per `<tag>` element in `source`, in source order. */
export function classNamesOf(source: string, tag: string): string[] {
  const opener = new RegExp(`<${tag}[\\s>]`, "g");
  return [...source.matchAll(opener)].map((match) =>
    classNameOfTag(tagTextAt(source, match.index)).trim().replace(/\s+/g, " "),
  );
}

/* ---------------------------------------------------------------------------------------------
 * THE BALANCING TREE SCANNER (PR4's entry point into the same extractor)
 * ------------------------------------------------------------------------------------------ */

/**
 * ONE JSX ELEMENT, as this scanner sees it.
 *
 * `spelling` is `null` for an element with no `className` attribute and {@link COMPUTED_CLASSNAME}
 * for one whose attribute holds no string literal at all — "no classes" and "classes this scanner
 * cannot read" are different facts and neither is a card.
 *
 * `children` holds the element indices nested in this element's CHILDREN. Elements written
 * inside an attribute expression are NOT children — they are recorded with `inProp: true` and
 * the enclosing element as `parent`, because `<V2TurkeyMapExplorer regionsSection={<div …/>}>`
 * passes a sibling panel, not a child of the explorer. They still count as cards; they must not
 * count as grid tiles.
 */
export type ScannedElement = {
  readonly tag: string;
  readonly spelling: string | null;
  /**
   * `[start, end)` in the source {@link scanJsx} was handed — `start` is the `<` that opens the
   * element, `end` the character after its closing `>` (after the self-closing `/>` for a void
   * element, after the `>` of `</tag>` otherwise).
   *
   * ADDED BY PR5 (T-035 Task 7), because relating a SOURCE POSITION to an ELEMENT was the one
   * thing this module could not do, and the FAQ counters are all position-to-element questions:
   * "which element writes `{faq.question}`", "which `<section>` encloses this `.map(`", "is the
   * element holding this `faqPageJsonLd(` call inside a conditional". The alternative was a
   * second walk over the same text in the counter file, which is the exact shape T-045 exists to
   * prevent — two scanners with different semantics that silently disagree.
   *
   * OFFSETS ARE INTO THE STRING PASSED TO {@link scanJsx}, not into the file. `topLevelRenderNodes`
   * scans a SLICE, so spans from that path are slice-relative; a caller that needs file offsets
   * scans the whole file (what {@link jsxElementsOf} does) or adds the slice's own start itself.
   *
   * `end > start` always, and never past the end of the source: an element whose closing tag is
   * missing or mismatched ends where the scan stopped looking. See {@link innermostElementAt} for
   * the containment rule built on that.
   *
   * ONE CASE WHERE `end` DOES NOT COVER THE CHILDREN, stated rather than glossed. `scanRange`
   * returns early when it meets a closing tag belonging to an ancestor (`depth > 0`), and the
   * element it was scanning keeps the `end` its own header gave it — so an element whose closing
   * tag is absent from a NESTED position spans its opening tag only, and
   * {@link innermostElementAt} would answer with something shallower than the truth for a position
   * inside it. That needs mismatched JSX, which `tsc` rejects before any test here runs, so it is
   * unreachable on a tree that typechecks; it is written down because "always well defined" was
   * more than the code promises.
   */
  readonly start: number;
  readonly end: number;
  /**
   * EVERY ATTRIBUTE WRITTEN AT THE TOP LEVEL OF THE OPENING TAG, name → value text: the contents
   * for `name="…"`, the expression for `name={…}` (whitespace collapsed), and `""` for a bare
   * `name` with no value. An attribute written inside a nested element passed as a prop belongs to
   * that element, not to this one, because {@link scanJsx} skips braced values whole.
   *
   * ONE PARSER, which is the whole reason this field exists. The FAQ counters needed the labelling
   * attributes of a `<section>` (`aria-labelledby` vs `id` vs `id`+`tabIndex`) and the value of a
   * `data={…}` prop, and the first version of them re-walked the opening tag in the consumer — a
   * SECOND attribute reader with its own semantics, one module over from this one. That is the
   * T-045 shape exactly. `readHeader` now reads every attribute in the pass it was already making
   * and `className` is one of them: `spelling` is still derived from this attribute's value by the
   * one literal extractor, so the two cannot disagree.
   *
   * `spelling` is NOT `attributes.get("className")`: the former is the class string as a SPELLING
   * (literals joined, template holes reduced to {@link HOLE_MARKER}, {@link COMPUTED_CLASSNAME}
   * where no literal is written), the latter the raw source of the attribute. Both are wanted, and
   * `composition-scan.test.ts` pins the relationship between them.
   */
  readonly attributes: ReadonlyMap<string, string>;
  /**
   * The raw attribute expression, kept ONLY where `spelling` is {@link COMPUTED_CLASSNAME}. Which
   * shape an unreadable className has decides whether it could ever hide a card: a `styles.x`
   * member lookup is the surviving CSS-Modules surface and never will, a bare identifier is the
   * module-constant hoist `COMPUTED_CARD_CLASSNAMES` exists to watch for.
   */
  readonly computed: string | null;
  readonly parent: number | null;
  readonly children: number[];
  readonly inProp: boolean;
  /**
   * Written from inside a `{…}` EXPRESSION in its parent's children, rather than as a plain JSX
   * child — `{cond && <X/>}`, `{a ? <X/> : <Y/>}`, `{rows.map(() => <X/>)}`.
   *
   * "Might not render." An element written as a plain child always renders when its parent does;
   * one inside an expression renders only if the expression evaluates that way, and this scanner
   * does not evaluate anything. It is the difference between "this tag appears in the source" and
   * "this element is on the page", which is the distinction four separate findings in this
   * programme have turned on (PR3's Ruling Z/AB, PR4 Task 4's `.map()` blind spot, PR4's Ruling BA
   * where `cn("grid", …)` behind a `void` satisfied two source pins, and T-046's own review, where
   * `{false && <PageContainer/>}` certified a full-bleed body as contained).
   *
   * A counter that MUST see an element is free to ignore this. A counter that treats an element as
   * PROOF of something — as "this body is inside a container" does — must not, or a dead reference
   * is a certificate.
   */
  readonly inExpression: boolean;
};

/**
 * A JSX scanner that BALANCES rather than matches.
 *
 * Three counting errors in this programme were the same mistake wearing different clothes: a
 * `className` pattern that only matched double-quoted literals, a substring test that fired on a
 * Tailwind `group/x` modifier name, and a docblock read as if it were markup. A regex cannot
 * avoid the first (all three className forms are live on this surface), and a naive recursion
 * cannot avoid mis-attributing a nested element's classes to its parent. So:
 *
 *   1. Comments are gone before this runs — the caller passes {@link readSource} output.
 *   2. Outside a tag, string, template and regex literals are SKIPPED whole, so `<div` inside a
 *      string is prose and a backtick inside a regex (`v2-rich-prose.tsx` has one) does not flip
 *      the scanner into template mode.
 *   3. `<` opens an element only when the next character is a letter (or `>`, a fragment) AND the
 *      previous character is not an identifier character, `)` or `]` — `useState<Foo>` and
 *      `Map<string, X>` are type arguments, not elements. Without this rule the type argument
 *      pushes a node nothing ever closes and every element after it lands at the wrong depth.
 *   4. The attribute header is read with string-, template- and brace-awareness to the `>` that
 *      actually closes it, and `className` is captured ONLY at header top level: a `className`
 *      inside a braced prop belongs to the nested element, not to the element holding the prop.
 *   5. The scan then re-enters the header as code, so an element passed as a prop is found.
 *
 * Verified against the live tree rather than asserted: of the 5225 `className=` occurrences in
 * the comment-stripped surface, 5216 attach to an element and the remaining 9 are
 * `className = ""` destructuring defaults, pinned by file in the card suite's "every className
 * attaches to an element". Nothing is silently dropped.
 */
export function scanJsx(source: string): ScannedElement[] {
  // Mutable internally so `end` can be written once the element's children have been walked; the
  // return type is the readonly `ScannedElement`, so no caller can write through it.
  type MutableElement = { -readonly [K in keyof ScannedElement]: ScannedElement[K] };
  const elements: MutableElement[] = [];
  const REGEX_OPENERS = new Set("(,=:[!&|?;{+-*%^~".split(""));

  const skipLiteral = (i: number): number => {
    const quote = source[i]!;
    let j = i + 1;
    while (j < source.length) {
      const inner = source[j]!;
      if (inner === "\\") {
        j += 2;
        continue;
      }
      if (quote === "`" && inner === "$" && source[j + 1] === "{") {
        j = skipBraced(j + 1);
        continue;
      }
      j += 1;
      if (inner === quote) break;
    }
    return j;
  };

  const skipBraced = (i: number): number => {
    let depth = 0;
    let j = i;
    while (j < source.length) {
      const inner = source[j]!;
      if (inner === '"' || inner === "'" || inner === "`") {
        j = skipLiteral(j);
        continue;
      }
      if (inner === "{") depth += 1;
      else if (inner === "}") {
        depth -= 1;
        if (depth === 0) return j + 1;
      }
      j += 1;
    }
    return source.length;
  };

  const skipRegex = (i: number): number => {
    let j = i + 1;
    let inClass = false;
    while (j < source.length) {
      const inner = source[j]!;
      j += 1;
      if (inner === "\\") {
        j += 1;
        continue;
      }
      if (inner === "\n") break;
      if (inClass) {
        if (inner === "]") inClass = false;
        continue;
      }
      if (inner === "[") inClass = true;
      else if (inner === "/") break;
    }
    return j;
  };

  /**
   * EVERY top-level attribute of the tag whose name ends at `i`, plus where its header ends.
   *
   * ONE WALK, ONE SET OF SEMANTICS. This used to look for the literal string `className` and skip
   * everything else a character at a time; a consumer that needed any OTHER attribute had to walk
   * the same opening tag again with its own rules, which is how two readers of the same text end
   * up disagreeing (T-045). It now reads NAMES — so `aria-labelledby` is one attribute rather than
   * the fragment `label` preceded by noise — and `className` is simply the name whose value also
   * feeds `spelling` and `computed` through {@link literalsIn}.
   *
   * The name character class includes `-` and `:` (`aria-label`, `xlink:href`) and so does the
   * boundary test before a name, which is what stops `data-className` being read as a `className`
   * — the one behaviour the old pattern got wrong. Inert on today's tree: no tag anywhere writes
   * `className` immediately after a `-`, `.` or `:`, and `composition-scan.test.ts` pins both the
   * inertness and the rule.
   */
  const ATTRIBUTE_NAME = /[A-Za-z0-9_$:.-]/;

  const readHeader = (
    i: number,
  ): {
    spelling: string | null;
    computed: string | null;
    attributes: Map<string, string>;
    end: number;
    selfClosing: boolean;
  } => {
    let spelling: string | null = null;
    let computed: string | null = null;
    const attributes = new Map<string, string>();
    let j = i;
    while (j < source.length) {
      const ch = source[j]!;
      if (ch === '"' || ch === "'" || ch === "`") {
        j = skipLiteral(j);
        continue;
      }
      if (ch === "{") {
        j = skipBraced(j);
        continue;
      }
      if (ch === ">") {
        return { spelling, computed, attributes, end: j + 1, selfClosing: source[j - 1] === "/" };
      }
      // A name starts here only if this character could begin one AND the previous character
      // could not be part of one — the same boundary rule the old `className` test used, widened
      // to the characters a JSX attribute name may actually contain.
      if (!/[A-Za-z_]/.test(ch) || ATTRIBUTE_NAME.test(source[j - 1] ?? " ")) {
        j += 1;
        continue;
      }
      let nameEnd = j;
      while (nameEnd < source.length && ATTRIBUTE_NAME.test(source[nameEnd]!)) nameEnd += 1;
      const name = source.slice(j, nameEnd);

      let k = nameEnd;
      while (k < source.length && /\s/.test(source[k]!)) k += 1;
      if (source[k] !== "=") {
        // A bare attribute (`disabled`, `hidden`) — or the `/` of a self-closing tag reached
        // through a name. Resume at the name's end so `>` is still seen by the loop.
        attributes.set(name, "");
        j = nameEnd;
        continue;
      }
      k += 1;
      while (k < source.length && /\s/.test(source[k]!)) k += 1;
      const opener = source[k];
      if (opener === '"' || opener === "'") {
        const end = skipLiteral(k);
        const value = source.slice(k + 1, end - 1);
        attributes.set(name, value);
        if (name === "className") spelling = value;
        j = end;
        continue;
      }
      if (opener === "{") {
        const end = skipBraced(k);
        const expression = source.slice(k + 1, end - 1);
        attributes.set(name, expression.trim().replace(/\s+/g, " "));
        if (name === "className") {
          const literals = literalsIn(expression, true);
          spelling = literals.length > 0 ? literals.join(" ") : COMPUTED_CLASSNAME;
          computed = literals.length > 0 ? null : expression.trim().replace(/\s+/g, " ");
        }
        j = end;
        continue;
      }
      attributes.set(name, "");
      j = k;
    }
    return { spelling, computed, attributes, end: source.length, selfClosing: false };
  };

  /** Scans `[i, end)` as JSX children of `parent`; returns where it stopped. */
  const scanRange = (
    i: number,
    end: number,
    parent: number | null,
    inProp: boolean,
    depth: number,
  ): number => {
    let previous = "";
    // Depth of `{…}` expressions opened IN THIS parent's children. Local to the call, and each
    // element's children get their own `scanRange`, so this is exactly "is the element I am about
    // to record written inside a braced expression of its own parent" — not of some ancestor.
    let braces = 0;
    while (i < end) {
      const ch = source[i]!;
      if (ch === '"' || ch === "'" || ch === "`") {
        i = skipLiteral(i);
        previous = ch;
        continue;
      }
      if (ch === "{") {
        braces += 1;
        previous = ch;
        i += 1;
        continue;
      }
      if (ch === "}") {
        if (braces > 0) braces -= 1;
        previous = ch;
        i += 1;
        continue;
      }
      if (
        ch === "/" &&
        source[i + 1] !== "/" &&
        source[i + 1] !== "*" &&
        REGEX_OPENERS.has(previous)
      ) {
        i = skipRegex(i);
        previous = "/";
        continue;
      }
      if (ch === "<" && source[i + 1] === "/") {
        if (depth > 0) return i;
        while (i < end && source[i] !== ">") i += 1;
        i += 1;
        continue;
      }
      if (ch === "<" && opensElement(source, i)) {
        const fragment = source[i + 1] === ">";
        let nameEnd = i + 1;
        while (!fragment && nameEnd < source.length && /[A-Za-z0-9._:-]/.test(source[nameEnd]!)) {
          nameEnd += 1;
        }
        const tag = fragment ? "" : source.slice(i + 1, nameEnd);
        const header = readHeader(nameEnd);
        const index = elements.length;
        elements.push({
          tag,
          spelling: header.spelling,
          computed: header.computed,
          parent,
          children: [],
          inProp,
          inExpression: braces > 0,
          start: i,
          end: header.end,
          attributes: header.attributes,
        });
        if (parent !== null && !inProp) elements[parent]!.children.push(index);
        scanRange(nameEnd, header.end, index, true, depth + 1);
        if (header.selfClosing) {
          i = header.end;
          previous = ">";
          continue;
        }
        let k = scanRange(header.end, end, index, false, depth + 1);
        if (source[k] === "<" && source[k + 1] === "/") {
          let m = k + 2;
          while (m < source.length && /\s/.test(source[m]!)) m += 1;
          let n = m;
          while (n < source.length && /[A-Za-z0-9._:-]/.test(source[n]!)) n += 1;
          if (source.slice(m, n) === tag) {
            while (n < source.length && source[n] !== ">") n += 1;
            k = n + 1;
          } else if (depth > 0) {
            return k;
          } else {
            while (k < source.length && source[k] !== ">") k += 1;
            k += 1;
          }
        }
        // `k` is now past the closing tag (or wherever the scan gave up on a mismatched one), so
        // this is the element's real extent. Written after the children walk, which is why the
        // record is mutable inside this function.
        elements[index]!.end = k;
        i = k;
        previous = ">";
        continue;
      }
      if (!/\s/.test(ch)) previous = ch;
      i += 1;
    }
    return i;
  };

  scanRange(0, source.length, null, false, 0);
  return elements;
}

/** Whether the `<` at `i` opens a JSX element rather than a type-argument list. */
export function opensElement(source: string, i: number): boolean {
  const next = source[i + 1];
  if (next === undefined) return false;
  if (next !== ">" && !/[A-Za-z]/.test(next)) return false;
  const previous = source[i - 1];
  return previous === undefined || !/[A-Za-z0-9_$)\]]/.test(previous);
}

/**
 * THE INNERMOST ELEMENT WHOSE SPAN CONTAINS `at`, or `null` if the position is outside every
 * element (module-scope code, an import clause, a bare `.map()` in a helper that renders nothing).
 *
 * "Innermost" is decided by MAXIMUM `start` among the containing elements, not by span width.
 * Elements nest, so among the elements containing one position the one that opens LAST is the
 * deepest — and that holds for an element written inside an attribute expression too
 * ({@link ScannedElement.inProp}), whose span lies inside its holder's header. Width would be a
 * different rule only where two elements have the same start, which cannot happen.
 *
 * WHAT THIS IS FOR, and why it is not a convenience. A counter that has to relate two things sitting
 * far apart in a file — `faqPageJsonLd(X)` up in the JSON-LD block and the `.map(` over `X` six
 * hundred lines down — needs to ask "which element is this position written inside", and the only
 * alternative is a second walk over the same text. The whole of T-045 is the record of what two
 * walks cost.
 *
 * NOT an evaluation of anything. The element it returns may be inside `{false && …}`; read
 * {@link ScannedElement.inExpression} on it and its ancestors to learn that a position is written
 * under SOME condition, never which one.
 */
export function innermostElementAt(elements: readonly ScannedElement[], at: number): number | null {
  let best: number | null = null;
  for (let index = 0; index < elements.length; index += 1) {
    const element = elements[index]!;
    if (element.start > at) break; // pre-order: every later element opens later still
    if (at < element.end && (best === null || element.start > elements[best]!.start)) best = index;
  }
  return best;
}

const cardElementCache = perFileCache<ScannedElement[]>();

export function jsxElementsOf(file: string): ScannedElement[] {
  const hit = cardElementCache.get(file);
  if (hit) return hit;
  const scanned = scanJsx(readSource(file));
  cardElementCache.set(file, scanned);
  return scanned;
}

/* ---------------------------------------------------------------------------------------------
 * THE BINDING RESOLVER
 * ------------------------------------------------------------------------------------------ */

/** A file plus the name of one declaration inside it. `null` = the whole file. */
export type RenderNode = { readonly file: string; readonly name: string | null };

/** A node's identity in a walk: file plus declaration, `*whole*` for a whole-module node. */
export function nodeKey(node: RenderNode): string {
  return `${node.file}::${node.name ?? "*whole*"}`;
}

/**
 * Every name a file binds from another FILE in this repo, mapped to the node it names.
 *
 * `import type …` clauses and `type`-prefixed members are dropped — they compile to nothing and
 * so cannot render anything, the same erasure `runtimeImportsOf` performs one level down.
 * Package specifiers resolve to `null` and never enter the map. `import * as Ns` binds `Ns` to the
 * whole module (name `"*"`), which the heading walk's `nodeSpan` then cannot isolate — see
 * `MODULE_SCOPE_FALLBACKS` in `components/v2/page-composition-headings.test.ts`.
 */
const IMPORT_CLAUSE = /^import\s+([^;]*?)\s+from\s*["']([^"']+)["']/gm;

const bindingCache = perFileCache<Map<string, RenderNode>>();

export function importBindingsOf(file: string): Map<string, RenderNode> {
  const hit = bindingCache.get(file);
  if (hit) return hit;

  const bindings = new Map<string, RenderNode>();
  const source = readSource(file);
  for (const match of source.matchAll(IMPORT_CLAUSE)) {
    const clause = match[1]!.trim();
    if (/^type\b/.test(clause)) continue;
    const target = resolveSpecifier(file, match[2]!);
    if (target === null) continue;

    const braceAt = clause.indexOf("{");
    const head = (braceAt === -1 ? clause : clause.slice(0, braceAt)).replace(/,\s*$/, "").trim();
    if (head.length > 0) {
      const namespace = head.match(/^\*\s+as\s+([A-Za-z0-9_$]+)$/);
      if (namespace) bindings.set(namespace[1]!, { file: target, name: "*" });
      else if (/^[A-Za-z0-9_$]+$/.test(head)) bindings.set(head, { file: target, name: "default" });
    }
    if (braceAt !== -1) {
      const inner = clause.slice(braceAt + 1, clause.lastIndexOf("}"));
      for (const raw of inner.split(",")) {
        const member = raw.trim();
        if (member.length === 0 || /^type\b/.test(member)) continue;
        const aliased = member.match(/^([A-Za-z0-9_$]+)\s+as\s+([A-Za-z0-9_$]+)$/);
        if (aliased) bindings.set(aliased[2]!, { file: target, name: aliased[1]! });
        else if (/^[A-Za-z0-9_$]+$/.test(member))
          bindings.set(member, { file: target, name: member });
      }
    }
  }
  bindingCache.set(file, bindings);
  return bindings;
}

/**
 * Top-level declarations in a module, name → `[start, end)` in its source.
 *
 * A SCANNER, NOT A PARSER — the same contract `lib/test-support/strip-comments.ts` states for
 * itself. Boundaries are lines that BEGIN AT COLUMN 0 with a declaration keyword. A declaration's
 * region runs to the next such boundary, so `typography.tsx`'s `export function H1` region ends
 * exactly where `export function H2` begins. That is what makes "crediting an `H2` importer with
 * `H1`'s markup" — the same bug one level down from the module-granularity one — impossible here.
 *
 * WHY PRETTIER IS NOT THE WHOLE REASON. An earlier version of this docblock claimed the column-0
 * rule is "exact because Prettier is enforced (`docs/conventions.md`) — a nested `const` inside a
 * function body is indented". That is true of CODE and false of TEMPLATE LITERALS: Prettier does
 * not reindent what is inside backticks, so
 *
 *     const note = `line one
 *     const fake = 1;
 *     line three`;
 *
 * puts `const` at column 0 in the middle of a declaration and used to END that declaration's
 * region early. Review demonstrated it on `v2-hero.tsx` and the homepage lost its heading. The
 * direction was SAFE — a truncated region finds FEWER `<h1>`s, so `PAGES_WITHOUT_H1` goes UP and
 * the mistake can never be used to claim a win — and it went red loudly. It is closed anyway, by
 * running this pattern over {@link maskLiterals}' output rather than raw source, so a keyword
 * inside a literal is spaces by the time the regex sees it. Prettier now only has to guarantee
 * what it actually guarantees: that real top-level code starts at column 0.
 */
const TOP_LEVEL_BOUNDARY =
  /^(?:export|import|function|async|const|let|var|class|type|interface|declare|enum)\b/gm;

const declarationCache = perFileCache<Map<string, readonly [number, number]>>();

export function declarationRegions(file: string): Map<string, readonly [number, number]> {
  const hit = declarationCache.get(file);
  if (hit) return hit;

  const source = readSource(file);
  // Masked: a `const` at column 0 INSIDE a template literal is not a declaration, and Prettier
  // does not reindent template interiors, so the column-0 rule is exact only over masked text.
  const boundaries = [...maskedSource(file).matchAll(TOP_LEVEL_BOUNDARY)].map(
    (match) => match.index,
  );
  const regions = new Map<string, readonly [number, number]>();

  boundaries.forEach((start, position) => {
    const end = boundaries[position + 1] ?? source.length;
    const head = source.slice(start, Math.min(end, start + 200));
    const span = [start, end] as const;

    if (/^export\s+default\b/.test(head)) {
      regions.set("default", span);
      const named = head.match(
        /^export\s+default\s+(?:async\s+)?(?:function|class)\s+([A-Za-z0-9_$]+)/,
      );
      if (named) regions.set(named[1]!, span);
      return;
    }
    const destructured = head.match(/^export\s+(?:const|let|var)\s*\{([^}]*)\}/);
    if (destructured) {
      for (const raw of destructured[1]!.split(",")) {
        const name = raw
          .trim()
          .split(/\s*:\s*/)
          .pop()
          ?.trim();
        if (name && /^[A-Za-z0-9_$]+$/.test(name)) regions.set(name, span);
      }
      return;
    }
    const declared = head.match(
      /^(?:export\s+)?(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z0-9_$]+)/,
    );
    if (declared) regions.set(declared[1]!, span);
  });

  declarationCache.set(file, regions);
  return regions;
}

/** `export { A, B as C } from "…"` and `export * from "…"` — the forwarding a name can hide behind. */
const REEXPORT_NAMED = /^export\s+\{([^}]*)\}\s*from\s*["']([^"']+)["']/gm;
const REEXPORT_STAR = /^export\s*\*\s*from\s*["']([^"']+)["']/gm;

export function reexportTargetsOf(file: string, name: string): RenderNode[] {
  const source = readSource(file);
  const targets: RenderNode[] = [];
  for (const match of source.matchAll(REEXPORT_NAMED)) {
    const target = resolveSpecifier(file, match[2]!);
    if (target === null) continue;
    for (const raw of match[1]!.split(",")) {
      const member = raw.trim();
      if (member.length === 0 || /^type\b/.test(member)) continue;
      const aliased = member.match(/^([A-Za-z0-9_$]+)\s+as\s+([A-Za-z0-9_$]+)$/);
      if (aliased) {
        if (aliased[2] === name) targets.push({ file: target, name: aliased[1]! });
      } else if (member === name) {
        targets.push({ file: target, name });
      }
    }
  }
  for (const match of source.matchAll(REEXPORT_STAR)) {
    const target = resolveSpecifier(file, match[1]!);
    if (target !== null) targets.push({ file: target, name });
  }
  return targets;
}

/**
 * Does this binding lead to `module`'s `name`, through however many re-export hops?
 *
 * `seen` is a cycle guard: two barrels re-exporting each other is a legal thing to write and an
 * infinite walk otherwise. The depth cap is belt-and-braces on the same hazard.
 *
 * PARAMETERISED OVER THE TARGET because whole-branch review caught the obvious omission: PR4's
 * Rulings BB and BF were applied to `StatGrid` and skipped for `StatTile` in the same commit, one
 * line apart, and the previous round's own report named it "the same door one component over"
 * without walking through it. Both directions were reachable for the tile — a local or barrelled
 * `StatTile` counted a grid as migrated while rendering no tile (a phantom, which nets against a
 * real removal), and an aliased `import { StatTile as Tile }` dropped its grid out of the migrated
 * bucket entirely.
 *
 * The same chase is what the heading walk's `nodeSpan` performs through {@link reexportTargetsOf}:
 * PR3 kept that branch alive specifically so a barrel-exported component could not drop silently
 * out of a count, and the scanner written after it did not chase re-exports. Leaving that door
 * ajar in each new scanner is how this programme kept paying for the same bug — which is half the
 * reason there is now one resolver instead of two.
 */
export function resolvesTo(
  node: RenderNode,
  module: string,
  name: string,
  seen: Set<string> = new Set(),
): boolean {
  if (node.file === module) return node.name === name;
  if (node.name === null) return false;
  const key = `${node.file}#${node.name}`;
  if (seen.has(key) || seen.size > 8) return false;
  seen.add(key);
  return reexportTargetsOf(node.file, node.name).some((target) =>
    resolvesTo(target, module, name, seen),
  );
}

/* ---------------------------------------------------------------------------------------------
 * WHAT A RENDER ROOT ACTUALLY RETURNS
 * ------------------------------------------------------------------------------------------ */

/**
 * ONE NODE of what a render root returns, with its children — a direct child of the returned
 * fragment (or the returned element itself when the file returns a single element), and then that
 * node's own element children, recursively.
 *
 * A TREE, not a flat tag list. The first version of this type carried `subtree: string[]`, every
 * tag under the node, and the T-046 review defeated the counter built on it in one move: `some(tag
 * => isContainer(tag))` over a flat list says "a container exists somewhere below", which is true
 * of `<div><PageContainer/><section>loose body</section></div>` — a container and an uncontained
 * body as SIBLINGS. Structure is the whole question a containment counter asks, so the structure
 * has to survive the walk.
 *
 * `children` follows JSX children only. Elements written inside an attribute expression
 * ({@link ScannedElement.inProp}) are deliberately absent: `<Explorer panel={<PageContainer>…
 * </PageContainer>}>` passes a sibling panel, it does not wrap the explorer's body, and a caller
 * asking "is this node's content inside a container" must not be answered yes by a container handed
 * to it as a prop.
 *
 * `inExpression` is {@link ScannedElement.inExpression}, carried through unchanged.
 */
export type RenderTreeNode = {
  readonly tag: string;
  readonly spelling: string | null;
  readonly inExpression: boolean;
  readonly children: readonly RenderTreeNode[];
};

/**
 * A `return` that begins a render root's OWN output.
 *
 * COLUMN 2, not "any `return` followed by `<`", and the indent is the whole rule. A `return
 * <li …/>` inside a `.map(…)` callback is a list item, not a page: counting it as a top-level
 * render node would credit every row of every table with whatever container its callback happens
 * to sit in. Prettier (`docs/conventions.md`) indents a top-level function's own statements by
 * exactly two spaces and anything nested deeper by more, which is the same guarantee — one level
 * in — that {@link TOP_LEVEL_BOUNDARY}'s column-0 rule leans on, and it is read off
 * {@link maskedSource} for the same reason: Prettier does not reindent template-literal interiors,
 * so a `  return <` inside a backtick would otherwise open a phantom render tree.
 *
 * EVERY matching `return` inside the `default` declaration contributes, not just the last one: an
 * early `return` renders a whole screen to a reader exactly as the final one does.
 */
const RETURNED_JSX = /^ {2}return\s*(?:\(\s*)?(?=<)/gm;

const renderTreeCache = perFileCache<RenderTreeNode[]>();

/**
 * The top-level nodes of every JSX a render root's DEFAULT export returns.
 *
 * SCOPE, stated because a counter built on this inherits all of it:
 *
 *   - the `default` declaration only, located through {@link declarationRegions}. A page whose
 *     body is assembled in a named helper in the same file and rendered as `{renderBody()}` has
 *     its body nodes counted as ONE node (the call expression is not an element at all), not as
 *     the sections the helper writes;
 *   - a file with no `default` region — there is none under `PAGE_ROOTS` today — yields nothing,
 *     which reads downstream as "no uncontained node", the silent-pass direction. The caller is
 *     expected to assert the walk is non-empty rather than trust the zero;
 *   - tags only, never resolved: each node holds the source spelling of its tag. Deciding that a
 *     `PageContainer` in the tree is THE `PageContainer` is the caller's job, through
 *     {@link importBindingsOf} and {@link resolvesTo};
 *   - `inExpression` records that an element is written inside a `{…}`, never whether the
 *     expression is true. `{false && <X/>}` and `{isLoggedIn && <X/>}` are the same fact here, and
 *     a caller treating an element as PROOF of something must read the flag and treat both as
 *     unproven — see {@link ScannedElement.inExpression}.
 */
export function topLevelRenderNodes(file: string): RenderTreeNode[] {
  const hit = renderTreeCache.get(file);
  if (hit) return hit;

  const source = readSource(file);
  const region = declarationRegions(file).get("default");
  const nodes: RenderTreeNode[] = [];

  if (region) {
    const [start, end] = region;
    for (const match of maskedSource(file).matchAll(RETURNED_JSX)) {
      const at = match.index;
      if (at < start || at >= end) continue;
      const elements = scanJsx(source.slice(at + match[0].length, end));
      const root = elements[0];
      if (root === undefined) continue;
      const build = (index: number): RenderTreeNode => {
        const element = elements[index]!;
        return {
          tag: element.tag,
          spelling: element.spelling,
          inExpression: element.inExpression,
          children: element.children.map(build),
        };
      };
      // A fragment is not a node of its own; a returned element is its own only top-level node.
      for (const index of root.tag === "" ? root.children : [0]) nodes.push(build(index));
    }
  }

  renderTreeCache.set(file, nodes);
  return nodes;
}
