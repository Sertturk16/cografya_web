import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stripCssComments } from "@/lib/test-support/strip-comments";

/**
 * THE BUG CLASS (T-041, born from T-035 PR1's Task 3 finding): a rule declared OUTSIDE every
 * `@layer` beats EVERY rule inside `@layer utilities`, regardless of specificity — that is how
 * CSS cascade layers work, not a quirk of this file. `app/globals.css` used to carry ~360 lines
 * of exactly that, sitting between the FIRST `@layer base { … }` closing and a SECOND
 * `@layer base { … }` re-opening near the end of the file. Nothing about that failure is loud:
 * no error, no warning, the page renders — a Tailwind utility written next to one of those
 * classes simply never took effect. `.container` (1120px, no product consumer left) had
 * already done exactly this once, silently rendering five hero bands at the wrong width
 * (T-035 PR1 Task 3).
 *
 * This file is the tripwire: it counts every rule outside any `@layer` in `app/globals.css`
 * and fails the moment that count grows past the named exemptions below. It cannot fail by
 * going to zero and staying there quietly — see the mutation check recorded in
 * `.superpowers/sdd/t-041-unlayered-css-report.md`, which is the manual counterpart to the
 * automated positive controls in "the scanner itself" below (the same split
 * `components/v2/page-composition.test.ts` uses: automated checks that the SCANNER works,
 * a manual mutation check recorded in prose that the ASSERTION would actually go red).
 *
 * ## What "a rule" means here
 *
 * The scanner (`findUnlayeredRules` below) walks the file once, comment-stripped, tracking
 * brace nesting from the top. At each level:
 *
 *   - a block whose prelude starts with `@layer` is skipped WITHOUT descending — everything
 *     nested inside a layer stays in that layer, including a further `@media`/`@supports`
 *     nested inside it, so there is nothing unlayered left to find under one;
 *   - a block whose prelude starts with `@media` or `@supports` (the two CSS "grouping"
 *     conditionals that do NOT establish a layer of their own) is walked INTO, and whatever
 *     rules sit inside it are reported with a `parent > child` label, because those rules are
 *     just as unlayered as one written at the top level;
 *   - anything else — a plain selector, or a leaf at-rule like `@theme` whose body is a flat
 *     property list rather than nested rules — is reported as one rule, labelled by its exact
 *     (whitespace-collapsed) prelude text.
 *
 * ## SCOPE — what this scanner cannot see
 *
 *   - It only recognises braces and the two grouping at-rules above. Native CSS nesting
 *     (`.a { .b { color: red; } }`) is not used anywhere in this file today; if it ever were,
 *     a nested selector inside a PLAIN top-level rule would be swallowed into that rule's
 *     `body` text rather than reported as its own entry.
 *   - `@import`ed stylesheets (`tailwindcss`, `tw-animate-css`, `shadcn/tailwind.css`) are not
 *     followed — only the text of `app/globals.css` itself is scanned. Tailwind's own preflight
 *     lives inside ITS `@layer base`, which is a different file this scanner never opens.
 *   - It counts unlayered rule PRESENCE, which is what enables the bug class. It does not
 *     prove any given rule has actually collided with a specific utility — `.container` only
 *     became a live defect once a page's `className` happened to use the same word.
 *   - `@theme inline`'s body is treated as one leaf rule because Tailwind's `@theme` grammar
 *     does not support nested selectors; if that ever changed, a nested rule inside it would
 *     be invisible to this scanner for the same reason native nesting is.
 */

const GLOBALS_PATH = fileURLToPath(new URL("../app/globals.css", import.meta.url));
const RAW_CSS = readFileSync(GLOBALS_PATH, "utf8");
const CSS = stripCssComments(RAW_CSS);

const GROUPING_AT_RULES = new Set(["@media", "@supports"]);

interface CssRule {
  /** The rule's own prelude, whitespace-collapsed; nested under a grouping at-rule this is
   *  `"<parent prelude> > <child prelude>"`. */
  readonly label: string;
  /** Everything between this rule's own braces, comment-stripped, NOT further collapsed —
   *  exemption liveness checks read real declarations out of this. */
  readonly body: string;
}

function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Returns the index just past the `}` that matches the `{` at `openBraceIndex`. */
function matchingBraceEnd(text: string, openBraceIndex: number): number {
  let depth = 1;
  let i = openBraceIndex + 1;
  while (i < text.length && depth > 0) {
    if (text[i] === "{") depth += 1;
    else if (text[i] === "}") depth -= 1;
    i += 1;
  }
  return i;
}

function scanLevel(css: string, labelPrefix: string): CssRule[] {
  const found: CssRule[] = [];
  let cursor = 0;
  for (;;) {
    const openBrace = css.indexOf("{", cursor);
    if (openBrace === -1) break;
    // Only the text since the last top-level `;` is the real prelude — semicolon-terminated
    // at-rules with no block of their own (`@import "…";`, `@custom-variant dark (…);`) must
    // not glue onto the next block's prelude.
    const preludeRaw = css.slice(cursor, openBrace);
    const lastSemi = preludeRaw.lastIndexOf(";");
    const prelude = collapse(lastSemi === -1 ? preludeRaw : preludeRaw.slice(lastSemi + 1));
    const closeAfter = matchingBraceEnd(css, openBrace);
    const body = css.slice(openBrace + 1, closeAfter - 1);
    const atKeyword = prelude.match(/^@[a-zA-Z-]+/)?.[0];
    const label = labelPrefix === "" ? prelude : `${labelPrefix} > ${prelude}`;

    if (atKeyword === "@layer") {
      // Skip entirely — do not descend. Everything nested here, at any depth, stays layered.
    } else if (atKeyword !== undefined && GROUPING_AT_RULES.has(atKeyword)) {
      found.push(...scanLevel(body, label));
    } else if (prelude !== "") {
      found.push({ label, body });
    }
    cursor = closeAfter;
  }
  return found;
}

export function findUnlayeredRules(css: string): CssRule[] {
  return scanLevel(css, "");
}

/** True when every declaration in `body` is a custom property (`--x: y;`) — never a real
 *  rendered style. `:root`/`.light`, `.dark` and `.dark .climate-dark-scope` all lean on this:
 *  being unlayered only matters for declarations that could otherwise beat a Tailwind utility,
 *  and a custom property assignment competes with nothing a `className` ever writes directly. */
function isOnlyCustomProperties(body: string): boolean {
  const declarations = body
    .split(";")
    .map((d) => d.trim())
    .filter((d) => d.length > 0);
  return declarations.length > 0 && declarations.every((d) => d.startsWith("--"));
}

interface UnlayeredExemption {
  readonly label: string;
  readonly reason: string;
  /** Re-checks the SPECIFIC property that makes the exemption still true, not just presence —
   *  the same shape `token-binding.test.ts`'s `ACHROMATIC_EXEMPTIONS` liveness check uses. */
  readonly liveness: (rule: CssRule) => void;
}

const EXEMPTIONS: readonly UnlayeredExemption[] = [
  {
    label: ":root, .light",
    reason:
      "The whole Terra token bridge. Every declaration is a custom property, never a rendered " +
      "style, so no utility competes with it directly regardless of layer.",
    liveness: (rule) => expect(isOnlyCustomProperties(rule.body)).toBe(true),
  },
  {
    label: ".dark",
    reason:
      "OUT OF SCOPE per the T-041 task brief: it contains only custom-property declarations " +
      "(same shape as :root above) and :root is itself unlayered, so being unlayered here is " +
      "what lets it override :root's values at all — moving it into a layer would make it LOSE " +
      "to the still-unlayered :root the instant a page switches to dark mode.",
    liveness: (rule) => expect(isOnlyCustomProperties(rule.body)).toBe(true),
  },
  {
    label: ".dark .climate-dark-scope",
    reason:
      "Same shape and same reason as .dark: it exists ONLY to shadow four raw Terra custom " +
      "properties (--color-ink/-slate/-surface/-border) for climate.module.css's frozen table, " +
      "one consumer (app/[locale]/(site)/turkiye/[slug]/page.tsx). Those raw tokens are declared " +
      "in the unlayered :root block, so an override of them must ALSO be unlayered to win — " +
      "moving this into a layer would silently revert that table to its light-mode ink colour " +
      "in dark mode (the exact 1.20:1 contrast defect this scope was written to fix).",
    liveness: (rule) => expect(isOnlyCustomProperties(rule.body)).toBe(true),
  },
  {
    label: ":focus-visible",
    reason:
      "Deliberately unlayered, not an oversight — the file's own comment above this rule and " +
      'above :where([tabindex="-1"]):focus-visible works out the specificity math against ' +
      "`@layer base`'s `outline-ring/50` and against module-level focus rings. Moving it into a " +
      "layer would let ANY component utility silently defeat the site's one guaranteed " +
      "keyboard-focus ring — a worse regression than the bug this tripwire exists to catch.",
    liveness: (rule) => expect(rule.body).toContain("outline"),
  },
  {
    label: ':where([tabindex="-1"]):focus-visible',
    reason:
      "Sibling of :focus-visible above, same reasoning: `:where()` is used specifically to hold " +
      "this rule's specificity at zero while staying unlayered, a combination a layer cannot " +
      "reproduce.",
    liveness: (rule) => expect(rule.body).toContain("outline"),
  },
  {
    label: "@media (prefers-reduced-motion: reduce) > *",
    reason:
      "Every declaration inside carries !important. Per the CSS Cascade Layers spec, unlayered " +
      "important declarations have the LOWEST priority among important declarations — the " +
      "OPPOSITE bug direction from every other exemption here, and also the opposite of the " +
      "plain-unlayered-always-wins rule this whole file is about. Today it is moot (zero " +
      "product classNames use Tailwind's `!` important modifier, so nothing layered competes " +
      "for these three properties), but moving it would not make it MORE correct, only rename " +
      "which direction of the same spec footnote applies — left in place per the coordinating " +
      "brief for this task, which also asks that its behaviour not be touched at all " +
      "(docs/design.md's reduced-motion note).",
    liveness: (rule) => {
      const declarations = rule.body
        .split(";")
        .map((d) => d.trim())
        .filter((d) => d.length > 0);
      expect(declarations.length).toBeGreaterThan(0);
      expect(declarations.every((d) => d.endsWith("!important"))).toBe(true);
    },
  },
  {
    label: "@theme inline",
    reason:
      "Not a cascade rule at all — Tailwind v4's build-time theme-token directive, consumed by " +
      "the Tailwind compiler to register `bg-primary`/`text-foreground`/etc. It has no selector " +
      "and never competes with a utility class in the browser's cascade; every declaration " +
      "inside is a custom property, same shape as :root.",
    liveness: (rule) => expect(isOnlyCustomProperties(rule.body)).toBe(true),
  },
];

const ALL_RULES = findUnlayeredRules(CSS);
const EXEMPT_LABELS = new Set(EXEMPTIONS.map((e) => e.label));
const NON_EXEMPT = ALL_RULES.filter((r) => !EXEMPT_LABELS.has(r.label));

/**
 * EXACT, not a ceiling — `docs/design.md` and `components/v2/page-composition.test.ts` both
 * record what a ceiling is worth here: a count that only ever gets checked against "not more
 * than before" lets a number drift upward one small change at a time with nobody noticing,
 * which is exactly how this file grew to ~360 unlayered lines in the first place.
 *
 * MUTATION-CHECKED — see `.superpowers/sdd/t-041-unlayered-css-report.md` for the verbatim
 * RED (naming the reintroduced selector) and GREEN (after reverting) output.
 */
export const UNLAYERED_CSS_RULES = 0;

describe("the scanner itself", () => {
  it("positive control — read the real file and it is not trivially small", () => {
    expect(RAW_CSS.length).toBeGreaterThan(20_000);
    expect(RAW_CSS).toContain("@layer base");
    expect(RAW_CSS).toContain("@layer utilities");
  });

  it("positive control — comments were actually stripped before scanning", () => {
    // `app/globals.css` documents this exact scanner's own reasoning inside a comment that
    // quotes CSS-shaped text (".container", ".btn-primary", etc.) — if comment-stripping were
    // broken, those quoted class names would leak in as phantom rules.
    expect(RAW_CSS).toMatch(/\/\*[\s\S]*T-041[\s\S]*\*\//);
    expect(CSS).not.toContain("T-041");
  });

  it("a rule INSIDE @layer base is not reported as unlayered", () => {
    // `body`, `html` and `*` all appear TWICE in the real file — once unlayered (moved into a
    // layer by this task) and, before this task, nowhere layered. After this task both real
    // occurrences of each are inside a layer, so none should be reported at all.
    expect(ALL_RULES.some((r) => r.label === "body")).toBe(false);
    expect(ALL_RULES.some((r) => r.label === "html")).toBe(false);
    expect(ALL_RULES.some((r) => r.label === "*")).toBe(false);
  });

  it("descends into a non-layer @media block and labels the nested rule", () => {
    const sample = "@media (min-width: 1px) { .foo { color: red; } }";
    expect(findUnlayeredRules(sample)).toEqual([
      { label: "@media (min-width: 1px) > .foo", body: " color: red; " },
    ]);
  });

  it("does not descend into @layer at all, even when it wraps a @media", () => {
    const sample = "@layer base { @media (min-width: 1px) { .foo { color: red; } } }";
    expect(findUnlayeredRules(sample)).toEqual([]);
  });

  it("reports a plain top-level selector", () => {
    const sample = ".foo { color: red; }";
    expect(findUnlayeredRules(sample)).toEqual([{ label: ".foo", body: " color: red; " }]);
  });

  it("does not glue a semicolon-terminated at-rule onto the next block's prelude", () => {
    const sample = '@import "x"; @custom-variant dark (&:is(.dark *)); .foo { color: red; }';
    expect(findUnlayeredRules(sample)).toEqual([{ label: ".foo", body: " color: red; " }]);
  });

  it("a rule hidden inside a comment is invisible once comments are stripped", () => {
    const sample = "/* .foo { color: red; } */";
    expect(findUnlayeredRules(stripCssComments(sample))).toEqual([]);
  });
});

describe("app/globals.css has no unlayered rule outside the named exemptions", () => {
  it("has exactly the recorded number, exemptions aside", () => {
    expect(
      NON_EXEMPT.length,
      `unlayered, non-exempt rules found:\n${NON_EXEMPT.map((r) => `  ${r.label}`).join("\n")}`,
    ).toBe(UNLAYERED_CSS_RULES);
  });
});

describe("every named exemption is still live", () => {
  it.each(EXEMPTIONS)("$label", (exemption) => {
    // A stale exemption hides a real regression just as effectively as a missing rule — the
    // same guard `token-binding.test.ts` runs for `ACHROMATIC_EXEMPTIONS`.
    const rule = ALL_RULES.find((r) => r.label === exemption.label);
    expect(rule, `${exemption.label} is no longer unlayered; drop the exemption`).toBeDefined();
    exemption.liveness(rule!);
  });

  it("names no exemption that isn't actually reachable by the scanner — positive control", () => {
    expect(EXEMPTIONS.length).toBeGreaterThan(0);
    expect(EXEMPT_LABELS.size).toBe(EXEMPTIONS.length);
  });
});
