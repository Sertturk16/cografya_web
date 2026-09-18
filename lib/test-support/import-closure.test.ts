import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveSpecifier, runtimeImportsOf, runtimeSpecifiersOf } from "./import-closure";

/**
 * Regression fixture for the false negative found in review round 1 of
 * `components/patterns/rsc-boundary.test.ts`: `IMPORT_OR_EXPORT_FROM` used to be
 * `[\s\S]*?` between the `import`/`export` keyword and `from`, which could cross a `;` and
 * merge two adjacent statements into one clause. On
 *
 *     export type { X };
 *     import { b } from "./real";
 *
 * the old pattern found no `from` before the `import` keyword and kept consuming into the
 * SECOND statement, capturing `"type { X };\nimport { b }"` — a clause starting with `type\b`,
 * so `isRuntimeClause` called the whole thing type-only and the real edge to `"./real"`
 * vanished. `components/patterns/breadcrumbs.tsx` carries `export type { BreadcrumbTrailItem
 * };` today with nothing after it BUT more code — the exact shape one future import statement
 * below that line would have silently blinded the guard on.
 *
 * These are real files on disk (not string fixtures passed to an internal parser), because
 * `runtimeImportsOf`/`runtimeSpecifiersOf` read from disk and resolve relative specifiers
 * against the calling file's own directory — the same path production code takes.
 */
describe("runtimeImportsOf: the export-type-then-import merge is fixed", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "import-closure-fixture-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("follows the real import that immediately follows a bare 'export type { X };'", () => {
    // The exact two-line shape from the review finding, byte for byte.
    writeFileSync(
      join(dir, "blind.ts"),
      ["export type { X };", 'import { b } from "./real";', "", "export type X = string;", ""].join(
        "\n",
      ),
    );
    writeFileSync(join(dir, "real.ts"), "export const b = 1;\n");

    const blindPath = join(dir, "blind.ts");
    const realPath = resolveSpecifier(blindPath, "./real");
    expect(realPath).not.toBeNull(); // positive control: the fixture file really resolves

    // The regression: this must include `real.ts`, not silently drop it.
    expect(runtimeImportsOf(blindPath)).toContain(realPath);
  });

  it("the merge previously classified the clause as type-only — proof the classifier itself is not the fix", () => {
    // If `isRuntimeClause` alone had a bug (not the merge), this would already catch it: the
    // merged clause STARTS with `type`, which `isRuntimeClause` correctly calls type-only on
    // its own. The bug was entirely in what got handed to it — the anchor on
    // `IMPORT_OR_EXPORT_FROM`, not the classifier. This asserts the untouched classifier logic
    // (a clean, unmerged `{ b }`) is what actually decides the fixture above.
    writeFileSync(join(dir, "clean.ts"), 'import { b } from "./real";\n');
    writeFileSync(join(dir, "real.ts"), "export const b = 1;\n");
    const cleanPath = join(dir, "clean.ts");
    const realPath = resolveSpecifier(cleanPath, "./real");
    expect(runtimeImportsOf(cleanPath)).toContain(realPath);
  });

  it("still drops a GENUINELY type-only import — the merge fix did not turn the guard permissive the other way", () => {
    writeFileSync(join(dir, "typeonly.ts"), 'import type { A } from "./real";\n');
    writeFileSync(join(dir, "real.ts"), "export type A = string;\n");
    const typeonlyPath = join(dir, "typeonly.ts");
    const realPath = resolveSpecifier(typeonlyPath, "./real");
    expect(runtimeImportsOf(typeonlyPath)).not.toContain(realPath);
  });

  it("a chain through the fixed edge reaches a server-only module — the shape rsc-boundary.test.ts depends on", () => {
    writeFileSync(
      join(dir, "blind.ts"),
      [
        "export type { X };",
        'import { real } from "./real";',
        "void real;",
        "",
        "export type X = string;",
        "",
      ].join("\n"),
    );
    writeFileSync(join(dir, "real.ts"), 'import "server-only";\nexport const real = 1;\n');
    const blindPath = join(dir, "blind.ts");
    const realPath = resolveSpecifier(blindPath, "./real")!;
    expect(runtimeImportsOf(blindPath)).toContain(realPath);
    expect(runtimeSpecifiersOf(realPath)).toContain("server-only");
  });
});

/**
 * {@link isRuntimeClause}'s OTHER branches, each with a fixture rather than a reading of the
 * regex. The merged-clause block above covers the anchor; these cover the classifier, whose
 * whole job is to decide what TypeScript's erasure leaves behind — and every wrong answer here
 * is silent in one of two opposite ways. A missed edge hides an orphan from
 * `components/orphan.test.ts` and a `server-only` reach from
 * `components/patterns/rsc-boundary.test.ts`; a phantom edge certifies a dead file as live.
 *
 * Disk fixtures, for the reason the block above gives: these functions read files and resolve
 * specifiers against the calling file's own directory, which is the path production takes.
 */
describe("isRuntimeClause: what survives type erasure, branch by branch", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "import-closure-branch-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const withTarget = (name: string, source: string): [string, string] => {
    writeFileSync(join(dir, `${name}.ts`), source);
    writeFileSync(join(dir, "real.ts"), "export const A = 1;\nexport type B = string;\n");
    const from = join(dir, `${name}.ts`);
    return [from, resolveSpecifier(from, "./real")!];
  };

  it("a brace block with ONE value member among type members is a real edge", () => {
    // `{ A, type B }` compiles to `import { A }` — the module is still evaluated at runtime.
    const [from, target] = withTarget("mixed", 'import { A, type B } from "./real";\nvoid A;\n');
    expect(target).not.toBeNull();
    expect(runtimeImportsOf(from)).toContain(target);
  });

  it("a brace block whose every member is type-prefixed is erased", () => {
    const [from, target] = withTarget("alltype", 'import { type B } from "./real";\n');
    expect(runtimeImportsOf(from)).not.toContain(target);
  });

  it("`export { X, type Y } from` is a real edge — the live shape in lib/game/target.ts", () => {
    // `lib/game/target.ts` writes `export { GAME_MODE_IDS, isGameModeId, type GameModeId } from
    // "./config"`. Read as type-only, `lib/game/config.ts` would drop out of every closure that
    // reaches the game through this barrel.
    const [from, target] = withTarget("barrel", 'export { A, type B } from "./real";\n');
    expect(runtimeImportsOf(from)).toContain(target);
  });

  it("`export type * from` is erased", () => {
    const [from, target] = withTarget("startype", 'export type * from "./real";\n');
    expect(runtimeImportsOf(from)).not.toContain(target);
  });

  it("`export * from` — no `type` keyword — is a real edge, the other half of that pair", () => {
    const [from, target] = withTarget("star", 'export * from "./real";\n');
    expect(runtimeImportsOf(from)).toContain(target);
  });

  it("a dynamic import() is a real edge", () => {
    // Never a `from` clause, so it reaches the graph through its own pattern rather than through
    // `isRuntimeClause` at all — which is exactly why it needs its own fixture.
    const [from, target] = withTarget(
      "dynamic",
      'export async function load() {\n  return import("./real");\n}\n',
    );
    expect(runtimeImportsOf(from)).toContain(target);
    expect(runtimeSpecifiersOf(from)).toContain("./real");
  });

  it("a side-effect import with no bindings at all is a real edge", () => {
    const [from, target] = withTarget("sideeffect", 'import "./real";\n');
    expect(runtimeImportsOf(from)).toContain(target);
  });
});
