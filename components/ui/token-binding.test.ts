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
 * Colour in a component comes from a bridge token. Three things are forbidden, and each has
 * already cost this repo something (T-034 spec §3):
 *
 *   - `var(--color-x, #hex)` escapes read a Terra token the `.dark` block never redefines,
 *     so the component is frozen at its light value in dark mode. There were 44 of them
 *     across six files, which is why no dark palette could have reached Badge, Alert,
 *     Button, Tabs, Dialog or Sheet.
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

  it.each(FILES)("%s has no var(--color-*, #hex) escape", (_path, source) => {
    expect(source).not.toMatch(/var\(--color-[a-z-]+,\s*#[0-9a-fA-F]{3,8}\)/);
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
   * task 3 converted it. The rule that put them here:
   * **the task that retires a module adds that module's directory to this list, in the same
   * commit as the conversion.** Nothing would otherwise have caught a `var(--color-*, #hex)`
   * escape in the four files that conversion rewrote — the constraint was complied with by
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
   * The tempting move is to widen this to every feature directory at once. Do NOT. The six
   * unconverted modules' consumers carry exactly the defects T-033 exists to remove, so a
   * blanket widening reds immediately and the only way back to green is an exemption list —
   * a list that then has to be pruned six times, by six tasks, each of which could
   * silently prune one row too many. Growing the scan in step with the conversion needs no
   * bookkeeping and cannot go stale: a directory is either converted and scanned, or neither.
   */
  const V2_DIRS = [
    fileURLToPath(new URL("../v2", import.meta.url)),
    fileURLToPath(new URL("../marine", import.meta.url)),
    fileURLToPath(new URL("../air", import.meta.url)),
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
    "%s has no var(--color-*, #hex) escape",
    (_label, path) => {
      const source = stripComments(readFileSync(path, "utf8"));
      expect(source).not.toMatch(/var\(--color-[a-z-]+,\s*#[0-9a-fA-F]{3,8}\)/);
    },
  );

  it("every exempt file still contains what it is exempt for", () => {
    for (const exempt of MAP_SURFACE_FILES) {
      const match = V2_DIRS.flatMap(walk).find((p) => p.endsWith(exempt));
      expect(match, `${exempt} no longer exists; drop the exemption`).toBeDefined();
      expect(
        stripComments(readFileSync(match!, "utf8")),
        `${exempt} no longer escapes; drop the exemption`,
      ).toMatch(/var\(--color-[a-z-]+,\s*#[0-9a-fA-F]{3,8}\)/);
    }
  });
});
