import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stripCssComments } from "@/lib/test-support/strip-comments";

/**
 * A custom property declared in BOTH `:root` and `@theme inline` has two values at once.
 *
 * `@theme inline` does not make its value win: Tailwind inlines it into the utilities
 * (`rounded-lg` compiles to `var(--radius)`), while the unlayered `:root` declaration beats the
 * `@layer theme` copy for anything that reads the variable by name. So `rounded-lg` and
 * `rounded-[var(--radius-lg)]` rendered 10px and 16px until T-113 removed the `:root` one.
 *
 * Allowed: the same value in both, or `@theme inline` re-exporting the variable as
 * `var(<itself>)`. Anything else is a second value, except the raw Terra colours below.
 */
const css = stripCssComments(
  readFileSync(fileURLToPath(new URL("../app/globals.css", import.meta.url)), "utf8"),
);

/**
 * Raw Terra tokens frozen at their light value (`docs/design.md`: colour comes from a bridge
 * token). In light mode each equals its bridge token; in dark only the bridge token switches.
 * A component that reads one of these by name is already a bridge-token violation.
 */
const RAW_TERRA_COLOURS = new Set([
  "--color-primary",
  "--color-secondary",
  "--color-accent",
  "--color-border",
  "--color-success",
  "--color-warning",
  "--color-info",
]);

function blockBodies(prelude: RegExp): string[] {
  const bodies: string[] = [];
  const stack: { prelude: string; from: number }[] = [];
  let preludeStart = 0;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === "{") {
      stack.push({ prelude: css.slice(preludeStart, i).trim(), from: i + 1 });
      preludeStart = i + 1;
    } else if (c === "}") {
      const open = stack.pop()!;
      if (stack.length === 0 && prelude.test(open.prelude)) bodies.push(css.slice(open.from, i));
      preludeStart = i + 1;
    } else if (c === ";") {
      preludeStart = i + 1;
    }
  }
  return bodies;
}

const declarations = (bodies: string[]) =>
  bodies.flatMap((body) =>
    [...body.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+);/g)].map(
      (m) => [m[1]!, m[2]!.trim().replace(/\s+/g, " ")] as const,
    ),
  );

const rootValues = new Map(declarations(blockBodies(/^:root\b/)));
const themeValues = declarations(blockBodies(/^@theme inline$/));

describe("no custom property carries two values across :root and @theme inline", () => {
  it("reads both blocks", () => {
    expect(rootValues.size, ":root declarations").toBeGreaterThan(50);
    expect(themeValues.length, "@theme inline declarations").toBeGreaterThan(50);
  });

  it("every shared name agrees or re-exports itself", () => {
    const conflicts = themeValues
      .filter(([name]) => rootValues.has(name) && !RAW_TERRA_COLOURS.has(name))
      .filter(([name, value]) => value !== `var(${name})` && value !== rootValues.get(name))
      .map(([name, value]) => `${name}: :root ${rootValues.get(name)} / @theme ${value}`);
    expect(conflicts).toEqual([]);
  });

  it("the raw Terra exemptions are all still shared names", () => {
    // A name that left either block no longer needs its exemption.
    const themeNames = new Set(themeValues.map(([name]) => name));
    for (const name of RAW_TERRA_COLOURS) {
      expect(rootValues.has(name) && themeNames.has(name), name).toBe(true);
    }
  });
});
