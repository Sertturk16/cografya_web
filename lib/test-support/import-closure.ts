import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { stripComments } from "./strip-comments";

/**
 * The real import graph, walked from a set of roots — shared by every test that needs to know
 * what a file actually reaches, not just what directly imports it.
 *
 * Extracted from `components/ui/orphan.test.ts` (T-036), which measured "does a primitive have
 * a product call site" by walking `PRODUCT_ROOTS` outward through every `import`/`export …
 * from`/dynamic `import()`. `components/patterns/rsc-boundary.test.ts` (Task 9) needed the
 * identical walk for a different question — "does a `\"use client\"` file transitively reach a
 * `server-only` module" — and duplicating a second copy of the same resolver is exactly the
 * kind of drift this repo's own conventions doc warns against. One resolver, two questions.
 *
 * `repoRoot` is computed HERE, from this file's own location (`lib/test-support/` is two
 * directories below the repo root, same depth `components/ui/orphan.test.ts` used to compute
 * its own), so every caller gets the same absolute root regardless of where it sits in the tree.
 */
export const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

export const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"] as const;

/** A root may name a directory or a single file. Test files (`*.test.*`) are never walked. */
export function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  if (statSync(dir).isFile()) return [dir];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : walk(full);
    return EXTENSIONS.some((ext) => entry.name.endsWith(ext)) && !entry.name.includes(".test.")
      ? [full]
      : [];
  });
}

/** `"@/components/ui/button"` / `"./table"` → an absolute path on disk, or `null` for a package. */
export function resolveSpecifier(fromFile: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) base = join(repoRoot, specifier.slice(2));
  else if (specifier.startsWith(".")) base = resolve(dirname(fromFile), specifier);
  else return null; // node_modules (including "server-only" itself) — not our graph

  for (const candidate of [
    ...EXTENSIONS.map((ext) => `${base}${ext}`),
    ...EXTENSIONS.map((ext) => join(base, `index${ext}`)),
  ]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** Static `import`/`export … from` and dynamic `import()`. Comments stripped first. */
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*)["']([^"']+)["']/g;

/** Every bare import specifier `file` writes, in source order (duplicates included). */
export function specifiersOf(file: string): string[] {
  const source = stripComments(readFileSync(file, "utf8"));
  return [...source.matchAll(SPECIFIER)].map((match) => match[1]!);
}

/** Every specifier in `file` that resolves to a file on disk (i.e. not a package). */
export function importsOf(file: string): string[] {
  return specifiersOf(file)
    .map((specifier) => resolveSpecifier(file, specifier))
    .filter((path): path is string => path !== null);
}

/** Every file reachable from `roots`, following the import graph transitively. */
export function closureFrom(roots: readonly string[]): Set<string> {
  const seen = new Set<string>();
  const queue = roots.flatMap((rel) => walk(join(repoRoot, rel)));
  for (const file of queue) seen.add(file);
  while (queue.length > 0) {
    for (const next of importsOf(queue.pop()!)) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return seen;
}

/**
 * Full `import …/export …` clauses ending `from "specifier"`, captured whole so
 * {@link isRuntimeClause} can inspect what is actually bound — not just the fact that a
 * specifier follows `from`.
 *
 * The clause is `[^;]*?`, NOT `[\s\S]*?` — anchored so it cannot cross a `;`. An earlier
 * version used `[\s\S]*?` and was WRONG, not merely imprecise in a safe direction as its own
 * docblock used to claim: `export type { X };` has no `from` of its own, so on
 *
 *     export type { X };
 *     import { b } from "./real";
 *
 * the unanchored version matched starting at `export`, and — finding no `from` before the
 * `import` keyword — kept consuming across the statement boundary until the NEXT `from`,
 * capturing the merged clause `"type { X };\nimport { b }"`. That clause starts with `type\b`,
 * so {@link isRuntimeClause} called it type-only and `"./real"` vanished from the runtime graph
 * — a FALSE NEGATIVE, the one direction this scanner cannot afford, on exactly the shape
 * `components/patterns/breadcrumbs.tsx` carries today (`export type { BreadcrumbTrailItem };`
 * followed, eventually, by more code). Anchoring at `;` instead: `export type { X };` no longer
 * matches this pattern AT ALL (no `from` appears before its own semicolon), so it is correctly
 * invisible to it, and `import { b } from "./real";` is left to match on its own, independently,
 * starting fresh at its own `import` keyword. `lib/test-support/import-closure.test.ts` pins
 * this exact two-line shape as a regression fixture.
 *
 * Semicolons are not valid inside an import/export clause's own syntax (specifiers, braces,
 * `as` aliases, `* as ns`), so this anchor costs nothing there — the one thing it does give up,
 * a source file with automatic-semicolon-insertion omitting a statement's `;` entirely, does not
 * occur anywhere in this codebase (Prettier enforces `semi: true` — `docs/conventions.md`) and
 * is out of scope the same way `strip-comments.ts` calls itself a scanner, not a parser.
 */
const IMPORT_OR_EXPORT_FROM = /\b(?:import|export)\s+([^;]*?)\s+from\s*["']([^"']+)["']/g;

/**
 * Whether an `import`/`export …from` clause (the text between the keyword and `from`, e.g.
 * `"type { A }"`, `"{ A, type B }"`, `"Default, { A }"`, `"* as ns"`) leaves behind at least one
 * VALUE binding after TypeScript erases the type-only ones — i.e. whether the specifier it
 * points at is still imported in the COMPILED output, the thing that actually becomes a
 * bundler-graph edge.
 *
 * This is what `lib/auth/submit.client.ts`'s `import type { AuthBffCode } from
 * "./transport.server"` needs and the plain {@link importsOf} above does not give: that file is
 * `"use client"` and `./transport.server` carries `import "server-only"`, yet `pnpm build`
 * passes, because a type-only import compiles to NOTHING — no runtime specifier, no module
 * evaluation, no edge. Treating it as a real edge (what {@link importsOf} does, correctly, for
 * `orphan.test.ts`'s purpose, where over-following a type-only edge only widens a reachability
 * set and can never hide a real orphan) would make `components/patterns/rsc-boundary.test.ts`
 * flag it as a violation that `pnpm build` disagrees with.
 *
 * SCOPE: {@link IMPORT_OR_EXPORT_FROM} no longer merges clauses across a `;` (see its own
 * docblock for the false-negative that used to produce), so `clause` here is always exactly one
 * statement's own text. Any shape this function does not recognise as `type …` or a pure
 * `{ …members… }` block — a default import, `* as ns`, `Default, { … }` — is treated as a REAL
 * edge, never dropped: a false positive there costs a review, a false negative would hide the
 * exact bug this test exists to catch.
 */
function isRuntimeClause(clause: string): boolean {
  const trimmed = clause.trim();
  if (/^type\b/.test(trimmed)) return false; // `import type X …` / `import type { … } …`

  const braceMatch = trimmed.match(/\{([^}]*)\}/);
  const outsideBraces = braceMatch ? trimmed.replace(braceMatch[0], "").trim() : trimmed;
  if (braceMatch && outsideBraces === "") {
    // The clause is EXACTLY one `{ … }` block (no default import alongside it): real only if
    // at least one named member has no `type` prefix. `{}` (nothing) has no member at all.
    const members = braceMatch[1]!
      .split(",")
      .map((member) => member.trim())
      .filter((member) => member.length > 0);
    return members.some((member) => !/^type\s+/.test(member));
  }

  return true; // default import, namespace `* as ns`, `Default, { … }`, or an unrecognised shape
}

/** Every specifier `file` imports that survives TypeScript's type-only erasure. */
export function runtimeSpecifiersOf(file: string): string[] {
  const source = stripComments(readFileSync(file, "utf8"));
  const fromSpecifiers = [...source.matchAll(IMPORT_OR_EXPORT_FROM)]
    .filter((match) => isRuntimeClause(match[1]!))
    .map((match) => match[2]!);
  // Side-effect imports (`import "server-only";`) and dynamic `import("…")` are always runtime.
  const sideEffectSpecifiers = [...source.matchAll(/\bimport\s*["']([^"']+)["']/g)].map(
    (match) => match[1]!,
  );
  const dynamicSpecifiers = [...source.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)].map(
    (match) => match[1]!,
  );
  return [...fromSpecifiers, ...sideEffectSpecifiers, ...dynamicSpecifiers];
}

/** Every specifier in `file` that both resolves to a file on disk AND survives type erasure. */
export function runtimeImportsOf(file: string): string[] {
  return runtimeSpecifiersOf(file)
    .map((specifier) => resolveSpecifier(file, specifier))
    .filter((path): path is string => path !== null);
}
