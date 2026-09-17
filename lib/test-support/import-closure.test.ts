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
