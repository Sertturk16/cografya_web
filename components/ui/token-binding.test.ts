import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { stripComments } from "@/lib/test-support/strip-comments";

/**
 * `../showcase/specimens` is scanned for the same reason the other two are. It was left out
 * originally as "just demo code", and a `text-white` promptly landed there — reproducing, in
 * the one place meant to demonstrate correct usage, the exact defect `button.tsx` had.
 */
const DIRS = ["../ui", "../patterns", "../showcase/specimens"] as const;

/**
 * Comments and docblocks are stripped before scanning.
 *
 * Not a convenience: the comment on `components/ui/alert.tsx` explains the defect by quoting
 * `dark:text-[var(--color-success,#496f35)]`, and a scanner that could not tell prose from
 * code would flag the very explanation of why the code is now correct. The same trap caught
 * `lib/theme/bridge-tokens.test.ts`, whose parser found `@theme inline` inside a comment
 * before finding the real block.
 */
const FILES = DIRS.flatMap((rel) => {
  const dir = fileURLToPath(new URL(rel, import.meta.url));
  return readdirSync(dir)
    .filter((f) => f.endsWith(".tsx") && !f.includes(".test."))
    .map((f) => [join(rel, f), stripComments(readFileSync(join(dir, f), "utf8"))] as const);
});

const RAW_PALETTE =
  /\b(bg|text|border|ring|fill|stroke|from|to|via)-(slate|gray|zinc|neutral|stone|amber|emerald|sky|teal|rose|red|green|blue|orange|yellow|indigo|violet|purple|pink|cyan|lime)-\d{2,3}\b/;

/**
 * `white` and `black` take no numeric suffix, so `RAW_PALETTE` never matched them — and they
 * are the two most tempting literals of the lot. `button.tsx` carried `text-white` on the
 * destructive variant from the day it was written; it read correctly in light mode and
 * measured 2.89:1 once `.dark` lifted the fill. Nothing failed, because nothing was looking.
 *
 * Two scrims are exempt, listed by file and exact utility like the `dark:` exemptions below:
 * a modal scrim is not a themed surface. It is the same black veil over whatever the page is
 * showing in both themes, and a token that resolved lighter in dark mode would make the
 * dialog behind it harder to separate, not easier.
 */
const RAW_ACHROMATIC = /\b(bg|text|border|ring|fill|stroke|from|to|via)-(white|black)\b/;

const ACHROMATIC_EXEMPTIONS: ReadonlyArray<readonly [string, string, string]> = [
  ["dialog.tsx", "bg-black/50", "The modal scrim. Identical in both themes by design."],
  ["sheet.tsx", "bg-black/50", "The modal scrim. Identical in both themes by design."],
  // A third row covered `switch.tsx`'s `bg-white` thumb. T-036 deleted that primitive — the
  // two places in the product that want a toggle want switch SEMANTICS, not a rail and a
  // thumb, and both already write `role="switch"` by hand — so the exemption went with the
  // file it exempted rather than outliving it.
];

const BRAND_HEX = /#(b0522e|7e3a1e|4f6d30|276b70|496f35|c9860f|b23b2e|ede3d5|2b2622|211c19)/i;

/**
 * ANY read of a raw Terra token, with or without a hex fallback — and the fallback is the part
 * that never mattered.
 *
 * This used to be `/var\(--color-[a-z-]+,\s*#[0-9a-fA-F]{3,8}\)/`, i.e. it required the comma
 * and the hex. The defect is not the fallback: it is reading a `--color-*` token at all, because
 * `.dark` redefines not one of them. `text-[var(--color-ink)] bg-[var(--color-surface)]` — the
 * exact 1.14:1 pair T-033 spent eight tasks deleting — planted into a scanned component left the
 * whole suite green, 229 files and 5,170 tests, because the narrow pattern walked straight past a
 * bare `var()`. T-033 also made that spelling IDIOMATIC: `bg-[var(--region-marmara)]/15` ships on
 * the province page, so a frozen token coming back would not even look like an escape.
 *
 * The widening is bounded, and was measured before it was written: over the 153 files these two
 * `describe`s scan, comment-stripped, it finds **zero** hits in code. The 26 occurrences in the
 * tree are 10 inside docblocks (which `stripComments` removes — `alert.tsx` quotes an escape to
 * explain it) and 16 in the four `MAP_SURFACE_FILES` already exempt below. **No exemption row was
 * added to land this**, which is the same standard `V2_DIRS` was grown to across eight
 * directories.
 */
const RAW_TOKEN_READ = /var\(\s*--color-[a-z0-9-]+/;

/**
 * Colour in a component comes from a bridge token. Three things are forbidden, and each has
 * already cost this repo something (T-034 spec §3):
 *
 *   - reading a `--color-*` Terra token AT ALL — `var(--color-x)`, with or without a `#hex`
 *     fallback — freezes the component at that token's light value, because `.dark` redefines
 *     none of them. There were 44 of the fallback form across six files, which is why no dark
 *     palette could have reached Badge, Alert, Button, Tabs, Dialog or Sheet; the bare form is
 *     what T-033 spec §6 asked this file to hold once the CSS Modules were gone.
 *   - raw Tailwind palette classes are off-brand and theme-blind.
 *   - hand-written `dark:` classes mean the component is bound to the wrong token.
 *     `docs/design.md` says so outright: override tokens in `.dark`, do not sprinkle `dark:`
 *     per component. Alert carried four such pairs that resolved to the same colour as their
 *     light counterparts and had never done anything at all.
 */
describe("components bind colour through the token bridge", () => {
  it("positive control — files were actually read and comments actually stripped", () => {
    expect(FILES.length).toBeGreaterThan(20);
    expect(FILES.some(([path]) => path.endsWith("button.tsx"))).toBe(true);
    const alert = FILES.find(([path]) => path.endsWith("alert.tsx"));
    expect(alert?.[1]).toContain("alertVariants");
    // The docblock quoting an escape is gone, so the scan below is meaningful.
    expect(alert?.[1]).not.toContain("never did anything");
  });

  it.each(FILES)("%s reads no raw Terra token", (_path, source) => {
    expect(source).not.toMatch(RAW_TOKEN_READ);
  });

  it("the raw-token pattern fires on source that does read one — positive control", () => {
    // This surface has no exempt file to keep the pattern honest, unlike the V2 one below, and
    // an absence-only rule with a broken pattern is green and worthless. Both spellings, because
    // the narrow predecessor matched only the second.
    expect("text-[var(--color-ink)]").toMatch(RAW_TOKEN_READ);
    expect("bg-[var(--color-surface,#f1e9de)]").toMatch(RAW_TOKEN_READ);
  });

  it.each(FILES)("%s has no raw Tailwind palette class", (_path, source) => {
    expect(source).not.toMatch(RAW_PALETTE);
  });

  it.each(FILES)("%s has no brand hex literal", (_path, source) => {
    expect(source).not.toMatch(BRAND_HEX);
  });

  it.each(FILES)("%s uses no bare white/black utility", (path, source) => {
    let scanned = source;
    for (const [file, utility] of ACHROMATIC_EXEMPTIONS) {
      if (path.endsWith(file)) scanned = scanned.split(utility).join(" ");
    }
    expect(scanned).not.toMatch(RAW_ACHROMATIC);
  });

  it("every achromatic exemption is still present", () => {
    // A stale exemption hides a real regression just as effectively as a missing rule.
    for (const [file, utility] of ACHROMATIC_EXEMPTIONS) {
      const entry = FILES.find(([p]) => p.endsWith(file));
      expect(entry, `${file} is no longer scanned`).toBeDefined();
      expect(entry?.[1], `${file} no longer contains ${utility}; drop the exemption`).toContain(
        utility,
      );
    }
  });

  /**
   * The `dark:` rule now runs with NO exemptions at all, which is the strongest form it has
   * had — and it got there by deletion, not by loosening.
   *
   * Two utilities used to be exempt, each because it expressed something a colour token
   * cannot: `avatar.tsx`'s `dark:after:mix-blend-lighten` (a blend MODE — no custom property
   * carries `mix-blend-mode`) and `dropdown-menu.tsx`'s
   * `dark:data-[variant=destructive]:focus:bg-destructive/20` (an ALPHA — the same token at
   * 10% on light and 20% on dark). T-036 deleted both primitives for having no product call
   * site, so both exemptions went with the files they exempted.
   *
   * A third was never exempted: `custom-select.tsx` had `bg-white dark:bg-card`, which is a
   * hard-coded colour with a theme patch bolted on. It now reads `bg-popover`, which is what
   * the bridge has a token for.
   *
   * If a real blend-mode or alpha case comes back, restore the list-by-file-and-exact-utility
   * shape above — an exemption nobody wrote down is how a tripwire quietly stops tripping.
   */
  it.each(FILES)("%s writes no hand-rolled dark: class", (_path, source) => {
    // `components/showcase/theme-pair.tsx` carries the bare class names `dark` and `light`
    // on a wrapper, which is a different thing from a `dark:` variant and passes this.
    expect(source).not.toMatch(/\bdark:/);
  });

  it("the dark: pattern fires on source that does carry one — positive control", () => {
    // With no exemption rows left there is nothing else proving the regex still works; an
    // absence-only rule with a broken pattern is green and worthless.
    expect("dark:bg-card").toMatch(/\bdark:/);
  });
});

/**
 * The same escape rule, extended to the V2 surface.
 *
 * Phase A2 fixed 44 escapes in `components/ui` and scoped its audit there. That scoping was
 * a gap: `components/v2` and the V2 pages carried 103 more of the same defect, so the
 * night-sea palette reached the primitives but not most of the pages built on them. 87 were
 * swept in phase D; the rest are exempt below.
 *
 * ONLY the escape rule is checked here. Raw palette classes (749) and hand-written `dark:`
 * (203) across this surface are the categorical accent system, which the T-034 spec scoped
 * out explicitly and T-031c owns. Asserting them now would fail on work nobody has started.
 */
describe("the V2 surface binds chrome colour through the bridge too", () => {
  /**
   * GROWS ONE DIRECTORY PER T-033 TASK, AND DELIBERATELY NOT FASTER.
   *
   * `components/marine` is here because T-033 task 2 converted it, `components/air` because
   * task 3 converted it, `components/climate` because task 4 did, `components/site-search`
   * because task 5 did and `components/earthquake` because task 6 did. The rule that put them
   * here:
   * **the task that retires a module adds that module's directory to this list, in the same
   * commit as the conversion.** Nothing would otherwise have caught a raw `var(--color-*)` read
   * in the four files that conversion rewrote — the constraint was complied with by
   * hand and enforced by nothing, which is the shape every defect in this file's docblocks
   * started as.
   *
   * What this buys is the ESCAPE rule and only the escape rule, because that is all this
   * `describe` checks — see its own docblock: raw palette classes and hand-written `dark:`
   * are the categorical accent system across this whole surface and T-031c owns them, so
   * asserting them here for one directory would both contradict that scoping and collide
   * with the branch doing the sweep. Measured on the converted files anyway, and recorded
   * rather than asserted: `components/marine/*.tsx` carries no `dark:`, no raw palette class,
   * no bare `white`/`black` utility and no brand hex either. When T-031c lands, the stricter
   * rules arrive for this directory with everything else.
   *
   * `components/climate` carries the SECOND deliberate bare `white`, for the same measured
   * reason and on the same ruling: `climate-chart.tsx`'s plot frame is `bg-white` because
   * `--chart-precip-bar` measures 6.88:1 on it and **2.47:1 on `--card`**, and
   * `--chart-temp-line` 5.18:1 against 3.29:1. It differs from the air chart in one way that is
   * worth writing down here rather than only in the component: its scaffolding is drawn from
   * `--color-ink-dark`, not `--color-ink`, because the province page renders this chart inside
   * `.climate-dark-scope`, where `--color-ink` is shadowed to `--color-bg` and `fill-ink/80`
   * would measure 1.05:1 on the plot's own white ground. `--color-ink-dark` is frozen and
   * unshadowed. It carries no `dark:`, no raw palette class and no brand hex.
   *
   * `components/air` carries one DELIBERATE bare `white` utility, and it is not an oversight:
   * `pm25-chart.tsx` paints the plot `bg-white` because `--chart-pm25-line`, the section's one
   * data token, measures 9.86:1 on that plot and 1.73:1 on `--card`, and no dark-adapted PM2.5
   * token exists. That file's own docblock and `air-pollution.structure.test.ts` carry the
   * measurement and assert the shape; it is a data surface, not chrome, so it is outside what
   * this `describe` is about. It carries no `dark:`, no raw palette class and no brand hex.
   *
   * It is NOT the first bare `white` on the walked surface — an earlier draft of this note said
   * so and that was wrong. `components/v2` has been in this list from the start and carries 88
   * such utilities across 12 files, almost all of them `text-white` on a gradient plate or a
   * translucent `bg-white/NN` scrim. What IS singular, and the reason the claim was tempting, is
   * the OPAQUE form: `grep -rnP "\bbg-white\b(?!/)"` over every directory this list walks
   * returns exactly one hit, the chart frame above. A translucent white over a themed gradient
   * still follows the theme underneath it; an opaque white surface does not, which is why this
   * one owes a measurement and the other 88 belong to T-031c with the rest of the palette.
   *
   * `components/site-search` is the one directory here with NO exception to record: the header
   * combobox carries no `dark:`, no raw palette class, no brand hex and no bare `white`/`black`
   * utility, because it has no data surface to protect — every colour in it is chrome and every
   * one of them is a bridge token. Its focus ring is `outline-ring`, measured at 5.44:1 dark and
   * 6.13:1 light on `--card`; the `--color-accent` it replaced was 2.78:1 on the dark half.
   *
   * `components/earthquake` carries the THIRD deliberate bare `white`, and it is the opaque form
   * again rather than a scrim: `magnitude-badge.tsx` prints its label `text-white` because the
   * label sits on the `--eq-mag-1`…`-5` fill, a data ramp encoding a public-safety scale that no
   * theme redefines. Measured — #fff on the five fills: **4.69 / 6.43 / 9.01 / 13.15 / 17.21:1**,
   * clearing 4.5:1 on every step. A bridge token would track the page instead of the ground the
   * label is actually on, and it fails in BOTH themes: `--foreground`'s light value #2b2622
   * measures 3.19 / 2.33 / 1.66 / **1.14** / 1.15:1 — worst at `--eq-mag-4`, not `--eq-mag-5`,
   * because the ramp's darkest step is a shade off pure black and the ink is not — and its dark
   * value #e8f0f1 measures 4.06 / 5.56 / 7.80 / 11.38 / 14.89:1, below white's throughout and
   * under 4.5:1 on `--eq-mag-1`.
   *
   * The ramp ITSELF fails on the dark half and is recorded rather than quietly tolerated:
   * **3.63 / 2.65 / 1.89 / 1.29 / 1.01:1** against dark `--card` (#121e21), the panel these
   * badges render on. Four of five are under WCAG 1.4.11's 3:1. It is not repaired here for the
   * same reason the map tints above are not — a ramp is an ordered scale, not five independent
   * colours — and it belongs to T-031d with them. Everything else in the directory is a bridge
   * token: no `dark:`, no raw palette class, no brand hex, and the focus ring on the event
   * table is `outline-ring` (5.44:1 dark / 6.13:1 light on `--card`) where the stylesheet had
   * `--color-accent` at 2.78:1.
   *
   * `components/book` is here because T-033 task 7 converted `book-video.module.css`, the
   * module with the most consumers of the eight (five). It carries NO exception at all: no
   * escape, no `dark:`, no raw palette class, no bare `white`/`black` utility and no brand hex
   * in code. The one place a bare `white` would have been tempting is the timeline card, which
   * the stylesheet painted `#fff` outright — it is `bg-card` now, because unlike the two chart
   * plates above it carries no data token that needs a fixed ground.
   *
   * `app/[locale]` has been in this list from the start, which is why T-033 task 8 —
   * `book-detail.module.css`, whose one consumer is `app/[locale]/(site)/kitaplar/[slug]/page.tsx`
   * — added no entry here. The rule still held: the task's job was to check that the directory it
   * converted was already scanned, and it was, so the fourteen converted class constants were
   * under the escape rule the moment they were written rather than one commit later. That page
   * carries no escape, no `dark:`, no raw palette class, no brand hex and no bare `white`/`black`
   * utility; where the stylesheet painted `#fff` on 210 tiles it is `bg-card` now, for the same
   * reason the timeline card is — there is no data token on it that needs a fixed ground.
   *
   * `components/map` is here because T-033 task 9 converted `locator-map.module.css`, the LAST
   * of the eight. It is the one directory added to this list whose component deliberately keeps
   * a FROZEN colour, and it is here rather than in `MAP_SURFACE_FILES` because the freeze needs
   * no escape: the overlay reads `fill-primary-dark` / `stroke-primary-dark`, utilities the
   * `@theme inline` block exports, so there is no `var(--color-*)` read in its code for this
   * `describe` to find — measured under the widened pattern, not only the hex-fallback one. The reason for the freeze is the same one the exempt files carry — the base map is an
   * isolated `<img>` document whose land and sea are literal hex that no theme redefines, so the
   * ink on top of it is measured against a fixed backdrop: **8.36:1** on that white land and
   * **6.61:1** on that sea, against a lifted primary's **2.08** and **1.64** there in dark. The
   * page chrome around the artifact is bridged normally (`border-border`,
   * `text-muted-foreground`), and `components/map/locator-map-floors.test.ts` asserts the split
   * in both directions. Dark maps, artifact included, remain T-031d's.
   *
   * THE LIST IS NOW COMPLETE for T-033: all eight converted directories are scanned, and no
   * exemption row was ever needed. The tempting move was to widen this to every feature
   * directory at once. Do NOT, for whatever comes next either: a blanket widening reds
   * immediately and the only way back to green is an exemption list — a list that then has to be
   * pruned once per task, each time by someone who could silently prune one row too many.
   * Growing the scan in step with the conversion needs no bookkeeping and cannot go stale: a
   * directory is either converted and scanned, or neither.
   */
  const V2_DIRS = [
    fileURLToPath(new URL("../v2", import.meta.url)),
    fileURLToPath(new URL("../marine", import.meta.url)),
    fileURLToPath(new URL("../air", import.meta.url)),
    fileURLToPath(new URL("../climate", import.meta.url)),
    fileURLToPath(new URL("../site-search", import.meta.url)),
    fileURLToPath(new URL("../earthquake", import.meta.url)),
    fileURLToPath(new URL("../book", import.meta.url)),
    fileURLToPath(new URL("../map", import.meta.url)),
    fileURLToPath(new URL("../../app/[locale]", import.meta.url)),
  ];

  function walk(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return walk(full);
      return entry.name.endsWith(".tsx") && !entry.name.includes(".test.") ? [full] : [];
    });
  }

  /**
   * Map surfaces, and they stay escaped on purpose.
   *
   * All four read `--color-*` tokens directly in code (16 reads), and the staleness check below
   * holds them to it under the same widened pattern the rule uses, so an exemption cannot outlive
   * the thing it exempts.
   *
   * Every one is an SVG `fill` or `stroke` drawn onto a map, where the contrast was measured
   * against surfaces that do NOT follow the theme — white land and the seven Okabe-Ito region
   * tints. `--color-ink-dark` in particular is documented in `app/globals.css` as the single
   * neutral clearing WCAG 1.4.11's 3:1 floor over every one of those tints. Binding these to
   * a bridge token would move a line whose whole justification is a measurement against a
   * fixed backdrop. Dark maps are T-031d, and re-measuring that table is its first task.
   */
  const MAP_SURFACE_FILES = [
    "v2-continent-locator-map.tsx",
    "v2-region-locator-map.tsx",
    "v2-tool-workbench.tsx",
    join("bolge", "[slug]", "page.tsx"),
  ] as const;

  const FILES_V2 = V2_DIRS.flatMap(walk).filter(
    (path) => !MAP_SURFACE_FILES.some((exempt) => path.endsWith(exempt)),
  );

  it("positive control — the V2 surface was actually walked", () => {
    expect(FILES_V2.length).toBeGreaterThan(60);
  });

  it.each(FILES_V2.map((f) => [f.split("/").slice(-2).join("/"), f] as const))(
    "%s reads no raw Terra token",
    (_label, path) => {
      const source = stripComments(readFileSync(path, "utf8"));
      expect(source).not.toMatch(RAW_TOKEN_READ);
    },
  );

  it("every exempt file still contains what it is exempt for", () => {
    for (const exempt of MAP_SURFACE_FILES) {
      const match = V2_DIRS.flatMap(walk).find((p) => p.endsWith(exempt));
      expect(match, `${exempt} no longer exists; drop the exemption`).toBeDefined();
      expect(
        stripComments(readFileSync(match!, "utf8")),
        `${exempt} no longer reads a raw Terra token; drop the exemption`,
      ).toMatch(RAW_TOKEN_READ);
    }
  });
});
