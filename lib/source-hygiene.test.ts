import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * NO CONTROL CHARACTERS IN COMMITTED SOURCE.
 *
 * Written because T-035 PR5 put four raw **U+0000 bytes** into
 * `components/v2/page-composition-faq.test.ts` — a `U+0000`-delimited sentinel in a string
 * substitution, which Prettier normalised from the escape into the literal character. Nothing in
 * the gate noticed: `tsc` compiles it, ESLint passes it, Prettier formats it, git stores it. What
 * DID happen is that `rg` began reporting the whole 1200-line file as **binary** and skipping it,
 * and GNU `grep` found nothing in it at all — so the file quietly dropped out of every search the
 * next person would run over it, which is a worse failure than a red test.
 *
 * `CLAUDE.md`'s rule for a repeated or corrected mistake is: if a check could have caught it, add
 * the check rather than a line of documentation. This is the check. It is deliberately about BYTES
 * rather than about that one sentinel — a stray `\v`, a `\f` pasted out of a PDF, an ANSI escape
 * copied from terminal output and a zero-width-joiner-free-but-still-invisible `\x1b` all break the
 * same tools for the same reason.
 *
 * WHAT IS ALLOWED: tab, newline, carriage return. Everything else below `0x20` is rejected.
 * Characters at or above `0x20` are NOT this test's business — a non-breaking space or a
 * zero-width space is a content question (and `messages/*.json` legitimately holds Turkish text),
 * not a "this file is now binary to every search tool" question.
 *
 * NOT an ESLint rule, deliberately: ESLint sees only `.ts`/`.tsx`, and the same paste ruins a
 * `.json` message catalogue or a `.css` file exactly as thoroughly.
 */
const repoRoot = fileURLToPath(new URL("../", import.meta.url));

const label = (path: string) => relative(repoRoot, path);

/** The directories that hold hand-written source. `public/` and `data/` are excluded: they hold
 * fetched artifacts and real binaries (fonts, images), which are not source and are not searched. */
const SOURCE_ROOTS = ["app", "components", "lib", "tools", "scripts", "docs", "messages"] as const;

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".mjs", ".css", ".json", ".md"] as const;

const NEVER_WALKED = new Set(["node_modules", ".next", ".git", "coverage", "dist", "out"]);

/**
 * The generated files, DERIVED from `.prettierignore` rather than retyped.
 *
 * They are machine-written and compared byte for byte by their own `generate:*:check` gates, so
 * this test must not be the thing that decides what a generator may emit. Deriving the list also
 * means a sixth generated artifact is skipped by being added there, with no edit here — the same
 * "a guard's population is derived, not written" rule the composition scanner's guards follow.
 */
function prettierIgnoredPrefixes(): string[] {
  return readFileSync(join(repoRoot, ".prettierignore"), "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((entry) => join(repoRoot, entry));
}

function walkSource(dir: string, ignored: readonly string[]): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (ignored.some((prefix) => full === prefix || full.startsWith(`${prefix}/`))) return [];
    if (entry.isDirectory()) return NEVER_WALKED.has(entry.name) ? [] : walkSource(full, ignored);
    return SOURCE_EXTENSIONS.some((extension) => entry.name.endsWith(extension)) ? [full] : [];
  });
}

function sourceFiles(): string[] {
  const ignored = prettierIgnoredPrefixes();
  return SOURCE_ROOTS.flatMap((rel) => walkSource(join(repoRoot, rel), ignored)).sort();
}

/** Bytes a search tool treats as "this is not text". Tab, newline and carriage return excepted. */
const ALLOWED_CONTROL_BYTES = new Set([0x09, 0x0a, 0x0d]);

/** Every offending byte in `bytes`, as `offset: 0xNN` — the ONE predicate, used by the sweep and
 * by its own fixture control, so the fixture cannot pass through a second implementation. */
function controlBytesIn(bytes: Uint8Array): string[] {
  const found: string[] = [];
  for (let i = 0; i < bytes.length; i += 1) {
    const byte = bytes[i]!;
    if (byte < 0x20 && !ALLOWED_CONTROL_BYTES.has(byte)) {
      found.push(`byte ${i}: 0x${byte.toString(16).padStart(2, "0")}`);
    }
  }
  return found;
}

describe("committed source holds no control characters", () => {
  it("no file under the source roots contains a byte below 0x20 bar tab, LF and CR", () => {
    const offenders = sourceFiles().flatMap((file) => {
      const found = controlBytesIn(readFileSync(file));
      return found.length === 0 ? [] : [`${label(file)} — ${found.slice(0, 5).join(", ")}`];
    });
    expect(
      offenders,
      `control characters in committed source (a file with one is BINARY to rg and grep):\n${offenders
        .map((row) => `  ${row}`)
        .join("\n")}`,
    ).toEqual([]);
  });

  it("the walk saw the whole source tree — anti-vacuity", () => {
    // 625 files on the day this was written. A floor rather than an exact pin, because this
    // number moves with every file anyone adds and an exact pin would be a chore with no defect
    // behind it; the floor is well under today's count and far above any accident that would
    // leave the sweep scanning a handful of files, which is the failure this guards.
    const files = sourceFiles();
    expect(files.length, "the source walk found almost nothing").toBeGreaterThan(400);
    // Every root contributed, so a renamed or moved directory fails here rather than silently
    // shrinking the swept population.
    for (const root of SOURCE_ROOTS) {
      expect(
        files.filter((file) => label(file).startsWith(`${root}/`)).length,
        `no source file found under ${root}/ — has the directory moved?`,
      ).toBeGreaterThan(0);
    }
    // Every declared extension is genuinely present, so the list is not carrying a dead entry that
    // would make a whole file type invisible to the sweep.
    for (const extension of SOURCE_EXTENSIONS) {
      expect(
        files.filter((file) => file.endsWith(extension)).length,
        `no ${extension} file found — the extension list has a dead entry`,
      ).toBeGreaterThan(0);
    }
  });

  it("the predicate rejects a NUL, and accepts tab, LF and CR — the positive control", () => {
    // EVERY control character here is built with `String.fromCharCode`, never written as a
    // backslash-u escape — which is the second half of the original defect. Prettier NORMALISES
    // such an escape in a string literal (and in a docblock quoting one) to the raw byte, so a
    // test that spelled its own fixture the way the bug was spelled would plant the bug in itself.
    // It did: the first run of this file flagged five of its own bytes beside the four it was
    // written to find.
    const control = (code: number) => String.fromCharCode(code);
    const sentinel = Buffer.from(
      `const swapped = source.replace(arm, "${control(0)}LIST${control(0)}");\n`,
    );
    expect(controlBytesIn(sentinel)).toEqual(["byte 37: 0x00", "byte 42: 0x00"]);
    // …and the three that must never be flagged, or this test would reject every file in the repo.
    expect(controlBytesIn(Buffer.from("a\tb\nc\r\nd"))).toEqual([]);
    // One more of each class a paste actually produces: a vertical tab and an ANSI escape.
    expect(controlBytesIn(Buffer.from(`x${control(11)}y`))).toEqual(["byte 1: 0x0b"]);
    expect(controlBytesIn(Buffer.from(`${control(27)}[31mred`))).toEqual(["byte 0: 0x1b"]);
  });

  it("skips exactly the generated files, and reads that list from .prettierignore", () => {
    // Anti-vacuity for the derivation: the ignore file really is being parsed, and the schema
    // artifact really is being skipped by it rather than by never having been walked.
    const ignored = prettierIgnoredPrefixes().map(label);
    expect(ignored, "the .prettierignore derivation found nothing").toContain("lib/api/schema.ts");
    const swept = sourceFiles().map(label);
    expect(swept).not.toContain("lib/api/schema.ts");
    // …and the file it skips does exist, so the skip is a decision rather than a stale path.
    expect(statSync(join(repoRoot, "lib/api/schema.ts")).isFile()).toBe(true);
  });
});
