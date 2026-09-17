import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stripComments, stripCssComments } from "./strip-comments";

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

  it("strips the real component this task's guards read, without eating its scopes", () => {
    const source = readFileSync(
      fileURLToPath(new URL("../../components/v2/v2-sources-section.tsx", import.meta.url)),
      "utf8",
    );
    const stripped = stripComments(source);

    // Every scope key survives — the naive "block comments first" regex loses everything from
    // the `messages/*.json` line comment in the `deniz` list onward.
    for (const scope of ["home", "turkiye", "deniz", "oyun", "deprem", "araclar", "kitaplar"]) {
      expect(stripped, `${scope} scope key`).toContain(`  ${scope}: [`);
    }
    expect(stripped).toContain('id: "afad-deprem"');
    // …and the prose really is gone.
    expect(stripped).not.toContain("NO `general` SCOPE");
  });
});
