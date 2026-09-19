import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { stripComments } from "@/lib/test-support/strip-comments";
import {
  CARD_FIXTURE,
  COMPUTED_CLASSNAME,
  type RenderNode,
  type ScannedElement,
  importBindingsOf,
  jsxElementsOf,
  label,
  maskedSource,
  readSource,
  repoRoot,
  resolvesTo,
  scanJsx,
  walkCardSurface,
  withInjectedSource,
} from "@/lib/test-support/composition-scan";

/* -------------------------------------------------------------------------------------------
 * T-035 PR4 — the card surface. Two ratchets, a stat-grid counter, and the three populations PR4
 * is forbidden to touch, each pinned rather than merely described.
 *
 * T-045 split the original `page-composition.test.ts` three ways and moved the scanner itself to
 * `lib/test-support/composition-scan.ts`. What is imported from there: `walkCardSurface` and the
 * other walkers, `readSource`, the injection harness (`withInjectedSource`, `CARD_FIXTURE`, and
 * the registered `jsxElementsOf` memo), `scanJsx` and the ONE literal extractor behind it, and the
 * binding resolver `resolvesTo` / `importBindingsOf` that `isGridShell` and `isStatTileElement`
 * below are built on. What stays here: the predicates, the counters, their docblocks, their
 * mutation records and the three membership tables. The container and breadcrumb counters are in
 * `components/v2/page-composition-containers.test.ts`, the heading counters in
 * `components/v2/page-composition-headings.test.ts`.
 *
 * THE CROSS-SCANNER GUARD IS GONE BECAUSE THE SECOND SCANNER IS. It pinned 22 `<div>`s where this
 * section's extractor and PR3's disagreed; there is one extractor now, so both halves moved to
 * `lib/test-support/composition-scan.test.ts` — the 22 pinned directly as the template-hole
 * population, and the agreement asserted with no normalisation at all.
 * ---------------------------------------------------------------------------------------- */

/**
 * ONE TAILWIND TOKEN, reduced to what it names.
 *
 * Variant prefixes (`sm:`, `dark:`, `hover:`) and an `/opacity` suffix are stripped, then the
 * comparison is EQUALITY on the reduced token, never a substring test. Both halves are
 * load-bearing:
 *
 *   - equality is what stops the `group/btn` family of false positives that has already produced
 *     one wrong figure in this programme — `bg-card-foreground` contains `bg-card` and is a text
 *     colour, not a surface;
 *   - stripping `/NN` is what makes `bg-card/85` and `border-border/80` count, which they must:
 *     `dunya/[slug]/page.tsx`'s 12 backdrop panels (`bg-card/85`) and
 *     `v2-tool-educational-content.tsx`'s 12 panels (`border-border/80`) are the same surface at
 *     reduced opacity. Requiring a bare token instead reads 406 / 73 files, so 84 of the 490
 *     hold their surface or their edge at reduced opacity and nothing else.
 */
function baseToken(token: string): string {
  const withoutVariants = token.slice(token.lastIndexOf(":") + 1).replace(/^[-!]/, "");
  const slash = withoutVariants.indexOf("/");
  return slash === -1 ? withoutVariants : withoutVariants.slice(0, slash);
}

function tokensOf(spelling: string | null): string[] {
  if (spelling === null || spelling === COMPUTED_CLASSNAME) return [];
  return spelling.split(/\s+/).filter(Boolean).map(baseToken);
}

/** The six exports of `components/ui/card.tsx`. An element wearing one of these tags is the
 * primitive doing its job, never a hand-drawn card, whatever its className says.
 *
 * Was seven. Task 5 deleted `CardAction`: it was exported and rendered nowhere in the tree, and
 * `docs/design.md`'s T-036 rule is that a component with no product call site is deleted rather
 * than kept alive for the showcase. */
const CARD_PRIMITIVE_TAGS = new Set([
  "Card",
  "CardHeader",
  "CardFooter",
  "CardTitle",
  "CardDescription",
  "CardContent",
]);

const CARD_ROUNDING = new Set(["rounded-xl", "rounded-2xl", "rounded-3xl"]);

type CardKind = "card" | "well";

/**
 * The TOKEN half of the predicate, with no opinion about the tag.
 *
 * Split out of {@link cardKind} so the tag exclusion is the ONLY difference between the
 * hand-drawn counters and {@link STOCK_CARD_SURFACE_OVERRIDES} below. Two copies of "rounding plus
 * `bg-card` and/or `border-border`" would drift, and the second counter exists precisely to watch
 * the door the first one's tag rule opens — a divergence between them would be the hole reopening
 * inside the thing built to observe it.
 */
function cardSurfaceKind(element: ScannedElement): CardKind | null {
  const tokens = tokensOf(element.spelling);
  if (!tokens.some((token) => CARD_ROUNDING.has(token))) return null;
  const surface = tokens.includes("bg-card");
  const edge = tokens.includes("border-border");
  if (!surface && !edge) return null;
  return surface ? "card" : "well";
}

function cardKind(element: ScannedElement): CardKind | null {
  if (CARD_PRIMITIVE_TAGS.has(element.tag)) return null;
  return cardSurfaceKind(element);
}

function handDrawnByFile(): Map<string, { cards: number; wells: number }> {
  const byFile = new Map<string, { cards: number; wells: number }>();
  for (const file of walkCardSurface()) {
    let cards = 0;
    let wells = 0;
    for (const element of jsxElementsOf(file)) {
      const kind = cardKind(element);
      if (kind === "card") cards += 1;
      else if (kind === "well") wells += 1;
    }
    if (cards + wells > 0) byFile.set(file, { cards, wells });
  }
  return byFile;
}

function handDrawnTotals(): { cards: number; wells: number; files: number } {
  const byFile = handDrawnByFile();
  let cards = 0;
  let wells = 0;
  for (const counts of byFile.values()) {
    cards += counts.cards;
    wells += counts.wells;
  }
  return { cards, wells, files: byFile.size };
}

/**
 * How many DISTINCT spellings the hand-drawn population writes.
 *
 * Whole-branch review's M3: this figure lived only as prose in the docblock above ("239 distinct
 * spellings"), so nothing in the suite would ever have noticed it drifting — in a file whose whole
 * argument is that its numbers are measured rather than asserted. It is the figure that says
 * whether the population is a long tail of one-offs (fine) or a handful of spellings carrying most
 * of the occurrences (a variant waiting to be built), so it is the one most worth watching.
 */
function handDrawnSpellings(): number {
  const spellings = new Set<string>();
  for (const file of walkCardSurface()) {
    for (const element of jsxElementsOf(file)) {
      // `spelling` is nullable on a `ScannedElement` (an element with no className attribute).
      // Such an element never satisfies `cardKind`, so the guard is belt-and-braces — but the
      // alternative is a `!` that would silently start counting `null` as a spelling if the
      // predicate ever widened.
      if (cardKind(element) !== null && element.spelling !== null) spellings.add(element.spelling);
    }
  }
  return spellings.size;
}

function handDrawnReport(pick: (counts: { cards: number; wells: number }) => number): string {
  return [...handDrawnByFile()]
    .map(([file, counts]) => [label(file), pick(counts)] as const)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([file, n]) => `  ${n}x ${file}`)
    .join("\n");
}

/**
 * WHAT A CARD IS, BEFORE ANYTHING IS COUNTED.
 *
 * A **hand-drawn card** is a JSX element on the surface {@link walkCardSurface} scans whose tag is
 * not one of `components/ui/card.tsx`'s seven exports, and whose readable `className` carries
 *
 *   a rounding token — `rounded-xl` | `rounded-2xl` | `rounded-3xl` — together with
 *   a card surface (`bg-card`, any opacity) and/or a `border-border` edge (any opacity).
 *
 * The counting unit is ONE ELEMENT, never one class string and never one `cn()` fragment. An
 * element written `cn("rounded-2xl bg-card", condition && "border-border")` is one card whose
 * spelling is the ordered join of its literal fragments.
 *
 * **359 elements across 58 files, at 235 distinct spellings**, satisfy that predicate today, and
 * that single number hides two different design problems, so it is pinned as two:
 *
 * | population                                                      | n       | pinned by |
 * | --------------------------------------------------------------- | ------- | --------- |
 * | {@link HAND_DRAWN_CARDS} — a real `bg-card` surface              | **190** | its own `it` |
 * | {@link HAND_DRAWN_WELLS} — no `bg-card`, qualifying via the edge | **169** | its own `it` |
 * | files holding either                                             | **58**  | the disjointness `it` |
 * | {@link HAND_DRAWN_CARD_SPELLINGS}                                | **235** | its own `it` |
 *
 * THIS TABLE HAD DRIFTED AGAIN, AND THE MERGE IS WHERE IT WAS CAUGHT. It read 195 / 168 / 60 / 238
 * above pins of 189 / 169 / 58 / 234 — stale by the whole of Tasks 6 and 8, the exact defect M3
 * names one paragraph down, re-committed in the same file that forbids it. The figures above are
 * now the merged tree's measured values, every one of them asserted below.
 *
 * EVERY FIGURE IN THIS TABLE IS ASSERTED. Whole-branch review's M3 caught it reading 409/68/239
 * with `HAND_DRAWN_CARDS` at 241 — a task out of date, three screens above the pin that said 191,
 * in a file whose whole argument is that its numbers are measured. The spelling figure was the
 * worst of it: prose in a docblock, pinned by nothing, so nothing would ever have noticed it
 * drift. A stale headline above a correct pin is worse than no headline, so the rule now is that
 * this table may only contain numbers something fails on.
 *
 * Of the 168: 124 are `bg-muted*`, 20 `bg-gradient-to-b`, 7 carry no background token at all, and
 * 17 carry something else (5 `bg-background`, 5 other gradient directions, 7 arbitrary map colours
 * such as `bg-[var(--map-sea,#dbe7e8)]`). They read as insets and wells, not as cards, and a
 * `Card` variant sized for them would be the wrong variant.
 *
 * **The 168 are counted, not excluded, and that is the whole point of the split.** Dropping them
 * would let PR4 report "241 hand-drawn cards, all migrated" while 168 elements still hand-draw a
 * panel — duplication hidden behind a definition, which is exactly the defect PR1 shipped and PR3
 * spent four review rounds removing. Two ratchets keep both visible; one number would not.
 *
 * ## WHAT THESE TWO NUMBERS ARE, AND WHAT THEY ARE NOT
 *
 * They are **ratchets that can only fall**. Neither will ever read zero, and neither is trying
 * to: 181 of the 239 spellings occur exactly once, and a one-off panel written inline is not a
 * defect. What is a defect is a handful of spellings carrying a large share of the occurrences.
 * That was 21 spellings carrying 197 of 486 when Task 4 pinned these; Task 5 took 77 of them
 * (see below) and Task 6 took 50 of the Metric Strip tile's 56, leaving that spelling at 6
 * (`kitaplar/[slug]`'s facts sheet and `deprem/fay-hatlari`'s deliberately-unmigrated strip). That is what a variant is for,
 * and that is what these numbers are here to make visible when it lands.
 *
 * So: lower is progress, a rise is a regression that has to be argued for, and "0" is not the
 * target. A counter whose name implies an end state it cannot reach is the defect PR3 spent four
 * review rounds removing; these two are named for what they hold, not for a finish line.
 *
 * ## THE THREE POPULATIONS PR4 MUST NOT TOUCH
 *
 * All three are inside the 409 — they are cards by the predicate — and each is pinned below by
 * MEMBERSHIP, `file <tag>` per element, never by a count. A count is gameable in exactly the way
 * these populations invite: ~16 of the 37 interactive carriers live in files the adoption task
 * opens, so migrating one card-shaped `<Link>` while adding another elsewhere in the same PR
 * leaves a tally of 28 untouched and green. Membership names both halves of that trade.
 *
 *   - {@link CARD_SHAPED_PRIMITIVES} (8) — design-system primitives wearing card chrome.
 *   - {@link MAP_VIEWPORTS} (11) — a rounded, bordered box around an `aspect-[…]` canvas.
 *   - {@link INTERACTIVE_CARD_CARRIERS} (37) — `<Link>` ×28, `<a>` ×5, `<button>` ×4.
 *
 * ## SCOPE — what this scanner cannot see
 *
 * Every claim above is a claim about SOURCE TEXT read by {@link scanJsx}, never about a rendered
 * DOM or a computed style. Specifically:
 *
 *   1. **A className assembled out of identifiers is invisible.** Only string and template
 *      literals written inside the attribute are read. `className={CARD_SHELL}`, where
 *      `CARD_SHELL` is a module constant holding the card tokens, reads as
 *      {@link COMPUTED_CLASSNAME} and counts as nothing. This is the one blind spot that can
 *      SUBTRACT from a ratchet without anything migrating, so it is the one blind spot with its
 *      own counter: {@link COMPUTED_CARD_CLASSNAMES} pins the size of the invisible population at
 *      278, and the first element that stops writing its classes inline moves it. That counter is
 *      noisy by construction — every `className={styles.x}` and `className={props.className}` on
 *      the surface is in it — and that is the price of the hole being observed at all.
 *   2. **A ternary className is credited with BOTH branches.**
 *      `components/v2/v2-register-card.tsx` writes
 *      `className={inModal ? "w-full" : "relative w-full rounded-3xl … bg-card/95 …"}`; the
 *      scanner joins both literals, so that element counts as one card even in the render where
 *      it is a bare `w-full` wrapper. It is the only such element on the surface today, and it
 *      is counted once, not twice.
 *   3. **A `cva()` base is not a `className`, but a `components/ui` file is not all `cva()`.**
 *      `input.tsx`, `select.tsx`, `tabs.tsx` and `dialog.tsx` carry their card-ish chrome inside
 *      `cva()` calls, which this scanner never reads. `custom-select.tsx` does NOT: its trigger
 *      `<button>` and popover `<div>` write real JSX `className`s and were counted until
 *      `components/ui/**` was excluded from the walk, as were `accordion.tsx`'s item shell and
 *      `card.tsx`'s own root `<div>`. The directory exclusion, not the `cva()` idiom, is what
 *      keeps design-system internals out; the 8 primitives below are counted at their USE sites.
 *   4. **The `<Card*>` tag exclusion is inert, and stayed inert through the adoption.** 170
 *      `<Card*>` elements now exist across 37 importers (93 across 9 before Task 5 converted 77
 *      sites), and NONE of them writes a rounding token with a card surface, so excluding them
 *      removes nothing — measured after the adoption, not assumed: neutering the tag set fails its
 *      own control and moves no counter. The reason it stays inert is that a variant card writes
 *      NO `className` at all (`className?: never`), so it is invisible to this scanner by the
 *      no-classes rule, not by the tag rule.
 *
 *      **What the tag rule actually does, stated correctly (Ruling AV).** It keeps a
 *      `<Card className="rounded-2xl bg-card …">` override from RE-ENTERING the hand-drawn count;
 *      it does not DETECT one. `cardKind` declines to look at any `<Card*>` element, so such an
 *      override would move no counter here at all — and since Ruling AS closed the variant form,
 *      the stock branch is the one remaining way to hand-draw a card surface unobserved. That door
 *      is watched by {@link STOCK_CARD_SURFACE_OVERRIDES}, which applies this section's own token
 *      test exactly where this rule declines to: exclusion here, observation there.
 *   5. **The token list is closed, and the residue has a number.** `rounded-lg` is not a card
 *      rounding (admitting it reads 496 / 79 files over the pre-exclusion surface), and
 *      `bg-muted`, `bg-background` and `bg-popover` are not card surfaces unless a `border-border`
 *      edge is also present. The largest thing that rules out: **32 elements carry a card rounding
 *      token and a `bg-muted*` background with NO border at all.** They are wells by eye and
 *      invisible to {@link HAND_DRAWN_WELLS}. Admitting them would make the well predicate
 *      "rounded + any muted-ish background", which sweeps in badges and pills; leaving them out is
 *      a decision, and 32 is its cost.
 *   6. **No line numbers, anywhere.** {@link readSource} collapses each comment to a single
 *      space, so an index into it is not a source line — the mistake that reported one strip at
 *      126 when it is at 141 during the measurement, boarded as T-043. Every failure message
 *      below names FILES.
 *   7. **Outside the walk nothing is seen at all.** A card written in `components/ui`,
 *      `components/showcase`, `app/[locale]/design-system`, `app/global-error.tsx` or
 *      `app/not-found.tsx` moves nothing.
 *
 * MEASURED 2026-09-18 against the tree at `b7649a6`, not predicted, and invariant across PR3:
 * measured at `a2b3d61` (`dev` before PR3) by the same scanner, every figure identical, tag tally
 * and well breakdown included — PR3 changed 29 files under `app/` and `components/`, the hero
 * block and 34 new lines in `v2-game-screen.tsx` among them, and moved nothing here. Re-run over
 * every tracked `.tsx` in the repo rather than the walk: 492 / 79 files, the six extras being the
 * four `components/ui` internals named above plus `app/[locale]/design-system/page.tsx` and
 * `components/showcase/specimens/harita.tsx`. No card-shaped class string lives anywhere else.
 *
 * TASK 5 (2026-09-18) adopted three `Card` variants at every site whose spelling they were derived
 * from — 77 elements across 29 files: `panel` 52 (the `rounded-3xl border border-border bg-card
 * p-6 sm:p-8` surface at 9 spellings differing only in `shadow-*` and `space-y-*`), `glass` 12 (the
 * `bg-card/85 backdrop-blur-md` hero strip) and `feature` 13 (the gradient hero plate, one per hub
 * page). 64 of the 77 carried a real `bg-card` token and 13 did not — the gradient plate writes
 * `from-card via-card`, so it was a WELL by this predicate all along: `HAND_DRAWN_CARDS` 305 → 241
 * (−64) and `HAND_DRAWN_WELLS` 181 → 168 (−13), with the file count 74 → 68 (six files — the four
 * auth pages, `components/marine/marine-attribution.tsx` and `components/v2/v2-profile-form.tsx` —
 * held nothing else) and the spelling count 250 → 239. The stat-grid trio did NOT move
 * (62 / 35 / 159): no converted element was a
 * direct child of a qualifying grid, checked by simulation before the edit and re-read after. A
 * fourth measured surface, `rounded-2xl bg-card p-4 shadow-2xs`, was deliberately NOT built —
 * every one of its 56 occurrences (52 + the 4 in `turkiye/bolge/page.tsx` that add `space-y-1`) is
 * a Metric Strip tile, and every other `rounded-2xl bg-card` spelling with 3+ occurrences is a
 * stat-grid tile, so the variant would have had no consumer that is not Task 6's.
 *
 * MUTATION-CHECKED 2026-09-18, each counter at the value it is pinned at, each reverted. The
 * probes deliberately avoid files Task 5 or Task 6 is contracted to rewrite, so a reader can
 * still reproduce them after the adoption lands. The first two were re-run at the POST-adoption
 * values, because a target that moved 305 → 241 was never shown to fail at 241 by a check that
 * ran at 305:
 *
 *   - one `rounded-2xl bg-card border border-border` probe added to `hakkimizda/page.tsx` — RED,
 *     `expected 242 to be 241`, the message naming `2x app/[locale]/(site)/hakkimizda/page.tsx`
 *     among the files it lists (it read `expected 306 to be 305` before the adoption);
 *   - the same probe spelled `bg-muted/30` instead — RED, `expected 169 to be 168`, same file
 *     named, and `HAND_DRAWN_CARDS` unmoved, which is the split doing its job;
 *   - a card moved from children into an attribute expression on the fixture — the counters see
 *     it either way, so a codemod that pushes cards into props cannot make this number fall;
 *   - `token.includes("bg-card")` in place of the equality test — RED on the substring control
 *     ONLY, every counter unmoved. See that control's own comment: the trap is LATENT, and the
 *     latency is now asserted rather than merely disclosed.
 *   - `CARD_PRIMITIVE_TAGS` neutered — RED on its control only, every counter unmoved, which is
 *     SCOPE note 4 measured rather than asserted.
 *
 * TASK 6 (2026-09-18) then took the fourth surface Task 5 deliberately did not build. The note
 * above calls it `rounded-2xl bg-card p-4 shadow-2xs` with 56 occurrences, every one a Metric
 * Strip tile; 50 of them are now `<StatTile>` and the tile draws the surface inside the component,
 * so `HAND_DRAWN_CARDS` reads 241 → **191** (−50) and `HAND_DRAWN_WELLS` is unmoved at 168. The
 * remaining 6 are `kitaplar/[slug]`'s inverted facts sheet (4, deliberately left — a different
 * component) and the two `turkiye/bolge` grids that add `space-y-1`.
 *
 * SUPERSEDED — THE 191 ABOVE IS HISTORY, NOT THE PIN. Ruling BG then took
 * `deprem/fay-hatlari`'s strip back OUT of the migration (its three fault values are categorical
 * identifiers that must agree with the fault cards on the same page), returning its 4 tiles to the
 * hand-drawn population: **191 → 195**, wells still 168, files still 60. So 46 of the 56 Metric
 * Strip tiles are `<StatTile>` and 10 remain — `kitaplar/[slug]`'s 4, `fay-hatlari`'s 4, and the
 * two `turkiye/bolge` grids that add `space-y-1`.
 *
 * RE-CHECKED AT 195 / 168 / 60 / 238, per Ruling AZ — a control proved at 191 proves nothing at
 * 195, which is the rule this block's own heading states and which an earlier version of it broke
 * by leaving the 191 evidence standing above a 195 pin:
 *
 *   - the two-tile `rounded-2xl bg-card border border-border` grid probe on `hakkimizda/page.tsx`
 *     — RED at `expected 197 to be 195` (two cards, so +2), RED on
 *     {@link HAND_DRAWN_CARD_SPELLINGS} at `expected 239 to be 238`, and RED on
 *     {@link STAT_GRIDS_TOTAL} at `expected 63 to be 62`, which is correct: the probe CREATES a
 *     grid rather than migrating one, and creating one is the other thing the total may notice.
 *   - the `bg-muted/30` spelling of it — RED on `HAND_DRAWN_WELLS` (`expected 169 to be 168`)
 *     with `HAND_DRAWN_CARDS` unmoved, so the split still splits.
 *   - a NOVEL SPELLING probe (a card class string occurring nowhere else) — RED on
 *     {@link HAND_DRAWN_CARD_SPELLINGS} at `expected 239 to be 238` with `HAND_DRAWN_CARDS` RED at
 *     196 alongside. That is the spelling counter's first mutation check; it had none when it was
 *     introduced, which is the gap re-review named.
 *
 * SUPERSEDED AGAIN — T-035 PR5 Task 9, and this time the movement is a REMOVAL rather than a
 * re-classification. The six hand-written FAQ blocks were converged onto
 * `components/patterns/faq-section.tsx`, whose items are `<Card variant="panel">` rather than a
 * hand-drawn surface, so their item wrappers left this population outright:
 * **195 → 192 cards, 168 → 166 wells, 238 → 235 spellings, 363 → 358 total.**
 *
 * The stat-grid family moved with them, which was not obvious until it was measured: a FAQ item
 * is a bold line over a muted line inside a `grid`, so the four static FAQ grids satisfied the
 * hand-rolled TILE predicate too. **50 → 46 grids, 26 → 25 files, 113 → 109 tiles, 62 → 58
 * total.** Nothing migrated to `<StatTile>` — four grids stopped existing — which is why
 * `SURFACE_FILES_RENDERING_STATTILE` is unmoved at 12 and must be read beside these four.
 *
 * RE-CHECKED AT 192 / 166 / 235 / 358, Ruling AZ again — a control proved at 195 proves nothing
 * at 192:
 *
 *   - the two-tile `rounded-2xl bg-card border border-border` grid probe on `hakkimizda/page.tsx`
 *     — RED at `expected 194 to be 192`, RED on {@link HAND_DRAWN_CARD_SPELLINGS} at `expected 236
 *     to be 235`, and RED on {@link STAT_GRIDS_TOTAL} at `expected 59 to be 58`.
 *   - the `bg-muted/30` spelling of it — RED on `HAND_DRAWN_WELLS` at `expected 167 to be 166`
 *     with `HAND_DRAWN_CARDS` unmoved at 192, so the split still splits.
 *   - a NOVEL SPELLING probe — RED on {@link HAND_DRAWN_CARD_SPELLINGS} at `expected 236 to be
 *     235` with `HAND_DRAWN_CARDS` RED at 193 alongside.
 *
 * MOVED AGAIN — T-042, and the reason must not be misread as adoption. NOTHING WAS CONVERTED.
 * Three files left the scanned surface:
 *
 *   - `components/patterns/theme-pair.tsx` moved to `components/showcase/theme-pair.tsx`, which
 *     {@link CARD_SCAN_EXCLUSIONS} excludes — showcase markup must not answer for product markup;
 *   - `components/patterns/empty-state.tsx` and `components/patterns/map-legend.tsx` were
 *     DELETED. Both were reachable only from `/design-system`, so the card surfaces they drew
 *     were never on a page a reader could open.
 *
 * **192 → 188 cards, 235 → 231 spellings, 358 → 354 total, 60 → 57 files**, wells unmoved at 166.
 * A ratchet that falls because dead code was removed is not progress on the adoption it counts,
 * which is why the cause is written down beside the number.
 *
 * RE-CHECKED AT 188 / 166 / 231 / 354 (T-033's arrival then took cards, spellings and the
 * total to 189 / 232 / 355 — see the docblock on {@link HAND_DRAWN_CARDS}), Ruling AZ again — a control proved at 192 proves nothing
 * at 188. All three probes on `app/[locale]/(site)/hakkimizda/page.tsx`, each reverted:
 *
 *   - the two-tile `rounded-2xl bg-card border border-border` stat grid — RED at `expected 190
 *     to be 188`, RED on {@link HAND_DRAWN_CARD_SPELLINGS} at `expected 232 to be 231`, and RED
 *     on {@link STAT_GRIDS_TOTAL} at `expected 59 to be 58`, `STAT_GRID_FILES` at `expected 26
 *     to be 25` and `STAT_TILES_WITHOUT_STATTILE` at `expected 111 to be 109` — the probe CREATES
 *     a grid rather than migrating one, which is the other thing those totals may notice.
 *   - the `bg-muted/30` spelling of it — RED on `HAND_DRAWN_WELLS` at `expected 167 to be 166`
 *     with `HAND_DRAWN_CARDS` unmoved at 188, so the split still splits.
 *   - a NOVEL SPELLING probe (a card class string occurring nowhere else) — RED on
 *     {@link HAND_DRAWN_CARD_SPELLINGS} at `expected 232 to be 231` with `HAND_DRAWN_CARDS` RED
 *     at 189 alongside.
 * T-031c TASK 6 — THE MARINE CLUSTER, +2 WELLS AND +1 SPELLING, AND THE CAUSE IS REAL.
 *
 * **166 → 168 wells, 231 → 232 spellings, 354 → 356 total**, cards unmoved at 188.
 *
 * `components/v2/v2-marine-map-explorer.tsx`'s telemetry grid drew three panels: the water
 * temperature one on `bg-primary/10 border border-primary/20`, and one each for wave height and
 * wind on the same shape in cyan and teal. The palette inventory rules those two `decoration`
 * — the heading names the measure, and two panels differing only in hue is panel variety, not
 * an encoding — so they de-tinted to `bg-muted/40 border border-border/60`.
 *
 * That is what moved this census: a panel drawn with a PALETTE border was never a hand-drawn
 * well, and the same panel drawn with `border-border` is. So the two panels did not appear,
 * they became VISIBLE to a predicate keyed on `border-border`. The count rising is the honest
 * reading and re-recording it is the right response — the alternative was picking a border
 * colour to keep a number still, which is the failure mode this file exists to catch.
 *
 * RE-CHECKED AT 188 / 168 / 232 / 356, Ruling AZ again — a control proved at 166 proves nothing
 * at 168. Both probes on `app/[locale]/(site)/hakkimizda/page.tsx`, each reverted:
 *
 *   - the `bg-muted/30` well probe — RED on {@link HAND_DRAWN_WELLS} at `expected 169 to be
 *     168` with {@link HAND_DRAWN_CARDS} unmoved at 188, so the split still splits.
 *   - a two-element `rounded-2xl bg-card border border-border` card probe — RED on
 *     {@link HAND_DRAWN_CARDS} at `expected 190 to be 188` and on
 *     {@link HAND_DRAWN_CARD_SPELLINGS} at `expected 233 to be 232` (the string occurs nowhere
 *     else, so it is a novel spelling too), with {@link HAND_DRAWN_WELLS} unmoved at 168 —
 *     the other half of the same property.
 *
 * MOVED AGAIN BY T-031c TASK 8, 188 / 168 / 232 / 356 -> **189 / 169 / 234 / 358**, and for the
 * same reason Task 6's move had. `turkiye/bolge/[slug]/page.tsx` carried two callouts whose
 * surface was a mood rather than a scale: an elevation banner and a GDP-contribution figure,
 * both drawn on a palette tint with a palette border. The inventory rules both `decoration`, so
 * they take the neutral surfaces the SAME PAGE already uses one section over — a 30% muted well
 * for the banner that stands beside three of them, and the card surface for the one nested
 * inside a muted panel.
 *
 * Neither element appeared. Both became VISIBLE to predicates keyed on `border-border` and
 * `bg-card`, which a palette border and a palette tint had hidden them from. One lands in each
 * bucket, which is the split doing its job.
 *
 * THE STAT TRIO MOVES FOR A DIFFERENT REASON, AND ONLY ONE OF THE TWO MOVES IT. An earlier
 * version of this block said both callouts are tile-shaped "so the stat trio moves with them".
 * That is wrong about the cause, and the cause is what the next auditor reads against Ruling
 * AZ. Isolated by reverting one change at a time, on the same tree:
 *
 *   - reverting BOTH SURFACES to their palette tints and keeping both eyebrow colours drops
 *     the four surface pins to 188 / 168 / 232 / 356 and leaves the trio GREEN at
 *     47 / 111 / 59. So the surfaces move this census and NOT the trio.
 *   - reverting ONLY the GDP callout's eyebrow from `text-muted-foreground` back to an
 *     inherited colour, with both surfaces left de-tinted, drops the WHOLE trio to
 *     46 / 109 / 58 (grids `to have a length of 47 but got 46`,
 *     {@link STAT_TILES_WITHOUT_STATTILE} `expected 109 to be 111`,
 *     {@link STAT_GRIDS_TOTAL} `expected 58 to be 59`) while the surface pins hold.
 *
 * So the trio's 46 / 109 / 58 -> **47 / 111 / 59** is caused entirely by ONE label taking the
 * muted text colour, which is what makes that element read as a TILE — a small label over a
 * sized value — and its container read as a grid. The elevation banner contributes nothing to
 * the trio at all. `STAT_GRID_FILES` is unmoved at 25 because the file was already on the list.
 *
 * The alternative was to drop the border, or to pick a surface that keeps the number still.
 * That is the failure mode this file exists to catch, so the number rises instead.
 *
 * RE-CHECKED AT 189 / 169 / 234 / 358 AND 47 / 25 / 111 / 59, Ruling AZ again. Both probes on
 * `app/[locale]/(site)/hakkimizda/page.tsx`, which is in no task's edit set, each reverted:
 *
 *   - a two-element `rounded-2xl border border-border bg-card` grid — RED on
 *     {@link HAND_DRAWN_CARDS} at `expected 191 to be 189`, on
 *     {@link HAND_DRAWN_CARD_SPELLINGS} at `expected 235 to be 234` and on the disjointness
 *     total at `expected 360 to be 358`, with {@link HAND_DRAWN_WELLS} unmoved at 169.
 *   - the same grid drawn as `bg-muted/30 border border-border/80` tiles — RED on
 *     {@link HAND_DRAWN_WELLS} at `expected 171 to be 169` with {@link HAND_DRAWN_CARDS}
 *     unmoved at 189, so the split still splits, AND red across the whole stat trio at the new
 *     values: grids `to have a length of 47 but got 48`, {@link STAT_GRID_FILES}
 *     `expected 26 to be 25`, {@link STAT_TILES_WITHOUT_STATTILE} `expected 113 to be 111`,
 *     {@link STAT_GRIDS_TOTAL} `expected 60 to be 59`.
 */
/**
 * T-033: **188 → 189 cards, 231 → 232 spellings, 354 → 355 total**, wells unmoved at 166.
 *
 * ONE element, and it is an ARRIVAL, not a migration: `components/marine/province-marine-
 * section.tsx`'s reference-point block. It was a hand-drawn card all along — `.provinceBlock`
 * in `marine.module.css`, `background: #fff` plus a `--color-border` hairline — and this
 * census could not see it, because a `styles.x` lookup resolves to a CSS-Module class and
 * never to Tailwind tokens. Retiring that stylesheet made the surface legible to the scanner
 * for the first time, so the number goes UP while the tree gets smaller. That is the census
 * working: the population it measures is "hand-drawn cards the scanner can read", and one
 * just stopped hiding behind a module.
 *
 * It is written INLINE at `rounded-2xl`, not hoisted into a constant and not left at the
 * module's own 10px `--radius`, precisely so it lands here rather than in
 * {@link COMPUTED_CARD_CLASSNAMES}'s invisible population or outside {@link CARD_ROUNDING}
 * altogether. Both of those spellings were available and both would have kept this counter
 * at 188 while the element existed.
 */
/**
 * MERGED WITH T-033: 189 / 169 / 234 / 358 and 189 / 166 / 232 / 355 -> **190 / 169 / 235 / 359**.
 *
 * THE TRAP THIS BLOCK EXISTS TO RECORD. Both branches moved this counter off 188 and both landed
 * on 189 — for DIFFERENT elements. T-031c's is the `turkiye/bolge/[slug]` elevation banner (the
 * block two up); T-033's is the marine reference-point block (the block directly above). git saw
 * two identical `= 189` lines and merged them with NO conflict, which would have shipped a pin
 * that is wrong by exactly one on a tree where both arrivals exist — a counter silently one
 * short is precisely the failure every ratchet in this file is built to catch.
 *
 * So the figures below come from RE-RUNNING the census on the merged tree, not from either
 * branch's record. Each printed delta is the sum of two independent moves, and each was checked
 * against the arithmetic the two branches recorded separately:
 *
 *   - cards      188 + 1 (T-031c Task 8) + 1 (T-033) = **190** — the census said
 *                `1x components/v2/v2-world-continents.tsx: expected 190 to be 189`
 *   - wells      166 + 3 (T-031c Task 8) + 0 = **169**, unmoved by the merge, which is what
 *                T-033's own block claims ("wells unmoved at 166") read on this tree
 *   - spellings  231 + 3 (T-031c) + 1 (T-033) = **235** — `expected 235 to be 234`
 *   - the disjointness total is DERIVED at the assertion (`HAND_DRAWN_CARDS + HAND_DRAWN_WELLS`),
 *     never pinned, so 190 + 169 = **359** follows rather than being chosen.
 */
export const HAND_DRAWN_CARDS = 190;

export const HAND_DRAWN_WELLS = 169;

/** Distinct class strings across both populations. See {@link handDrawnSpellings} for why. */
export const HAND_DRAWN_CARD_SPELLINGS = 235;

/**
 * RULING AV — THE DOOR THE TAG EXCLUSION LEAVES OPEN, NOW WATCHED.
 *
 * `cardKind` returns `null` for every `<Card*>` element, whatever its className says (SCOPE note 4
 * above). That exclusion is right — a primitive doing its job is not a hand-drawn card — but it is
 * a rule about the TAG, so it says nothing about what the className on that tag contains. Task 5's
 * Ruling AS closed the variant form (`className?: never`, plus a runtime strip and a spread order
 * that cannot be defeated — `components/ui/card-variants.test.tsx`), which leaves exactly one way
 * left to hand-draw a card surface without any counter moving:
 *
 *     <Card className="rounded-2xl bg-card border border-border p-4">…</Card>
 *
 * That is the STOCK branch of `components/ui/card.tsx`, which still takes
 * `React.ComponentProps<"div">` and merges whatever it is given. It compiles, it renders a
 * hand-drawn card wearing a primitive's tag, and before this counter nothing in the repo observed
 * it: `HAND_DRAWN_CARDS` declines to look because of the tag, and `components/ui/**` is outside
 * the walk anyway. A documented hole nothing observes is the defect this whole programme keeps
 * having to re-fix; this is the observation.
 *
 * ## What it counts
 *
 * Elements on {@link walkCardSurface}'s surface whose tag IS one of {@link CARD_PRIMITIVE_TAGS} and
 * whose readable className satisfies {@link cardSurfaceKind} — the identical token test the
 * hand-drawn counters use, applied exactly where they decline to look. Both kinds are counted
 * together and neither is split out: the split above exists because a `bg-muted` well wants a
 * different variant from a `bg-card` panel, and a surface override on a primitive is the same
 * defect either way.
 *
 * All six tags, not just `<Card>`: `<CardContent className="rounded-2xl bg-card border-border">`
 * walks through the same door. And every hit is necessarily a STOCK-branch call — a variant card
 * cannot carry a `className` at all, so `<Card variant="panel" className="…">` is a type error
 * before it is a counter error.
 *
 * ## Why 0 is the right pin, and what a non-zero reading would mean
 *
 * MEASURED 2026-09-18 after the adoption: **0**, across 170 `<Card*>` elements in 37 files. This
 * is a counter that should stay at 0 rather than a ratchet that falls: unlike `HAND_DRAWN_CARDS`,
 * which names a real population being worked down, every member of this one is a primitive being
 * used to re-spell the thing the primitive exists to provide. A rise is not progress to be
 * re-pinned, it is a call site to convert to a variant — or, if it genuinely needs width or
 * layout, to wrap.
 *
 * SCOPE, inherited from the scanner and worth stating because the counter reads 0: this sees
 * literal `className` strings only. `<Card className={SHELL}>` with the tokens in a module
 * constant is invisible here exactly as it is to `HAND_DRAWN_CARDS`, and is watched — as a
 * population, not per element — by {@link COMPUTED_CARD_CLASSNAMES}.
 *
 * MUTATION-CHECKED, each reverted. All three probes on `components/patterns/page-container.tsx`;
 * the host was `theme-pair.tsx` until T-042 moved that file off this surface, which is the rule
 * stated one level up — no control may be hosted on a file a later task is contracted to remove:
 *
 *   - `<Card className="rounded-2xl bg-card border border-border p-4" />` — RED,
 *     `expected [ Array(1) ] to have a length of +0 but got 1`, the message printing
 *     `components/patterns/page-container.tsx <Card> :: rounded-2xl bg-card border border-border
 *     p-4`, i.e. the file, the tag AND the spelling to convert;
 *   - the same probe with `bg-muted/30` in place of `bg-card` — also RED, same shape: it qualifies
 *     through `border-border`, which is the "both kinds" rule above doing its job;
 *   - `<Card className="p-4 max-w-sm" />` — GREEN. A primitive taking an ordinary spacing or width
 *     override is legitimate and must not be caught, or the counter becomes noise and gets muted.
 */
export const STOCK_CARD_SURFACE_OVERRIDES = 0;

function stockCardSurfaceOverrides(): string[] {
  const hits: string[] = [];
  for (const file of walkCardSurface()) {
    for (const element of jsxElementsOf(file)) {
      if (!CARD_PRIMITIVE_TAGS.has(element.tag)) continue;
      if (cardSurfaceKind(element) === null) continue;
      hits.push(`${label(file)} <${element.tag}> :: ${element.spelling}`);
    }
  }
  return hits.sort();
}

describe("the card primitive is not used to hand-draw a card surface", () => {
  it("the number of stock-branch surface overrides is exactly the recorded number", () => {
    const hits = stockCardSurfaceOverrides();
    expect(
      hits,
      `<Card*> elements whose className re-spells a card surface — convert to a variant, or wrap if it needs layout:\n${hits
        .map((row) => `  ${row}`)
        .join("\n")}`,
    ).toHaveLength(STOCK_CARD_SURFACE_OVERRIDES);
  });

  it("the scan looked at real <Card*> elements — anti-vacuity", () => {
    // A counter that reads 0 because it found nothing to look at is worthless. The adoption put
    // 77 variant cards on this surface, so the tag is not going away; asserted as a floor rather
    // than a total so ordinary call-site churn does not touch it.
    const cardTags = walkCardSurface().flatMap((file) =>
      jsxElementsOf(file).filter((element) => CARD_PRIMITIVE_TAGS.has(element.tag)),
    );
    expect(cardTags.length).toBeGreaterThan(100);
  });

  it("fires on a stock override and not on an ordinary one — the predicate, both ways", () => {
    const override = scanJsx('<Card className="rounded-2xl bg-card border border-border p-4" />');
    expect(cardSurfaceKind(override[0]!)).toBe("card");
    expect(cardKind(override[0]!)).toBe(null); // …which is why this counter has to exist.

    const well = scanJsx(
      '<CardContent className="rounded-2xl bg-muted/30 border border-border" />',
    );
    expect(cardSurfaceKind(well[0]!)).toBe("well");

    // Legitimate: a primitive with a spacing or width override is not a re-spelled surface.
    expect(cardSurfaceKind(scanJsx('<Card className="p-4 max-w-sm" />')[0]!)).toBe(null);
    expect(cardSurfaceKind(scanJsx('<Card className="rounded-2xl" />')[0]!)).toBe(null);
  });

  it("the two predicates differ ONLY by the tag rule — the split's own guard", () => {
    // If `cardKind` ever stops delegating, the hand-drawn counters and this one start disagreeing
    // about what a card surface is, and the door reopens inside the check built to watch it.
    const probe = scanJsx('<div className="rounded-2xl bg-card border border-border" />')[0]!;
    expect(cardKind(probe)).toBe(cardSurfaceKind(probe));
    const tagged = scanJsx('<Card className="rounded-2xl bg-card border border-border" />')[0]!;
    expect(cardKind(tagged)).toBe(null);
    expect(cardSurfaceKind(tagged)).not.toBe(null);
  });
});

/**
 * The size of SCOPE note 1's hole, in the ONE shape that can actually hide a card.
 *
 * This is the only blind spot that can SUBTRACT from a ratchet with nothing migrated: move a
 * card's tokens into a module constant and `HAND_DRAWN_CARDS` falls while the markup is unchanged.
 * A rise here beside a fall there is the signature of that move, and neither number alone shows it.
 *
 * ## Why 23 and not 211
 *
 * 211 elements on the surface write a `className` this scanner cannot read. Broken down by the
 * shape of the expression:
 *
 * | shape                                            | n       | can it hide a card?                |
 * | ------------------------------------------------ | ------- | ---------------------------------- |
 * | member expression (`styles.x`, `continentMeta?.badgeClass`) | 186 | no — the CSS-Modules surface   |
 * | **single identifier** (`subregionsGridClass`)     | **23**  | **yes — the module-constant hoist** |
 * | ternary (`x ? styles.a : styles.b`)              | 2       | in principle; neither is card-shaped |
 *
 * The member bucket is the surviving `*.module.css` consumers. A `styles.x` lookup resolves to a
 * CSS module class, not to Tailwind tokens, so it cannot become the hoist SCOPE note 1 describes
 * — and it churns whenever any of those files is touched. Pinning the total would put a +1 hoist
 * inside 211 units of unrelated noise: a smoke alarm in the wrong room. Pinned at the
 * single-identifier shape, the counter moves VISIBLY by exactly +1 the day `card.tsx`'s classes
 * are hoisted into a constant.
 *
 * 278 / 25 before T-042, and BOTH numbers fell for the same reason — dead CSS-Module consumers
 * left the tree, nothing was hoisted or un-hoisted. `components/tools`' island and its two panels
 * held 55 `styles.x` lookups into `tools.module.css`; `components/home/featured-cards.tsx` held
 * nine more into `home.module.css`, plus the two bare identifiers that took this counter 25 → 23.
 * A ratchet that falls because unreachable code was deleted has not moved on what it measures.
 *
 * The other TWO shapes are watched one door over: {@link UNREADABLE_CLASSNAME_SHAPES} pins the
 * whole breakdown and the buckets are asserted to SUM to the population, so narrowing this
 * counter did not discard the other 188 — it filed them, and a new shape cannot slip between the
 * buckets. Two, not three: the `call` bucket held exactly one element and it died with
 * `components/patterns/callout.tsx`, so an empty bucket is not listed and a `call` reappearing
 * fails that pin as a NEW shape rather than as a moved number. {@link computedShape} draws the
 * member/ternary line at OPTIONAL CHAINING — `a?.b` and `a?.[b]` are member access, not a
 * conditional — which is why `continentMeta?.badgeClass` is one of the 186 and not one of the 2.
 * The three buckets sum to 211, which is the assertion below rather than a figure quoted here.
 *
 * MUTATION-CHECKED, both halves of the narrowing, re-run at T-042's values on
 * `components/patterns/page-container.tsx` — the previous host, `theme-pair.tsx`, has left this
 * surface, which is the hazard this repo already named one level up: no control may be hosted on
 * a file a later task is contracted to remove.
 *
 *   - `<div className={cardShell} />` added there — RED, `expected 24 to be 23`, the message
 *     listing the bare-identifier classNames by file. That is the hoist SCOPE note 1 describes,
 *     caught at +1 in 23.
 *   - `<div className={styles.probe} />` in the same place — this counter stays GREEN at 23 and
 *     only the shape breakdown moves (`member` 186 → 187). CSS-module churn no longer reaches the
 *     hoist counter, which is exactly what narrowing the population to 23 bought.
 *
 * Both reverted.
 */
/**
 * T-033: **23 → 44**, `member` 186 → 164 one door down. **−22 and +21, NOT a swap** — an
 * earlier draft of this note said "the same 22 elements, re-spelled, equal and opposite",
 * and that is wrong in the direction that matters. Measured, retiring `marine.module.css`:
 *
 *   - 22 `className={styles.x}` elements left the `member` bucket, across
 *     `components/marine/{province-marine-section,value-cell,vintage-line,direction-arrow}.tsx`;
 *   - only **15** of those 22 came back here as a bare identifier over a hoisted Tailwind
 *     string. The other **7** became literal strings the scanner reads in full: the block
 *     grid, the card surface, the `<dl>`, the kunye rule, `sr-only`, the kunye list and the
 *     arrow glyph;
 *   - and **6** entries here are NEW carriers, not re-spellings. The three `<dt>`s and three
 *     `<dd>`s of the value rows had NO `className` at all before — they were styled by the
 *     module's `.provinceValue dt` / `.provinceValue dd` descendant selectors, and a
 *     descendant selector has no element-level attribute for any scanner to see. Tailwind has
 *     no descendant form, so the styling moved onto the elements themselves.
 *
 * So six elements newly entered the population this counter cannot read. That is the honest
 * statement, and it is why this note is not "nothing became invisible": something did. What
 * did NOT become invisible is the thing this file exists to count — see below.
 *
 * THE RULE THE REMAINING SEVEN CONVERSIONS FOLLOW. A CARD SURFACE IS WRITTEN INLINE. Any
 * className carrying a {@link CARD_ROUNDING} token together with `bg-card` or `border-border`
 * stays a literal string on its element: not hoisted into a module constant, and not moved to
 * an off-language radius. Both of those keep {@link HAND_DRAWN_CARDS} still while the card
 * exists, and both were available for marine's reference-point block — which had been a
 * hand-drawn card since W2b (`background: #fff` plus a `--color-border` hairline) and was
 * invisible here for four rounds only because a CSS-Module class lookup is opaque to this
 * scanner. It is now inline at `rounded-2xl` and counted. Hoist the quiet vocabulary —
 * `TERM`, `DESC`, `ROW` — freely; hoisting is what this counter is FOR noticing, and it
 * notices it. Never hoist the surface.
 *
 * T-033 task 3: **44 → 76**, `member` 164 → 130. This one IS equal and opposite, and it was
 * checked rather than assumed: 34 `className={styles.x}` elements left the `member` bucket
 * across `components/air/{air-pollution-section,pm25-chart,pm25-table}.tsx` (17 + 9 + 8), and
 * 32 came back here as bare identifiers (18 + 7 + 7). The two that did not are the notices
 * wrapper and the attribution wrapper, which became literal strings this scanner reads in
 * full. No element gained a `className` it did not have — the deleted stylesheet used no
 * descendant selector, so marine's six new carriers have no counterpart here.
 *
 * The chart's `point.labelled ? GRID : GRID_YEAR` stays in the `ternary` bucket it was
 * already in, which is why that figure does not move.
 *
 * NO NEW HAND-DRAWN CARD, and that is a measurement too. The chart frame is a card-shaped
 * element (`rounded-lg`, a border, a fill) that this counter does NOT see, because `rounded-lg`
 * is outside {@link CARD_ROUNDING} and the fill is `bg-white` rather than `bg-card`. Both are
 * deliberate and neither is the hiding move the rule above forbids: the frame is a data
 * surface whose radius is the module's own `--radius` and whose fill cannot follow the theme
 * without taking `--chart-pm25-line` below WCAG 1.4.11 (`components/air/pm25-chart.tsx` carries
 * the figures). It is not a card wearing a disguise; it is a plot.
 *
 * T-033 task 4: **76 → 119**, `member` 130 → 89. NOT equal and opposite, and it is marine's
 * shape rather than air's — bigger, and for the same cause. Measured: 41 `className={styles.x}`
 * elements left the `member` bucket across
 * `components/climate/{climate-chart,climate-section,climate-table}.tsx` (24 + 10 + 7) and 43
 * arrived here as bare identifiers (27 + 9 + 7). The arithmetic of the 24 → 27 in the chart is
 * where the whole +2 lives:
 *
 *   - **14 left and did not come back** — the figure, the layout row, the `<svg>`, the seven
 *     `.summaryItem` wrappers (which now carry no `className` at all, the grid does their work),
 *     the seasons cell, the legend and its two items all became literal strings or nothing;
 *   - **15 are NEW carriers**, exactly marine's case: the summary's eight `<dt>`s and seven
 *     `<dd>`s had no `className`, because `.summaryItem dt` / `.summaryItem dd` /
 *     `.summarySeasons dt` were DESCENDANT selectors and a descendant selector has no
 *     element-level attribute for any scanner to see. Tailwind has no descendant form;
 *   - **2 moved buckets rather than appearing** — the legend's two swatch `<span>`s were
 *     `` `${styles.swatch} ${styles.swatchPrecip}` ``, template literals, and are now single
 *     constants.
 *
 * So fifteen elements newly entered the population this counter cannot read, and that is the
 * honest statement. The `ternary` figure does not move: the chart's
 * `tick.value === 0 ? GRID_ZERO : GRID` was already `styles.gridZero : styles.grid`.
 *
 * NO NEW HAND-DRAWN CARD here either, and again it is measured rather than asserted. Two
 * elements are card-shaped and neither is a card in disguise: the chart frame (`rounded-lg`,
 * a `border-ink-dark/15` edge, a `bg-white` fill) is the same plot the air note describes, and
 * the table's scroll container (`rounded-lg border border-border`) is hoisted only because
 * `rounded-lg` is outside {@link CARD_ROUNDING} — it is the deleted stylesheet's own
 * `var(--radius)`, not a `rounded-2xl` surface hidden behind a constant.
 *
 * T-033 task 5: **119 -> 139**, `member` 89 -> 66. The arithmetic is smaller than the last two
 * and it closes exactly: `components/site-search/search-combobox.tsx` held 23
 * `className={styles.x}` elements, 20 came back as bare identifiers, and the 3 that did not are
 * the visually-hidden ones — the `<label>`, the close button's name and the live region — which
 * are now the literal `"sr-only"` and therefore READABLE rather than unreadable. No element
 * gained or lost a className; the file is the same tree it was.
 *
 * ONE element is card-shaped and it is not a card in disguise: the combobox panel, hoisted as
 * `PANEL`. It is a popover — `rounded-[16px]` (the deleted stylesheet's `var(--radius-lg)`, which
 * `rounded-2xl` at 18px and `rounded-lg` at 10px do not spell), `p-2.5`, and an edge of
 * `border-input` rather than `border-border` because it must carry the same 3:1 control boundary
 * as the trigger it hangs from. `Card`'s `panel` variant is `rounded-3xl border border-border
 * bg-card p-6 sm:p-8`: a 22px radius, a 1.45:1 decorative edge and 24-32px of padding on a
 * dropdown whose padding is 10px. Both the radius and the edge are outside {@link CARD_ROUNDING}
 * and the surface predicate anyway, so the hoist hides nothing this counter would have seen.
 *
 * T-033 task 6: **139 -> 154**, `member` 66 -> 57. Nine `styles.x` lookups into
 * `earthquake.module.css` left the tree — six in `earthquake-list.tsx`, three in
 * `province-earthquake-section.tsx` — and fifteen bare identifiers arrived: twelve in the list
 * (`SCROLL`, `TABLE`, `CAPTION`, `EMPTY_STATE`, `PLACE_NAME`, `BINDING_NOTE`, plus three
 * `HEAD_CELL` header cells and three `CELL` data cells that the stylesheet had styled through
 * `.table th, .table td` with no className at all) and three in the province section
 * (`FLOOR_NOTE`, `FLOOR_LABEL`, `HUB_LINK`). The gap of six is those six previously bare cells:
 * six elements genuinely entered this population, the other nine only changed shape.
 *
 * NO NEW HAND-DRAWN CARD, measured rather than asserted. Two constants are surface-ish and
 * neither is card-shaped: the event table's scroll box is `rounded-lg border border-border` —
 * the deleted stylesheet's own `var(--radius)`, and `rounded-lg` is outside
 * {@link CARD_ROUNDING}, the same reading the climate note above already records for the same
 * spelling — and the magnitude badge is `rounded-full`, a pill. The `ternary` figure does not
 * move; this conversion introduced none.
 *
 * T-033 task 7: **154 -> 181**, `member` 57 -> 27, and the `call` bucket REOPENS at 1. The
 * arithmetic, because three different things happened at once and the net (-2 unreadable) hides
 * all three:
 *
 * · `book-video.module.css` had 30 `className={styles.x}` sites across its five consumers — the
 *   most of any module in T-033 — and every one of them left the member bucket;
 * · 5 of those 30 were the module's own `.srOnly` block, which is Tailwind's `sr-only` utility
 *   now (two in `bench-stage.tsx`, two in `deneme-meta.tsx`, one in `deneme-video.tsx`'s live
 *   region). A string literal is READABLE, so those five left this population altogether;
 * · 24 became bare identifiers, and 3 MORE arrived from the other direction:
 *   `deneme-video.tsx`'s cover/player boxes were `` `${styles.frame} ${styles.playerBox}` ``
 *   and `` `${styles.frame} ${styles.thumbBox}` `` — template holes, which is why
 *   `lib/test-support/composition-scan.test.ts`'s own `TEMPLATE_HOLE_DIVS` falls 21 -> 18 in
 *   the same commit. They are `PLAYER_BOX` and `THUMB_BOX` now.
 *
 * THE `call` BUCKET IS NOT AN OVERSIGHT AND ITS RETURN IS THE POINT OF LISTING IT BY SHAPE.
 * `video-progress-controls.tsx` writes `cn(WATCHED_TOGGLE, watched && WATCHED_TOGGLE_CHECKED)`
 * on the watched toggle: the checked fill is ADDITIVE over a base the control keeps in both
 * states (the 44px target), so a ternary would have had to restate that target in both branches
 * and let the two drift. It is a `<Button>`, not a `<div>`, and neither constant carries a card
 * rounding token — `WATCHED_TOGGLE` is `min-h-11` alone — so it hides nothing this counter
 * exists to find.
 *
 * NO NEW HAND-DRAWN CARD here either, measured the same way. The one surface-ish constant is
 * `bench-timeline.tsx`'s `TIMELINE`: `rounded-lg border border-border bg-card`, and `rounded-lg`
 * is outside {@link CARD_ROUNDING} for the same reason the two notes above give for the same
 * spelling — it is the deleted stylesheet's own `var(--radius)`, not a card radius.
 * `deneme-video.tsx`'s `THUMB_BOX` is the same `rounded-lg`. The `ternary` figure does not move.
 *
 * T-033 task 8: **181 -> 193**, `member` 27 -> 14. The last module outside `components/`.
 * `book-detail.module.css` had 13 `className={styles.x}` sites, all in one consumer
 * (`app/[locale]/(site)/kitaplar/[slug]/page.tsx`), and every one left the member bucket. Twelve
 * became bare identifiers; the thirteenth was the module's own `.srOnly` block, which is
 * Tailwind's `sr-only` now — a string literal, so READABLE, so it left this population
 * altogether. 13 - 1 = 12, which is the gap. The `indexClassName={INDEX}` site is a different
 * prop and was never in this census in either spelling.
 *
 * NO NEW HAND-DRAWN CARD, measured the same way as the three notes above. Two constants are
 * surface-ish and neither is card-shaped: `JUMP_ITEM` and `QUESTION_LINK` are both
 * `rounded-lg border border-border bg-card`, and `rounded-lg` is outside {@link CARD_ROUNDING}
 * for the reason those notes already give for the same spelling — it is the deleted stylesheet's
 * own `var(--radius)` at 10px, not a card radius. A 44×44 fragment tile is a control, not a
 * panel. The `ternary` and `call` figures do not move; this conversion introduced neither.
 *
 * T-033 task 9: **193 -> 198**, `member` 14 -> 9. The LAST CSS Module in the tree.
 * `locator-map.module.css` had 7 `className={styles.x}` sites, all in its one consumer
 * (`components/map/locator-map.tsx`), and every one left the member bucket. FIVE became bare
 * identifiers (`BASE`, `OVERLAY`, `HIGHLIGHT`, `RING`, `CREDIT`); the other two — the figure and
 * the frame — are `{ province, country }` records read as `FIGURE[kind]` and `FRAME[kind]`, which
 * this scanner's own member regex still calls `member`. So the member bucket loses 7 and regains
 * 2, and the identifier bucket gains 5. The two records are a computed lookup rather than a
 * ternary because only ONE kind renders on any route and a ternary lets the unrendered branch
 * drift silently; `components/map/locator-map-floors.test.ts` asserts the two rows differ in the
 * aspect ratio and in nothing else.
 *
 * NO NEW HAND-DRAWN CARD, measured the same way as the four notes above. The one surface-ish
 * constant is the frame, `rounded-[var(--radius-lg)] border border-border bg-[var(--map-sea)]`,
 * and it is outside {@link CARD_ROUNDING} on both counts: the radius is the retired stylesheet's
 * own `var(--radius-lg)` rather than a card radius, and the fill is the map's frozen sea rather
 * than a themed surface. A map figure is an illustration, not a panel. The `ternary` and `call`
 * figures do not move; this conversion introduced neither.
 */
export const COMPUTED_CARD_CLASSNAMES = 198;

/** The whole unreadable-className population by expression shape — the rest of what the counter
 * above deliberately does not watch, kept visible rather than dropped.
 *
 * The `call` bucket used to hold exactly one element, `components/patterns/callout.tsx`'s
 * `cn(calloutVariants({…}))`, and T-042 deleted that file; an empty bucket is not listed, so a
 * `call` reappearing failed this pin as a NEW shape rather than as a moved number. It DID
 * reappear, in T-033 task 7, and the pin worked exactly as designed: the element is
 * `video-progress-controls.tsx`'s watched toggle, whose checked fill is additive over a base the
 * control keeps in both states. See {@link COMPUTED_CARD_CLASSNAMES}'s note for why that is a
 * composition rather than a ternary, and for the whole 154 -> 181 / 57 -> 27 arithmetic, and the
 * 181 -> 193 / 27 -> 14 one that task 8 added on top of it, and the 193 -> 198 / 14 -> 9 one
 * task 9 closed the programme with. */
const UNREADABLE_CLASSNAME_SHAPES: ReadonlyArray<readonly [string, number]> = [
  ["call", 1],
  ["identifier", 198],
  ["member", 9],
  ["ternary", 2],
];

/** Which of {@link UNREADABLE_CLASSNAME_SHAPES} an unreadable `className` expression has. */
function computedShape(expression: string): string {
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(expression)) return "identifier";
  if (
    /^[A-Za-z_$][A-Za-z0-9_$]*(\??\.[A-Za-z_$][A-Za-z0-9_$]*|\??\[[^[\]]*\])+$/.test(expression)
  ) {
    return "member";
  }
  if (expression.includes("?") && expression.includes(":")) return "ternary";
  return "call";
}

function unreadableClassNames(): { file: string; shape: string }[] {
  return walkCardSurface().flatMap((file) =>
    jsxElementsOf(file)
      .filter((element) => element.computed !== null)
      .map((element) => ({ file: label(file), shape: computedShape(element.computed!) })),
  );
}

describe("the card scanner itself", () => {
  it("scanned a real, non-trivial surface — anti-vacuity", () => {
    const files = walkCardSurface();
    expect(files.length).toBeGreaterThan(120);
    expect(files.map(label)).toContain("components/v2/v2-member-hub.tsx");
    expect(files.map(label)).toContain("app/[locale]/(site)/turkiye/page.tsx");
    expect(files.some((file) => label(file).startsWith("components/showcase/"))).toBe(false);
  });

  /**
   * THE RECONCILIATION. Every `className=` in the scanned surface is either attached to an
   * element or is one of five `className = ""` destructuring defaults — pinned by file, so a
   * parser regression that starts losing markup fails HERE, with the file named, rather than
   * showing up as a quietly falling card count that the next task reads as progress.
   *
   * Was nine before `components/ui/**` left the walk; `components/ui/accordion.tsx` held four.
   *
   * MUTATION-CHECKED: a sixth `{ className = "" }` default added to
   * `components/patterns/page-container.tsx` — RED, the message listing
   * `1x components/patterns/page-container.tsx` at the head of the five. Reverted. (The host was
   * `theme-pair.tsx` until T-042 moved that file out of this surface.)
   */
  it("every className attaches to an element, bar the five destructuring defaults", () => {
    const unattached = new Map<string, number>();
    for (const file of walkCardSurface()) {
      const source = readSource(file);
      const written = [...source.matchAll(/className\s*=/g)].length;
      const attached = jsxElementsOf(file).filter((el) => el.spelling !== null).length;
      if (written !== attached) unattached.set(label(file), written - attached);
    }
    const rows = [...unattached].sort((a, b) => a[0].localeCompare(b[0]));
    expect(
      rows,
      `className= occurrences the scanner did not attach to an element:\n${rows
        .map(([file, n]) => `  ${n}x ${file}`)
        .join("\n")}`,
    ).toEqual([
      ["components/v2/v2-favorite-button.tsx", 1],
      ["components/v2/v2-leaderboard-modal.tsx", 1],
      ["components/v2/v2-marine-map-explorer.tsx", 1],
      ["components/v2/v2-rich-prose.tsx", 1],
      ["components/v2/v2-sources-section.tsx", 1],
    ]);
  });

  // `CARD_FIXTURE` and the rule it exists for — no control may depend on markup a later task in
  // the plan is contracted to delete — are in `lib/test-support/composition-scan.ts`.
  const cardFixture = (body: string) =>
    `export default function Fixture() {\n  return (\n    <main>\n${body}\n    </main>\n  );\n}\n`;

  const fixtureElements = <T>(body: string, read: (elements: ScannedElement[]) => T): T =>
    withInjectedSource([[CARD_FIXTURE, cardFixture(body)]], () =>
      read(jsxElementsOf(CARD_FIXTURE)),
    );

  it("reads a double-quoted className", () => {
    const spellings = fixtureElements(
      '      <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs" />',
      (elements) => elements.map((el) => el.spelling),
    );
    expect(spellings).toContain("p-4 rounded-2xl bg-card border border-border shadow-2xs");
  });

  it("reads a cn() className, fixed fragments only", () => {
    // `cn("a b", className)` yields the fixed part; the caller-supplied argument is a variable and
    // correctly contributes nothing. `components/patterns/map-attribution.tsx` writes this shape today.
    const card = fixtureElements(
      '      <div className={cn("rounded-2xl border border-border bg-card p-6", className)} />',
      (elements) => elements.find((el) => cardKind(el) !== null),
    );
    expect(card?.spelling).toBe("rounded-2xl border border-border bg-card p-6");
    expect(cardKind(card!)).toBe("card");
  });

  it("reads a template-literal className, hole and all", () => {
    // The `${…}` marker is the point: the element is credited with what it literally writes and
    // never with whatever the interpolation may produce. Live example of the idiom today:
    // `deprem/fay-hatlari/page.tsx`'s fault panel — named, deliberately not asserted.
    const spellings = fixtureElements(
      "      <article className={`rounded-3xl border ${fault.borderClass} bg-card p-6`} />",
      (elements) => elements.map((el) => el.spelling),
    );
    expect(spellings).toContain("rounded-3xl border ${…} bg-card p-6");
  });

  it("scans attribute expressions — a card passed as a prop is a card, and is not a child", () => {
    // The finding the parser was rewritten for: a children-only walk misses a card handed to a
    // component as a prop, and would report a FALLING count while cards moved into props.
    // `turkiye/page.tsx` does exactly this today (`<V2TurkeyMapExplorer regionsSection={…}>`), and
    // Task 6 may well convert it — which is why the SHAPE is asserted here and not there.
    const { passed, holderChildren } = fixtureElements(
      '      <Explorer regionsSection={<div className="rounded-3xl border border-border bg-gradient-to-r from-card p-6" />} />',
      (elements) => ({
        passed: elements.filter((el) => el.inProp && cardKind(el) !== null),
        holderChildren: elements.find((el) => el.tag === "Explorer")?.children ?? null,
      }),
    );
    expect(passed).toHaveLength(1);
    expect(passed[0]!.spelling).toContain("bg-gradient-to-r");
    expect(holderChildren).toEqual([]);
  });

  it("a prop-borne card is inside the counters, not merely inside the parser", () => {
    // Children vs prop, same card, same file: the counters must not be able to tell the
    // difference, or a codemod that pushes cards into props reads as progress.
    const asChild = fixtureElements(
      '      <Explorer><div className="rounded-2xl bg-card border border-border" /></Explorer>',
      (elements) => elements.filter((el) => cardKind(el) === "card").length,
    );
    const asProp = fixtureElements(
      '      <Explorer slot={<div className="rounded-2xl bg-card border border-border" />} />',
      (elements) => elements.filter((el) => cardKind(el) === "card").length,
    );
    expect(asChild).toBe(1);
    expect(asProp).toBe(1);
  });

  it("the live surface really does write JSX inside attribute expressions — anti-vacuity", () => {
    // The durable half of the control above. Elements written inside a prop are an idiom this
    // surface uses in bulk (`icon={<Foo />}`, `trigger={…}`, `regionsSection={…}`), so unlike any
    // one card it cannot be migrated away. If this ever reads zero, the attribute-expression
    // branch of the scanner has stopped running and every control above it is exercising nothing.
    const inProp = walkCardSurface().flatMap((file) =>
      jsxElementsOf(file).filter((el) => el.inProp),
    );
    expect(inProp.length).toBeGreaterThan(100);
  });

  it("balances nested cn() calls rather than matching them", () => {
    const [element] = scanJsx(
      '<div className={cn("rounded-2xl", cn("bg-card", active && "border-border"))}>x</div>',
    );
    expect(element!.spelling).toBe("rounded-2xl bg-card border-border");
    expect(cardKind(element!)).toBe("card");
  });

  it("a `>` inside a brace expression does not end the tag early", () => {
    const [element] = scanJsx('<div onClick={() => go(a > b)} className="rounded-2xl bg-card" />');
    expect(element!.spelling).toBe("rounded-2xl bg-card");
  });

  it("a className inside a braced prop belongs to the nested element, not its holder", () => {
    const elements = scanJsx(
      '<Widget slot={<div className="rounded-2xl bg-card" />} className="p-4">x</Widget>',
    );
    expect(elements[0]!.tag).toBe("Widget");
    expect(elements[0]!.spelling).toBe("p-4");
    expect(elements[1]!.spelling).toBe("rounded-2xl bg-card");
  });

  /**
   * LATENT, NOT DEAD — DO NOT DELETE THIS CONTROL.
   *
   * It is synthetic because it has to be: no element on the live tree pairs a card rounding token
   * with `bg-card-foreground` today, which is asserted immediately below rather than merely
   * claimed. So no tree change can exercise this control, and a future reader will find it
   * failing nothing and looking removable — exactly how a guard dies. It is the WHOLE defence
   * against the substring family of bug that has already produced one wrong figure in this
   * programme (a `group/btn` counted as a `group`), and mutating the predicate to
   * `token.includes("bg-card")` fails this control and NOTHING else.
   *
   * MUTATION-CHECKED, both halves: the predicate loosened to `token.includes(…)` — RED here,
   * every counter unmoved; and a real `<div className="rounded-2xl bg-card-foreground p-4" />`
   * added to `components/patterns/page-container.tsx` — RED on the latency assertion below,
   * `elements a substring test would count and this predicate does not:
   * components/patterns/page-container.tsx`. Both reverted. (The host was `theme-pair.tsx` until
   * T-042 moved that file out of this surface.)
   */
  it("matches whole tokens, never substrings — the group/x trap, one door over", () => {
    // `bg-card-foreground` CONTAINS `bg-card` and is a text colour. A substring test counts it;
    // this programme has already shipped one wrong figure to a `group/btn` of exactly this shape.
    expect(cardKind(scanJsx('<div className="rounded-2xl bg-card-foreground" />')[0]!)).toBe(null);
    expect(cardKind(scanJsx('<div className="rounded-2xl group/card bg-muted" />')[0]!)).toBe(null);
    expect(cardKind(scanJsx('<div className="rounded-2xl bg-card/85" />')[0]!)).toBe("card");
    expect(cardKind(scanJsx('<div className="sm:rounded-2xl dark:border-border/80" />')[0]!)).toBe(
      "well",
    );
  });

  it("the substring trap is still LATENT on the live surface — the control's own premise", () => {
    // Measures the latency the control above depends on, so the day a real element pairs a card
    // rounding token with `bg-card-foreground` (or any other `bg-card…`/`border-border…` token
    // that a substring test would swallow), the suite says so instead of the control quietly
    // becoming load-bearing without anyone noticing.
    const wouldDifferUnderSubstring = walkCardSurface().flatMap((file) =>
      jsxElementsOf(file)
        .filter((el) => {
          const tokens = tokensOf(el.spelling);
          if (!tokens.some((token) => CARD_ROUNDING.has(token))) return false;
          const exact = tokens.includes("bg-card") || tokens.includes("border-border");
          const loose = tokens.some(
            (token) => token.includes("bg-card") || token.includes("border-border"),
          );
          return loose && !exact;
        })
        .map(() => label(file)),
    );
    expect(
      wouldDifferUnderSubstring,
      `elements a substring test would count and this predicate does not:\n${wouldDifferUnderSubstring
        .map((file) => `  ${file}`)
        .join("\n")}`,
    ).toEqual([]);
  });

  it("the module-constant-hoist population is exactly the recorded number", () => {
    const hoists = unreadableClassNames().filter((row) => row.shape === "identifier");
    const byFile = new Map<string, number>();
    for (const row of hoists) byFile.set(row.file, (byFile.get(row.file) ?? 0) + 1);
    expect(
      hoists.length,
      `elements whose className is a bare identifier, by file:\n${[...byFile]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([file, n]) => `  ${n}x ${file}`)
        .join("\n")}`,
    ).toBe(COMPUTED_CARD_CLASSNAMES);
  });

  it("the rest of the unreadable population is filed by shape, not discarded", () => {
    const tally = new Map<string, number>();
    for (const row of unreadableClassNames()) tally.set(row.shape, (tally.get(row.shape) ?? 0) + 1);
    expect(
      [...tally].sort(),
      `unreadable classNames by shape: ${JSON.stringify([...tally].sort())}`,
    ).toEqual([...UNREADABLE_CLASSNAME_SHAPES].sort());
    expect(
      unreadableClassNames().length,
      "every unreadable className is in exactly one shape bucket",
    ).toBe(UNREADABLE_CLASSNAME_SHAPES.reduce((total, [, n]) => total + n, 0));
  });

  it("separates the two populations on the surface token alone", () => {
    expect(cardKind(scanJsx('<div className="rounded-2xl bg-card border-border" />')[0]!)).toBe(
      "card",
    );
    expect(cardKind(scanJsx('<div className="rounded-2xl bg-muted/30 border-border" />')[0]!)).toBe(
      "well",
    );
    expect(cardKind(scanJsx('<div className="rounded-2xl bg-muted/30" />')[0]!)).toBe(null);
    expect(cardKind(scanJsx('<div className="rounded-lg bg-card border-border" />')[0]!)).toBe(
      null,
    );
  });

  it("a <Card> from the primitive is never a hand-drawn card, whatever it wears", () => {
    expect(cardKind(scanJsx('<Card className="rounded-2xl bg-card border-border" />')[0]!)).toBe(
      null,
    );
    expect(cardKind(scanJsx('<CardContent className="rounded-2xl bg-card" />')[0]!)).toBe(null);
  });

  it("a docblock quoting a card className does not count — comment stripping applied", () => {
    const source = stripComments(
      '/** Panels are `rounded-2xl bg-card border border-border`. */\n<div className="p-4" />',
    );
    const elements = scanJsx(source);
    expect(elements).toHaveLength(1);
    expect(elements[0]!.spelling).toBe("p-4");
  });

  it("a card inside a string literal is prose, not markup", () => {
    const elements = scanJsx(
      'const USAGE = "<div className=\\"rounded-2xl bg-card border-border\\" />";\n<p className="x" />',
    );
    expect(elements.map((el) => el.tag)).toEqual(["p"]);
  });

  it("a type-argument list is not an element — <Record …> does not open a node", () => {
    const elements = scanJsx(
      'const m = new Map<string, Foo>();\nreturn <div className="rounded-2xl bg-card">x</div>;',
    );
    expect(elements.map((el) => el.tag)).toEqual(["div"]);
  });
});

describe("hand-drawn card surfaces are counted, split by what they actually draw", () => {
  it("the number of elements with a bg-card surface is exactly the recorded number", () => {
    const { cards } = handDrawnTotals();
    expect(
      cards,
      `hand-drawn card surfaces (rounded + bg-card), by file:\n${handDrawnReport((c) => c.cards)}`,
    ).toBe(HAND_DRAWN_CARDS);
  });

  it("the number of elements qualifying only through border-border is exactly the recorded number", () => {
    const { wells } = handDrawnTotals();
    expect(
      wells,
      `hand-drawn wells (rounded + border-border, no bg-card), by file:\n${handDrawnReport(
        (c) => c.wells,
      )}`,
    ).toBe(HAND_DRAWN_WELLS);
  });

  it("the number of distinct spellings is exactly the recorded number", () => {
    // M3: this was prose in a docblock and pinned by nothing. Now it is the docblock's headline
    // and an assertion, so the two cannot disagree again.
    //
    // LR2: with the by-spelling report, not bare. Its three neighbours all print their population
    // on failure and this one did not, so a reader who tripped it got `expected 239 to be 238`
    // and no way to find the new spelling. Sorted by occurrence count, because the spelling that
    // matters is the one carrying many elements — that is the whole reason this figure is watched.
    const bySpelling = new Map<string, number>();
    for (const file of walkCardSurface()) {
      for (const element of jsxElementsOf(file)) {
        if (cardKind(element) === null || element.spelling === null) continue;
        bySpelling.set(element.spelling, (bySpelling.get(element.spelling) ?? 0) + 1);
      }
    }
    const report = [...bySpelling]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 20)
      .map(([spelling, n]) => `  ${n}x ${spelling}`)
      .join("\n");
    expect(
      bySpelling.size,
      `distinct hand-drawn card spellings (top 20 by occurrence):\n${report}`,
    ).toBe(HAND_DRAWN_CARD_SPELLINGS);
    // The two ways of counting must agree — otherwise this `it` could pass while
    // `handDrawnSpellings()`, the function the docblock names, drifted.
    expect(bySpelling.size).toBe(handDrawnSpellings());
  });

  it("a new spelling raises the count — the counter, not just the scanner", () => {
    // LR2's other half: a relative control of its own, so this figure is driven end to end the
    // way the cards/wells totals are. The neighbouring control asserts cards and wells only.
    const file = join(repoRoot, "components/patterns/page-container.tsx");
    const before = handDrawnSpellings();
    const novel = `${readFileSync(file, "utf8")}\nconst Probe = () => <div className="rounded-2xl bg-card border border-border p-7 gap-11" />;\n`;
    expect(withInjectedSource([[file, novel]], () => handDrawnSpellings())).toBe(before + 1);
    // A SECOND element at an EXISTING spelling must NOT raise it — the figure counts spellings,
    // not elements, and that distinction is the only reason it is worth a separate counter.
    const duplicate = `${readFileSync(file, "utf8")}\nconst Probe = () => <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs" />;\n`;
    expect(withInjectedSource([[file, duplicate]], () => handDrawnSpellings())).toBe(before);
    expect(handDrawnSpellings()).toBe(before);
  });

  it("the two populations are disjoint and cover the whole predicate", () => {
    // The split is the claim; this is what stops it drifting into two overlapping counters.
    let strict = 0;
    for (const file of walkCardSurface()) {
      for (const element of jsxElementsOf(file)) {
        if (cardKind(element) !== null) strict += 1;
      }
    }
    expect(strict).toBe(HAND_DRAWN_CARDS + HAND_DRAWN_WELLS);
    // 74 before Task 5, 68 after it, 60 after Task 6: eight more files hold no hand-drawn card
    // surface at all once their metric strip is a `<StatGrid>` of `<StatTile>`s. 57 after T-042,
    // which is a DELETION rather than an adoption — `theme-pair.tsx` left the scanned surface for
    // `components/showcase/`, and `empty-state.tsx` and `map-legend.tsx` were deleted outright.
    // 58 after T-033: `province-marine-section.tsx` joins the surface, holding a card that was
    // always there and was only ever invisible because it was drawn from a CSS Module.
    // See {@link HAND_DRAWN_CARDS}.
    expect(handDrawnTotals().files).toBe(58);
  });

  it("a new hand-drawn card raises the count — the counter, not just the scanner", () => {
    // Asserted RELATIVELY, on purpose: the host file's own contents may change freely without
    // touching this control, and the control still proves the whole path from walk to total.
    const file = join(repoRoot, "components/patterns/page-container.tsx");
    const before = handDrawnTotals();
    const injected = `${readFileSync(file, "utf8")}\nconst Probe = () => <div className="rounded-2xl bg-card border border-border" />;\n`;
    const after = withInjectedSource([[file, injected]], () => handDrawnTotals());
    expect(after.cards).toBe(before.cards + 1);
    expect(after.wells).toBe(before.wells);
    expect(handDrawnTotals().cards).toBe(before.cards);
  });
});

/**
 * Design-system primitives wearing card chrome, AT THEIR USE SITES. They are cards by the
 * predicate and they are NOT cards: the primitive that owns each spelling lives in
 * `components/ui/**`, which the walk no longer visits, so converting one of these use sites to a
 * `Card` variant would fight a component this section cannot even see. PR4 must not touch them.
 *
 * Pinned by `[file, tag]` so the list cannot rot into prose. Line numbers are deliberately absent
 * — see SCOPE note 6.
 *
 * MUTATION-CHECKED 2026-09-18: `v2-books-hub.tsx`'s search `<input>` re-spelled `rounded-xl` →
 * `rounded-lg` — RED, `expected [ …(7) ] to deeply equal [ …(8) ]`, the message listing the seven
 * survivors with `components/v2/v2-books-hub.tsx <input>` gone from it. Reverted. Re-run after
 * `components/ui/**` left the walk, with the same result.
 */
const CARD_SHAPED_PRIMITIVES: ReadonlyArray<readonly [string, string]> = [
  ["components/v2/v2-auth-dialog.tsx", "DialogContent"],
  ["components/v2/v2-books-hub.tsx", "input"],
  ["components/v2/v2-earthquake-explorer.tsx", "Input"],
  ["components/v2/v2-header.tsx", "SheetTrigger"],
  ["components/v2/v2-hero.tsx", "Button"],
  ["components/v2/v2-marine-map-explorer.tsx", "Input"],
  ["components/v2/v2-register-card.tsx", "select"],
  ["components/v2/v2-register-card.tsx", "select"],
];

/**
 * Map viewports: a rounded, bordered box around an `aspect-[…]` canvas is a VIEWPORT, not a
 * surface, and several set their own background (`bg-[var(--map-sea,#dbe7e8)]`, `bg-[#0d1b2a]`,
 * `bg-[#dbe8ee]`) that a `Card` variant would fight. Two of those backgrounds are raw hex on an
 * element this predicate calls a card — `v2-game-screen.tsx` and `v2-world-map-explorer.tsx` —
 * which is a `docs/design.md` violation in its own right, recorded here rather than fixed by a
 * counting task.
 *
 * FOUND by SHAPE (an `aspect-*` token on the element itself) so a twelfth viewport enters rather
 * than hiding behind an exemption, but PINNED by MEMBERSHIP: a count would go green on a viewport
 * migrated away and a new one appearing in the same PR, which is the trade this population exists
 * to forbid.
 *
 * MUTATION-CHECKED 2026-09-18: `v2-region-thumb.tsx`'s `aspect-[2.33/1]` replaced with `h-40` —
 * RED, `expected [ …(10) ] to deeply equal [ …(11) ]`, the diff naming the missing row
 * `- "components/v2/v2-region-thumb.tsx <div>"`. Reverted.
 */
const MAP_VIEWPORTS: readonly string[] = [
  "app/[locale]/(site)/kitaplar/[slug]/page.tsx <div>",
  "components/v2/v2-books-hub.tsx <div>",
  "components/v2/v2-continent-locator-map.tsx <div>",
  "components/v2/v2-earthquake-explorer.tsx <div>",
  "components/v2/v2-game-screen.tsx <div>",
  "components/v2/v2-marine-map-explorer.tsx <div>",
  "components/v2/v2-province-locator-map.tsx <div>",
  "components/v2/v2-region-locator-map.tsx <div>",
  "components/v2/v2-region-thumb.tsx <div>",
  "components/v2/v2-turkey-map-explorer.tsx <div>",
  "components/v2/v2-world-map-explorer.tsx <div>",
];

/**
 * Interactive carriers. Card-shaped, but they need focus-visible, hover and `group` behaviour a
 * static panel must not carry, so they are out of PR4's scope; if they ever get a variant it is a
 * distinct `interactive` one, and it stays `<Link className={…}>` because `Button` has no
 * `asChild` in this repo (`CLAUDE.md`).
 *
 * PINNED BY MEMBERSHIP, one row per element, because this is the population where a tag tally is
 * most obviously gameable: roughly 16 of the 37 live in files the adoption task opens, so
 * converting one card-shaped `<Link>` — the thing this list forbids — while a new one appears
 * elsewhere in the same PR leaves `Link: 28` green. Both halves of that trade show up here.
 *
 * MUTATION-CHECKED 2026-09-18 against the NETTING scenario specifically, because that is the one a
 * tag tally survives: one of `v2-related-tools.tsx`'s two `<Link>` tiles re-spelled `rounded-2xl`
 * → `rounded-lg` (a migration this list forbids) AND a new card-shaped `<Link>` added to
 * `v2-books-hub.tsx` in the same edit. Tag tallies unchanged at 28/5/4 — the previous form of this
 * assertion would have been GREEN. Membership went RED:
 * `expected [ …(37) ] to deeply equal [ …(37) ]`, same length, with two
 * `components/v2/v2-books-hub.tsx <Link>` rows and one `v2-related-tools.tsx <Link>` row in the
 * printed list. Reverted.
 */
const INTERACTIVE_CARD_CARRIERS: readonly string[] = [
  "app/[locale]/(site)/deprem/fay-hatlari/page.tsx <Link>",
  "app/[locale]/(site)/dunya/[slug]/page.tsx <Link>",
  "app/[locale]/(site)/dunya/[slug]/page.tsx <Link>",
  "app/[locale]/(site)/dunya/kita/[slug]/page.tsx <Link>",
  "app/[locale]/(site)/dunya/kita/[slug]/page.tsx <Link>",
  "app/[locale]/(site)/hakkimizda/page.tsx <a>",
  "app/[locale]/(site)/page.tsx <a>",
  "app/[locale]/(site)/page.tsx <a>",
  "app/[locale]/(site)/turkiye/[slug]/page.tsx <Link>",
  "app/[locale]/(site)/turkiye/[slug]/page.tsx <Link>",
  "app/[locale]/(site)/turkiye/bolge/[slug]/page.tsx <Link>",
  "components/site-search/search-combobox.tsx <a>",
  "components/site-search/search-combobox.tsx <a>",
  "components/site-search/search-combobox.tsx <button>",
  "components/site-search/search-combobox.tsx <button>",
  "components/v2/theme-toggle.tsx <button>",
  "components/v2/v2-books-hub.tsx <Link>",
  "components/v2/v2-header.tsx <Link>",
  "components/v2/v2-header.tsx <Link>",
  "components/v2/v2-header.tsx <button>",
  "components/v2/v2-member-hub.tsx <Link>",
  "components/v2/v2-member-hub.tsx <Link>",
  "components/v2/v2-member-hub.tsx <Link>",
  "components/v2/v2-member-hub.tsx <Link>",
  "components/v2/v2-related-tools.tsx <Link>",
  "components/v2/v2-related-tools.tsx <Link>",
  "components/v2/v2-sea-basin-detail-view.tsx <Link>",
  "components/v2/v2-sea-basin-detail-view.tsx <Link>",
  "components/v2/v2-tool-educational-content.tsx <Link>",
  "components/v2/v2-tool-educational-content.tsx <Link>",
  "components/v2/v2-tool-educational-content.tsx <Link>",
  "components/v2/v2-tool-educational-content.tsx <Link>",
  "components/v2/v2-turkey-map-explorer.tsx <Link>",
  "components/v2/v2-turkey-map-explorer.tsx <Link>",
  "components/v2/v2-world-continents.tsx <Link>",
  "components/v2/v2-world-map-explorer.tsx <Link>",
  "components/v2/v2-world-map-explorer.tsx <Link>",
];

function cardsMatching(predicate: (element: ScannedElement) => boolean): string[] {
  const hits: string[] = [];
  for (const file of walkCardSurface()) {
    for (const element of jsxElementsOf(file)) {
      if (cardKind(element) !== null && predicate(element))
        hits.push(`${label(file)} <${element.tag}>`);
    }
  }
  return hits.sort();
}

describe("the three card-shaped populations PR4 must not touch", () => {
  it("the design-system primitives are exactly the recorded eight", () => {
    const tags = new Set(CARD_SHAPED_PRIMITIVES.map(([, tag]) => tag));
    const found = cardsMatching((element) => tags.has(element.tag));
    expect(
      found,
      `primitives wearing card chrome:\n${found.map((row) => `  ${row}`).join("\n")}`,
    ).toEqual(CARD_SHAPED_PRIMITIVES.map(([file, tag]) => `${file} <${tag}>`).sort());
  });

  it("the map viewports are exactly the recorded eleven, by file", () => {
    const found = cardsMatching((element) =>
      tokensOf(element.spelling).some((token) => token.startsWith("aspect-")),
    );
    expect(
      found,
      `card-shaped map viewports:\n${found.map((row) => `  ${row}`).join("\n")}`,
    ).toEqual([...MAP_VIEWPORTS].sort());
  });

  it("the interactive carriers are exactly the recorded 37, by file", () => {
    const tags = new Set(["Link", "a", "button"]);
    const found = cardsMatching((element) => tags.has(element.tag));
    expect(
      found,
      `card-shaped interactive carriers:\n${found.map((row) => `  ${row}`).join("\n")}`,
    ).toEqual([...INTERACTIVE_CARD_CARRIERS].sort());
  });
});

/**
 * THE STAT GRID — the thing `components/patterns/stat-tile.tsx` was written for.
 *
 * It had never been used by one until T-035 PR4 Task 6, which moved the 13-strong metric-strip
 * family onto it. The heading above used to end "and has never been used by"; that sentence is
 * what the adoption task existed to falsify and it is now false.
 *
 * Operational definition, stated before the number so the number can be checked:
 *
 *   an element whose classes include `grid` AND a `grid-cols-*` token, having **≥1 direct child
 *   element that is a hand-drawn card** (prop-borne elements are not children — see
 *   {@link ScannedElement}), where **every** one of those card children holds, somewhere in its
 *   subtree, both a display VALUE (an element whose classes include `font-bold` and a `text-<size>`
 *   token) and a muted LABEL (an element whose classes include `text-muted-foreground`).
 *
 * That read **62 grids / 35 files / 159 tiles**, with **0** of them rendering `<StatTile>`. After
 * the metric-strip migration it reads **50 / 26 / 113**, with **12 files** rendering `<StatTile>`
 * and {@link STAT_GRIDS_TOTAL} UNMOVED at 62 — the two halves of the invariant below, measured
 * together as it requires.
 *
 * TWELVE strips, not thirteen. `deprem/fay-hatlari`'s was migrated and then taken back out under
 * RULING BG: its three fault values are coloured `text-red-600`/`-blue-600`/`-emerald-600`, and
 * those hues are FAULT IDENTIFIERS that the same page re-uses on each fault's own card from
 * `lib/earthquake/fault-lines-data.ts`. Re-toning them onto bridge tokens severed a live
 * correspondence — a teal DAF tile above a blue-bordered DAF card — and the comment justifying it
 * asserted the opposite of what `grep borderClass` returns. It is categorical data encoding with
 * a `dark:`-paired other half, so it belongs to T-031c beside `/deprem`'s legend, and the strip is
 * deliberately left hand-rolled like `kitaplar/[slug]`'s inverted facts sheet.
 *
 * ## WHY ≥1 AND NOT ≥2 — A TILE TEMPLATE IS A TILE
 *
 * The first version of this counter required ≥2 card children, and that made **the dominant React
 * idiom invisible**: a grid written `{rows.map((r) => <div className="rounded-2xl bg-card …">…)}`
 * has ONE tile element in source however many it renders. 25 such grids across 17 files were
 * being skipped, `components/v2/v2-game-history-stats.tsx` among them — a textbook metric grid.
 *
 * It was worse than a blind spot. It ran the WRONG WAY for a ratchet: refactoring a literal
 * four-tile strip into a `.map()` over data — an ordinary cleanup that adopts nothing — would have
 * subtracted a grid and four tiles and read as progress. A counter an adoption task can lower by
 * doing nothing is not a ratchet.
 *
 * So a mapped grid counts as one grid and its file as one file, and **it contributes ONE tile per
 * template, not per rendered instance**. A static scan cannot know the length of `rows`. The grid
 * and file figures are therefore complete; the TILE figure is honestly approximate and reads low
 * wherever the markup is mapped — the opposite direction from blind spot 1 below, and the two do
 * not cancel.
 *
 * `StatTile` exists, has a contract test (`components/patterns/patterns-contract.test.ts`) and had
 * exactly one consumer in the whole repo for three tasks: `components/showcase/specimens/veri.tsx`,
 * a showcase specimen this section does not scan. Its product-surface consumer count is
 * {@link SURFACE_FILES_RENDERING_STATTILE}, which was zero and is now 13.
 *
 * ## WHAT THE ADOPTION FOUND THAT THIS COUNTER COULD NOT SEE
 *
 * The strips' values are NOT NUMBERS. "WGS84", "Haversine", "L'Huilier", "M 1.0 - 7.0+",
 * "ÖSYM / MEB". `MetricValue` takes `value: number`, so `StatTile` as shaped could not render a
 * single one of the 52 tiles this section had been sizing since PR3. That is a fifth blind spot
 * and it belongs beside the four below: the predicate reads a bold element in a `text-<size>`
 * class, which is a statement about TYPOGRAPHY and says nothing about whether the thing set in it
 * is a quantity. `StatTile` grew a second, literal `fact` branch for them rather than widening
 * `MetricValue.value` to `string`, which would have reopened T-024's defect.
 *
 * ## SCOPE — this is a SHAPE test, so it over-counts in one direction and under-counts in another
 *
 *   1. **It admits feature cards whose "value" is a bold heading and whose "label" is a muted
 *      description.** Concretely: `components/v2/v2-tools-hub.tsx` (2 grids, 6 tiles — hover-lit
 *      tool cards), `components/v2/v2-tool-educational-content.tsx` (6 grids, 22 tiles — prose
 *      explainer panels whose "value" is a `<div … font-bold>` wrapping an icon and an `<h4>`) and
 *      `components/v2/v2-game-hub.tsx` (1 grid, 3 tiles). Those are not metrics and `StatTile` is
 *      the wrong component for them, so the tile figure is an UPPER bound on what `StatTile` can
 *      absorb — roughly 159 minus those 31. **No tighter predicate is available**: requiring the
 *      bold element not to be a heading tag drops the pre-fix 134 only to 126 (the educational
 *      panels survive — their bold element is a `<div>`), and requiring `text-2xl` or larger drops
 *      it to 54 and discards genuine `text-xl font-bold` metric tiles. A source-shape test cannot
 *      tell a bold number from a bold heading. Re-audit before converting.
 *   2. **It misses a stat grid whose tiles are not hand-drawn cards.** A grid of bare `<div>`s
 *      with no rounding or surface token holds no card children and never qualifies, however
 *      metric-shaped its content.
 *   3. **It misses a tile grid built with flex rather than `grid`**, and one whose columns come
 *      from an arbitrary `grid-cols-[…]`-free utility.
 *   4. **Relaxing the value+label requirement** to "any grid with ≥1 card child" sweeps in every
 *      panel layout on the site; the requirement is what keeps this a tile counter.
 *
 *   5. **A grid is counted only where its tiles are its DIRECT JSX children.** A fragment between
 *      the grid and its tiles, a hoisted `const TILES = [...]` spread back in, or the tile
 *      extracted into a local `<Tile />` component all break that edge and remove the grid from
 *      the count. Measured on `araclar/page.tsx`'s real 4-tile strip: wrapping its tiles in
 *      `<>…</>` reads 61 / 34 / 155 with `HAND_DRAWN_CARDS` unchanged at 305 and
 *      `SURFACE_FILES_RENDERING_STATTILE` still 0. That is the `.map()` vector's whole CLASS, and
 *      extracting a repeated tile into a component is the normal FIRST STEP of the migration the
 *      adoption task is doing — so the fall would arrive looking like progress.
 *      {@link STAT_GRIDS_TOTAL} is the structural answer: see below.
 *
 * ## THE LONG TAIL, AUDITED — why 49 is where this stops rather than a milestone
 *
 * Task 6 migrated the metric-strip FAMILY and nothing else, and the reason is a measurement, not
 * a budget. The strip was the one population on this surface with a single repeated tile: 56
 * occurrences of `p-4 rounded-2xl bg-card border border-border shadow-2xs`, identical character
 * for character across 13 files. 50 are now `<StatTile>`; `grep` finds the exact spelling at EIGHT
 * remaining sites, and the split matters: FOUR write it alone (`kitaplar/[slug]`'s facts sheet, the
 * inverted tile deliberately left) and FOUR write it plus `space-y-1` (`turkiye/bolge`, the
 * fourteenth strip, listed below with its geometric reason). An earlier version of this sentence
 * claimed four, all `kitaplar/[slug]`; review counted eight.
 *
 * The other 49 grids write TWENTY-PLUS distinct tile spellings between them, and the divergence
 * is geometric rather than cosmetic:
 *
 *   - `v2-sea-basin-detail-view` (1 strip, 6-across): `p-3.5`, `text-[10px]` label,
 *     `text-lg sm:text-xl` value, label ABOVE value.
 *   - `turkiye/bolge` (1, 4 tiles): the strip's chrome plus `space-y-1`, but inverted — icon
 *     inside the label, label above, `font-extrabold`, a `text-[11px] text-muted-foreground/80`
 *     third line, and a TR/EN ternary in three places.
 *   - `dunya/kita` and `dunya/kita/[slug]`: `bg-card/60 backdrop-blur-sm p-3.5`.
 *   - `v2-member-hub`, `v2-earthquake-explorer`, `app/page`: `bg-muted/30`, `bg-muted/40`,
 *     `bg-muted/60`, `rounded-xl` — wells, not cards, by this file's own split.
 *   - `v2-tool-educational-content` (6 grids, 22 tiles), `v2-tools-hub` (2, 6) and `v2-game-hub`
 *     (1, 3) are the 31 named prose/feature panels SCOPE note 1 already excludes.
 *
 * Absorbing those would mean a `StatTile` variant per geometry, each with exactly one consumer —
 * which is the thing `components/orphan.test.ts` and T-036 exist to stop — and would change
 * six more pages' appearance with no colour defect to justify it, unlike the three that had one.
 * So the remainder is a RATCHET at 49, not a worklist at 49.
 *
 * ONE DEFECT WAS FOUND THERE AND DELIBERATELY LEFT. `v2-sea-basin-detail-view.tsx`'s 6-across
 * strip colours its "Maksimum Derinlik" value `text-cyan-600` with NO dark pair — a sixth
 * instance of exactly the frozen-colour defect this task fixed five of. It is left because the
 * same file carries five more raw palette classes outside any stat grid, two of which DO have
 * `dark:` pairs, so it is a file-level colour job rather than a tile migration; `components/ui/
 * token-binding.test.ts` scopes that whole population to T-031c by name.
 *
 * ## THE INVARIANT — read this before reading any number above
 *
 * **Progress is {@link SURFACE_FILES_RENDERING_STATTILE} RISING. A fall in the trio without it is
 * a refactor, not a migration.**
 *
 * {@link STAT_GRIDS_TOTAL} makes that checkable rather than merely stated: it is the sum of the
 * grids that hand-roll their tiles and the grids that render `<StatTile>`, and it is pinned. A
 * real migration moves a grid from one bucket to the other and leaves the total UNTOUCHED. Any
 * refactor that breaks the grid→tile edge — fragment, hoisted array, extracted component — lowers
 * the total and goes red on a counter that cannot be read as progress, because nothing arrived in
 * the other bucket. That closes the class, not the one vector.
 *
 * Like the two counters above, `STAT_GRIDS_WITHOUT_STATTILE` is a RATCHET, not a target: it falls
 * as grids adopt `StatTile`, it will not reach zero (blind spot 1 is a permanent residue), and a
 * rise is a regression to be argued for.
 *
 * MUTATION-CHECKED 2026-09-18 at 62 / 35 / 159 / 0, reverted after each:
 *
 *   - `hakkimizda/page.tsx` given a literal two-tile grid — RED on all three:
 *     `to have a length of 62 but got 63`, `expected 36 to be 35`, `expected 161 to be 159`, each
 *     message listing the grids by file. `hakkimizda` is in neither Task 5's nor Task 6's edit
 *     set, so this probe stays reproducible after the adoption lands.
 *   - **the gaming vector itself**: `oyun/page.tsx`'s four literal strip tiles rewritten as one
 *     `{STRIP.map(…)}` template — the refactor that adopts nothing. The grid and file counts HELD
 *     (62 / 35), which is what the ≥1 rule buys; `HAND_DRAWN_CARDS` went `expected 302 to be 305`
 *     and the tile count `expected 156 to be 159`. So the refactor is a RED diff that has to be
 *     re-pinned deliberately, not a silent −1 grid / −4 tiles read as progress.
 *   - a `<StatTile label="x" value="1" />` added to `v2-game-history-stats.tsx` — RED,
 *     `files rendering <StatTile>: components/v2/v2-game-history-stats.tsx: expected [ Array(1) ]
 *     to have a length of +0 but got 1`.
 *   - **the invariant, both ways, on `araclar/page.tsx`'s real 4-tile strip.** Tiles wrapped in a
 *     fragment (a refactor, nothing migrated): RED on all four — `expected 61 to be 62` on the
 *     TOTAL, plus 61 / 34 / 155 on the trio, with `HAND_DRAWN_CARDS` unmoved at 305 and
 *     `SURFACE_FILES_RENDERING_STATTILE` still 0. The same four tiles replaced by `<StatTile>`
 *     (a real migration): the trio and the adoption floor go red as they must — they have to be
 *     re-pinned — and **`STAT_GRIDS_TOTAL` does NOT appear in the failure list at all.** That
 *     difference is the whole ruling: a migration trades buckets, a refactor loses a grid.
 *
 * RE-PINNED AND RE-CHECKED at 49 / 26 / 109 / 13 after the metric-strip migration, per Ruling AZ
 * — a control proved at the old number proves nothing at the new one.
 *
 * **THOSE FOUR NUMBERS ARE HISTORY. The pins below read 50 / 26 / 113 / 12.** Ruling BG took
 * `deprem/fay-hatlari`'s strip back out of the migration after this block was written, and an
 * earlier version of it left this heading standing above the superseded figures — which is the
 * literal violation of the rule the heading states, in the block that states it. The run at the
 * current values is recorded after these three.
 *
 *   - `hakkimizda/page.tsx` given the same literal two-tile grid — RED on all three at the new
 *     values (`to have a length of 49 but got 50`, `expected 27 to be 26`, `expected 111 to be
 *     109`). The probe survived the adoption exactly as predicted, because `hakkimizda` holds no
 *     stat grid and was never in the edit set.
 *   - **the half-migration, on a real migrated strip**: `oyun/page.tsx`'s `<StatTile>` children
 *     reverted to hand-drawn tiles inside the `<StatGrid>` that now wraps them. RED on the TOTAL
 *     (`expected 61 to be 62`) with the trio holding at 49 / 26 / 109 and
 *     `SURFACE_FILES_RENDERING_STATTILE` falling to 12 — the shell adopted, the tiles not, the
 *     grid in neither bucket. That is RULING BA's own vector, checked on live markup rather than
 *     asserted.
 *   - **the shell removed from a migrated strip**: `araclar/page.tsx`'s `<StatGrid>` replaced by a
 *     bare `<div>` with no grid classes. RED on the TOTAL (`expected 61 to be 62`) with
 *     `SURFACE_FILES_RENDERING_STATTILE` unmoved at 13 — so a migrated grid cannot lose its shell
 *     and keep reading as migrated.
 *
 * RE-PINNED AND RE-CHECKED AGAIN at **50 / 26 / 113 / 12** after Ruling BG, which is what the
 * constants below now hold:
 *
 *   - `hakkimizda/page.tsx` given the same literal two-tile grid — RED on all three at the current
 *     values (`to have a length of 50 but got 51`, `expected 27 to be 26`, `expected 115 to be
 *     113`), plus `HAND_DRAWN_CARDS` 197, {@link HAND_DRAWN_CARD_SPELLINGS} 239 and the TOTAL 63.
 *   - **the full half-migration**, all four of `oyun/page.tsx`'s `<StatTile>` children reverted to
 *     hand-drawn tiles inside the `<StatGrid>` that still wraps them: RED on the TOTAL
 *     (`expected 61 to be 62`) with the trio HOLDING at 50 / 26 / 113 and
 *     `SURFACE_FILES_RENDERING_STATTILE` falling to **11**. Same vector, same answer, at the
 *     numbers that are actually pinned.
 *   - a **local `function StatTile()`** shadowing the import inside a real `<StatGrid>`: RED on the
 *     TOTAL at 61, on the floor at 11, and — the part that points rather than shouts — on the
 *     per-element anti-vacuity assertion, which names the offender:
 *     `app/[locale]/(site)/oyun/page.tsx <StatTile>: expected false to be true`.
 *
 * The tile and file counts are separate `it`s for a reason the first run showed: asserted
 * together, the file count failed first and the tile number — the figure the adoption tasks
 * actually drive — never printed.
 *
 * **THE PINS BELOW READ 47 / 25 / 111 / 12.** T-031c Task 8 de-tinted a GDP-contribution
 * callout on `turkiye/bolge/[slug]/page.tsx`, and its eyebrow label taking the muted text
 * colour is what makes that element read as a TILE here — a small label over a sized value.
 * The de-tinted SURFACES move {@link HAND_DRAWN_CARDS} and {@link HAND_DRAWN_WELLS} and do not
 * move these three; the isolation run that separates the two is in that block above, as is the
 * Ruling AZ control at these values, on `hakkimizda/page.tsx` and reverted.
 */
export const STAT_GRIDS_WITHOUT_STATTILE = 47;

export const STAT_GRID_FILES = 25;

export const STAT_TILES_WITHOUT_STATTILE = 111;

/**
 * The floor that is supposed to RISE. Zero for three tasks; 13 once the metric-strip family
 * landed. Stated beside the trio every time, because the trio falling on its own is a refactor.
 */
export const SURFACE_FILES_RENDERING_STATTILE = 12;

/**
 * Every tile grid on the surface, migrated or not: {@link STAT_GRIDS_WITHOUT_STATTILE} plus the
 * grids whose tiles are `<StatTile>` elements. **This number must not move when a grid is
 * migrated** — the grid leaves one bucket and arrives in the other. It moves only when a grid is
 * created, deleted, or REFACTORED OUT OF SIGHT, which is the whole point.
 *
 * **HALF OF WHAT MAKES THIS NUMBER TRUSTWORTHY LIVES IN ANOTHER FILE.** Since a `<StatGrid>` tag
 * counts as a grid shell here (Rulings BA/BB/BF, on {@link isGridShell}), this counter is only as
 * good as the guarantee that `StatGrid` still RENDERS a grid — and that is asserted in
 * `components/patterns/patterns-contract.test.ts`, which renders the component and pins its exact
 * class string. It lives there because that is where the component can be rendered; importing
 * `isGridShell` into it would push a scanner internal out of this 4800-test module, a worse trade.
 * If you are auditing this number, read both.
 */
export const STAT_GRIDS_TOTAL = 59;

const TILE_VALUE_SIZE = /^text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl|\[)/;

function subtreeOf(
  elements: readonly ScannedElement[],
  index: number,
  into: number[] = [],
): number[] {
  for (const child of elements[index]!.children) {
    into.push(child);
    subtreeOf(elements, child, into);
  }
  return into;
}

function isStatTile(elements: readonly ScannedElement[], index: number): boolean {
  const subtree = subtreeOf(elements, index);
  const hasValue = subtree.some((i) => {
    const tokens = tokensOf(elements[i]!.spelling);
    return tokens.includes("font-bold") && tokens.some((token) => TILE_VALUE_SIZE.test(token));
  });
  const hasLabel = subtree.some((i) =>
    tokensOf(elements[i]!.spelling).includes("text-muted-foreground"),
  );
  return hasValue && hasLabel;
}

/**
 * How many tile ELEMENTS the element at `index` holds as a stat grid, or `null` if it is not one.
 *
 * One is enough. A `{rows.map(…)}` grid writes its tile once and renders it n times, and the whole
 * point of Ruling AH is that such a grid is a stat grid — so the returned number counts templates,
 * not rendered tiles. See the docblock above for why that under-count is the honest one and why
 * the ≥2 rule it replaced was worse than under-counting.
 */
function statGridTiles(elements: readonly ScannedElement[], index: number): number | null {
  const tokens = tokensOf(elements[index]!.spelling);
  if (!tokens.includes("grid") || !tokens.some((token) => token.startsWith("grid-cols-"))) {
    return null;
  }
  const tiles = elements[index]!.children.filter((i) => cardKind(elements[i]!) !== null);
  if (tiles.length < 1) return null;
  if (!tiles.every((i) => isStatTile(elements, i))) return null;
  return tiles.length;
}

/** One qualifying grid: the file that writes it and how many tiles it holds. */
function statGrids(): { file: string; tiles: number }[] {
  const grids: { file: string; tiles: number }[] = [];
  for (const file of walkCardSurface()) {
    const elements = jsxElementsOf(file);
    elements.forEach((_, index) => {
      const tiles = statGridTiles(elements, index);
      if (tiles !== null) grids.push({ file: label(file), tiles });
    });
  }
  return grids;
}

/**
 * RULING BA. What counts as the GRID SHELL of a migrated grid.
 *
 * A hand-rolled grid writes `grid` and `grid-cols-*` in the caller's own className, and that is
 * how {@link statGridTiles} finds it. `components/patterns/stat-grid.tsx` moves those tokens
 * INTO a component, which is the entire point of having one — and which, read literally by the
 * rule above, removes the grid from both buckets and lowers {@link STAT_GRIDS_TOTAL}. That is
 * the exact signature of a grid refactored out of sight, so adopting `StatGrid` would have
 * arrived looking like the failure the invariant exists to catch.
 *
 * It is not that failure: the tiles are still the grid's direct children and the grid is still a
 * grid on screen. So `<StatGrid>` is recognised as a shell BY TAG, here, in the migrated bucket
 * only. Deliberately not in {@link statGridTiles}: a `<StatGrid>` filled with hand-drawn tiles is
 * a HALF migration — the shell adopted, the tiles left — and it lowers the total and goes red,
 * which is the correct answer for it.
 *
 * ## THE TAG IS NOT A FREE PASS, AND TWO SEPARATE THINGS HAD TO BE TRUE FOR THAT
 *
 * This docblock used to claim the tag was safe because `patterns-contract.test.ts` "pins that it
 * still spells `grid grid-cols-*`, so the shell cannot quietly stop being one". **That was false
 * and review proved it.** The pin was two SOURCE-SUBSTRING checks, and
 *
 *     const unused = cn("grid", COLUMNS[columns]);
 *     void unused;
 *     return <div className={cn("flex flex-col", …)}>{children}</div>;
 *
 * satisfies both while collapsing thirteen live metric strips to one column at every viewport —
 * with the entire suite green. Third occurrence of that shape in this programme (PR3's Ruling Z/AB,
 * Task 4's `.map()` blind spot), and the same fix each time: assert the RENDERED output, not the
 * source that is supposed to produce it. `patterns-contract.test.ts` now renders `StatGrid` through
 * `renderToStaticMarkup` and asserts the exact class string for every `columns` member, the way
 * `components/ui/card-variants.test.tsx` already does next door.
 *
 * RULING BB. The second half: the tag is resolved to a BINDING, not matched as a string. A locally
 * declared `function StatGrid({ children }) { return <section>{children}</section>; }` used to
 * count as a migrated shell and push {@link STAT_GRIDS_TOTAL} to 63 for an element that renders no
 * grid at all. Safe on its own — it ADDS a phantom and the counter is pinned exact — but it nets
 * against a real removal, which is precisely the hiding this invariant exists to stop. Ruling AB's
 * class, and `importBindingsOf` was already in this module for it.
 *
 * Aliasing is covered by the same lookup: `import { StatGrid as Grid }` binds `Grid` to
 * (`stat-grid.tsx`, `StatGrid`) and qualifies, while a local `StatGrid` binds nothing and falls
 * through to the className rule — where a `<section>` correctly reads as no grid.
 *
 * RULING BF. The binding is chased THROUGH RE-EXPORTS, not matched one hop deep.
 *
 * `importBindingsOf` resolves the immediate specifier only, so a genuine `StatGrid` reached
 * through a barrel binds to the BARREL and failed the identity test. Re-review measured all three
 * shapes holding the total at 62 where it should read 63: a plain name through a barrel, an
 * alias-of-alias through two barrels, and `export { StatGrid as default }`.
 *
 * The direction is safe — under-recognition LOWERS the total, which is the exact signature this
 * invariant shouts about, so such a grid goes red and gets investigated rather than hiding a loss
 * — and it is latent, because no `components/patterns` barrel exists today. It is fixed anyway,
 * for precedent: PR3's Ruling AB kept `reexportTargetsOf` — now in
 * `lib/test-support/composition-scan.ts`, beside {@link resolvesTo}, which is where the two
 * scanners' one-hop-vs-chase divergence was finally closed by there being only one — alive
 * *specifically* so a
 * barrel-exported component could not drop silently out of a count, and the scanner written after
 * it did not chase re-exports. Leaving that door ajar in each new scanner is how this programme
 * keeps paying for the same bug.
 *
 * NOTE ON THE OTHER HALF OF THIS PIN, because a reader arriving at {@link STAT_GRIDS_TOTAL} needs
 * to know where to look. The identity test answers "is this tag really the component"; it does not
 * answer "does that component still render a grid". THAT lives in
 * `components/patterns/patterns-contract.test.ts`, which renders `StatGrid` and asserts the exact
 * class string, including one assertion that the rendered tokens satisfy the className rule below.
 * It has to live there because that is where the component can be rendered; importing
 * `isGridShell` into it would export a scanner internal out of a 4800-test module, which trades a
 * small coupling risk for a larger one. So the guard is deliberately two files, and this is the
 * signpost to the other one.
 */
const STAT_GRID_MODULE = join(repoRoot, "components/patterns/stat-grid.tsx");

const STAT_TILE_MODULE = join(repoRoot, "components/patterns/stat-tile.tsx");

const resolvesToStatGrid = (node: RenderNode) => resolvesTo(node, STAT_GRID_MODULE, "StatGrid");

/** The tile half of the same rule, by binding rather than by tag. See {@link resolvesTo}. */
function isStatTileElement(element: ScannedElement, bindings: Map<string, RenderNode>): boolean {
  const bound = bindings.get(element.tag);
  return bound !== undefined && resolvesTo(bound, STAT_TILE_MODULE, "StatTile");
}

function isGridShell(element: ScannedElement, bindings: Map<string, RenderNode>): boolean {
  const bound = bindings.get(element.tag);
  if (bound !== undefined && resolvesToStatGrid(bound)) return true;
  const tokens = tokensOf(element.spelling);
  return tokens.includes("grid") && tokens.some((token) => token.startsWith("grid-cols-"));
}

/** What a file that really imports `StatGrid` binds. The fixtures below pass it explicitly. */
const STAT_GRID_BINDING: Map<string, RenderNode> = new Map([
  ["StatGrid", { file: STAT_GRID_MODULE, name: "StatGrid" }],
  ["StatTile", { file: STAT_TILE_MODULE, name: "StatTile" }],
]);

/**
 * The other bucket: a grid shell whose direct children include a `<StatTile>`.
 *
 * No value/label check, and none is possible — the tile's content lives inside the component, not
 * in the grid's markup, which is the entire benefit of migrating. So a migrated grid qualifies on
 * the same structural evidence its hand-rolled form did: the grid shell, and tiles as its direct
 * children.
 */
function statGridsUsingStatTile(): { file: string; tiles: number }[] {
  const grids: { file: string; tiles: number }[] = [];
  for (const file of walkCardSurface()) {
    const elements = jsxElementsOf(file);
    const bindings = importBindingsOf(file);
    elements.forEach((element, index) => {
      if (!isGridShell(element, bindings)) return;
      const tiles = elements[index]!.children.filter((i) =>
        isStatTileElement(elements[i]!, bindings),
      );
      if (tiles.length > 0) grids.push({ file: label(file), tiles: tiles.length });
    });
  }
  return grids;
}

/**
 * RULING BC. The one door the `fact`/`value` union leaves open, watched.
 *
 * `StatTile.fact` is typed `string`, and the TYPE cannot say "a compile-time literal". So
 * `fact={String(book.pageCount)}` typechecks, renders a runtime reading, and asks no `absent`
 * question anywhere — T-024's defect walking through the branch built to exclude it. The type
 * relationship is pinned thoroughly in `components/patterns/patterns-contract.test.ts`
 * (`fact?: never` / `value?: never` / `absent?: never`, all three); what it cannot express is this
 * USAGE rule, so it is pinned here as a counter, the way {@link STOCK_CARD_SURFACE_OVERRIDES}
 * watches the stock-`Card` door.
 *
 * Zero today — every one of the 46 `fact` props on the surface is a quoted literal.
 *
 * A brace expression is not automatically a defect (`fact={"WGS84"}` is a literal the long way
 * round), which is why this is a RATCHET and not a ban: a future `fact={…}` has to come here,
 * raise the number on purpose, and say why the expression cannot be absent.
 *
 * MUTATION-CHECKED 2026-09-18 at 0: `kitaplar/page.tsx`'s `fact="ÖSYM / MEB"` rewritten as
 * `fact={String(books.length)}` — RED, `expected [ Array(1) ] to have a length of +0 but got 1`,
 * the message naming the file. Reverted.
 */
export const FACT_PROPS_WITH_EXPRESSION = 0;

function factPropsWithExpression(): string[] {
  const hits: string[] = [];
  for (const file of walkCardSurface()) {
    // Masked, not raw: comments are stripped and string bodies are blanked, so neither this
    // docblock nor a prose string quoting `fact={` can put itself in the count.
    const found = [...maskedSource(file).matchAll(/\bfact=\{/g)].length;
    for (let i = 0; i < found; i += 1) hits.push(label(file));
  }
  return hits.sort();
}

function statGridReport(grids: readonly { file: string; tiles: number }[]): string {
  const byFile = new Map<string, number>();
  for (const grid of grids) byFile.set(grid.file, (byFile.get(grid.file) ?? 0) + grid.tiles);
  return [...byFile]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([file, tiles]) => `  ${tiles} tiles ${file}`)
    .join("\n");
}

describe("stat grids hand-roll the tile StatTile was written for", () => {
  it("the number of hand-rolled stat grids is exactly the recorded number", () => {
    const grids = statGrids();
    expect(grids, `hand-rolled stat grids, by file:\n${statGridReport(grids)}`).toHaveLength(
      STAT_GRIDS_WITHOUT_STATTILE,
    );
  });

  it("the number of files holding one is exactly the recorded number", () => {
    const grids = statGrids();
    const files = new Set(grids.map((grid) => grid.file));
    expect(files.size, `files holding a hand-rolled stat grid:\n${statGridReport(grids)}`).toBe(
      STAT_GRID_FILES,
    );
  });

  // Its own `it`, not a second assertion beside the file count: a task that deletes one grid
  // moves both, and the first `expect` to fail would otherwise hide the tile number — the figure
  // the adoption tasks are actually driving.
  it("the number of hand-rolled tiles is exactly the recorded number", () => {
    const grids = statGrids();
    const tiles = grids.reduce((total, grid) => total + grid.tiles, 0);
    expect(tiles, `hand-rolled stat tiles, by file:\n${statGridReport(grids)}`).toBe(
      STAT_TILES_WITHOUT_STATTILE,
    );
  });

  /**
   * RULING AJ. The one assertion a migration must NOT move, and the one a refactor cannot avoid
   * moving. Pinned as a sum so the buckets can trade freely: 62 = 62 hand-rolled + 0 migrated
   * today, and after Task 6 it should still read 62, with the split having shifted.
   */
  it("the total number of tile grids, migrated or not, is exactly the recorded number", () => {
    const handRolled = statGrids();
    const migrated = statGridsUsingStatTile();
    expect(
      handRolled.length + migrated.length,
      `hand-rolled:\n${statGridReport(handRolled)}\nusing StatTile:\n${statGridReport(migrated)}`,
    ).toBe(STAT_GRIDS_TOTAL);
  });

  it("a migrated grid moves between buckets and leaves the total alone", () => {
    // The invariant, on a fixture: the same grid shell hand-rolled and migrated. One counts in
    // `statGrids()`, the other in `statGridsUsingStatTile()`, and the sum is 1 either way — so a
    // real migration cannot lower the total, and a refactor that hides the grid cannot hide in it.
    const shell = (tiles: string) => `<div className="grid grid-cols-2 gap-3">${tiles}</div>`;
    const handRolled =
      '<div className="rounded-2xl bg-card border-border"><span className="text-2xl font-bold">1</span><span className="text-xs text-muted-foreground">x</span></div>';
    const migrated = '<StatTile value="1" label="x" />';
    const buckets = (source: string) => {
      const elements = scanJsx(source);
      const hand = statGridTiles(elements, 0) === null ? 0 : 1;
      const uses =
        isGridShell(elements[0]!, STAT_GRID_BINDING) &&
        elements[0]!.children.some((i) => isStatTileElement(elements[i]!, STAT_GRID_BINDING))
          ? 1
          : 0;
      return { hand, uses, total: hand + uses };
    };
    expect(buckets(shell(handRolled + handRolled))).toEqual({ hand: 1, uses: 0, total: 1 });
    expect(buckets(shell(migrated + migrated))).toEqual({ hand: 0, uses: 1, total: 1 });
    // …and the refactor that reads as progress: tiles wrapped in a fragment, nothing migrated.
    expect(buckets(shell(`<>${handRolled}${handRolled}</>`))).toEqual({
      hand: 0,
      uses: 0,
      total: 0,
    });
  });

  /**
   * RULING BA on a fixture, both ways. The shell moved into `<StatGrid>` and the tiles into
   * `<StatTile>` is the FULL migration and must read exactly like the hand-rolled grid did —
   * total 1, in the migrated bucket. The shell adopted with hand-drawn tiles left behind is the
   * HALF migration and must read 0, because that is a grid whose tiles are no longer countable
   * from source and which arrived in neither bucket.
   */
  it("a <StatGrid> is a grid shell — but only once its tiles are StatTiles too", () => {
    const handRolled =
      '<div className="rounded-2xl bg-card border-border"><span className="text-2xl font-bold">1</span><span className="text-xs text-muted-foreground">x</span></div>';
    const tile = '<StatTile fact="1" label="x" />';
    const buckets = (source: string) => {
      const elements = scanJsx(source);
      const hand = statGridTiles(elements, 0) === null ? 0 : 1;
      const uses =
        isGridShell(elements[0]!, STAT_GRID_BINDING) &&
        elements[0]!.children.some((i) => isStatTileElement(elements[i]!, STAT_GRID_BINDING))
          ? 1
          : 0;
      return { hand, uses, total: hand + uses };
    };
    expect(buckets(`<StatGrid>${tile}${tile}</StatGrid>`)).toEqual({
      hand: 0,
      uses: 1,
      total: 1,
    });
    expect(buckets(`<StatGrid>${handRolled}${handRolled}</StatGrid>`)).toEqual({
      hand: 0,
      uses: 0,
      total: 0,
    });
    // And the tag rule is a tag rule, not a name-contains rule: a neighbour does not qualify.
    expect(buckets(`<StatGridHeader>${tile}${tile}</StatGridHeader>`)).toEqual({
      hand: 0,
      uses: 0,
      total: 0,
    });
  });

  /**
   * RULING BB's second half, on a fixture. The shell is a BINDING, not a spelling.
   *
   * Review declared a local `function StatGrid({ children }) { return <section>…</section>; }` in a
   * page and it counted as a migrated shell, pushing the TOTAL to 63 for an element that renders no
   * grid. The direction was safe — a phantom ADDS, and the counter is pinned exact — but it nets
   * against a real removal, and netting is the hiding this invariant exists to stop.
   */
  it("a locally declared StatGrid is not the shell — the binding is resolved, not the name", () => {
    const tile = '<StatTile fact="1" label="x" />';
    const shell = (bindings: Map<string, RenderNode>) =>
      isGridShell(scanJsx(`<StatGrid>${tile}${tile}</StatGrid>`)[0]!, bindings) ? 1 : 0;

    // Imported from the real module: a shell.
    expect(shell(STAT_GRID_BINDING)).toBe(1);
    // Declared locally — no import binding at all: NOT a shell, and the `<StatGrid>` element
    // carries no grid className to fall back on.
    expect(shell(new Map())).toBe(0);
    // Imported from somewhere else under the same name: NOT a shell.
    expect(
      shell(
        new Map([
          ["StatGrid", { file: join(repoRoot, "components/v2/v2-hero.tsx"), name: "StatGrid" }],
        ]),
      ),
    ).toBe(0);
    // ALIASED from the real module: still a shell — `import { StatGrid as Grid }` is the natural
    // way to write it beside a local grid helper, and it must not fall out of the count.
    const aliased = scanJsx(`<Grid>${tile}${tile}</Grid>`)[0]!;
    expect(
      isGridShell(aliased, new Map([["Grid", { file: STAT_GRID_MODULE, name: "StatGrid" }]])),
    ).toBe(true);
    // …but an alias pointing at a DIFFERENT export of the same module is not.
    expect(
      isGridShell(aliased, new Map([["Grid", { file: STAT_GRID_MODULE, name: "StatGridProps" }]])),
    ).toBe(false);
  });

  /**
   * RULING BF, all three shapes. A genuine `StatGrid` reached through a barrel is still the shell.
   *
   * The two hosts are borrowed PATHS in the same directory — `withInjectedSource` replaces their
   * source entirely for the duration, so nothing here depends on what either file contains, which
   * is Ruling AY's requirement: no control anchored on markup a later task can delete. They have
   * to be real paths rather than notional ones only because the last assertion reads them back
   * after the injection is gone, to prove it was temporary.
   */
  it("a StatGrid reached through a re-export barrel is still the shell", () => {
    const outer = join(repoRoot, "components/patterns/breadcrumbs-nav.tsx");
    const middle = join(repoRoot, "components/patterns/form-field.tsx");
    const chase = (
      source: string,
      name: string,
      extra: ReadonlyArray<readonly [string, string]> = [],
    ) =>
      withInjectedSource([[outer, source], ...extra], () =>
        resolvesToStatGrid({ file: outer, name }),
      );

    // A plain named re-export.
    expect(chase('export { StatGrid } from "./stat-grid";\n', "StatGrid")).toBe(true);
    // `export { StatGrid as default }`, imported as a default binding.
    expect(chase('export { StatGrid as default } from "./stat-grid";\n', "default")).toBe(true);
    // `export * from`.
    expect(chase('export * from "./stat-grid";\n', "StatGrid")).toBe(true);
    // An alias-of-alias through TWO hops.
    expect(
      chase('export { Grid as G2 } from "./form-field";\n', "G2", [
        [middle, 'export { StatGrid as Grid } from "./stat-grid";\n'],
      ]),
    ).toBe(true);

    // NEGATIVE CONTROLS — the chase must not turn into "anything reachable".
    // A barrel that re-exports a DIFFERENT symbol of the real module.
    expect(chase('export { StatGridProps } from "./stat-grid";\n', "StatGridProps")).toBe(false);
    // A barrel that re-exports a same-named symbol from somewhere else entirely.
    expect(chase('export { StatGrid } from "./page-hero";\n', "StatGrid")).toBe(false);
    // A barrel exporting nothing relevant.
    expect(chase('export { PageContainer } from "./page-container";\n', "StatGrid")).toBe(false);
    // A CYCLE terminates rather than recursing forever — two barrels re-exporting each other.
    expect(
      chase('export { StatGrid } from "./form-field";\n', "StatGrid", [
        [middle, 'export { StatGrid } from "./breadcrumbs-nav";\n'],
      ]),
    ).toBe(false);

    // The injection really was temporary: the borrowed path resolves nothing once it is gone.
    expect(resolvesToStatGrid({ file: outer, name: "StatGrid" })).toBe(false);
  });

  /**
   * The SAME two rulings, on the TILE. Whole-branch review's M4: `tag === "StatTile"` sat one line
   * under `isGridShell` while that function was being taught to resolve a binding and chase
   * re-exports, and the previous round's report named the gap without closing it.
   *
   * Both directions are asserted because both are reachable and they fail opposite ways: a
   * phantom tile counts a grid as migrated that renders nothing (it ADDS, and nets against a real
   * removal), while an unrecognised alias drops a real migrated grid out of the bucket (it
   * SUBTRACTS, and reads as a lost grid).
   */
  it("a StatTile is resolved by binding too — phantom in, alias not out", () => {
    const tile = scanJsx('<StatTile fact="1" label="x" />')[0]!;
    const aliased = scanJsx('<Tile fact="1" label="x" />')[0]!;
    const real = { file: STAT_TILE_MODULE, name: "StatTile" };

    expect(isStatTileElement(tile, new Map([["StatTile", real]]))).toBe(true);
    // Locally declared — the phantom. Not a tile.
    expect(isStatTileElement(tile, new Map())).toBe(false);
    // Same name, different module. Not a tile.
    expect(
      isStatTileElement(
        tile,
        new Map([
          ["StatTile", { file: join(repoRoot, "components/v2/v2-hero.tsx"), name: "StatTile" }],
        ]),
      ),
    ).toBe(false);
    // A different export of the real module. Not a tile.
    expect(
      isStatTileElement(
        tile,
        new Map([["StatTile", { file: STAT_TILE_MODULE, name: "StatTone" }]]),
      ),
    ).toBe(false);
    // ALIASED from the real module: still a tile.
    expect(isStatTileElement(aliased, new Map([["Tile", real]]))).toBe(true);
    // And through a barrel, with the same walk the shell uses.
    const barrel = join(repoRoot, "components/patterns/breadcrumbs-nav.tsx");
    expect(
      withInjectedSource([[barrel, 'export { StatTile as Tile } from "./stat-tile";\n']], () =>
        isStatTileElement(aliased, new Map([["Tile", { file: barrel, name: "Tile" }]])),
      ),
    ).toBe(true);
  });

  it("every product StatTile resolves to the real module — anti-vacuity for the rule above", () => {
    // If `resolvesTo` started answering false for everything, the migrated bucket would empty and
    // the TOTAL would fall — loudly, but only after someone re-pinned it. Assert the premise on
    // the live surface: every `<StatTile>` element resolves, over a population that is really
    // there. 46 today; the floor is 30 so that removing one strip (a legitimate thing a later
    // task may do, as Ruling BG just did) does not trip an anti-vacuity guard, while a scan that
    // has stopped seeing the surface still does.
    let resolved = 0;
    for (const file of walkCardSurface()) {
      if (file === STAT_TILE_MODULE) continue;
      const bindings = importBindingsOf(file);
      for (const element of jsxElementsOf(file)) {
        if (element.tag !== "StatTile") continue;
        expect(isStatTileElement(element, bindings), `${label(file)} <StatTile>`).toBe(true);
        resolved += 1;
      }
    }
    expect(resolved).toBeGreaterThan(30);
  });

  it("the direct binding still short-circuits without touching the re-export walk", () => {
    // The common path — 13 files import `StatGrid` directly — must not depend on `readSource`
    // being able to open anything. Asserted on a node that names a file with no source at all.
    expect(resolvesToStatGrid({ file: STAT_GRID_MODULE, name: "StatGrid" })).toBe(true);
    expect(resolvesToStatGrid({ file: STAT_GRID_MODULE, name: "StatGridProps" })).toBe(false);
    expect(resolvesToStatGrid({ file: STAT_GRID_MODULE, name: null })).toBe(false);
  });

  it("the real migrated pages resolve their StatGrid binding — anti-vacuity for the rule above", () => {
    // Without this, a `resolveSpecifier` that quietly returned null for every `@/components/...`
    // specifier would make `isGridShell` reject every real shell, the migrated bucket would empty,
    // and the TOTAL would fall — loudly, but only after someone re-pinned it. Assert the premise.
    const page = join(repoRoot, "app/[locale]/(site)/araclar/page.tsx");
    const bound = importBindingsOf(page).get("StatGrid");
    expect(bound, "araclar/page.tsx no longer binds StatGrid").toBeDefined();
    expect(bound!.file).toBe(STAT_GRID_MODULE);
    expect(bound!.name).toBe("StatGrid");
  });

  it("no product surface renders StatTile at all — the adoption floor", () => {
    // Expected to RISE, unlike every other number in this section, so it is pinned exactly:
    // the first real consumer has to come and change it on purpose. `stat-tile.tsx` itself is
    // excluded — a component naming its own export proves nothing about adoption.
    const primitive = join(repoRoot, "components/patterns/stat-tile.tsx");
    const consumers = walkCardSurface()
      .filter((file) => file !== primitive)
      .filter((file) => {
        const bindings = importBindingsOf(file);
        return jsxElementsOf(file).some((element) => isStatTileElement(element, bindings));
      })
      .map(label);
    expect(consumers, `files rendering <StatTile>:\n${consumers.join("\n")}`).toHaveLength(
      SURFACE_FILES_RENDERING_STATTILE,
    );
    expect(existsSync(primitive)).toBe(true);
  });

  it("every fact prop on the surface is a literal, never an expression", () => {
    const hits = factPropsWithExpression();
    expect(
      hits,
      `fact={…} — a runtime reading in the branch that asks no absent question:\n${hits.join("\n")}`,
    ).toHaveLength(FACT_PROPS_WITH_EXPRESSION);
  });

  it("the fact scan looked at real fact props — anti-vacuity", () => {
    // A counter reading 0 because it found nothing to look at is worthless, so assert the
    // population exists before trusting the zero. 42 today (46 landed, then Ruling BG returned
    // `deprem/fay-hatlari`'s 4 to hand-rolled markup). The floor is 30 rather than 40 for the
    // reason the tile floor below carries: removing one strip is a legitimate thing a later task
    // may do — Ruling BG just did — and an anti-vacuity guard that trips on legitimate work stops
    // being read. A scan that has stopped seeing the surface still fails it.
    const quoted = walkCardSurface().reduce(
      (n, file) => n + [...maskedSource(file).matchAll(/\bfact="/g)].length,
      0,
    );
    expect(quoted).toBeGreaterThan(30);
  });

  it("the fact pattern fires on an expression and not on a literal — both ways", () => {
    expect(/\bfact=\{/.test('<StatTile fact={String(x)} label="y" />')).toBe(true);
    expect(/\bfact=\{/.test('<StatTile fact="WGS84" label="y" />')).toBe(false);
    // Not a substring match on some other prop ending in "fact".
    expect(/\bfact=\{/.test("<X artefact={1} />")).toBe(false);
  });

  it("the tile predicate needs BOTH a value and a muted label — negative controls", () => {
    const grid = (tile: string) => `<div className="grid grid-cols-2 gap-3">${tile}${tile}</div>`;
    const valueAndLabel =
      '<div className="rounded-2xl bg-card border-border"><span className="text-2xl font-bold">12</span><span className="text-xs text-muted-foreground">il</span></div>';
    const valueOnly =
      '<div className="rounded-2xl bg-card border-border"><span className="text-2xl font-bold">12</span></div>';
    const qualifies = (source: string) => statGridTiles(scanJsx(source), 0);
    expect(qualifies(grid(valueAndLabel))).toBe(2);
    expect(qualifies(grid(valueOnly))).toBe(null);
    expect(qualifies(`<div className="grid grid-cols-2 gap-3">${valueOnly}</div>`)).toBe(null);
    expect(qualifies(`<div className="flex gap-3">${valueAndLabel}${valueAndLabel}</div>`)).toBe(
      null,
    );
    expect(qualifies(grid(valueAndLabel.replace("rounded-2xl bg-card border-border", "p-3")))).toBe(
      null,
    );
  });

  /**
   * RULING AH, asserted. A mapped grid and the identical grid written literally must both be
   * stat grids; before this, only the literal one was, and the difference was a free −1 grid /
   * −4 tiles for anyone who refactored a strip into a `.map()` over data.
   *
   * The tile NUMBERS differ (1 template vs 2 elements) and that is the documented approximation,
   * not a defect: source cannot know how long `rows` is. What must not differ is whether the grid
   * is seen at all.
   */
  it("a mapped grid is a grid — the same markup written two ways", () => {
    const tile =
      '<div className="rounded-2xl bg-card border-border"><span className="text-2xl font-bold">{r.n}</span><span className="text-xs text-muted-foreground">{r.label}</span></div>';
    const mapped = `<div className="grid grid-cols-2 gap-3">{rows.map((r) => (${tile}))}</div>`;
    const literal = `<div className="grid grid-cols-2 gap-3">${tile}${tile}</div>`;
    expect(statGridTiles(scanJsx(mapped), 0)).toBe(1);
    expect(statGridTiles(scanJsx(literal), 0)).toBe(2);
  });

  it("a mapped grid reaches the COUNTERS, not just the predicate", () => {
    // The end-to-end half: walk → cache → scan → `statGrids()`. Run on an injected real file so
    // the whole path executes, and asserted RELATIVELY so the host file's contents may change.
    const file = join(repoRoot, "app/[locale]/(site)/hakkimizda/page.tsx");
    const before = statGrids();
    const probe = `
const Probe = () => (
  <div className="grid grid-cols-2 gap-3">
    {rows.map((r) => (
      <div key={r.id} className="p-4 rounded-2xl bg-card border border-border">
        <span className="text-2xl font-bold">{r.n}</span>
        <span className="text-xs text-muted-foreground">{r.label}</span>
      </div>
    ))}
  </div>
);
`;
    const after = withInjectedSource([[file, `${readFileSync(file, "utf8")}${probe}`]], () =>
      statGrids(),
    );
    expect(after).toHaveLength(before.length + 1);
    expect(after.reduce((n, g) => n + g.tiles, 0)).toBe(
      before.reduce((n, g) => n + g.tiles, 0) + 1,
    );
    expect(statGrids()).toHaveLength(before.length);
  });
});
