import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { blockOf } from "@/lib/test-support/css-tokens";
import { stripCssComments } from "@/lib/test-support/strip-comments";

const CSS = readFileSync(fileURLToPath(new URL("../../app/globals.css", import.meta.url)), "utf8");
/** For the whole-file matches below. `blockOf` strips comments itself; a raw match must not. */
const STRIPPED = stripCssComments(CSS);
/** Returns the body of the first top-level block whose selector starts with `name`. */
const section = (name: string): string => blockOf(CSS, name);

const SEMANTIC = ["success", "warning", "info", "chip"] as const;

/**
 * The semantic half of the shadcn bridge.
 *
 * Terra has always carried `--color-success`, `--color-warning`, `--color-info` and the chip
 * pair, but the BRIDGE never did, so components reached for the raw Terra token with a hex
 * fallback instead — 44 such escapes across six files (T-034 spec §3). Those Terra tokens are
 * not redefined under `.dark`, so every one of them was frozen at its light value in dark
 * mode: a new dark palette could not reach Badge, Alert, Button, Tabs, Dialog or Sheet at all.
 *
 * These assertions pin the fix in all three places a bridge token has to appear: declared in
 * the light block, re-exported through `@theme inline` so Tailwind emits `bg-success` and
 * friends, and redefined under `.dark`.
 */
describe("semantic bridge tokens", () => {
  const root = section(":root,");
  const theme = section("@theme inline");
  const dark = section(".dark {");

  it("positive control — the parser found real blocks", () => {
    expect(root).toContain("--color-primary");
    expect(dark).toContain("--background");
    expect(theme).toContain("--color-background");
  });

  it.each(SEMANTIC)("--%s is declared in the light block with a foreground", (name) => {
    expect(root).toContain(`--${name}:`);
    expect(root).toContain(`--${name}-foreground:`);
  });

  it.each(SEMANTIC)("--%s is re-exported through @theme inline", (name) => {
    expect(theme).toContain(`--color-${name}: var(--${name})`);
    expect(theme).toContain(`--color-${name}-foreground: var(--${name}-foreground)`);
  });

  it.each(SEMANTIC)("--%s is redefined under .dark", (name) => {
    expect(dark).toContain(`--${name}:`);
    expect(dark).toContain(`--${name}-foreground:`);
  });

  /**
   * `--destructive` is declared in both blocks but its FOREGROUND was only ever re-exported,
   * never declared — so `text-destructive-foreground` resolved to nothing and `button.tsx`
   * used a literal `text-white` instead. That read fine in light mode and measured 2.89:1
   * once `.dark` lifted the fill. An exported half-pair is worse than a missing one: the
   * utility exists, so nothing errors.
   */
  it("--destructive carries a declared foreground in both blocks, not just an export", () => {
    expect(theme).toContain("--color-destructive-foreground: var(--destructive-foreground)");
    expect(root).toContain("--destructive-foreground:");
    expect(dark).toContain("--destructive-foreground:");
  });

  /**
   * The `-strong` members exist for one shape: text on a tint of its own colour. The four
   * semantic families got them in T-034; `primary` and `secondary` were skipped because they
   * read as chrome rather than as status, and both then failed the same way — Badge `default`
   * at 4.12:1, Badge `secondary` at 4.54:1, Tabs `line` at 4.26:1 in BOTH themes.
   */
  const STRONG = ["success", "warning", "info", "destructive", "primary", "secondary"] as const;

  it.each(STRONG)("--%s-strong exists in both themes and is exported", (name) => {
    expect(root).toContain(`--${name}-strong:`);
    expect(dark).toContain(`--${name}-strong:`);
    expect(theme).toContain(`--color-${name}-strong: var(--${name}-strong)`);
  });

  /**
   * `@layer base` styles a bare `<a>` and a bare `<h2>`. Both used to read
   * `--color-primary-dark` — a raw Terra token `.dark` never redefines — so every element
   * reaching the base layer without its own colour class froze at the light value. Three
   * shipped components did exactly that, measured at 2.23:1, 2.04:1 and 1.99:1 on the dark
   * background. `components/ui/token-binding.test.ts` cannot catch this class of defect: the
   * components have no colour class, so there is nothing for it to scan. This is where it
   * gets caught instead.
   */
  it("--link is theme-aware, so a bare anchor is not frozen at the light value", () => {
    expect(root).toContain("--link:");
    expect(dark).toContain("--link:");
  });

  it("the base layer reads --link, never the raw Terra token", () => {
    const base = section("@layer base");
    expect(base).toContain("color: var(--link)");
    expect(base).not.toContain("color: var(--color-primary-dark)");
  });

  /**
   * The same defect, one rule further up, and it survived the round that fixed `a` and `h2`.
   * `h1,h2,h3,h4` set `color: var(--color-ink)` — a raw Terra token `.dark` redefines only
   * inside `.climate-dark-scope`. The `h2` rule below it overrode that for h2 alone, so h2
   * looked correct while h1, h3 and h4 stayed frozen at the light value. It was invisible on
   * ordinary pages, whose content sets explicit colours, and showed up on `app/not-found.tsx`,
   * which deliberately carries almost none: measured at 1.25:1.
   */
  it("bare headings take a theme-aware colour, not the raw ink token", () => {
    const base = section("@layer base");
    expect(base).toContain("color: var(--foreground)");
    expect(base).not.toContain("color: var(--color-ink)");
  });

  it("h2 keeps Terra's terracotta through the strong member", () => {
    // Identical to the old value in light (#7e3a1e); the strong member is what survives a
    // tinted surface in dark, where --link measured 4.29:1 on --muted.
    expect(section("@layer base")).toContain("color: var(--primary-strong)");
  });

  it("the focus ring reads --ring, which .dark redefines", () => {
    // --color-accent is a light-mode Terra token, so the ring was identical in both themes:
    // 5.79:1 in light, 3.04:1 in dark — clearing WCAG 1.4.11 by 0.04.
    //
    // STRIPPED, like every other read in this file: the two assertions below are the one place
    // that matched the raw `CSS`, so a comment QUOTING the old rule would have satisfied the
    // first and broken the second — the "prose in a comment fools a string match" defect
    // `blockOf` strips comments to avoid everywhere else.
    expect(STRIPPED).toContain("outline: 3px solid var(--ring)");
    expect(STRIPPED).not.toContain("outline: 3px solid var(--color-accent)");
  });
});

/**
 * The night-sea invariant (T-034 phase C).
 *
 * What this block replaced was shadcn's stock ramp, every neutral written `oklch(x 0 0)` —
 * chroma exactly zero. Light mode's identity is warmth, so an achromatic dark mode was by
 * definition a different brand. These assertions are what stops a future edit, or a
 * `shadcn add` that rewrites the block, quietly restoring it.
 */
describe("the dark neutrals carry the brand's hue", () => {
  const dark = section(".dark {");
  const NEUTRALS = [
    "--background",
    "--foreground",
    "--card",
    "--card-foreground",
    "--popover",
    "--popover-foreground",
    "--muted",
    "--muted-foreground",
    "--border",
    "--input",
    "--chip",
  ] as const;

  const declared = (token: string): string => {
    const match = new RegExp(`${token}:\\s*([^;]+);`).exec(dark);
    expect(match, `${token} is not declared in .dark`).not.toBeNull();
    return match![1]!.trim();
  };

  it.each(NEUTRALS)("%s is not an achromatic oklch", (token) => {
    // `oklch(L 0 H)` is a grey whatever the hue says, and that is the exact shape this
    // palette exists to remove.
    expect(declared(token)).not.toMatch(/oklch\([\d.]+\s+0\s/);
  });

  it.each(NEUTRALS)("%s is not a neutral hex either", (token) => {
    const value = declared(token);
    const hex = /^#([0-9a-fA-F]{6})$/.exec(value);
    if (hex === null) return; // authored in oklch with real chroma; the row above covers it
    const [r, g, b] = [0, 2, 4].map((i) => Number.parseInt(hex[1]!.slice(i, i + 2), 16));
    expect(
      Math.max(r!, g!, b!) - Math.min(r!, g!, b!),
      `${token} = ${value} has no colour in it`,
    ).toBeGreaterThan(2);
  });

  it("the border is opaque, so it draws the same line on every surface", () => {
    // A white-alpha border picks up whatever sits behind it, which on a tinted field reads
    // as the border changing colour between --card and --background.
    expect(declared("--border")).not.toContain("/");
  });
});
