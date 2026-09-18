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
 * this test must not be the thing that decides what a generator may emit. Deriving the list means
 * a sixth generated artifact written as a BARE PATH (`lib/map/foo.generated.ts`) or as a
 * DIRECTORY (`openapi/`, with or without the trailing slash) is skipped by being added there,
 * with no edit here.
 *
 * GLOBS ARE NOT SUPPORTED, and that is a real limit rather than an oversight. Prettier honours
 * `**\/*.generated.ts`; this parser would turn that into a literal path prefix matching nothing,
 * so such an entry would be silently ignored here and the file it protects would be walked as
 * source. Nothing in `.prettierignore` uses one today. If one is ever added, this function has to
 * learn about it — the failure mode is a false FAILURE (a generated file scanned and flagged),
 * which is the safe direction but still a puzzle for whoever hits it.
 *
 * THE TRAILING SLASH IS STRIPPED BEFORE `join`, and that line is the whole fix for a bug that
 * made every directory entry inert. `join(repoRoot, "coverage/")` PRESERVES the trailing
 * separator, so the prefix was `<repo>/coverage/`; the walker then tested `full === prefix`
 * (never true, walked paths carry no trailing slash) and ``full.startsWith(`${prefix}/`)``, which
 * asks for `<repo>/coverage//` and can never match either. Every one of the six directory-style
 * entries — `.next/`, `out/`, `build/`, `coverage/`, `node_modules/`, `openapi/` — was therefore
 * doing nothing. Four are saved by {@link NEVER_WALKED} and `openapi/` by not being under a
 * source root, which is why nothing failed; the guard was simply not the thing providing the
 * protection it claimed.
 */
function parsePrettierIgnore(contents: string): string[] {
  return (
    contents
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"))
      // `replace(/\/+$/, "")` BEFORE `join`, not after: see the docblock above.
      .map((entry) => join(repoRoot, entry.replace(/\/+$/, "")))
  );
}

function prettierIgnoredPrefixes(): string[] {
  return parsePrettierIgnore(readFileSync(join(repoRoot, ".prettierignore"), "utf8"));
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

describe("the .prettierignore parser", () => {
  // The seam this block exists for: `parsePrettierIgnore` takes TEXT, so a directory-style entry
  // can be driven without touching the real `.prettierignore` or the walk.

  it("honours a directory-style entry, trailing slash or not", () => {
    const withSlash = parsePrettierIgnore("openapi/\n");
    const without = parsePrettierIgnore("openapi\n");
    expect(withSlash).toEqual(without);
    expect(withSlash).toEqual([join(repoRoot, "openapi")]);
    // The bug, pinned by its consequence rather than by its cause: the walker asks
    // ``full.startsWith(`${prefix}/`)``, so a prefix that kept its slash tested for `//` and
    // matched nothing. A file inside the directory must match the prefix the parser returns.
    const prefix = withSlash[0]!;
    const inside = join(repoRoot, "openapi", "openapi.json");
    expect(inside === prefix || inside.startsWith(`${prefix}/`)).toBe(true);
  });

  it("would NOT have matched before the fix — the control", () => {
    // The old expression, reproduced: `join` preserves the trailing separator.
    const unstripped = join(repoRoot, "openapi/");
    const inside = join(repoRoot, "openapi", "openapi.json");
    expect(inside === unstripped || inside.startsWith(`${unstripped}/`)).toBe(false);
  });

  it("keeps bare file paths exactly as written, and drops comments and blanks", () => {
    expect(parsePrettierIgnore("# a comment\n\nlib/api/schema.ts\n   \n# another\n")).toEqual([
      join(repoRoot, "lib/api/schema.ts"),
    ]);
  });

  it("really is the list the walk uses — anti-vacuity against the live file", () => {
    // Every directory entry in the real `.prettierignore` is now slash-free, so none of them is
    // the inert shape above. If someone reverts the strip, this fails on the live file.
    const prefixes = prettierIgnoredPrefixes();
    expect(prefixes.length).toBeGreaterThan(5);
    expect(prefixes.every((prefix) => !prefix.endsWith("/"))).toBe(true);
    expect(prefixes).toContain(join(repoRoot, "openapi"));
    expect(prefixes).toContain(join(repoRoot, "lib/api/schema.ts"));
  });
});

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
