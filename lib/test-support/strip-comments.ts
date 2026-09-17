/**
 * Strip TypeScript/TSX comments from source text, for the tests that assert page guarantees by
 * reading source (`docs/conventions.md` — nothing under `app/` is collected by vitest, so the
 * only way to bind a page rule is to grep its file, and prose is the thing most likely to contain
 * the string being searched for).
 *
 * ## Why this is a scanner and not two `String.replace` calls
 *
 * The usual form in this repo is
 *
 *     source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ")
 *
 * and it silently deletes live code. `components/v2/v2-sources-section.tsx` carried the line
 * comment
 *
 *     // NO `legalQuote`. The Copernicus Marine notice is single-sourced in `messages/*.json`
 *
 * whose `/*` opens a block comment as far as that regex is concerned, so the "strip" ate 220
 * lines of source up to the next closing delimiter — the whole `deprem` scope among them. A test
 * asserting `not.toContain(...)` over that result passes because the code is gone, which is the
 * same failure the comment-stripping rule exists to prevent, one level down.
 *
 * Swapping the two replaces only moves the hole: a `//` on its own line inside a block comment
 * then terminates nothing and the block's closing delimiter survives into the output.
 *
 * So this walks the text once, tracking which construct it is inside. String and template
 * literals are copied through verbatim (a `//` in a URL literal is not a comment); both comment
 * forms collapse to a single space, so tokens either side never weld into a new identifier.
 *
 * Regex literals are tracked too, for the same reason strings are. `components/v2/v2-rich-prose.tsx`
 * holds `/(\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`)/g`: the backticks in it flipped the
 * scanner into template-literal mode and it copied the next fifteen lines through verbatim,
 * comments and all — the leak this helper exists to close, in the other direction. Eleven tracked
 * files leaked that way, `v2-tool-workbench.tsx` and `tool-png.ts` among them, both already read
 * through this function.
 *
 * NOT a parser. Whether a `/` opens a regex or divides is decided from the previous significant
 * character, the standard heuristic; `<` and `>` are deliberately NOT treated as regex-opening, so
 * JSX text containing a slash stays division. A misread regex bails at the newline rather than
 * running to EOF, so the worst case is a few characters copied through, never a swallowed scope.
 */
export function stripComments(source: string): string {
  return scan(source, 0, false).out;
}

/**
 * Scans from `start`, returning the stripped text and the index it stopped at. With
 * `untilCloseBrace` it is reading a `${…}` interpolation and returns on the brace that closes it.
 */
function scan(source: string, start: number, untilCloseBrace: boolean): { out: string; i: number } {
  let out = "";
  let i = start;
  let depth = 0;

  while (i < source.length) {
    const ch = source[i]!;
    const next = source[i + 1];

    if (untilCloseBrace) {
      if (ch === "}") {
        if (depth === 0) return { out, i };
        depth -= 1;
      } else if (ch === "{") {
        depth += 1;
      }
    }

    // Line comment: to end of line, newline kept so line-anchored assertions still line up.
    if (ch === "/" && next === "/") {
      out += " ";
      while (i < source.length && source[i] !== "\n") i += 1;
      continue;
    }

    // Block comment, JSX `{/* … */}` included — the surrounding braces are harmless punctuation.
    if (ch === "/" && next === "*") {
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) i += 1;
      i += 2; // past the closing delimiter; an unterminated block just runs to EOF
      out += " ";
      continue;
    }

    // String or template literal: copied verbatim, escapes honoured so `\"` does not close it.
    // A template's `${…}` holes are code, not text, so they are scanned rather than copied —
    // `v2-game-screen.tsx` puts a `//` comment inside one, and copying it through would leak the
    // prose this function exists to remove.
    if (ch === '"' || ch === "'" || ch === "`") {
      out += ch;
      i += 1;
      while (i < source.length) {
        const inner = source[i]!;
        if (inner === "\\") {
          out += inner;
          i += 1;
          if (i < source.length) {
            out += source[i]!;
            i += 1;
          }
          continue;
        }
        if (ch === "`" && inner === "$" && source[i + 1] === "{") {
          out += "${";
          const hole = scan(source, i + 2, true);
          out += hole.out;
          i = hole.i;
          continue;
        }
        out += inner;
        i += 1;
        if (inner === ch) break;
      }
      continue;
    }

    // Regex literal: copied verbatim, character classes and escapes honoured so `[/]` and `\/` do
    // not close it. Bails at a newline, so a `/` misread as an opener cannot run away.
    if (ch === "/" && opensRegex(out)) {
      out += ch;
      i += 1;
      let inClass = false;
      while (i < source.length) {
        const inner = source[i]!;
        out += inner;
        i += 1;
        if (inner === "\\") {
          if (i < source.length) {
            out += source[i]!;
            i += 1;
          }
          continue;
        }
        if (inner === "\n") break;
        if (inClass) {
          if (inner === "]") inClass = false;
          continue;
        }
        if (inner === "[") inClass = true;
        else if (inner === "/") break;
      }
      continue;
    }

    out += ch;
    i += 1;
  }

  return { out, i };
}

/** Operators and punctuation after which a `/` can only begin a regex, never divide. */
const REGEX_PRECEDING_PUNCTUATION = new Set("(,=:[!&|?;{+-*%^~".split(""));

/** Keywords after which the same holds. `return /x/` divides nothing. */
const REGEX_PRECEDING_KEYWORDS = new Set([
  "return",
  "typeof",
  "instanceof",
  "in",
  "of",
  "new",
  "delete",
  "void",
  "case",
  "do",
  "else",
  "yield",
  "await",
]);

/**
 * Whether the `/` about to be read opens a regex literal, judged from the last significant
 * character already emitted. Comments emit a space, so the lookback lands on the token before
 * them. `<` and `>` are absent on purpose: `<br />` and `km/h` in JSX text are not regexes.
 */
function opensRegex(out: string): boolean {
  let j = out.length - 1;
  while (j >= 0 && /\s/.test(out[j]!)) j -= 1;
  if (j < 0) return true;

  const ch = out[j]!;
  if (REGEX_PRECEDING_PUNCTUATION.has(ch)) return true;
  if (!/[A-Za-z0-9_$]/.test(ch)) return false;

  let k = j;
  while (k >= 0 && /[A-Za-z0-9_$]/.test(out[k]!)) k -= 1;
  return REGEX_PRECEDING_KEYWORDS.has(out.slice(k + 1, j + 1));
}

/**
 * The CSS half, for the tests that scan `*.module.css` and `app/globals.css`.
 *
 * CSS has exactly one comment form, so this is one `replace` and not a scanner. It is a separate
 * function rather than a reuse of `stripComments` because `//` is NOT a comment in CSS:
 * `url(https://example.org/a.png)` would lose the rest of its line, and
 * `components/book/bench.structure.test.ts` had already written that reason down beside its own
 * pair of strips. No stylesheet in the tree contains a `//` today, so the two agree right now —
 * which is precisely why the wrong one would be adopted silently.
 */
export function stripCssComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ");
}
