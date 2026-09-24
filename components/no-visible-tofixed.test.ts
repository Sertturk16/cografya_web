import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { maskComments } from "@/lib/test-support/strip-comments";

/**
 * No `toFixed` reaches visible text (T-093).
 *
 * `toFixed` always writes an English decimal point, so `M {mag.toFixed(1)}` printed `M 2.9` in a
 * strip that is otherwise Turkish, where it should read `M 2,9`. Visible figures go through
 * `lib/text/format-number.ts` (`tr()` beside hard-written Turkish, `formatNumber(n, locale)` on a
 * surface whose words go through `next-intl`).
 *
 * Telling a visible `toFixed` from a harmless one needs a type checker, not a grep. So the rule
 * is a census instead: every `toFixed(` left in `app/`, `components/` and `lib/` is listed below,
 * by the exact line it sits on, with the reason its output is never read by a person. A new
 * `toFixed` anywhere fails this test until it is either converted or justified here. Comments
 * are masked first, so a docblock that explains the rule is not counted as breaking it.
 */

interface Allowed {
  readonly file: string;
  /** The trimmed source line, exactly. An edit to the line re-opens the question. */
  readonly line: string;
  readonly why: string;
}

const ALLOWED: readonly Allowed[] = [
  {
    file: "components/book/bench-timeline.tsx",
    line: "style={{ left: `${(ratio * 100).toFixed(2)}%` }}",
    why: "A CSS `left` percentage. CSS requires the decimal point.",
  },
  {
    file: "lib/brand/glyph.ts",
    line: "const rx = (radiusRatio * 32).toFixed(2);",
    why: "An SVG `rx` attribute in the generated brand glyph. SVG requires the decimal point.",
  },
  {
    file: "lib/map/projection.ts",
    line: "const round = (n: number) => Number(n.toFixed(1));",
    why: "Rounds a number that becomes an SVG `viewBox`, and returns a number, not text.",
  },
];

const repoRoot = fileURLToPath(new URL("../", import.meta.url));

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.tsx?$/.test(entry.name) && !entry.name.includes(".test.") ? [full] : [];
  });

/** Every non-comment line that calls `toFixed(`, trimmed. */
function toFixedLines(source: string): string[] {
  return maskComments(source)
    .split("\n")
    .filter((line) => line.includes("toFixed("))
    .map((line) => line.trim());
}

/** The `toFixed` lines of `files` that no {@link ALLOWED} entry justifies, as `file: line`. */
function unjustified(
  files: ReadonlyArray<{ readonly file: string; readonly source: string }>,
  allowed: readonly Allowed[] = ALLOWED,
): string[] {
  return files.flatMap(({ file, source }) =>
    toFixedLines(source)
      .filter((line) => !allowed.some((a) => a.file === file && a.line === line))
      .map((line) => `${file}: ${line}`),
  );
}

const files = ["app", "components", "lib"]
  .flatMap((dir) => walk(join(repoRoot, dir)))
  .map((full) => ({ file: relative(repoRoot, full), source: readFileSync(full, "utf8") }));

describe("no toFixed in visible text (T-093)", () => {
  it("reads the tree it means to read", () => {
    // Anti-vacuity: an empty walk passes every rule below for free.
    expect(files.length).toBeGreaterThan(250);
    expect(files.map((f) => f.file)).toContain("components/v2/v2-live-ticker.tsx");
  });

  it("every toFixed left in the tree is a justified, non-visible use", () => {
    const found = unjustified(files);
    expect(
      found,
      `these print a decimal point where Turkish writes a comma — format with ` +
        `lib/text/format-number.ts (tr() or formatNumber(n, locale)), or, if the value is never ` +
        `read by a person (CSS, SVG, a numeric rounding), list the line in ALLOWED with why:\n  ` +
        found.join("\n  "),
    ).toEqual([]);
  });

  it("every allowlist entry still matches a line — a stale entry is a hole", () => {
    const stale = ALLOWED.filter(
      (a) => !files.some((f) => f.file === a.file && toFixedLines(f.source).includes(a.line)),
    );
    expect(stale.map((a) => `${a.file}: ${a.line}`)).toEqual([]);
  });

  it("catches the ticker line T-093 fixed — the scanner can fail", () => {
    // The pre-T-093 ticker, verbatim: `M 2.9` on a Turkish strip.
    const before = [
      '"use client";',
      "// earthquake.magnitude.toFixed(1) in a comment is not code",
      "<span>",
      "  M {earthquake.magnitude.toFixed(1)} {earthquake.location}",
      "</span>",
    ].join("\n");
    expect(unjustified([{ file: "components/v2/v2-live-ticker.tsx", source: before }])).toEqual([
      "components/v2/v2-live-ticker.tsx: M {earthquake.magnitude.toFixed(1)} {earthquake.location}",
    ]);
  });

  it("an allowed line in one file does not excuse the same line in another", () => {
    const entry = ALLOWED[0]!;
    expect(unjustified([{ file: "components/v2/elsewhere.tsx", source: entry.line }])).toHaveLength(
      1,
    );
  });
});

/**
 * The same comma, hard-written (T-093). A figure typed straight into Turkish copy — a legend
 * `"M 3.0–3.9"`, a threshold `"0.5 m/s"`, a table cell `"Mw 7.4"` — never passes through a
 * formatter, so the `toFixed` census above cannot see it. This scan reads string and JSX text
 * for the two shapes that are unambiguous in this codebase: a magnitude written with a point,
 * and a number with one or two decimals written with a point in front of a physical unit.
 * Thousands (`1.200 km`) have three digits after the point and are not matched; CSS and SVG
 * numbers carry no unit from the list, and an SVG path (`M582.5 306.8`) has no space after its
 * `M`. Generated map files are skipped. `components/showcase/` is the design-system specimen
 * page, out of scope for site copy (`docs/copy.md`).
 */
const HARD_WRITTEN_DECIMAL: readonly RegExp[] = [
  /\bM[wsLd]?(?:\s+|\s*[<≥≤~]\s*)\d+\.\d\b/,
  /\b\d+\.\d{1,2}\s?(?:°C|°[KGDB](?![a-zA-Z])|m\/s|km\/h|km²|km(?![a-zA-Z])|mm(?![a-zA-Z-])|m(?![a-zA-Z/-]))/,
];

function hardWrittenDecimals(file: string, source: string): string[] {
  return maskComments(source)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => HARD_WRITTEN_DECIMAL.some((re) => re.test(line)))
    .map((line) => `${file}: ${line}`);
}

describe("no hard-written decimal point in visible Turkish copy (T-093)", () => {
  it("finds none in app/, components/, lib/ or messages/tr.json", () => {
    const sources = [
      ...files.filter(
        (f) => !f.file.startsWith("components/showcase/") && !f.file.includes(".generated."),
      ),
      {
        file: "messages/tr.json",
        source: readFileSync(join(repoRoot, "messages/tr.json"), "utf8"),
      },
    ];
    const found = sources.flatMap(({ file, source }) => hardWrittenDecimals(file, source));
    expect(found, `write the Turkish decimal comma:\n  ${found.join("\n  ")}`).toEqual([]);
  });

  it("catches the shapes it names — the scanner can fail", () => {
    for (const line of [
      'legend: "M 3.0–3.9",',
      'magnitude: "Mw 7.4",',
      'calmThreshold: "0.5 m/s (~1.8 km/h)",',
      'avgSummerTemp: "24.5°C – 26.5°C",',
      "YENGEÇ DÖNENCESİ (23.5°K)",
      "M≥9.0 büyüklüğünde",
    ]) {
      expect(hardWrittenDecimals("x.tsx", line), line).toHaveLength(1);
    }
  });

  it("leaves thousands, commas, CSS and comments alone", () => {
    for (const line of [
      'fact="6.371 km"',
      '"M 3,0–3,9"',
      'className="gap-1.5 mt-2.5 text-[0.85rem]"',
      'stroke-width="0.5"',
      "// was M 2.9 before T-093",
      'd: "M582.5 306.8l-2.5 .2Z"',
    ]) {
      expect(hardWrittenDecimals("x.tsx", line), line).toEqual([]);
    }
  });
});
