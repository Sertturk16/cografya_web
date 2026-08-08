import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * DANGLING-TOKEN TRIPWIRE for sticky-header anchor offsets.
 *
 * Every fragment target in this repo offsets itself below the sticky header with
 * `scroll-margin-top: calc(var(--some-header-token) + 1rem)`, and the measurement lives in
 * the global token layer rather than in the component (PR #44 review CR-I2). That indirection
 * has one failure mode, and it is silent: `var(--undefined-token)` makes the whole `calc()`
 * invalid at computed-value time, so the declaration is dropped and the offset becomes ZERO —
 * the jump target lands underneath the header again. Nothing errors, nothing warns, and a
 * screenshot of the page before the jump looks identical.
 *
 * This is not hypothetical here: `--header-height-wrapped` was retired when the mobile nav
 * moved into a disclosure panel, and its one consumer had to move to `--header-height` in the
 * same commit. This test is what makes the next such retirement fail loudly instead.
 *
 * Structural only (`CONVENTIONS.md` §2): it asserts that every custom property an anchor
 * offset READS is DECLARED unconditionally in the token layer, never what its value is. It
 * therefore cannot catch a token whose VALUE has gone out of date — that class is caught by
 * measurement at the sample gate and recorded in `DESIGN.md` §4. A test that asserts a
 * constant equals itself would protect nothing.
 */

const GLOBALS = new URL("../app/globals.css", import.meta.url);
const SITE_HEADER = new URL("./site-header.module.css", import.meta.url);

/**
 * BOTH stylesheet roots, and every `.css` in them — not just `components/**\/*.module.css`
 * (review TA56-M2). Four route stylesheets (`turkiye`, `country-detail`, `province-detail`,
 * `game`) live under `app/` and were invisible to this guard. No live gap existed the day it
 * was written — none of them declares an offset — but a guard that only asserts "at least one
 * offset exists" cannot notice the file it never opened, and the letter-jump anchors this
 * test was written for live on `/turkiye`.
 */
const ROOTS = [
  { label: "components", url: new URL("../components/", import.meta.url) },
  { label: "app", url: new URL("../app/", import.meta.url) },
] as const;

/** CSS comments are stripped before every scan — the PR-A CR-S2 lesson: a rule quoted inside
 *  a comment must never satisfy (or trip) a source-text guard. */
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, " ");

const globals = stripComments(readFileSync(GLOBALS, "utf8"));

/**
 * Only the UNCONDITIONAL `:root` block counts as a definition (review TA56-M3). A token
 * declared inside an at-rule is undefined outside it, which is precisely the shape this
 * commit deleted: `--header-height-wrapped` was declared in `:root` AND redeclared under
 * `@media (min-width: 64rem)`. Accepting a match anywhere in the file would let someone
 * reintroduce a media-only offset token, pass this tripwire, and leave `calc()` invalid — and
 * the offset silently zero — on every viewport outside that query.
 */
const rootBlock = (() => {
  const start = globals.indexOf(":root {");
  if (start === -1) return "";
  const end = globals.indexOf("}", start);
  return end === -1 ? "" : globals.slice(start, end);
})();

const cssFiles = ROOTS.flatMap(({ label: rootLabel, url: root }) =>
  readdirSync(root, { recursive: true, encoding: "utf8" })
    .filter((name) => name.endsWith(".css") && !name.includes("node_modules"))
    .map((name) => ({
      file: fileURLToPath(new URL(name, root)),
      label: `${rootLabel}/${name}`,
      css: readFileSync(new URL(name, root), "utf8"),
    })),
).sort((a, b) => a.file.localeCompare(b.file));

/** Every custom-property read inside a `calc()` in either stylesheet root. */
const calculatedReferences = cssFiles.flatMap(({ css, label }) =>
  [...stripComments(css).matchAll(/calc\(([^;{}]+)\)/g)].flatMap((calculation) =>
    [...(calculation[1] ?? "").matchAll(/var\(\s*(--[a-z0-9-]+)(\s*,[^)]*)?\)/gi)].map(
      (reference) => ({
        css: stripComments(css),
        fallback: reference[2] !== undefined,
        label,
        token: reference[1] ?? "",
      }),
    ),
  ),
);

/** The sticky-header token is deliberately global: all five readers must resolve it at every
 * viewport. Other `calc()` tokens may be selector- or at-rule-scoped, so this test must not
 * mistake a declaration elsewhere in the same file for their definition. */
const headerHeightReaders = calculatedReferences.filter(({ token }) => token === "--header-height");

describe("sticky-header anchor offsets", () => {
  it("finds sticky-header token readers to guard", () => {
    expect(headerHeightReaders.length).toBeGreaterThan(0);
  });

  it("scans both stylesheet roots", () => {
    // Guards the widening itself: a move of either root would otherwise shrink the scanned
    // set in silence, which is the failure mode of the version this replaced.
    expect(cssFiles.some(({ file }) => file.includes("/app/"))).toBe(true);
    expect(cssFiles.some(({ file }) => file.includes("/components/"))).toBe(true);
  });

  it("finds the unconditional :root block in globals.css", () => {
    // Anchor for the definition side: an empty slice would make every offset below pass or
    // fail for the wrong reason.
    expect(rootBlock).toContain("--header-height");
  });

  it.each(headerHeightReaders)(
    "$label resolves the global sticky-header token used inside calc()",
    () => {
      expect(/--header-height\s*:/.test(rootBlock)).toBe(true);
    },
  );

  it("keeps the mobile header on one row below 64rem", () => {
    const header = stripComments(readFileSync(SITE_HEADER, "utf8"));
    const mobileRules = header.slice(0, header.indexOf("@media (min-width: 64rem)"));
    expect(mobileRules.length).toBeGreaterThan(0);
    expect(mobileRules).toMatch(/\.inner\s*\{[^}]*flex-wrap:\s*nowrap/);
  });

  it("no longer references the retired wrapped-header token anywhere", () => {
    // It described a header that cannot occur any more (the nav moved into a disclosure and
    // `.inner` is `nowrap` below 64rem), so a reintroduced reference would be reading a
    // property nothing declares.
    for (const { css } of cssFiles) {
      expect(stripComments(css)).not.toContain("--header-height-wrapped");
    }
  });
});
