import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Every `*.module.css` reachable from the product tree, found by walking rather than listed. */
function findModules(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : findModules(path);
    return entry.name.endsWith(".module.css") ? [path] : [];
  });
}

export const SURVIVING_MODULES: readonly string[] = [
  ...findModules("components"),
  ...findModules("app"),
].sort();

/**
 * Steps down as T-033 converts each module. The count is the POSITIVE CONTROL: without it, a
 * walk that found nothing would satisfy the raw-token assertion perfectly.
 */
const EXPECTED_MODULE_COUNT = 2;

/**
 * Raw Terra tokens are frozen at their light values — `.dark` redefines not one of the 13
 * these files use. Measured 2026-09-19 on /tr/turkiye/istanbul in dark: 111 of 181 text
 * elements carrying a module class fell below 3:1, worst 1.14:1 (`--color-ink` #2b2622 on
 * `--card` #121e21). Every read below is one of those failures waiting to render.
 *
 * 179 when pinned; 147 once T-033 deleted `marine.module.css`'s 42 classes with no call
 * site, which took 32 of those reads with them without moving a pixel; 128 once the file's
 * four consumers moved to bridge tokens and the file itself was deleted, taking the last 19;
 * 104 once `air-pollution.module.css` went the same way, taking 24 — the file that owned the
 * 1.14:1 reading named above, which was its own `.value`, the headline annual-mean figure;
 * 82 once `climate.module.css` followed it, taking 22. That file had no dead class to delete
 * first: all 22 reads were live, on the ERA5-Land table, the chart's axis ink and the three
 * attribution blocks, and every one of them rendered inside `.climate-dark-scope`.
 *
 * 62 once `site-search.module.css` went the same way, taking 20. Its readings were the second
 * worst of the eight — a `#fff` panel with `--color-ink` text (1.14:1 on dark `--card`),
 * `--color-primary-dark` result links (2.04:1), and a `--color-accent` focus ring that this
 * conversion's own move to `bg-card` would have left at 2.78:1, below WCAG 1.4.11's 3:1 floor for
 * the one reader who cannot do without a ring.
 *
 * NOT "the most-seen of the eight", which is what the plan said and what an earlier version of
 * this docblock repeated. Measured: all 20 reads lived in `search-combobox.tsx`'s `variant
 * !== "v2"` branch, and the tree's only mount passes `variant="v2"`, so the stylesheet was
 * REACHABLE — which is all `orphan-stylesheets.test.ts` asks — and rendered by no route. The
 * header search a reader actually meets is the v2 command dialog, which was already Tailwind.
 * T-054 owns what to do with the unrendered branch; this task converted it rather than deleting
 * it, because deleting it changes the `variant` contract.
 *
 * 57 once `earthquake.module.css` lost the three classes with no call site — `.sources`,
 * `.regulationReference` and `.disclaimer`, the rules `earthquake-attribution.tsx` abandoned
 * when it moved to bridge tokens and recorded in its own docblock as a debt left unpaid. They
 * took FIVE reads with them, not three: `.sources p` and `.regulationReference` each read
 * `--color-slate`, and `.disclaimer` alone read three (`--color-accent`, `--color-surface`,
 * `--color-ink`). The IMPORTER-SCOPED, test-excluding loop printed exactly those three names.
 *
 * 46 once the file itself went, taking the remaining 11. Its readings were not the worst of the
 * eight but they were the most repeated: `--color-ink` (1.14:1 on dark `--card`) on every place
 * name and every header cell, `--color-slate` (2.15:1) on the caption, the binding sentence, the
 * empty state and the magnitude-floor note, and a `--color-accent` focus ring at 2.78:1 — under
 * WCAG 1.4.11's 3:1 floor for the one reader who cannot do without it. The `--color-surface`
 * header band was the "light card on a dark page" shape again in miniature: #f1e9de at 14.15:1
 * against the card it sat on.
 *
 * 27 once `book-video.module.css` went, taking 19 — the module with the MOST consumers of the
 * eight (five) and no dead class among its 23. Its readings were the "light box on a night
 * page" shape at full size rather than in miniature: a literal `#fff` timeline card at
 * **18.65:1** against dark `--background`, a `--color-surface` cover box at **15.50:1** and a
 * `--color-border` hairline at **12.85:1** around it, with the ink on top frozen the other way
 * — `--color-primary-dark` on the stage caption at **2.23:1** and `--color-slate` on the künye
 * strip, the resume line, the tick times and all thirty index rows at **2.36:1**. Four of the
 * five consumers render for any visitor on
 * `/kitaplar/ayt-cografya-konu-ozetli-brans-denemeleri`; `video-progress-controls.tsx` and the
 * player branch of `deneme-video.tsx` need an authenticated session, so they were measured with
 * one rather than left unmeasured.
 *
 * What did NOT move is `magnitude-badge.tsx`'s `--eq-mag-1`…`-5` ramp. It is a data token set
 * encoding a public-safety scale, so it is absent from the bridge mapping by design — and it is
 * measured rather than assumed: **3.63 / 2.65 / 1.89 / 1.29 / 1.01:1** on dark `--card`, four of
 * five under 3:1. That is T-031d's to re-derive with the other dark data surfaces; the reading is
 * recorded in the badge's own docblock rather than left silent.
 */
const TOTAL_RAW_READS = 27;

describe("CSS modules cannot read a colour that dark mode never redefines", () => {
  it("found the modules it claims to check", () => {
    expect(SURVIVING_MODULES).toHaveLength(EXPECTED_MODULE_COUNT);
  });

  it("reads exactly the recorded number of raw Terra tokens", () => {
    const total = SURVIVING_MODULES.reduce(
      (sum, path) => sum + (readFileSync(path, "utf8").match(/var\(--color-/g) ?? []).length,
      0,
    );
    expect(total).toBe(TOTAL_RAW_READS);
  });

  it.each(SURVIVING_MODULES)("%s reads no raw Terra token", (path) => {
    const reads = readFileSync(path, "utf8").match(/var\(--color-[a-z0-9-]+/g) ?? [];
    expect(reads, `${path} reads ${reads.length}: ${[...new Set(reads)].join(", ")}`).toEqual([]);
  });
});
