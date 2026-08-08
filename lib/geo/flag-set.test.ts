import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { flagIsoCodes, hasFlag, LOCAL_FLAG_OVERRIDES, resolveFlag } from "./flag-set";

/**
 * The three-layer flag resolution (local override → package → fail-soft), pinned as a
 * MECHANISM.
 *
 * Deliberately NOT pinned: which countries have a flag. That is a property of an upstream
 * package we version-pin and of a seed we do not own; asserting it here would turn a data
 * change into a failing unit test (CONVENTIONS §2 — tests check structure and invariants,
 * never facts). The one behaviour that IS asserted about real data is the invariant the
 * fail-soft path exists for: a code with no asset anywhere resolves to `null`, never to a
 * broken path.
 *
 * The override layer is exercised with a SYNTHETIC directory rather than with `QN`. The real
 * override map is empty today because DEC 2026-08-08c md.2 places the KKTC asset in a later
 * phase; a test written against `QN` would assert the existence of a file this phase
 * deliberately does not create, and would then have to be rewritten the day it does.
 */

function tempDirWith(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "flag-set-"));
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  return dir;
}

describe("resolveFlag — resolution ORDER", () => {
  it("prefers a local override over the package file of the same code", () => {
    const local = tempDirWith({ "xx.svg": "<svg/>" });
    const pkg = tempDirWith({ "xx.svg": "<svg/>" });

    const resolved = resolveFlag("XX", { XX: "xx.svg" }, { local, package: pkg });

    expect(resolved?.origin).toBe("local");
    expect(resolved?.path).toBe(join(local, "xx.svg"));
  });

  it("falls through to the package when the override names a file that is not there", () => {
    const local = tempDirWith({});
    const pkg = tempDirWith({ "xx.svg": "<svg/>" });

    const resolved = resolveFlag("XX", { XX: "missing.svg" }, { local, package: pkg });

    expect(resolved?.origin).toBe("package");
  });

  it("uses the package for a code with no override", () => {
    const pkg = tempDirWith({ "yy.svg": "<svg/>" });
    expect(resolveFlag("YY", {}, { local: tempDirWith({}), package: pkg })?.origin).toBe("package");
  });

  it("fails soft — null, never a path — when neither layer has the code", () => {
    const resolved = resolveFlag("ZZ", {}, { local: tempDirWith({}), package: tempDirWith({}) });
    expect(resolved).toBeNull();
  });

  it("is case- and whitespace-insensitive on the api's code, and rejects an empty one", () => {
    const pkg = tempDirWith({ "xx.svg": "<svg/>" });
    expect(resolveFlag(" xx ", {}, { package: pkg })?.origin).toBe("package");
    expect(resolveFlag("", {}, { package: pkg })).toBeNull();
  });
});

describe("the shipped override map", () => {
  it("is a plain record — the abstraction stays one line until a second case exists", () => {
    // Asserting the SHAPE, not the contents: the map is empty today and will gain `QN`.
    for (const [code, file] of Object.entries(LOCAL_FLAG_OVERRIDES)) {
      expect(code).toMatch(/^[A-Z]{2}$/);
      expect(file).toMatch(/\.svg$/);
    }
  });
});

describe("flagIsoCodes / hasFlag", () => {
  it("exposes only ISO alpha-2 keys — the set's 14 non-country entries are filtered out", () => {
    for (const code of flagIsoCodes()) expect(code).toMatch(/^[A-Z]{2}$/);
  });

  it("answers false for a code no layer carries, rather than throwing", () => {
    expect(hasFlag("ZZ")).toBe(false);
  });

  it("is memoised — the directory is read once, not per country page", () => {
    expect(flagIsoCodes()).toBe(flagIsoCodes());
  });
});
