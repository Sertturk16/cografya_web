import { stripCssComments } from "./strip-comments";

/**
 * The body of the first top-level block whose selector starts with `selector`.
 *
 * Comments are stripped FIRST, the precaution `bridge-tokens.test.ts` took when a prose
 * mention of a selector inside a comment made its parser return the wrong block. Brace
 * counting rather than a regex, because `@media`/`@supports` nest and a non-greedy match to
 * the first `}` would truncate the block at its first nested rule.
 *
 * A second decoy survives comment-stripping because it is not a comment: `app/globals.css:45`
 * reads `@custom-variant dark (&:is(.dark *));` — real, uncommented code that happens to
 * contain the literal substring `.dark`. A naive `indexOf` finds THAT occurrence, walks
 * forward to the next `{` — which belongs to `:root`, hundreds of lines later — and returns
 * `:root`'s body under the name `.dark`, without ever throwing. `map-surface.test.ts` hit
 * exactly this: every `.dark`-selector lookup silently read `:root` instead, and the failure
 * looked like a data mismatch rather than the parser bug it was.
 *
 * What tells a decoy apart from a real selector is a `;`: a genuine selector's own text runs
 * straight into ITS `{` with nothing but whitespace in between, while
 * `@custom-variant dark (&:is(.dark *));` always has a statement-terminating `;` before any
 * `{` appears at all. So each candidate occurrence is checked for a `;` between itself and
 * the next `{`; a decoy is skipped and the search resumes just past it, rather than being
 * accepted (silently wrong) or thrown on immediately (a real block with this selector may
 * still appear later in the file, as `.dark {` does here). The existing "not found" throw
 * still fires once every occurrence — decoy or not — has been exhausted.
 */
export function blockOf(css: string, selector: string): string {
  const stripped = stripCssComments(css);
  let from = 0;
  for (;;) {
    const start = stripped.indexOf(selector, from);
    if (start === -1) throw new Error(`${selector} block not found`);
    const open = stripped.indexOf("{", start);
    const isDecoy = open === -1 || stripped.slice(start, open).includes(";");
    if (isDecoy) {
      from = start + selector.length;
      continue;
    }
    let depth = 0;
    for (let i = open; i < stripped.length; i += 1) {
      if (stripped[i] === "{") depth += 1;
      if (stripped[i] === "}") {
        depth -= 1;
        if (depth === 0) return stripped.slice(open, i);
      }
    }
    throw new Error(`${selector} block never closed`);
  }
}

/**
 * Every custom property one block declares, as `{ "--name": "value" }`.
 *
 * BLOCK-SCOPED, and that is the whole point: a file-wide regex over `app/globals.css` returns
 * the LAST declaration of a name, so once `.dark` redefines a token the light value silently
 * becomes unreadable. Both arms that compare a committed table against the stylesheet go
 * through here so neither can take its two sides from different blocks.
 */
export function tokensIn(css: string, selector: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of blockOf(css, selector).matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)) {
    out[m[1]!] = m[2]!.trim();
  }
  return out;
}

/** Matches a value that is exactly `var(--name)`, no fallback, allowing surrounding whitespace. */
const BARE_VAR = /^\s*var\((--[a-z0-9-]+)\)\s*$/;

/**
 * Resolves one level of `var(--name)` aliasing within a single block's token map.
 *
 * `app/globals.css` uses aliasing as its single-source idiom rather than repeating a hex value —
 * `--map-water: var(--map-sea)` ships today, and later tasks add more of the same shape
 * (`--map-plate: var(--map-sea)`, `--map-context-line: var(--province-stroke)`,
 * `--eq-mag-fg: var(--color-ink-dark)`). A table test that compares `tokensIn(...)` against a
 * committed hex table would otherwise see the literal string `"var(--map-sea)"` where it expects
 * `"#dbe7e8"` and fail for a reason that has nothing to do with the palette being wrong.
 *
 * Deliberately ONE level, not a fixed-point resolve to a hex: recursing would silently flatten a
 * two-level alias into whatever it eventually bottoms out at, which is exactly the kind of
 * silent substitution this file's sibling `tokensIn` was written to stop doing (there, across
 * blocks; here, across alias hops). One level means a two-level chain surfaces as an unresolved
 * `var(--something)` string in a failing `toEqual` against the hex table — a loud, specific
 * failure pointing at the token that needs a second hop, rather than a green test hiding it.
 *
 * A value that is not a bare `var(--name)` (a hex, an `oklch(...)`, a `var(...)` with a
 * fallback, or anything else) passes through unchanged. So does a bare `var(--name)` whose
 * target is absent from `tokens` — that name may simply live in another block (the light block
 * aliasing into a token only `.dark` needs would be the same shape as a genuine typo, and only
 * the caller's table comparison, not this function, is positioned to tell those apart).
 */
export function resolveVars(tokens: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(tokens)) {
    const match = BARE_VAR.exec(value);
    const target = match?.[1];
    out[name] = target !== undefined && target in tokens ? tokens[target]! : value;
  }
  return out;
}
