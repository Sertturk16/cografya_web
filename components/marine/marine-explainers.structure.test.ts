import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * STRUCTURAL SHIELD for the FAQ accordion's own central claim (TEST121-I1).
 *
 * `marine-explainers.tsx`'s own docblock names the architecture's whole reason for existing:
 * every answer paragraph stays in the first-response HTML regardless of open/closed state,
 * because `<details>` needs no script — the risk of losing that is to a HUMAN (no-JS reader,
 * AT user), not to SEO (a crawler reads closed markup the same as open). Nothing asserted that
 * this stays true. The repo has already lived this exact regression once:
 * `components/site-nav/nav-disclosure.test.ts`'s own docblock describes a prior case where
 * `{open && children}` removed every hub link from the first HTML response while `typecheck`,
 * `lint`, `test`, `build` and an unchanged visual sample all stayed green — because nothing
 * asserted the links were unconditional. This file is that same guard for the accordion — and,
 * unlike the nav-disclosure incident, this component is a SERVER component today: the
 * regression this guard exists to catch must first go client (`"use client"` + `useState`),
 * which is why that half of the guard is checked as its own, separate assertion.
 *
 * WHY IT READS SOURCE INSTEAD OF RENDERING. `vitest.config.ts` runs `environment: "node"` with
 * no jsdom/`@testing-library`, so no test in this repo can render a component or dispatch a DOM
 * event. A source-level invariant is the honest version of the same guard — the same shape
 * `nav-disclosure.test.ts` and `entity-index.structure.test.ts` already use for this class of
 * risk. It does not claim to prove what the DOM ends up looking like; the empirical half is the
 * curl-check on the rendered page, part of this fix round's own verification.
 *
 * THE BAN IS SHAPE-ANCHORED, NOT NAME-ANCHORED. An earlier draft matched only the literal
 * identifier `open` and missed `isOpen` — the very name a real client-state rewrite would
 * plausibly use. `GATES_EXPLAINER_BODY` below matches `{<any identifier> && … explainerBody …}`
 * regardless of what the identifier is called.
 *
 * THE POSITIVE CONTROL IS HAND-WRITTEN, NOT DERIVED FROM `SOURCE`. Building it via
 * `SOURCE.replace(pattern, wrap(pattern))` leaves the original pattern embedded, intact, inside
 * the "regressed" string — so a `.not.toMatch(pattern)` assertion against it never goes red for
 * the intended reason. The control here is a small literal, independent of the real file, and
 * the assertion checks the BAN's own boolean result against it directly.
 *
 * Structural only (`CONVENTIONS.md` §2): asserts a shape, never the copy inside it.
 */

function sourceOf(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n");
}

const SOURCE = code(sourceOf("./marine-explainers.tsx"));

/** `{<identifier> && … explainerBody …}` for ANY identifier — see docblock above. */
const GATES_EXPLAINER_BODY = /\{\s*[A-Za-z_$][\w$]*\s*&&[^}]*explainerBody/;

describe("the FAQ accordion renders every answer unconditionally", () => {
  it("is a server component: no client directive, no client state", () => {
    expect(SOURCE).not.toMatch(/["']use client["']/);
    expect(SOURCE).not.toMatch(/\buseState\b/);
  });

  it("never gates the answer paragraph behind open/closed state", () => {
    expect(SOURCE).toMatch(/<p className=\{styles\.explainerBody\}>\{explainer\.answer\}<\/p>/);
    expect(GATES_EXPLAINER_BODY.test(SOURCE)).toBe(false);
    expect(SOURCE).not.toMatch(/open\s*\?[^:]*explainer\.answer/);
    expect(SOURCE).not.toMatch(/hidden=\{/);
  });

  it("positive control: the ban actually fires on the regression shape it exists to catch", () => {
    const control = "{isOpen && <p className={styles.explainerBody}>{explainer.answer}</p>}";
    expect(GATES_EXPLAINER_BODY.test(control)).toBe(true);
  });
});
