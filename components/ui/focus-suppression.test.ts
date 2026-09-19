import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { describe, expect, it } from "vitest";
import { stripComments } from "@/lib/test-support/strip-comments";
import { repoRoot, walk } from "@/lib/test-support/import-closure";

/**
 * A SUPPRESSED OUTLINE MUST BE REPLACED, NOT JUST REMOVED.
 *
 * ## What changed under this test (T-053)
 *
 * `app/globals.css`'s `:focus-visible` used to sit outside every `@layer`, which in CSS beats
 * every rule in `@layer utilities` regardless of specificity. All 26 `outline-none` class strings
 * in this repo were therefore inert: a component that asked for its own ring got BOTH, its ring
 * and the global teal outline concentrically, and the rule's `border-radius: 4px` travelled to
 * every focused element -- `site-search`'s trigger measured `rounded-lg` 10px unfocused and 4px
 * focused. T-041 knew the rule was unlayered and exempted it from
 * `components/globals-unlayered-css.test.ts` deliberately, reasoning that a layer "would let ANY
 * component utility silently defeat the site's one guaranteed keyboard-focus ring". That was
 * right about the risk and wrong about the remedy: the guarantee it bought was a guarantee of the
 * WRONG rendering. This file is the remedy that costs nothing, and it is why the move was safe.
 *
 * ## The rule, and why the unit is a DECLARATION and not a file
 *
 * A suppression must sit in the same top-level declaration as a focus treatment. The first
 * version of this file asked the question per FILE and was vacuous on the exact defect it was
 * written for: `components/ui/tabs.tsx` holds `TabsTrigger` (the offender) and `TabsContent`
 * (which carries `focus-visible:ring-3` for its panel), so a file-level scan saw a treatment and
 * passed. The mutation check caught that -- putting `outline-none` back on `TabsTrigger` left the
 * suite green -- which is the whole reason this repo runs one on every new counter.
 *
 * A declaration is the right unit because it is the smallest one that still holds a cva's base
 * string AND its variants together: `ui/input.tsx` suppresses in `cva`'s base argument and
 * replaces in `variants.invalid`/`variants.state` a dozen lines below, and both belong to the
 * same `const inputVariants = ...`. Anything finer (a class string) would red on that correct
 * file; anything coarser (a file) reds on nothing.
 *
 * ## What a green run proves, and what it does not
 *
 * Green means no top-level declaration suppresses the outline without also writing a focus
 * treatment, exemptions aside. It does NOT prove the treatment lands on the same ELEMENT as the
 * suppression -- a declaration can render several -- and it cannot: that is a rendered-geometry
 * question, and this repo has learned twice (T-046, T-047) that a source scanner cannot answer
 * one. The browser round recorded in
 * `docs/superpowers/plans/2026-09-20-t053-focus-visible-layer.md` covers that half.
 * `components/ui/token-binding.test.ts` is the precedent for pairing a source rule with a named
 * exemption list rather than pretending the scan is complete.
 */

/** Tailwind's suppression spellings, bare and prefixed, including the `!` important form. */
const SUPPRESSION = /(?:^|[\s"'`])(?:[\w-]+:)*outline-none!?(?![\w-])/;

/**
 * Anything that makes focus visible. `focus:` as well as `focus-visible:` because
 * `ui/custom-select.tsx` uses the former; `focus-within:` and `has-[input:focus]:` because a row
 * owning its input's ring is this repo's documented pattern (`search-combobox.tsx`).
 */
const TREATMENT =
  /(?:focus-visible:|focus:|focus-within:|has-\[input:focus\]:)(?:ring|outline-(?!none)|border|stroke|scale|bg|shadow|text)/;

interface Exemption {
  readonly file: string;
  /** The exempt declaration's first line, as {@link uncoveredIn} reports it. */
  readonly declaration: string;
  readonly reason: string;
}

/**
 * The declarations allowed to suppress with no treatment of their own. Each names WHY focus is
 * still visible, or why DOM focus never lands on the suppressed element.
 *
 * Keyed by DECLARATION and not by file, so exempting one does not blind the scanner to a second,
 * unrelated suppression appearing in the same file later. `search-combobox.tsx` is exactly that
 * risk: `INPUT` below is legitimately exempt, and the v2 dialog input a few hundred lines down
 * is the site T-053 had to fix.
 */
const EXEMPTIONS: readonly Exemption[] = [
  {
    file: "components/ui/dialog.tsx",
    declaration: "const dialogContentVariants = cva(",
    reason:
      "The suppression is on the dialog PANEL, which Base UI focuses programmatically when it " +
      "opens. Tab never lands there, so a ring could not tell a keyboard user 'you are here' -- " +
      "it would draw a box around a page-sized region. Exactly the case app/globals.css already " +
      'sanctions for `:where([tabindex="-1"]):focus-visible`, with the same reasoning.',
  },
  {
    file: "components/site-search/search-combobox.tsx",
    declaration: "const INPUT =",
    reason:
      "The row owns the ring, on purpose and measured: `INPUT_ROW`, the declaration immediately " +
      "above, carries `has-[input:focus]:outline-3 has-[input:focus]:outline-offset-2 " +
      "has-[input:focus]:outline-ring`, and that file's own docblock records why the inner ring " +
      "is suppressed with `!` rather than plainly. A separate declaration, so the scanner is " +
      "right to see the two apart -- this entry is what puts them back together.",
  },
];

const EXEMPT_KEYS = new Set(EXEMPTIONS.map((e) => `${e.file}  ->  ${e.declaration}`));

const SCAN_ROOTS = ["components", "app"] as const;

function productSources(): string[] {
  return SCAN_ROOTS.flatMap((root) => walk(`${repoRoot}${root}`)).filter(
    (file) => !file.includes(".test."),
  );
}

/**
 * Split a module into its top-level declarations. A new block opens at every line that starts a
 * declaration in column zero, which is what Prettier guarantees for this repo. Everything before
 * the first one (imports, module docblock) is a block too, so nothing is dropped.
 */
const DECLARATION_START =
  /^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function|const|let|var|class)\s/;

export function declarationsOf(source: string): string[] {
  const blocks: string[] = [];
  let current: string[] = [];
  for (const line of source.split("\n")) {
    if (DECLARATION_START.test(line) && current.length > 0) {
      blocks.push(current.join("\n"));
      current = [];
    }
    current.push(line);
  }
  if (current.length > 0) blocks.push(current.join("\n"));
  return blocks;
}

const suppresses = (source: string) => SUPPRESSION.test(source);

/** Every declaration in `file` that suppresses the outline and replaces it with nothing. */
function uncoveredIn(file: string): string[] {
  return declarationsOf(stripComments(readFileSync(file, "utf8")))
    .filter((block) => suppresses(block) && !TREATMENT.test(block))
    .map((block) => block.split("\n")[0]!.trim().slice(0, 72));
}

const rel = (file: string) => relative(repoRoot, file);

describe("every outline suppression has a replacement", () => {
  it("no declaration suppresses the focus outline without also making focus visible", () => {
    const offenders = productSources()
      .flatMap((file) => uncoveredIn(file).map((head) => `${rel(file)}  ->  ${head}`))
      .filter((key) => !EXEMPT_KEYS.has(key))
      .sort();

    expect(
      offenders,
      "these declarations remove the focus outline and put nothing visible in its place. Since " +
        "T-053 moved `:focus-visible` into `@layer base`, `outline-none` actually works -- so " +
        "this is a control a keyboard user cannot see. Either drop the suppression and take the " +
        "site default (3px var(--ring), docs/design.md), or add a focus treatment to the same " +
        "declaration, or add an exemption above saying why focus is still visible.",
    ).toEqual([]);
  });
});

describe("the scanner itself", () => {
  it("reaches a real, non-trivial slice of the surface -- anti-vacuity", () => {
    expect(productSources().length).toBeGreaterThan(100);
  });

  it("still finds suppressions on the live tree -- anti-vacuity", () => {
    const suppressing = productSources().filter((file) =>
      suppresses(stripComments(readFileSync(file, "utf8"))),
    );
    expect(suppressing.length).toBeGreaterThan(5);
  });

  it("splits a module into its top-level declarations, keeping the preamble", () => {
    const sample = ["import x from 'y';", "", "const A = 1;", "function B() {}", "class C {}"].join(
      "\n",
    );
    expect(declarationsOf(sample)).toEqual([
      "import x from 'y';\n",
      "const A = 1;",
      "function B() {}",
      "class C {}",
    ]);
  });

  it("keeps a cva base string and its variants in ONE block -- the ui/input.tsx shape", () => {
    const sample = [
      'const v = cva("focus-visible:outline-none", {',
      "  variants: {",
      '    state: { default: "focus-visible:ring-3" },',
      "  },",
      "});",
    ].join("\n");
    expect(declarationsOf(sample)).toHaveLength(1);
    expect(uncoveredInSource(sample)).toEqual([]);
  });

  it("separates two sibling components -- the ui/tabs.tsx shape this file was vacuous on", () => {
    const sample = [
      'function Trigger() { return <b className="outline-none" />; }',
      'function Content() { return <b className="focus-visible:ring-3" />; }',
    ].join("\n");
    expect(uncoveredInSource(sample)).toEqual([
      'function Trigger() { return <b className="outline-none" />; }',
    ]);
  });

  it("recognises a treatment -- positive control", () => {
    expect(TREATMENT.test('className="outline-none focus-visible:ring-2"')).toBe(true);
    expect(TREATMENT.test('className="outline-none focus-within:ring-4"')).toBe(true);
    expect(TREATMENT.test('className="outline-none focus:border-primary"')).toBe(true);
  });

  it("does not mistake the suppression itself for a treatment -- negative control", () => {
    expect(TREATMENT.test('className="focus-visible:outline-none"')).toBe(false);
  });

  it("recognises every spelling of the suppression -- positive control", () => {
    expect(suppresses('className="outline-none"')).toBe(true);
    expect(suppresses('className="focus-visible:outline-none"')).toBe(true);
    expect(suppresses('"focus-visible:outline-none!"')).toBe(true);
    expect(suppresses("`a outline-none b`")).toBe(true);
  });

  it("does not fire on a word that merely contains the token -- negative control", () => {
    expect(suppresses('className="outline-none-ish"')).toBe(false);
    expect(suppresses('className="my-outline-none"')).toBe(false);
  });

  it("every exemption is still NEEDED -- a stale one hides a regression", () => {
    for (const exemption of EXEMPTIONS) {
      expect(
        uncoveredIn(`${repoRoot}${exemption.file}`),
        `${exemption.file}'s "${exemption.declaration}" is no longer an uncovered suppression ` +
          "(renamed, or it grew a focus treatment); drop or retarget the exemption",
      ).toContain(exemption.declaration);
    }
  });
});

/** Test-local mirror of {@link uncoveredIn} for synthetic sources. */
function uncoveredInSource(source: string): string[] {
  return declarationsOf(stripComments(source))
    .filter((block) => suppresses(block) && !TREATMENT.test(block))
    .map((block) => block.split("\n")[0]!.trim().slice(0, 72));
}
