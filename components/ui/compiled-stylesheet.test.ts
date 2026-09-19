import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import type { AcceptedPlugin } from "postcss";
import tailwindcss from "@tailwindcss/postcss";
import { beforeAll, describe, expect, it } from "vitest";
import { EXCLUDED, RAW_EXEMPT, RAW_PALETTE } from "../../scripts/palette-inventory.mjs";

/**
 * THE FOURTH ARM: the stylesheet that actually ships.
 *
 * ## The hole the other three leave, and the branch proved it at scale
 *
 * `raw-palette-count.test.ts` has three arms and every one of them reads SOURCE — a class
 * notation, a bracketed literal, a colour written outside a class. All three reached their end
 * state on this branch, and the repo still shipped **125 distinct raw-palette rules** in the
 * compiled stylesheet. Two of them, `text-purple-600` and `text-rose-500`, existed nowhere in
 * the tree at all except inside `docs/superpowers/t031c-palette-inventory.md` — the very
 * document this branch wrote to record their removal.
 *
 * Tailwind v4 scans source TEXT. `app/globals.css` declared no `@source`, so Tailwind
 * auto-detected from the project root and compiled a 461-row prose census into real CSS. That
 * is the same defect T-031c had already fixed once inside one component (a comment quoting a
 * class name, commit `2bd41da`) — at repository scale, in the branch's own record, which the
 * last task grew by fifty rows. A source-only guard cannot see it, by construction.
 *
 * ## It also closes T-056, which is the same blind spot from the other side
 *
 * T-056 records the suite staying green — 5456, then 5599 tests — while **every route returned
 * 500**, four times, because a class-shaped string in a docblock compiled into invalid CSS.
 * `token-binding.test.ts` carries an interim shape guard for it that was re-spelled past twice
 * and had to be widened twice more; T-056's own scope note says the only thing that closes the
 * class is compiling, and that when it lands the shape guard becomes redundant.
 *
 * This arm compiles. `optimize` hands the generated CSS to Lightning CSS — the same engine
 * Next's own pipeline uses — which reports `Unexpected token Delim('*')` on exactly the
 * declarations that broke those builds. All four historical spellings are asserted below as
 * positive controls, including the arbitrary-PROPERTY form the shape guard was blind to until
 * its fourth incident. Lightning CSS runs with `errorRecovery`, so it WARNS rather than
 * throwing and the offending rule is dropped; the warning is therefore the signal, and this
 * arm asserts there are none.
 *
 * ## What it asserts about the palette, and why it is an exact set
 *
 * Not "fewer than N". The compiled sheet's palette rules must be EXACTLY the distinct classes
 * spelled in the two files this branch deferred by name — `EXCLUDED`'s T-033 page and
 * `RAW_EXEMPT`'s T-031d world map. Both directions fail:
 *
 *   - a class in the SHEET but in neither deferred file -> something else in the repo is
 *     feeding Tailwind: a doc, a test, a comment, a new component, or a dropped `@source not`.
 *   - a class in a deferred FILE but not in the sheet -> the record has drifted from what
 *     compiles, so the deferral no longer describes the thing being deferred.
 *
 * When T-031d and T-033 land, both sides go to zero together and the assertion becomes
 * `new Set()` equals `new Set()` — a literal, checkable palette-free stylesheet.
 */

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const GLOBALS = join(ROOT, "app/globals.css");

/** Compile one stylesheet through the project's own plugin, capturing Lightning CSS warnings. */
async function compile(css: string, from: string) {
  const warnings: string[] = [];
  const realWarn = console.warn;
  console.warn = (...args: unknown[]) => void warnings.push(args.join(" "));
  try {
    // `optimize` is what runs Lightning CSS. Minification is left OFF so a failure message
    // quotes readable CSS; the parse — the part that matters here — is identical either way.
    // The cast crosses ONE version boundary and nothing else: `@tailwindcss/postcss` ships its
    // own nested postcss (8.5.18) for types while this repo resolves 8.5.26, so the structurally
    // identical `Plugin` types are nominally different and tsc gives up comparing them. The
    // plugin instance is the real one either way — this is the project's own pipeline.
    const plugin = tailwindcss({ base: ROOT, optimize: { minify: false } }) as AcceptedPlugin;
    const result = await postcss([plugin]).process(css, { from });
    return { css: result.css, warnings };
  } finally {
    console.warn = realWarn;
  }
}

/**
 * Every raw palette class the compiled sheet actually emits a rule for.
 *
 * SELECTORS, NOT A TEXT SCAN of the whole file, and the difference is 24 rules. A regex
 * anchored on `.` in front of the property misses every variant-prefixed utility, because
 * `dark:text-blue-300` compiles to `.dark\:text-blue-300` — the `.` is in front of `dark`.
 * Walking rules and unescaping the selector catches those and cannot match a palette-shaped
 * string inside a declaration VALUE either.
 *
 * `RAW_PALETTE` itself is imported rather than re-spelled: one reader for the notation, the
 * same rule the source arms count with.
 */
function paletteRulesIn(compiled: string): Set<string> {
  const found = new Set<string>();
  postcss.parse(compiled).walkRules((rule) => {
    for (const selector of rule.selectors) {
      for (const match of selector.replace(/\\(.)/g, "$1").matchAll(RAW_PALETTE))
        found.add(match[0]);
    }
  });
  return found;
}

/** Compile a throwaway source tree with `source(none)`, so only the probe feeds the scanner. */
async function compileProbe(source: string) {
  const dir = mkdtempSync(join(tmpdir(), "t031c-compiled-"));
  writeFileSync(join(dir, "probe.tsx"), source, "utf8");
  try {
    // `from` stays inside the repo so `@import "tailwindcss"` resolves against its node_modules.
    return await compile(`@import "tailwindcss" source(none);\n@source "${dir}";\n`, GLOBALS);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("the stylesheet that ships is the one being asserted", () => {
  let compiled = "";
  let warnings: string[] = [];

  beforeAll(async () => {
    const result = await compile(readFileSync(GLOBALS, "utf8"), GLOBALS);
    compiled = result.css;
    warnings = result.warnings;
  }, 60_000);

  it("compiles at all — positive control", () => {
    // A guard that silently compiled an empty sheet would satisfy every assertion below.
    expect(compiled.length).toBeGreaterThan(100_000);
    expect(compiled).toContain("--color-primary");
  });

  it("emits no invalid CSS — this is T-056, and it is what 500'd every route four times", () => {
    expect(
      warnings,
      `Lightning CSS could not parse something Tailwind generated. Every occurrence of this ` +
        `so far has been a class-shaped string in a COMMENT, in a file Tailwind scans, and ` +
        `every one of them took the whole site to 500 with the suite green:\n${warnings.join("\n")}`,
    ).toEqual([]);
  });

  it("ships palette rules for exactly the two files this branch deferred by name", () => {
    const deferred = [...EXCLUDED, ...RAW_EXEMPT.map((entry) => entry.file)];
    const expected = new Set<string>();
    for (const file of deferred) {
      for (const match of readFileSync(join(ROOT, file), "utf8").matchAll(RAW_PALETTE)) {
        expected.add(match[0]);
      }
    }
    const actual = paletteRulesIn(compiled);
    const unexpected = [...actual].filter((cls) => !expected.has(cls)).sort();
    const missing = [...expected].filter((cls) => !actual.has(cls)).sort();
    expect(
      unexpected,
      `these palette rules are in the compiled stylesheet but in neither deferred file ` +
        `(${deferred.join(", ")}). Something else in the repo is feeding Tailwind — a doc, a ` +
        `test, a comment, a new component, or an \`@source not\` line that was dropped from ` +
        `app/globals.css:\n${unexpected.join(" ")}`,
    ).toEqual([]);
    expect(
      missing,
      `these are spelled in a deferred file but compile to nothing, so the deferral no longer ` +
        `describes what is being deferred:\n${missing.join(" ")}`,
    ).toEqual([]);
  });

  it("keeps the inventory document out of the stylesheet — the defect this arm was born for", () => {
    // Named rather than counted, because these two are the proof. Both are spelled in
    // `docs/superpowers/t031c-palette-inventory.md` and NOWHERE else in the repo, so if either
    // appears in the compiled sheet the `@source not "../docs/**"` line is gone or wrong. The
    // strings are assembled so that this file is not itself a source for them.
    const purple = ["text", "purple", "600"].join("-");
    const rose = ["text", "rose", "500"].join("-");
    const inventory = readFileSync(
      join(ROOT, "docs/superpowers/t031c-palette-inventory.md"),
      "utf8",
    );
    expect(inventory).toContain(purple);
    expect(inventory).toContain(rose);
    const rules = paletteRulesIn(compiled);
    expect(rules.has(purple), `${purple} is in the sheet and lives only in the inventory`).toBe(
      false,
    );
    expect(rules.has(rose), `${rose} is in the sheet and lives only in the inventory`).toBe(false);
  });

  it("would SEE a palette rule if one were emitted — positive control", async () => {
    const probe = await compileProbe('export const a = <div className="text-rose-500" />;\n');
    expect(probe.warnings).toEqual([]);
    expect([...paletteRulesIn(probe.css)]).toEqual(["text-rose-500"]);
  });

  it("sees a palette class a COMMENT puts in front of the scanner — positive control", async () => {
    // The exact shape of commit `2bd41da` and of the inventory document: prose, not markup,
    // compiled into a real rule. The source arms strip comments and cannot see this.
    const probe = await compileProbe(
      "// this used to be `text-rose-500` here\nexport const a = 1;\n",
    );
    expect([...paletteRulesIn(probe.css)]).toEqual(["text-rose-500"]);
  });

  it.each([
    // Every spelling that actually broke a build, assembled rather than written out: this file
    // is scanned by `token-binding.test.ts`'s walk, so spelling one here would BE the defect.
    ["T-056 #1 — a wildcard where the token name goes", `bg-[var(--sst-band-${"*"})]`],
    ["T-056 #2 — an ellipsis where the token name goes", `stroke-[var(${".".repeat(3)})]`],
    ["T-056 #3 — the same, in arbitrary-PROPERTY syntax", `[stroke:var(${".".repeat(3)})]`],
    ["T-056 #4 — a wildcard, in arbitrary-PROPERTY syntax", `[color:var(--fault-${"*"})]`],
  ])("reddens on %s — positive control", async (_label, cls) => {
    const probe = await compileProbe(`// the class is \`${cls}\` now\nexport const a = 1;\n`);
    expect(probe.warnings.join("\n")).toMatch(/while optimizing generated CSS/);
  });

  it("does NOT redden on the spellings that legitimately compile — negative control", async () => {
    // A guard that reds on things which compile is one people learn to route around. These are
    // what this repo writes, plus the shapes T-031c build-verified as non-fatal.
    for (const cls of [
      "bg-[var(--sst-band-cool)]",
      "fill-[var(--region-marmara)]/80",
      "bg-[var(--map-sea,#dbe7e8)]",
      "w-[calc(100%*2)]",
      "bg-[#ea580c]",
      "text-[oklch(0.5 0.11 27.325)]",
      "[color:var(--ring)]",
      "[fill:var(--region-marmara)]",
    ]) {
      const probe = await compileProbe(`export const a = <div className="${cls}" />;\n`);
      expect(probe.warnings, `${cls} compiles cleanly and must not redden this arm`).toEqual([]);
    }
  }, 60_000);

  it("the `@source not` lines still subtract the trees they name — positive control", () => {
    // Derived from the file rather than transcribed, so a renamed directory fails here instead
    // of leaving a line that matches nothing. `docs/**` without the `../` resolves against
    // `app/` and is a silent no-op; that near-miss cost 72 rules to find.
    const lines = readFileSync(GLOBALS, "utf8").match(/@source not "[^"]+";/g) ?? [];
    expect(lines).toEqual([
      '@source not "../docs/**";',
      '@source not "../scripts/**";',
      '@source not "../**/*.test.ts";',
      '@source not "../**/*.test.tsx";',
    ]);
    // Each pattern must still name something that exists, or it is subtracting nothing.
    const tracked = execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" }).split("\n");
    for (const [pattern, matches] of [
      ["../docs/**", (f: string) => f.startsWith("docs/")],
      ["../scripts/**", (f: string) => f.startsWith("scripts/")],
      ["../**/*.test.ts", (f: string) => f.endsWith(".test.ts")],
      ["../**/*.test.tsx", (f: string) => f.endsWith(".test.tsx")],
    ] as const) {
      expect(
        tracked.some(matches),
        `\`@source not "${pattern}"\` matches nothing in the tree any more`,
      ).toBe(true);
    }
    expect(relative(ROOT, GLOBALS)).toBe("app/globals.css");
  });
});
