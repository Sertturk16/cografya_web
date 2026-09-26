import { readFileSync } from "node:fs";
import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import enMessages from "@/messages/en.json";
import trMessages from "@/messages/tr.json";
import { TOOL_MODES } from "@/lib/tools/tool-presets";
import { V2ToolWorkbench } from "./v2-tool-workbench";

/**
 * T-081: the measurement workbench wrote its copy inline in Turkish, so `/en/tools/...` rendered a
 * Turkish tool. Every string now comes from the `ToolWorkbench` (and `Measurements`) catalogue.
 *
 * Two independent checks, because each misses what the other sees:
 *
 * - SOURCE: the AST of `v2-tool-workbench.tsx` carries no Turkish copy. It reads string literals,
 *   template chunks and JSX text (comments are not in that set, so prose explaining the file does
 *   not trip it), including strings only reached after a click — point labels, the clipboard
 *   summary, manual-coordinate errors — which a first render never shows.
 * - RENDER: the English first render of every mode, locked and free, carries no Turkish letters
 *   outside a short list of proper nouns. This catches a key that exists in `en.json` but holds
 *   Turkish, which the source scan cannot.
 */

const SOURCE_PATH = new URL("./v2-tool-workbench.tsx", import.meta.url);
const source = readFileSync(SOURCE_PATH, "utf8");

const TURKISH_LETTERS = /[çğıöşüÇĞİÖŞÜ]/;
/**
 * Turkish UI words with no Turkish-only letter, which the letter check alone would miss. Every one
 * was a visible label in this file before T-081.
 */
const ASCII_TURKISH_WORDS =
  /\b(Nokta|Ekle|Temizle|Mesafe|Alan|Koordinat|Hektar|metre|Girdi|Senaryo|dk|seyir|Tuval|Kaydet)\b/;

/** Literal text the scan accepts, each with its reason. */
const SOURCE_ALLOWLIST: readonly string[] = [
  // The brand, stamped on the exported PNG beside the licence credits. Not translated on any page.
  "Coğrafya Gurmesi · ",
];

/** JSX attributes a reader sees or hears; a string literal with letters there is inline copy. */
const USER_FACING_ATTRIBUTES = new Set([
  "aria-label",
  "placeholder",
  "searchPlaceholder",
  "emptyLabel",
  "title",
  "alt",
  "label",
]);

/** Words JSX text may still carry: units that read the same in both languages. */
const JSX_TEXT_WORDS = new Set(["km"]);

interface Finding {
  readonly line: number;
  readonly text: string;
  readonly why: string;
}

function scan(fileText: string): Finding[] {
  const ast = ts.createSourceFile(
    "workbench.tsx",
    fileText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const findings: Finding[] = [];
  const report = (node: ts.Node, text: string, why: string) =>
    findings.push({ line: ast.getLineAndCharacterOfPosition(node.getStart()).line + 1, text, why });

  const inClassName = (node: ts.Node): boolean => {
    for (let at: ts.Node | undefined = node; at; at = at.parent) {
      if (ts.isJsxAttribute(at)) return at.name.getText() === "className";
    }
    return false;
  };

  const checkLiteral = (node: ts.Node, text: string) => {
    if (SOURCE_ALLOWLIST.includes(text) || inClassName(node)) return;
    if (TURKISH_LETTERS.test(text)) report(node, text, "Turkish letters in a literal");
    else if (ASCII_TURKISH_WORDS.test(text)) report(node, text, "Turkish word in a literal");
  };

  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      checkLiteral(node, node.text);
      const parent = node.parent;
      if (
        ts.isJsxAttribute(parent) &&
        USER_FACING_ATTRIBUTES.has(parent.name.getText()) &&
        /[A-Za-z]/.test(node.text)
      ) {
        report(node, node.text, `inline copy in ${parent.name.getText()}`);
      }
    } else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      checkLiteral(node, node.text);
    } else if (ts.isJsxText(node)) {
      const text = node.text.trim();
      if (text !== "") {
        checkLiteral(node, text);
        // HTML entities (`&bull;`) are punctuation, not words.
        const words = text.replace(/&[a-z]+;/g, "").match(/[\p{L}]{2,}/gu) ?? [];
        const stray = words.filter((word) => !JSX_TEXT_WORDS.has(word));
        if (stray.length > 0) report(node, text, "JSX text that is not a unit");
      }
    } else if (ts.isJsxAttribute(node) && USER_FACING_ATTRIBUTES.has(node.name.getText())) {
      // `aria-label={`...`}` — a template in an expression container.
      const init = node.initializer;
      if (
        init &&
        ts.isJsxExpression(init) &&
        init.expression &&
        (ts.isTemplateExpression(init.expression) ||
          ts.isNoSubstitutionTemplateLiteral(init.expression) ||
          ts.isStringLiteral(init.expression))
      ) {
        report(node, init.expression.getText(), `inline copy in ${node.name.getText()}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return findings;
}

const format = (findings: readonly Finding[]) =>
  findings.map((f) => `  line ${f.line}: ${f.why}: ${JSON.stringify(f.text)}`).join("\n");

describe("V2ToolWorkbench carries no inline Turkish copy (T-081)", () => {
  it("the source has no Turkish UI string left", () => {
    const findings = scan(source);
    expect(findings, `inline copy still in v2-tool-workbench.tsx:\n${format(findings)}`).toEqual(
      [],
    );
  });

  it("the scan is not vacuous: it flags each shape of inline copy it claims to catch", () => {
    const probe = [
      "export function Probe({ n }: { n: number }) {",
      '  const label = "Seçili Nokta";',
      "  const other = `Nokta ${n}`;",
      "  return (",
      '    <div className="İ-is-a-class-and-ignored">',
      "      Geri Al",
      '      <input aria-label="Zoom in" placeholder={`Ara ${n}`} />',
      "      <span>{label}{other}</span>",
      "      <span>{n} km</span>",
      "    </div>",
      "  );",
      "}",
    ].join("\n");
    const whys = scan(probe).map((f) => `${f.line}:${f.why}`);
    expect(whys).toEqual([
      "2:Turkish letters in a literal",
      "3:Turkish word in a literal",
      "6:JSX text that is not a unit",
      "7:inline copy in aria-label",
      "7:inline copy in placeholder",
    ]);
  });

  it("does not use a hardcoded locale for dates or numbers", () => {
    expect(source).not.toMatch(/formatDay\([^)]*"tr"/);
    expect(source).not.toContain('toLocaleString("tr-TR"');
  });
});

describe("the ToolWorkbench catalogue", () => {
  const tr = trMessages.ToolWorkbench as Record<string, string>;
  const en = enMessages.ToolWorkbench as Record<string, string>;

  it("has the same keys in both locales, every value non-empty", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(tr).sort());
    for (const [key, value] of [...Object.entries(tr), ...Object.entries(en)]) {
      expect(value.trim().length, key).toBeGreaterThan(0);
    }
  });

  it("has no dead key: each one is named in the workbench source or its preset list", () => {
    const presets = readFileSync(
      new URL("../../lib/tools/tool-presets.ts", import.meta.url),
      "utf8",
    );
    const unused = Object.keys(tr).filter(
      (key) => !source.includes(`"${key}"`) && !presets.includes(`"${key}"`),
    );
    expect(unused).toEqual([]);
  });
});

describe("the English workbench renders in English (T-081)", () => {
  /**
   * Turkish letters an English page legitimately shows: the country's English name, a province
   * (a proper noun), and the Turkish unit named in parentheses beside its English one.
   */
  const PROPER_NOUNS = /Türkiye|Kırşehir|dönüm/g;

  it.each(TOOL_MODES)("%s", (mode) => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="en" messages={enMessages} timeZone="Europe/Istanbul">
        <V2ToolWorkbench mode={mode} />
      </NextIntlClientProvider>,
    );
    // Province names in the map's per-path <title> are data (the api publishes Turkish names in
    // both locales), not copy.
    const copy = html
      .replace(/<title>[^<]*<\/title>/g, "")
      .replace(PROPER_NOUNS, "")
      .replace(/<[^>]*\sd="[^"]*"[^>]*>/g, "");
    const turkish = [...copy.matchAll(/[^<>"]*[çğıöşüÇĞİÖŞÜ][^<>"]*/g)].map((m) => m[0].trim());
    expect(turkish).toEqual([]);
  });
});
