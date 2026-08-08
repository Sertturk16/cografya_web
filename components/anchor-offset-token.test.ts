import { readdirSync, readFileSync } from "node:fs";
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
 * offset READS is DECLARED in the token layer, never what its value is.
 */

const COMPONENTS_DIR = new URL("./", import.meta.url);
const GLOBALS = new URL("../app/globals.css", import.meta.url);

/** CSS comments are stripped before every scan — the PR-A CR-S2 lesson: a rule quoted inside
 *  a comment must never satisfy (or trip) a source-text guard. */
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, " ");

const globals = stripComments(readFileSync(GLOBALS, "utf8"));

const moduleFiles = readdirSync(COMPONENTS_DIR, { recursive: true, encoding: "utf8" })
  .filter((name) => name.endsWith(".module.css"))
  .sort();

/** Every `scroll-margin-top` declaration in the component stylesheets, with its file. */
const offsets = moduleFiles.flatMap((name) => {
  const css = stripComments(readFileSync(new URL(name, COMPONENTS_DIR), "utf8"));
  return [...css.matchAll(/scroll-margin-top\s*:\s*([^;}]+)/g)].map((match) => ({
    file: name,
    value: match[1]?.trim() ?? "",
  }));
});

describe("sticky-header anchor offsets", () => {
  it("finds at least one anchor offset to guard", () => {
    // Guards the guard: a refactor that renames the property would otherwise make this whole
    // file pass by testing nothing.
    expect(offsets.length).toBeGreaterThan(0);
  });

  it.each(offsets)("$file reads only custom properties declared in globals.css", ({ value }) => {
    const referenced = [...value.matchAll(/var\(\s*(--[a-z0-9-]+)/gi)].map((match) => match[1]);
    expect(referenced.length).toBeGreaterThan(0);
    for (const token of referenced) {
      expect(globals).toMatch(new RegExp(`${token}\\s*:`));
    }
  });

  it("no longer references the retired wrapped-header token anywhere", () => {
    // It described a header that cannot occur any more (the nav moved into a disclosure), so
    // a reintroduced reference would be reading a property nothing declares.
    for (const name of moduleFiles) {
      const css = stripComments(readFileSync(new URL(name, COMPONENTS_DIR), "utf8"));
      expect(css).not.toContain("--header-height-wrapped");
    }
    expect(globals).not.toContain("--header-height-wrapped");
  });
});
