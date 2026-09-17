import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DIRS = ["../ui", "../patterns"] as const;

/**
 * Comments and docblocks are stripped before scanning.
 *
 * Not a convenience: the comment on `components/ui/alert.tsx` explains the defect by quoting
 * `dark:text-[var(--color-success,#496f35)]`, and a scanner that could not tell prose from
 * code would flag the very explanation of why the code is now correct. The same trap caught
 * `lib/theme/bridge-tokens.test.ts`, whose parser found `@theme inline` inside a comment
 * before finding the real block.
 */
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

const FILES = DIRS.flatMap((rel) => {
  const dir = fileURLToPath(new URL(rel, import.meta.url));
  return readdirSync(dir)
    .filter((f) => f.endsWith(".tsx") && !f.includes(".test."))
    .map((f) => [join(rel, f), stripComments(readFileSync(join(dir, f), "utf8"))] as const);
});

const RAW_PALETTE =
  /\b(bg|text|border|ring|fill|stroke|from|to|via)-(slate|gray|zinc|neutral|stone|amber|emerald|sky|teal|rose|red|green|blue|orange|yellow|indigo|violet|purple|pink|cyan|lime)-\d{2,3}\b/;

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

  /**
   * Two `dark:` utilities survive, and both are exempt because they express something a
   * colour token cannot. Listed by file and by the exact utility, never by a loose pattern —
   * an exemption nobody wrote down is how a tripwire quietly stops tripping.
   *
   * A third was NOT exempted: `custom-select.tsx` had `bg-white dark:bg-card`, which is a
   * hard-coded colour with a theme patch bolted on. It now reads `bg-popover`, which is what
   * the bridge has a token for.
   */
  const DARK_VARIANT_EXEMPTIONS: ReadonlyArray<readonly [string, string, string]> = [
    [
      "avatar.tsx",
      "dark:after:mix-blend-lighten",
      "A blend MODE, not a colour. The ring is drawn by blending against whatever sits " +
        "behind it, so it must darken on light and lighten on dark. No custom property can " +
        "carry `mix-blend-mode`.",
    ],
    [
      "dropdown-menu.tsx",
      "dark:data-[variant=destructive]:focus:bg-destructive/20",
      "An ALPHA, not a colour: the same token at 10% on light and 20% on dark, because a " +
        "tint that reads as a wash on white disappears on near-black. Tokenising one call " +
        "site's opacity would cost more than it explains.",
    ],
  ];

  it.each(FILES)("%s writes no hand-rolled dark: class", (path, source) => {
    // `components/patterns/theme-pair.tsx` carries the bare class names `dark` and `light`
    // on a wrapper, which is a different thing from a `dark:` variant and passes this.
    let scanned = source;
    for (const [file, utility] of DARK_VARIANT_EXEMPTIONS) {
      if (path.endsWith(file)) scanned = scanned.split(utility).join(" ");
    }
    expect(scanned).not.toMatch(/\bdark:/);
  });

  it("every exemption is still present — a stale one would hide a real regression", () => {
    for (const [file, utility] of DARK_VARIANT_EXEMPTIONS) {
      const entry = FILES.find(([path]) => path.endsWith(file));
      expect(entry, `${file} is no longer scanned`).toBeDefined();
      expect(entry?.[1], `${file} no longer contains ${utility}; drop the exemption`).toContain(
        utility,
      );
    }
  });
});
