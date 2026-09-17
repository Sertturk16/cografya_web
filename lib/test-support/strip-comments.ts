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
 * NOT a parser. Regex literals are not tracked, so a regex whose body contains an escaped comment
 * opener would still be read as one. No file scanned by these tests contains such a literal; if
 * that changes, this function is the place to fix it, once, rather than in each test.
 */
export function stripComments(source: string): string {
  let out = "";
  let i = 0;

  while (i < source.length) {
    const ch = source[i]!;
    const next = source[i + 1];

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
    if (ch === '"' || ch === "'" || ch === "`") {
      out += ch;
      i += 1;
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
        if (inner === ch) break;
      }
      continue;
    }

    out += ch;
    i += 1;
  }

  return out;
}
