# T-031c — Decorative Palette to the Token Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drive 825 raw Tailwind palette classes to zero — each one decided case by case as data, semantic or pure decoration — and close the correctness bug underneath them: a region's badge and its map fill are currently unrelated colours.

**Architecture:** An inventory lands first as a reviewable document, so 825 scattered judgements become one artefact a reviewer can disagree with in a single pass. A counter test is pinned red beside it. Then the inventory is applied in batches, each batch driving the counter down, ending at zero with named exemptions.

**Tech Stack:** Tailwind v4 (CSS-first), bridge tokens in `app/globals.css`, vitest (node env), Playwright MCP for the visual round.

**Spec:** `docs/superpowers/specs/2026-09-19-dark-mode-and-build-integrity-design.md` (§2.3, §7)

## Global Constraints

- Branch off `dev`: `feature/t031c-decorative`. Never push to `main`.
- **Requires PR0 merged** — every contrast figure quoted must come from `lib/theme/contrast.ts`, and every categorical-separation figure from `lib/theme/delta-e.ts`.
- May run in parallel with T-048 and T-033. **This branch must not touch `app/[locale]/(site)/turkiye/[slug]/page.tsx`** — T-033 owns it and rewrites its climate markup wholesale. Its 32 occurrences are out of scope here and T-033 clears them.
- This branch **owns `app/globals.css`**. T-033 and T-048 do not edit it.
- A component that needs a hand-written `dark:` is bound to the wrong token. Removing a `dark:` pair is the normal outcome of binding correctly, not a regression.
- Brand chrome never encodes data (`docs/design.md` rule 1). Data token sets — `--region-*`, `--eq-mag-1..5`, `--game-*`, `--map-1..6`, `--chart-*` — are **not** bridge tokens and are never replaced by one.
- Public-safety scales stay standard, never restyled to Terra: AQI bands, USGS MMI, SST ramps.
- `pnpm typecheck && pnpm lint && pnpm test` green before every commit. Visible change ⇒ `pnpm sweep:overflow` plus screenshots at 320, 360, 390 and desktop in both themes.
- Do not `git worktree add` in this repo.

## The measurements this plan is built on

Measured 2026-09-19: **865 occurrences across 43 files**. Of those, 4 are test files (8 occurrences) and one is T-033's file (32 occurrences), leaving **825 in 38 product files** for this branch.

By hue: amber 219, emerald 150, cyan 107, teal 99, rose 57, orange 45, red 33, sky 30, yellow 29, stone 29, blue 24, slate 18.

By line: of the 455 source lines carrying them, 137 also carry a hand-written `dark:` and 318 do not — so roughly two thirds have no dark-mode treatment at all.

The ten heaviest files carry 278 of the 825:

| File                                                | Count |
| --------------------------------------------------- | ----- |
| `app/[locale]/(site)/turkiye/bolge/[slug]/page.tsx` | 57    |
| `components/v2/v2-turkey-map-explorer.tsx`          | 38    |
| `components/v2/v2-tools-hub.tsx`                    | 30    |
| `components/v2/v2-marine-map-explorer.tsx`          | 30    |
| `components/v2/v2-world-continents.tsx`             | 24    |
| `components/v2/v2-game-screen.tsx`                  | 24    |
| `app/[locale]/(site)/dunya/[slug]/page.tsx`         | 20    |
| `components/v2/v2-earthquake-explorer.tsx`          | 19    |
| `components/v2/v2-sea-basin-detail-view.tsx`        | 12    |
| `app/[locale]/(site)/deprem/fay-hatlari/page.tsx`   | 12    |

**Nothing holds this number.** `components/ui/token-binding.test.ts` enforces only the escape rule; the count lives in a comment. It moved 749 → 895 → 865 without any test noticing.

### The correctness bug underneath

`app/[locale]/(site)/turkiye/bolge/[slug]/page.tsx` gives each region both a `mapFill` bound to `--region-*` and a `badgeClass`/`accentColor`/`gradient`/`borderAccent` set written in unrelated raw hues:

| Region            | Badge / accent hue | `mapFill` token value                             |
| ----------------- | ------------------ | ------------------------------------------------- |
| Marmara           | amber              | `--region-marmara` #0072b2 (blue)                 |
| Ege               | teal               | `--region-ege` #e69f00 (orange)                   |
| Akdeniz           | emerald            | `--region-akdeniz` #56b4e9 (sky blue)             |
| İç Anadolu        | yellow             | `--region-ic-anadolu` #f0e442 (yellow)            |
| Karadeniz         | cyan               | `--region-karadeniz` #cc79a7 (reddish purple)     |
| Doğu Anadolu      | stone              | `--region-dogu-anadolu` #009e73 (bluish green)    |
| Güneydoğu Anadolu | —                  | `--region-guneydogu-anadolu` #d55e00 (vermillion) |

Six of seven disagree, and one (İç Anadolu) agrees by coincidence. The page tells a reader a region is amber and paints it blue on the map beside it. This is not a theming preference; it is the page contradicting itself, and it is the single highest-value fix in the branch.

---

### Task 1: The inventory

825 individual judgements are not reviewable as 825 diffs. They are reviewable as one table.

**Files:**

- Create: `docs/superpowers/t031c-palette-inventory.md`
- Create: `scripts/palette-inventory.mjs`

**Interfaces:**

- Consumes: nothing.
- Produces: `collectPaletteOccurrences(roots: string[]): { file: string; line: number; cls: string; context: string }[]` from `scripts/palette-inventory.mjs`, reused by Task 2's counter so the branch has **one** reader of this pattern, not two. Two readers of one notation that nothing compares is the failure T-045 was split to fix.

- [ ] **Step 1: Write the collector**

Create `scripts/palette-inventory.mjs`:

```js
/**
 * Find every raw Tailwind palette class in the product tree.
 *
 * ONE reader. `components/ui/token-binding.test.ts` has its own regex for the escape rule and
 * that one stays; this is the reader for the COUNT, and Task 2's counter imports it rather
 * than writing a second pattern. Two scanners of one notation that nothing compares is
 * exactly the shape T-045 was created to remove.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const FAMILIES =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const PROPERTIES =
  "text|bg|border|from|to|via|ring|fill|stroke|decoration|outline|shadow|accent|caret|divide";

/** e.g. `text-amber-600`, `bg-emerald-500/15`, `dark:text-cyan-400`. */
export const RAW_PALETTE = new RegExp(
  `\\b(?:${PROPERTIES})-(?:${FAMILIES})-(?:50|100|200|300|400|500|600|700|800|900|950)\\b`,
  "g",
);

/** Files this branch does not own, and files that are not product code. */
export const EXCLUDED = [
  // T-033 rewrites this file's climate markup wholesale and clears its 32 occurrences.
  "app/[locale]/(site)/turkiye/[slug]/page.tsx",
];

const isSource = (name) => name.endsWith(".tsx") || name.endsWith(".ts");
const isTest = (name) => name.includes(".test.");

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : walk(path);
    return isSource(entry.name) && !isTest(entry.name) ? [path] : [];
  });
}

/** @returns {{ file: string, line: number, cls: string, context: string }[]} */
export function collectPaletteOccurrences(roots = ["components", "app"]) {
  return roots
    .flatMap(walk)
    .filter((file) => !EXCLUDED.some((e) => file.endsWith(e)))
    .flatMap((file) =>
      readFileSync(file, "utf8")
        .split("\n")
        .flatMap((text, i) =>
          [...text.matchAll(RAW_PALETTE)].map((m) => ({
            file,
            line: i + 1,
            cls: m[0],
            context: text.trim().slice(0, 120),
          })),
        ),
    );
}
```

- [ ] **Step 2: Generate the raw list**

```bash
node --input-type=module -e "
import { collectPaletteOccurrences } from './scripts/palette-inventory.mjs';
const all = collectPaletteOccurrences();
console.log('total', all.length);
const byFile = {};
for (const o of all) byFile[o.file] = (byFile[o.file] ?? 0) + 1;
for (const [f, n] of Object.entries(byFile).sort((a,b)=>b[1]-a[1])) console.log(n, f);
"
```

Expected: `total 825` across 38 files. If it disagrees, find out why before writing the
inventory — the number is the thing this branch is accountable to.

- [ ] **Step 3: Classify every occurrence**

Write `docs/superpowers/t031c-palette-inventory.md`. One row per occurrence, grouped by file,
with a verdict from exactly three:

- **`data`** — encodes a value, a category or a safety band. It binds to a data token set and
  never to a bridge token. If the right data token does not exist, the row says which set it
  belongs in.
- **`semantic`** — means success, warning, danger, information or brand accent. It binds to
  the matching bridge token, and its hand-written `dark:` pair is deleted in the same edit.
- **`decoration`** — carries no meaning; a tint behind an icon, a gradient wash, a hover
  glow. It is **removed**, not re-tokenised.

Format:

```markdown
### components/v2/v2-sea-basin-detail-view.tsx (12)

| Line | Class                              | Verdict    | Becomes              | Note                                                                                             |
| ---- | ---------------------------------- | ---------- | -------------------- | ------------------------------------------------------------------------------------------------ |
| 147  | `text-cyan-600`                    | semantic   | `text-accent-strong` | "Maksimum Derinlik" reading; the sixth frozen colour recorded in T-044(3), no `dark:` pair today |
| 245  | `text-cyan-600 dark:text-cyan-400` | semantic   | `text-accent-strong` | the `dark:` pair goes with it                                                                    |
| 281  | `bg-red-500/10 text-red-600`       | decoration | removed              | tint behind a warning icon that already carries its own glyph and label                          |
```

Rules while classifying:

- A class inside a `mapFill`, a chart series, a legend swatch or a magnitude badge is `data`.
  When in doubt, ask whether two different values could ever want two different colours here.
  If yes, it is `data`.
- `docs/design.md` rule 3 forbids meaning by colour alone. A `decoration` verdict is only
  available where text, icon, pattern or shape already carries the meaning — say which, in the
  note. If nothing else carries it, the row is `semantic`, not `decoration`.
- Never guess at a bridge token's contrast. Quote the figure from `lib/theme/contrast.ts`.

- [ ] **Step 4: Commit the inventory alone**

```bash
git add docs/superpowers/t031c-palette-inventory.md scripts/palette-inventory.mjs
git commit -m "docs(t031c): classify all 825 raw palette occurrences

One reviewable table instead of 825 diffs to re-litigate. Three verdicts:
data binds to a data token set, semantic to a bridge token, decoration is
removed. One collector, reused by the counter, so the branch has a single
reader of this notation."
```

- [ ] **Step 5: Get the inventory reviewed before any code changes**

Stop here and ask for review of the table. This is the gate the whole design rests on: after
this, the edits are mechanical, and a wrong verdict discovered at Task 6 costs a rewrite.

---

### Task 2: The counter, pinned red

**Files:**

- Create: `components/ui/raw-palette-count.test.ts`

**Interfaces:**

- Consumes: `collectPaletteOccurrences`, `EXCLUDED` from `scripts/palette-inventory.mjs`.
- Produces: `RAW_PALETTE_BUDGET` — the number each later task steps down.

- [ ] **Step 1: Write the test**

Create `components/ui/raw-palette-count.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { collectPaletteOccurrences, EXCLUDED } from "../../scripts/palette-inventory.mjs";

/**
 * Raw Tailwind palette classes still in the product tree.
 *
 * ## Why a number and not just the escape rule
 *
 * `token-binding.test.ts` has enforced "no raw palette class" on a narrow surface for a long
 * time while this count moved 749 -> 895 -> 865 with nobody noticing, because it lived in a
 * comment. A comment is not a guard. This goes to 0; every step down is a commit.
 *
 * ## The one exclusion
 *
 * `turkiye/[slug]/page.tsx` belongs to T-033, which rewrites its climate markup wholesale.
 * Listing it here rather than silently skipping it is deliberate: when T-033 merges, this
 * test fails on the exclusion being stale, which is the reminder to delete it.
 */
const RAW_PALETTE_BUDGET = 825;

describe("the raw palette is being retired, and the number is held", () => {
  it("finds no more than the budget", () => {
    const found = collectPaletteOccurrences();
    const byFile = new Map<string, number>();
    for (const o of found) byFile.set(o.file, (byFile.get(o.file) ?? 0) + 1);
    const worst = [...byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    expect(
      found.length,
      `budget ${RAW_PALETTE_BUDGET}, found ${found.length}. Heaviest: ${worst
        .map(([f, n]) => `${f} (${n})`)
        .join(", ")}`,
    ).toBeLessThanOrEqual(RAW_PALETTE_BUDGET);
  });

  it("collects something at all — positive control", () => {
    // A collector that silently matched nothing would satisfy any budget.
    expect(collectPaletteOccurrences(["components"]).length).toBeGreaterThan(0);
  });

  it("still has a reason for every exclusion", () => {
    // When T-033 merges and this file no longer carries any, the exclusion is dead weight and
    // this fails, which is the point.
    for (const path of EXCLUDED) {
      const hits = collectPaletteOccurrences(["app", "components"]).filter((o) =>
        o.file.endsWith(path),
      );
      expect(hits, `${path} is excluded but the collector already skips it`).toEqual([]);
    }
  });
});
```

- [ ] **Step 2: Run it**

Run: `pnpm vitest run components/ui/raw-palette-count.test.ts`

Expected: PASS at 825 — the budget starts where reality is. It goes red only if someone adds
a raw class, and it is stepped down by every task below.

- [ ] **Step 3: Commit**

```bash
git add components/ui/raw-palette-count.test.ts
git commit -m "test(ui): hold the raw palette count at 825

The number moved 749 -> 895 -> 865 while living only in a comment."
```

---

### Task 3: Region identity — the correctness fix

The one place where the raw palette is not a theming wart but a page contradicting itself.

**Files:**

- Modify: `app/[locale]/(site)/turkiye/bolge/[slug]/page.tsx` (the region descriptor table, from :60)
- Modify: `app/globals.css` (add the tint and text members)
- Modify: `components/v2/v2-turkey-regions.tsx`
- Create: `components/v2/region-identity.test.ts`

**Interfaces:**

- Consumes: `deltaE00`, `CATEGORICAL_MIN` from `lib/theme/delta-e.ts`; `simulate`, `VISIONS` from `lib/theme/cvd.ts`; `REGION_TINTS` from `lib/theme/region-palette.test.ts` (all PR0).
- Produces: `--region-*-tint` and `--region-*-text` in `app/globals.css`, seven of each, consumed by T-031d.

- [ ] **Step 1: Write the failing test**

Create `components/v2/region-identity.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { REGION_TINTS } from "@/lib/theme/region-palette.test";

const SLUGS = Object.keys(REGION_TINTS);
const page = readFileSync("app/[locale]/(site)/turkiye/bolge/[slug]/page.tsx", "utf8");

describe("a region wears one colour, not two", () => {
  it.each(SLUGS)("%s does not paint its badge with a raw palette hue", (slug) => {
    // Each descriptor block ends at the next `mapFill`. Read the block that owns this slug.
    const block = page.split(/mapFill:/)[SLUGS.indexOf(slug)] ?? "";
    expect(block).not.toMatch(
      /\b(?:text|bg|border|from|to|via)-(?:amber|teal|emerald|yellow|cyan|stone|orange|rose|sky|blue)-\d{2,3}\b/,
    );
  });

  it.each(SLUGS)("%s draws its badge from its own region token", (slug) => {
    expect(page).toContain(`--region-${slug}-tint`);
    expect(page).toContain(`--region-${slug}-text`);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run components/v2/region-identity.test.ts`

Expected: FAIL — all 14 cases. Marmara's block matches `bg-amber-500/15`, and no
`--region-marmara-tint` exists.

- [ ] **Step 3: Add the two derived members per region**

In `app/globals.css`, beside the seven `--region-*` hues, add a tint and a text member for
each, and **record the measured figures in a comment the way every other token block here
does**. Each `-text` member must clear 4.5:1 on `--card` in both themes; produce every number
with `lib/theme/contrast.ts` and `blendOver` — a tinted chip's real contrast is against the
blend, not against the token.

- [ ] **Step 4: Rewrite the descriptor table**

Replace `badgeClass`, `accentColor`, `gradient` and `borderAccent` for all seven regions so
each is expressed through that region's own token. Marmara's badge becomes blue because
Marmara **is** blue on the map; that is the fix, not a side effect.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run components/v2/region-identity.test.ts components/ui/raw-palette-count.test.ts`

Expected: both PASS. Step `RAW_PALETTE_BUDGET` down by what this task actually removed — read
the number from the failure message, do not estimate it.

- [ ] **Step 6: Verify the set is still CVD-safe after the derived members land**

The seven hues do not move in this task, so `lib/theme/region-palette.test.ts` must still be
green and its four worst-case figures unchanged. If any moved, a hue was edited — revert it.

- [ ] **Step 7: Visual round and commit**

Screenshot `/tr/turkiye/bolge/marmara` and two more regions at 320, 360, 390 and desktop in
both themes, then:

```bash
pnpm sweep:overflow -- --filter=/tr/turkiye/bolge/marmara
git add -A
git commit -m "fix(regions): a region's badge is the colour its map paints it

Six of seven regions wore a badge hue unrelated to their map fill —
Marmara badged amber and painted blue, Ege teal and painted orange. The
page was contradicting itself. Badge, accent, gradient and border now all
derive from the region's own token."
```

---

### Tasks 4-N: Apply the inventory, file by file

Work the 38 files heaviest-first, in the order of the table in "The measurements this plan is
built on". Group them into commits of one file each for the ten heaviest, and into thematic
batches for the long tail.

Every one of these tasks has the same five steps. What changes is the file and its verdict
rows from Task 1's inventory.

- [ ] **Step 1** — Re-read that file's section of `docs/superpowers/t031c-palette-inventory.md`. The inventory is the decision; this step is not where classification happens.
- [ ] **Step 2** — Apply the rows. `semantic` binds to its bridge token and its hand-written `dark:` pair is deleted in the same edit. `decoration` is removed. `data` binds to its data token set, never to a bridge token.
- [ ] **Step 3** — `pnpm typecheck && pnpm lint && pnpm vitest run` and step `RAW_PALETTE_BUDGET` by the exact number removed.
- [ ] **Step 4** — For any file with a visible surface: `pnpm sweep:overflow -- --filter=<its route>` and screenshots at the four widths in both themes. Measure the changed text against its surface with `lib/theme/contrast.ts` and record the worst figure in the commit body.
- [ ] **Step 5** — Commit, naming the file and the count removed.

Files needing particular care, with the reason:

- **`v2-turkey-map-explorer.tsx` (38)** and **`v2-world-map-explorer.tsx` (11)** — mostly `data`. The province and country fills belong to map token sets, and T-031d is about to redesign the dark map surface. Bind them; do not invent new hues here.
- **`v2-game-screen.tsx` (24)** — the land/sea fills measure **1.17:1** against each other in dark, against a 3:1 floor. They are `data` (game state, `--game-*`), and the dark fix belongs to T-031d. Bind the chrome in this branch and leave a note in the inventory row saying the dark land/sea separation is T-031d's.
- **`v2-earthquake-explorer.tsx` (19)** — carries a traffic-light magnitude scale that must become the `--eq-mag-1..5` purple ramp. That ramp already exists and is already the owner's decision; this is a binding, not a redesign. Public-safety scale: do not restyle it to Terra.
- **`v2-sea-basin-detail-view.tsx` (12)** — the sixth frozen colour from T-044(3). Seven raw classes, **six without a `dark:` pair** (lines 147, 281, 359, 394, 410, 419).
- **`v2-marine-map-explorer.tsx` (30)** and **`v2-marine-basin-cards.tsx` (9)** — SST and similar geophysical ramps stay standard.
- **`v2-header.tsx` (9)** — every page. Screenshot `/tr` and one deep route.

---

### Task N+1: Close the counter and correct the record

**Files:**

- Modify: `components/ui/raw-palette-count.test.ts`
- Modify: `components/ui/token-binding.test.ts`
- Modify: `docs/design.md`

- [ ] **Step 1: Take the budget to zero**

`RAW_PALETTE_BUDGET = 0`, and change the assertion from `toBeLessThanOrEqual` to `toBe(0)` —
a budget of zero checked with `<=` passes on a negative count and reads as a floor when it is
now a fact.

If any occurrence genuinely must survive, it is an **exemption listed by file and line with
its reason**, and a further assertion fails if an exemption goes stale. `token-binding.test.ts`
already carries exactly that pattern for its two achromatic exemptions — follow it.

- [ ] **Step 2: Fold the count into the existing rule**

`token-binding.test.ts`'s docblock says _"Raw palette classes (749) and hand-written `dark:`
pairs are counted in a comment"_. Replace that sentence with a pointer to the counter, so
there is one place the number lives and it is executable.

- [ ] **Step 3: Correct `docs/design.md`**

The dark-mode section says _"Not yet themed, and known: the categorical accent system (T-031c)
and map surfaces (T-031d). Measured 2026-09-17: 895 raw palette classes across 42 files."_
Replace with the finished state, leaving T-031d named as still open.

- [ ] **Step 4: Full verification**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
pnpm sweep:overflow
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test(ui): the raw palette count is zero and held

825 occurrences across 38 files, each classified before it was touched."
```

---

## Branch close

- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` green.
- [ ] `pnpm sweep:overflow` green across all 22 URLs, five widths, both themes.
- [ ] `lib/theme/region-palette.test.ts` still green with its four worst-case figures unchanged.
- [ ] Every region's badge, accent, gradient and border derive from that region's own token; screenshots of three regions in both themes in the PR body.
- [ ] The inventory in `docs/superpowers/t031c-palette-inventory.md` matches what shipped — no row applied differently from its verdict without the row being edited and the change explained.
- [ ] Open the PR to `dev` (squash), titled `T-031c: bind or delete every raw palette class`.

## After this branch: T-031d

T-031d's plan is written **after this branch merges**, not now. Its task list depends on
facts this branch produces: which region members exist, which map fills ended up bound to
which token set, and what the inventory decided about the game screen's land and sea. Writing
it today would mean guessing at all three.

What is already fixed for it: the dark seven-tint set must hold **ΔE00 ≥ 10 across all 21
pairs under normal vision and all three simulations** — the floor PR0 measured on the light
set — and the game screen's land/sea separation must clear 3:1, against today's measured
**1.17:1**.
