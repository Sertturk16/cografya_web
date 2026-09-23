import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { maskComments, stripComments, stripCssComments } from "./strip-comments";

/**
 * The stripper other source-text tests depend on, so its own failure modes are pinned here
 * rather than discovered as a green assertion somewhere else.
 *
 * The two cases that matter are the ones the repo's usual regex form gets wrong, and both are
 * taken from real files: a line comment containing a glob (`messages/*.json`) and a block comment
 * containing what looks like a line comment.
 */
describe("stripComments", () => {
  it("removes both comment forms", () => {
    expect(stripComments("const a = 1; // trailing\nconst b = 2;")).toContain("const b = 2;");
    expect(stripComments("const a = 1; // trailing\nconst b = 2;")).not.toContain("trailing");
    expect(stripComments("/* head */ const a = 1;")).not.toContain("head");
    expect(stripComments("{/* jsx */}\nconst a = 1;")).not.toContain("jsx");
  });

  it("does not let a glob inside a LINE comment swallow the code after it", () => {
    const source = ["// single-sourced in `messages/*.json`", 'const kept = "value";'].join("\n");
    expect(stripComments(source)).toContain('const kept = "value";');
  });

  it("does not let a line comment inside a BLOCK comment leak the block's tail", () => {
    const source = ["/**", " * see also", " // not a line comment here", " */", "const kept = 1;"]
      .join("\n")
      .concat("\n");
    const stripped = stripComments(source);
    expect(stripped).toContain("const kept = 1;");
    expect(stripped).not.toContain("see also");
    expect(stripped).not.toContain("not a line comment");
  });

  it("leaves comment-looking text inside string and template literals alone", () => {
    expect(stripComments('const url = "https://example.org/a";')).toContain(
      'const url = "https://example.org/a";',
    );
    expect(stripComments("const glob = `messages/*.json`;")).toContain("messages/*.json");
    expect(stripComments('const escaped = "a \\" // b";')).toContain("// b");
  });

  it("does not let a quote inside a REGEX literal swallow the comments after it", () => {
    const source = [
      'const token = /(`([^`]+)`|"([^"]+)")/g;',
      "// Push preceding plain text",
      "const kept = 1;",
    ].join("\n");
    const stripped = stripComments(source);
    expect(stripped).toContain("const kept = 1;");
    expect(stripped).not.toContain("Push preceding plain text");
  });

  it("keeps a regex body verbatim, character classes and escapes included", () => {
    expect(stripComments("const re = /[/]\\//g;")).toContain("/[/]\\//g");
    expect(stripComments("const re = /a\\/\\/b/;\n// gone")).toContain("/a\\/\\/b/");
    expect(stripComments("const re = /a\\/\\/b/;\n// gone")).not.toContain("gone");
  });

  it("reads a slash after a value or in JSX text as division, not as a regex opener", () => {
    expect(stripComments("const ratio = total / count; // note")).toContain("total / count;");
    expect(stripComments("const ratio = total / count; // note")).not.toContain("note");
    expect(stripComments("<p>km/h</p>\n// gone\nconst kept = 1;")).toContain("const kept = 1;");
    expect(stripComments("<br />\n// gone\nconst kept = 1;")).toContain("const kept = 1;");
  });

  it("strips comments inside a template literal's `${}` holes but not its text", () => {
    const source = [
      "const cls = `base ${",
      "  // fullscreen fallback",
      "  wide ? `a ${inner} b` : `c`",
      "} tail`;",
    ].join("\n");
    const stripped = stripComments(source);
    expect(stripped).not.toContain("fullscreen fallback");
    expect(stripped).toContain("base ${");
    expect(stripped).toContain("} tail`");
    expect(stripped).toContain("`a ${inner} b`");
    expect(stripComments("const s = `a // b`;")).toContain("`a // b`");
    expect(stripComments("const s = `a /* b */ c`;")).toContain("`a /* b */ c`");
  });

  it("separates the tokens a comment stood between, so they cannot weld into a new one", () => {
    expect(stripComments("id/* x */Name")).toBe("id Name");
    expect(stripComments("id// x\nName")).toBe("id \nName");
  });

  it("survives an unterminated block comment instead of looping", () => {
    expect(stripComments("const a = 1; /* never closed")).toBe("const a = 1;  ");
  });

  it("leaves a CSS `url()` alone, which is why stylesheets get their own strip", () => {
    const rule = ".a { background: url(https://example.org/a.png); /* why */ color: red; }";
    expect(stripCssComments(rule)).toContain("url(https://example.org/a.png)");
    expect(stripCssComments(rule)).toContain("color: red");
    expect(stripCssComments(rule)).not.toContain("why");
    // The JS scanner would read the `//` as a line comment and lose the rest of the rule.
    expect(stripComments(rule)).not.toContain("color: red");
  });

  it("keeps every entry of a scoped list whose middle carries a glob line comment", () => {
    // The shape of the deleted `v2-sources-section.tsx` that first broke the naive regex: the
    // glob's `/*` opened a "block" that ran to the next docblock and ate the `deprem` scope.
    const source = [
      "/**",
      " * NO `general` SCOPE.",
      " */",
      "const SOURCES = {",
      '  home: [{ id: "tuik" }],',
      "  deniz: [",
      "    // NO `legalQuote`. The notice is single-sourced in `messages/*.json`",
      '    { id: "cmems" },',
      "  ],",
      '  deprem: [{ id: "afad-deprem" }],',
      "};",
      "/** trailing docblock */",
      "export default SOURCES;",
    ].join("\n");
    const stripped = stripComments(source);

    for (const scope of ["home", "deniz", "deprem"]) {
      expect(stripped, `${scope} scope key`).toContain(`  ${scope}: [`);
    }
    expect(stripped).toContain('id: "afad-deprem"');
    expect(stripped).toContain("export default SOURCES;");
    // …and the prose really is gone.
    expect(stripped).not.toContain("NO `general` SCOPE");
    expect(stripped).not.toContain("single-sourced");
    // Control: the naive two-replace form this scanner replaces DOES eat the `deprem` scope.
    const naive = source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");
    expect(naive).not.toContain('id: "afad-deprem"');
  });
});

/** 1-based line of `offset` in `text`, the number a counter would print as `file:line`. */
function lineAt(text: string, offset: number): number {
  return text.slice(0, offset).split("\n").length;
}

/**
 * The invariant `maskComments` exists for: same length, every line break where it was, and every
 * character that is not a comment copied through. A comment character may only become a space.
 */
function expectLinePreservingMask(source: string, masked: string, label = "source"): void {
  expect(masked.length, `${label}: length`).toBe(source.length);
  let firstBad = -1;
  for (let i = 0; i < source.length && firstBad < 0; i += 1) {
    const original = source[i]!;
    const kept = masked[i]!;
    const lineBreak = original === "\n" || original === "\r";
    if (lineBreak ? kept !== original : kept !== original && kept !== " ") firstBad = i;
  }
  expect(firstBad, `${label}: first offset that is neither copied nor blanked`).toBe(-1);
}

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const NOT_SOURCE = new Set([".git", ".next", "node_modules", "public", "coverage", "dist"]);

function walkSources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      return NOT_SOURCE.has(entry.name) ? [] : walkSources(join(dir, entry.name));
    }
    return entry.name.endsWith(".ts") || entry.name.endsWith(".tsx") ? [join(dir, entry.name)] : [];
  });
}

/**
 * `stripComments` collapses a comment to one space, so every line number computed from its output
 * after a multi-line block comment is short by the block's height. `maskComments` is the variant a
 * counter that reports `file:line` reads instead: the same lexer, so exactly the same characters
 * count as comment, but each one is blanked in place rather than removed.
 */
describe("maskComments", () => {
  it("keeps a token after a 15-line block comment on its original line and offset", () => {
    const block = ["{/* first", ...Array.from({ length: 13 }, (_, n) => `   prose ${n}`), "*/}"];
    expect(block).toHaveLength(15);
    const source = ["<section>", ...block, "<StatGrid />", "</section>"].join("\n");
    const masked = maskComments(source);

    expect(lineAt(source, source.indexOf("<StatGrid"))).toBe(17);
    expect(masked.indexOf("<StatGrid")).toBe(source.indexOf("<StatGrid"));
    expect(lineAt(masked, masked.indexOf("<StatGrid"))).toBe(17);
    expect(masked).not.toContain("prose");
    expect(masked.split("\n")).toHaveLength(source.split("\n").length);
    // The trap it replaces: the stripped text reports the same token fourteen lines early.
    const stripped = stripComments(source);
    expect(lineAt(stripped, stripped.indexOf("<StatGrid"))).toBe(3);
  });

  it("blanks both comment forms in place, delimiters included", () => {
    expect(maskComments("id/* x */Name")).toBe("id       Name");
    expect(maskComments("id// x\nName")).toBe("id    \nName");
    expect(maskComments("a /* one\ntwo */ b")).toBe("a       \n       b");
    expect(maskComments("{/* jsx */}")).toBe("{         }");
    expect(maskComments("x /* crlf\r\n */ y")).toBe("x        \r\n    y");
  });

  it("blanks an unterminated block comment to EOF without overrunning", () => {
    expect(maskComments("const a = 1; /* never\nclosed")).toBe("const a = 1;         \n      ");
    expect(maskComments("a /")).toBe("a /");
    expect(maskComments("a /*")).toBe("a   ");
  });

  it("lexes exactly like stripComments: strings, templates, `${}` holes and regexes", () => {
    const cases = [
      'const url = "https://example.org/a"; // gone',
      "const glob = `messages/*.json`; /* gone */",
      'const escaped = "a \\" // b"; // gone',
      'const token = /(`([^`]+)`|"([^"]+)")/g;\n// gone\nconst kept = 1;',
      "const re = /[/]\\//g; // gone",
      "const ratio = total / count; // gone",
      "<p>km/h</p>\n// gone\nconst kept = 1;",
      "const cls = `base ${\n  // gone\n  wide ? `a ${inner} b` : `c`\n} tail`;",
      "const s = `a /* kept */ c`;",
      "return /* gone */ /re/.test(x) /* gone */ / 2;",
    ];
    for (const source of cases) {
      const masked = maskComments(source);
      expectLinePreservingMask(source, masked, JSON.stringify(source));
      expect(masked, JSON.stringify(source)).not.toContain("gone");
      expect(collapse(masked), JSON.stringify(source)).toBe(collapse(stripComments(source)));
    }
    expect(maskComments("const s = `a /* kept */ c`;")).toBe("const s = `a /* kept */ c`;");
  });

  /**
   * Parity with `stripComments`, stated exactly. The two differ only in what a comment becomes:
   * one space there, the comment's own length in spaces and line breaks here. Every comment is at
   * least two characters, so both leave a whitespace run of length >= 1 where it stood, and
   * collapsing every whitespace run to one space makes the outputs identical. The mask is also
   * comment-free under the same lexer, so stripping it again changes nothing.
   */
  it("agrees with stripComments over every .ts/.tsx file in the repo", () => {
    const files = walkSources(REPO_ROOT);
    expect(files.length).toBeGreaterThan(300);
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      const masked = maskComments(source);
      expectLinePreservingMask(source, masked, file);
      expect(collapse(masked), file).toBe(collapse(stripComments(source)));
      expect(stripComments(masked), file).toBe(masked);
    }
  });
});

function collapse(text: string): string {
  return text.replace(/\s+/g, " ");
}
