import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { stripComments } from "@/lib/test-support/strip-comments";
import { tokensIn } from "@/lib/test-support/css-tokens";

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

/**
 * A `var(--token, #hex)` fallback still equals its token.
 *
 * ## The exposure this closes, and why it is not the escape rule above
 *
 * The rule above forbids `var(--color-*, #hex)` on the `ui`/`patterns`/`specimens` surface. It
 * is a NARROWER thing than it looks: it matches `--color-*` and nothing else. Ten live
 * occurrences in the product tree name `--map-sea`, so that rule never sees them — they were
 * described once as "already governed by token-binding", and they were governed by nothing.
 *
 * Nothing is miscoloured today: `--map-sea` is real (`app/globals.css`) and every fallback
 * equals it. The exposure is DRIFT — the stylesheet moving while a hex copied into a component
 * does not — and drift is silent by construction, because the fallback only paints where the
 * token is missing, which is the one case nobody looks at.
 *
 * This is the same defect as the seven `var(--region-*, #hex)` map fills, and it takes the same
 * fix: pin the fallback to the declaration, in both directions. Widening the escape rule instead
 * would need its own exemption list beside the one it already has, and double-governing a shape
 * under two rules with different exemptions is how an exemption goes stale unnoticed.
 *
 * COMMENTS ARE STRIPPED, which is load-bearing here for the same reason it is above:
 * `alert.tsx`'s docblock quotes `var(--color-success,#496f35)` while describing a class that no
 * longer exists. Pinning prose would force a historical note to be rewritten every time a token
 * moves.
 */
describe("every var() fallback in the product tree still equals its token", () => {
  const ROOTS = ["../../components", "../../app", "../../lib"] as const;

  function walkAll(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return entry.name === "node_modules" ? [] : walkAll(full);
      const source = entry.name.endsWith(".ts") || entry.name.endsWith(".tsx");
      return source && !entry.name.includes(".test.") ? [full] : [];
    });
  }

  /** Every `--token: #hex` declared with a LITERAL hex in app/globals.css. */
  const declared = new Map<string, string[]>();
  {
    const css = stripComments(
      readFileSync(fileURLToPath(new URL("../../app/globals.css", import.meta.url)), "utf8"),
    );
    for (const m of css.matchAll(/(--[a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
      declared.set(m[1]!, [...(declared.get(m[1]!) ?? []), m[2]!.toLowerCase()]);
    }
  }

  /** Every live `var(--token, #hex)` in the product tree, comments stripped. */
  const fallbacks = ROOTS.flatMap((rel) =>
    walkAll(fileURLToPath(new URL(rel, import.meta.url))).flatMap((path) => {
      const source = stripComments(readFileSync(path, "utf8"));
      return [...source.matchAll(/var\(\s*(--[a-z0-9-]+)\s*,\s*(#[0-9a-fA-F]{3,8})\s*\)/g)].map(
        (m) => ({ path, token: m[1]!, hex: m[2]!.toLowerCase() }),
      );
    }),
  );

  it("found the fallbacks and the declarations — positive control", () => {
    // Neither half may be empty: a pin over nothing is green and means nothing, which is the
    // hollow-pass shape this repo keeps paying for.
    // Was >20 with room to spare (35) while --map-sea's ten fallbacks were still live; T-031d
    // Task 3 deleted all ten (see "no fallback names a token .dark also declares" below for
    // why), which drops the true count to 25. Still clears this floor unchanged — recorded
    // here so the next removal knows what moved it and by how much, rather than just seeing a
    // smaller number and wondering if the walk broke.
    expect(fallbacks.length).toBeGreaterThan(20);
    expect(declared.size).toBeGreaterThan(20);
  });

  it.each([...new Set(fallbacks.map((f) => `${f.token} ${f.hex}`))])(
    "%s — the token is declared with exactly that value",
    (pair) => {
      const [token, hex] = pair.split(" ") as [string, string];
      const values = declared.get(token);
      expect(
        values,
        `${token} is not declared with a literal hex in app/globals.css`,
      ).toBeDefined();
      // Exactly one literal declaration, so "which one did it mean" can never be the answer.
      expect(values, `${token} is declared with a literal hex more than once`).toHaveLength(1);
      expect(
        values![0],
        `${token}'s fallback says ${hex}, app/globals.css says ${values![0]}`,
      ).toBe(hex);
    },
  );

  it("names every file carrying one, so a new one cannot arrive unnoticed", () => {
    // The other direction of the pin. Above asserts each fallback matches its token; this
    // asserts the POPULATION is the one that was reviewed, so a fallback added to a token that
    // happens to match today still has to be looked at.
    const byToken = new Map<string, number>();
    for (const f of fallbacks) byToken.set(f.token, (byToken.get(f.token) ?? 0) + 1);
    expect(Object.fromEntries([...byToken].sort())).toEqual({
      "--color-ink-dark": 7,
      "--color-primary": 4,
      "--color-primary-dark": 4,
      "--region-akdeniz": 1,
      "--region-dogu-anadolu": 1,
      "--region-ege": 1,
      "--region-guneydogu-anadolu": 1,
      "--region-ic-anadolu": 1,
      "--region-karadeniz": 1,
      "--region-marmara": 1,
      // The SST ramp's three. `lib/theme/sst-band.ts` paints the map's station pins through an
      // SVG `fill` ATTRIBUTE, which Tailwind never sees, so the band value has to be a raw CSS
      // value and carries a literal fallback — the same shape `--region-*`'s `fillValue` has.
      "--sst-band-cool": 1,
      "--sst-band-hot": 1,
      "--sst-band-warm": 1,
    });
  });

  /**
   * A THEMED TOKEN CANNOT CARRY ONE HONEST FALLBACK HEX, so a fallback naming one must not
   * exist at all — not "must still match", the check the two `it`s above already run.
   *
   * WHAT HAPPENED. `--map-sea` shipped ten `var(--map-sea, #dbe7e8)` fallbacks, one per literal
   * reference across six map components, every one copying its light-mode value. That was
   * silently fine for as long as `.dark` left `--map-sea` undeclared: `var()`'s second argument
   * only ever paints when the token is MISSING, and `--map-sea` was declared everywhere it was
   * read, so ten dead hexes sat there matching nothing and breaking nothing. T-031d Task 3 gave
   * every map surface a dark half, `.dark` now declares `--map-sea` too, and every one of those
   * ten fallbacks instantly became a light value hard-coded into a dark surface — wrong in
   * exactly the theme where `--map-sea` differs from it, which is the whole reason `.dark`
   * redefines it. The fix was not to weaken this file to tolerate the case (a token-shaped
   * exemption here would have to keep excusing every future themed token, which is the census
   * this repo has already refused once) but to delete the ten fallbacks outright: `--map-sea`
   * is unconditionally declared in both blocks, so `var(--map-sea)` alone paints correctly in
   * either theme and the fallback carried no signal beyond a light value already duplicated
   * wrongly.
   *
   * WHY THIS IS A STANDING GUARD, not a one-off cleanup. The trap is structural, not a stale
   * hex: a fallback naming a token `.dark` also declares is wrong in some theme by
   * CONSTRUCTION, because a fallback can only ever encode one colour and a themed token has
   * two. Keeping the literal in sync with `:root` (which the two `it`s above already enforce)
   * cannot fix it — it would still be silently wrong under `.dark`. So the only correct state
   * for a themed token's fallback is absent, and this checks for exactly that, generalised
   * over every token rather than named at `--map-sea` alone. It already covers two tokens
   * with no fallback today and no reason to ever grow one carelessly: `--map-land` and
   * `--map-context-land` — both real, `.dark`-declared T-031d tokens — so PR2's component
   * work trips this the moment it reaches for one instead of discovering the same defect a
   * second time by hand. (`--map-tectonic` briefly joined this list in review round 1 and
   * left again in round 2 — see `lib/theme/map-surface.test.ts`'s own docblock for why — so
   * it is not named here.)
   */
  describe("no fallback names a token .dark also declares", () => {
    const darkTokens = new Set(
      Object.keys(
        tokensIn(
          stripComments(
            readFileSync(fileURLToPath(new URL("../../app/globals.css", import.meta.url)), "utf8"),
          ),
          ".dark {",
        ),
      ),
    );

    it("positive control — the live population is real, and a known .dark token isn't hiding in it", () => {
      // Review round 1 found the first version of this control tautological: it filtered one
      // hardcoded literal against a set already known to contain it, so it exercised `Set.has`
      // rather than the fallback-parsing regex above and could not fail for the reason it
      // claimed to test. This version reads the two REAL parsed populations instead.
      //
      // The population side: the regex walk over components/app/lib actually found fallbacks,
      // or the negative assertion below is vacuous (true of an empty array for free).
      expect(fallbacks.length).toBeGreaterThan(0);
      // The negative-space side: --map-sea is a real, `.dark`-declared token (confirmed
      // against the real CSS parse, not asserted), and T-031d Task 3's fix means none of the
      // ten fallbacks that used to name it survive in the live tree. This is the fact the "no
      // live fallback" test below depends on to have found anything to prove; asserting it
      // here, from the same two real inputs, is what makes that test's own emptiness meaningful
      // rather than accidental.
      expect(darkTokens.has("--map-sea")).toBe(true);
      expect(fallbacks.some((f) => f.token === "--map-sea")).toBe(false);
    });

    it("no live fallback names a token .dark also declares", () => {
      const offenders = fallbacks.filter((f) => darkTokens.has(f.token));
      expect(
        offenders,
        offenders.length === 0
          ? ""
          : `these fallbacks name a token .dark redefines, so each is wrong in one theme — ` +
              `remove the fallback (var(--token) alone), do not retune the hex:\n` +
              offenders.map((f) => `  ${f.path}: var(${f.token}, ${f.hex})`).join("\n"),
      ).toEqual([]);
    });
  });
});

/**
 * A CLASS-SHAPED STRING IN A COMMENT IS STILL A CLASS, and an invalid one breaks every page.
 *
 * Tailwind v4 scans source TEXT for candidate class names. It does not parse the file, so it
 * cannot tell a rendered `className` from prose inside a `/* … *\/` block — which means a
 * comment that documents a family of tokens by wrapping the family name in a background
 * utility's bracket produces a real rule whose declaration reads that family name verbatim,
 * wildcard and all.
 *
 * A wildcard is not part of a custom property name, so PostCSS fails on the delimiter,
 * and the failure is not local: `app/globals.css` is imported by `app/[locale]/layout.tsx`, so
 * the whole stylesheet fails to compile and EVERY route returns 500.
 *
 * This is written down because it actually happened, in T-031c Task 6, in a doc comment in
 * `raw-palette-count.test.ts` describing the legend fix.
 *
 * WHAT WAS AND WAS NOT MISSING, stated precisely, because the first telling of this overstated
 * it. `pnpm typecheck`, `pnpm lint` and 5456 tests were all green while no page would load —
 * true, and none of those three compiles the stylesheet. But CI is not only those three:
 * `.github/workflows/ci.yml` has a `build` job running `pnpm build`, which DOES compile it and
 * WOULD have failed. So this was never "invisible to CI". What is missing is a **local and
 * pre-push** signal: `deploy.yml` runs only lint and test before handing off to the image
 * build, so the first report of the breakage would have come from a pipeline rather than from
 * the machine that wrote the comment.
 *
 * THIS GUARD IS AN INTERIM, AND FIX ROUND 1 IS THE THIRD PIECE OF EVIDENCE FOR THAT. It catches
 * ONE shape, and the shape has now been re-spelled past it twice in two tasks — once by dropping
 * the wildcard, once by dropping the utility name. Both were found by a person reading the
 * regex, not by the suite. **T-056 now carries this fourth spelling, the non-fatal negative
 * results below, and one operational note: the dev server does NOT recover from a CSS parse
 * failure on the next edit — it keeps serving 500 with a stale trace, which produced four false
 * positives before the port was freed and `.next` deleted.**
 *
 * **T-056** is the real fix — running
 * `app/globals.css` through the project's own PostCSS/Tailwind pipeline against the real source
 * set, in seconds, which catches the whole class of stylesheet-breaking source text rather than
 * this one spelling. **When T-056 lands, this block becomes redundant and should be deleted**
 * rather than left to accumulate shapes one incident at a time.
 *
 * **T-056 HAS LANDED: `components/ui/compiled-stylesheet.test.ts`.** It compiles this project's
 * real `app/globals.css` with `@tailwindcss/postcss`, whose `optimize` step hands the generated
 * CSS to Lightning CSS — the same engine Next's pipeline uses — and asserts it produces no
 * warnings. All four historical spellings are positive controls there, and the arm was verified
 * by planting the Task 6 shape in `i18n/routing.ts` (a real scanned file, outside this repo's
 * `components`/`app`/`lib`) and watching it redden. It catches the CLASS rather than the shape:
 * any source text that compiles to CSS Lightning cannot parse, in any syntax, present or future.
 *
 * **THIS BLOCK IS THEREFORE REDUNDANT AND CAN BE DELETED.** It is left standing here only
 * because deleting it was not in the closing task's scope, and because its four positive
 * controls are a cheap second reading of the same history. What it must NOT be given is a fifth
 * spelling: a new incident belongs in the compiled arm, not in this regex.
 *
 * ITS PREMISE IS ALSO NOW OUT OF DATE, in the safe direction. `app/globals.css` declares four
 * `@source not` lines since the T-031c close, so Tailwind no longer scans `docs/`, `scripts/`
 * or `*.test.ts(x)` at all — a class-shaped string in any of those cannot reach the compiler.
 * The walk below still covers them, so it over-reports rather than under-reports, which is the
 * right way round for a guard on its way out.
 *
 * IT HAPPENED AGAIN IN TASK 7, IN A DIFFERENT SPELLING, which is why the pattern below is no
 * longer keyed on the wildcard. That comment described the earthquake ripple's new binding and
 * wrote the utility out with an ellipsis where the token name goes. No `*` anywhere — and the
 * emitted declaration still read that ellipsis verbatim, PostCSS still failed on the delimiter,
 * and every route still 500'd with the whole suite green. The first version of this guard was
 * silent on it.
 *
 * The PATTERN is now the general form of both: a `var()` inside a bracketed arbitrary value
 * whose FIRST ARGUMENT is not a custom-property name. `--sst-band-*` is not one because of the
 * wildcard, `...` is not one because it is not a name at all, and anything else somebody
 * substitutes for the token in prose will not be one either. Legitimate spellings are
 * unaffected: `w-[calc(100%*2)]` has no `var()`, and every real binding in this repo names a
 * real token. A wildcard or a placeholder in prose is still fine as long as it is not wrapped
 * in the class shape — write `--sst-band-*` on its own, or describe the utility in words.
 *
 * The WALK is deliberately wide, and must stay that way. **It has to match Tailwind's own source
 * detection, not a hand-picked subset of it.** `app/globals.css` declares no `@source`, so
 * Tailwind auto-detects: it walks the whole project from the root, skips `node_modules` and
 * `.git`, and honours `.gitignore`. Anything narrower is a guard that is green because it did
 * not look. The first version of this block walked only `components`, `app` and `lib` — which
 * left `i18n/`, `proxy.ts`, `next.config.ts`, `vitest.config.ts`, `scripts/`, `docs/` and every
 * future top-level directory able to break the stylesheet without reddening anything. The walk
 * below therefore derives its exclusions from `git check-ignore` rather than from a list
 * somebody has to remember to update.
 */
describe("no source comment can compile into an invalid Tailwind utility", () => {
  const ROOT = fileURLToPath(new URL("../..", import.meta.url));

  /** The text extensions Tailwind will read a class candidate out of. */
  const SCANNABLE = /\.(?:[cm]?[jt]sx?|mdx?|html?|json)$/;

  /**
   * Only the two directories Tailwind itself never descends into. Everything else that should
   * be skipped is skipped because `.gitignore` says so, not because this list says so.
   */
  const NEVER_WALKED = new Set(["node_modules", ".git"]);

  function walkAll(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return NEVER_WALKED.has(entry.name) ? [] : walkAll(full);
      return SCANNABLE.test(entry.name) ? [full] : [];
    });
  }

  const candidates = walkAll(ROOT).map((f) => relative(ROOT, f));
  /**
   * `git check-ignore` IS the rule Tailwind applies, so it is the rule used here. It exits 1
   * when nothing in its input is ignored, which is a normal outcome and not an error.
   */
  const ignored = new Set(
    (() => {
      try {
        return execFileSync("git", ["check-ignore", "--stdin"], {
          cwd: ROOT,
          input: candidates.join("\n"),
          encoding: "utf8",
        }).split("\n");
      } catch {
        return [];
      }
    })().filter(Boolean),
  );
  const files = candidates.filter((f) => !ignored.has(f)).map((f) => join(ROOT, f));
  /**
   * ANY bracket whose `var()` names something that is not a custom property.
   *
   * The negative lookahead is the whole rule: a real binding is `var(--token)` or
   * `var(--token, fallback)`, so anything that does not open with `--name` followed by `,` or
   * `)` is prose that has been dressed as markup. Keyed on that rather than on the `*` the
   * first incident happened to contain, because the second incident contained no `*`.
   *
   * ANCHORED ON `[`, NOT ON `-[`, AND THAT WAS A REAL HOLE. Tailwind v4 also has an
   * arbitrary-PROPERTY syntax with no utility name in front of the bracket at all. A comment
   * spelling one of those around a bad `var()` took `/`, `/deprem` and `/deprem/fay-hatlari` to
   * 500 with the identical `Parsing CSS source code failed … Unexpected token` while this file
   * passed 313 of 313 — build-verified in fix round 1, planted in `i18n/routing.ts` against a
   * fresh `.next`. The Task 6 wildcard shape is missed the same way when it is written in that
   * syntax. One character of anchor was the whole difference.
   *
   * WHAT DOES **NOT** BREAK THE BUILD, recorded because it is what shows the premise is sound
   * and only the anchor was narrow. All of these emit an odd declaration and the stylesheet
   * still compiles, because CSS error recovery drops an unparseable declaration VALUE, whereas
   * a malformed first argument to `var()` is fatal to the parse:
   *
   *   a bracketed stroke utility around a bad value, a bracketed hex, a bracketed oklch,
   *   and a bracket naming a token without the `var()`
   *
   * and these emit nothing at all: a parenthesised shorthand token reference, and a bracketed
   * `var()` that DOES name a real token with a fallback. So this guard is narrow on purpose —
   * it names the one shape that is fatal rather than every shape that is unusual.
   *
   * A TEMPLATE HOLE IS EXCLUDED, and that is a decision rather than an oversight. Four modules
   * and two tests describe the assembled-class trap by quoting a bracketed utility with an
   * interpolation where the token name goes. Those have shipped for three tasks and the
   * stylesheet compiles: Tailwind's candidate extractor stops at the brace, so no rule is
   * emitted. Excluding them is also what lets the positive controls below assemble their
   * offenders through an interpolation — the source text stays legal while the runtime string
   * is the real defect. The exclusion is `${` specifically, not a bare `$`: a lone `$` inside a
   * bracket is not a hole and must not disarm the guard.
   *
   * The token-name class is `[A-Za-z0-9_-]`, not `[a-z0-9-]`. A custom property may carry
   * uppercase and underscores, so the narrower class reported a legal binding as fatal.
   *
   * THE LEADING WHITESPACE IS INSIDE THE LOOKAHEAD, and that placement is the fix for a false
   * positive rather than a stylistic choice. Written as `var\(\s*(?!--…)`, the engine ate the
   * space, matched and correctly negated `--ring)`, then BACKTRACKED: `\s*` gave the space back,
   * the lookahead re-ran against ` --ring`, failed on the space, and the negation succeeded. So
   * `[color:var( --ring )]` reported as fatal. It is reachable only in prose — a real Tailwind
   * arbitrary value cannot contain a literal space, `_` stands in for one — which is why the
   * clean tree never showed it.
   *
   * WHICH DIRECTION THE RISK RUNS, because the next person reading this lookahead will want to
   * know: backtracking only ever ADDS a match. Widening the lookahead can therefore produce a
   * false positive and can never produce a new MISS, so a change here is checked by re-proving
   * the offenders still red — never by trusting that nothing slipped through silently.
   */
  const NON_TOKEN_VAR_UTILITY = /\[(?![^\]]*\$\{)[^\]]*var\((?!\s*--[A-Za-z0-9_-]+\s*[,)])[^)\]]*/g;

  it("walked the whole scanned project, not a hand-picked subset — positive control", () => {
    expect(files.length).toBeGreaterThan(400);
    const seen = new Set(files.map((f) => relative(ROOT, f).split("/")[0]!));
    // The four the narrow walk missed, named individually so a regression to `components`/
    // `app`/`lib` fails here with the reason rather than merely counting lower.
    for (const entry of ["i18n", "proxy.ts", "next.config.ts", "vitest.config.ts"]) {
      expect(seen.has(entry), `${entry} is not being scanned, but Tailwind scans it`).toBe(true);
    }
    // And the exclusions really excluded: a guard that walked node_modules would be useless
    // rather than merely slow, and one that walked gitignored output would red on stale files.
    expect([...seen].some((d) => d === "node_modules" || d === ".next")).toBe(false);
  });

  it("spells no bracketed utility around anything but a real token name", () => {
    const offenders: string[] = [];
    for (const path of files) {
      for (const m of readFileSync(path, "utf8").matchAll(NON_TOKEN_VAR_UTILITY)) {
        offenders.push(`${path}: ${m[0]}`);
      }
    }
    expect(
      offenders,
      `these compile to a CSS declaration whose property name is not a custom property, ` +
        `which fails the whole stylesheet and 500s every route:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("recognises BOTH shapes that actually broke the build — positive control", () => {
    // Both offending strings are ASSEMBLED rather than written out, because this file is itself
    // scanned by Tailwind and by the assertion above: spelling either defect here would BE the
    // defect. That is not a workaround, it is the guard proving its own premise — the first
    // run of this test failed on its own doc comment.
    const star = String.fromCharCode(42);
    const dot = String.fromCharCode(46);
    // Task 6: a wildcard where the token name goes.
    const offender = `now \`bg-[var(--sst-band-${star})]\`. That legend`;
    expect(offender).toMatch(NON_TOKEN_VAR_UTILITY);
    // Task 7: an ELLIPSIS where the token name goes. No wildcard anywhere, and the first
    // version of this guard was green on it while every route returned 500.
    const second = `the ripple is a \`stroke-[var(${dot.repeat(3)})]\` class now`;
    expect(second).toMatch(NON_TOKEN_VAR_UTILITY);
    // Fix round 1: the SAME two payloads in Tailwind's arbitrary-PROPERTY syntax, which has no
    // utility name before the bracket. Build-verified as fatal, and invisible to the `-[`
    // anchor this guard used until now.
    const third = `the ripple is a \`[stroke:var(${dot.repeat(3)})]\` class now`;
    expect(third).toMatch(NON_TOKEN_VAR_UTILITY);
    const fourth = `the family is \`[color:var(--fault-${star})]\` here`;
    expect(fourth).toMatch(NON_TOKEN_VAR_UTILITY);
    // And the safe spellings stay legal. The first five are what this repo writes; the rest are
    // the shapes fix round 1 BUILD-VERIFIED as non-fatal, so that widening the anchor did not
    // quietly turn "unusual" into "forbidden". A guard that reds on things that compile is a
    // guard people learn to route around.
    for (const safe of [
      "bg-[var(--sst-band-cool)]",
      "fill-[var(--region-marmara)]/80",
      "bg-[var(--map-sea,#dbe7e8)]",
      "w-[calc(100%*2)]",
      `the --sst-band-${String.fromCharCode(42)} family`,
      // A custom property may carry uppercase and underscores; it is still a custom property.
      "bg-[var(--Fault-KAF_text)]",
      // Bad VALUE, good property: CSS error recovery drops the declaration, the sheet compiles.
      `stroke-[${dot.repeat(3)}]`,
      "bg-[#ea580c]",
      "text-[oklch(0.5 0.11 27.325)]",
      "bg-[--fault-kaf]",
      // These emit no rule at all.
      "bg-(--fault-kaf)",
      "text-[var(--fault-kaf, #e7000b)]",
      // Both whitespace spellings around a REAL token. The second is the backtracking false
      // positive this pattern was rewritten to clear; the first is what must not regress with it.
      "[color:var(--ring)]",
      "[color:var( --ring )]",
      // The arbitrary-property twin of this branch's goal state. Legal exactly as the utility
      // form is — the guard checks SYNTAX, and deliberately does not check that a token exists.
      "[fill:var(--region-marmara)]",
    ]) {
      expect(safe, `${safe} must stay legal`).not.toMatch(NON_TOKEN_VAR_UTILITY);
    }
    // A lone `$` inside the bracket is NOT a template hole and must not disarm the guard.
    expect(`bg-[var(--sst-band-${star})$]`).toMatch(NON_TOKEN_VAR_UTILITY);
  });
});
