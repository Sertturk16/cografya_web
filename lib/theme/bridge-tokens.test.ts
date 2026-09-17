import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Comments are stripped before parsing, the same precaution
 * `components/anchor-offset-token.test.ts` takes. Without it a prose mention of a selector
 * inside a comment is found first and the parser returns the wrong block — which is exactly
 * what happened when the `--success` comment below was written to say "re-exported in
 * `@theme inline` below".
 */
const CSS = readFileSync(
  fileURLToPath(new URL("../../app/globals.css", import.meta.url)),
  "utf8",
).replace(/\/\*[\s\S]*?\*\//g, " ");

/** Returns the body of the first top-level block whose selector starts with `name`. */
function section(name: string): string {
  const start = CSS.indexOf(name);
  if (start === -1) throw new Error(`${name} block not found`);
  const open = CSS.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < CSS.length; i += 1) {
    if (CSS[i] === "{") depth += 1;
    if (CSS[i] === "}") {
      depth -= 1;
      if (depth === 0) return CSS.slice(open, i);
    }
  }
  throw new Error(`${name} block never closed`);
}

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
