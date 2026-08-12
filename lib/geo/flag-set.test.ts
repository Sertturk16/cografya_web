import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  buildFlagIsoCodes,
  expectedPackageFlagFiles,
  flagIsoCodes,
  flagParamToIso,
  hasFlag,
  LOCAL_FLAG_OVERRIDES,
  memoizeFlagCatalogue,
  readFlagSvg,
  resolveFlag,
} from "./flag-set";

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
 * The override layer keeps being exercised with a SYNTHETIC directory even now that the real
 * map has an entry. The two jobs are different: these cases pin the ORDER of the three layers,
 * which must hold for any code, and naming `QN` in them would tie a mechanism test to one
 * country. What the shipped map needs instead is a coverage check, which is the last block in
 * this file and still names no country.
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
    // Asserting the SHAPE, not the membership: which countries we ship an asset for is a
    // product decision, and freezing it here would turn one into a failing unit test.
    for (const [code, file] of Object.entries(LOCAL_FLAG_OVERRIDES)) {
      expect(code).toMatch(/^[A-Z]{2}$/);
      expect(file).toMatch(/^[a-z]{2}\.svg$/);
    }
  });

  it("has a real file behind every key it claims", () => {
    // Catalogue construction checks this same property before publishing either layer.
    for (const code of Object.keys(LOCAL_FLAG_OVERRIDES)) {
      expect(resolveFlag(code)).toMatchObject({ origin: "local" });
    }
  });
});

describe("atomic flag catalogue", () => {
  it("traces the package manifest alongside both consumers' complete asset roots", () => {
    const config = readFileSync(new URL("../../next.config.ts", import.meta.url), "utf8");
    expect(config.match(/node_modules\/flag-icons\/country\.json/g)).toHaveLength(2);
    expect(config.match(/node_modules\/flag-icons\/flags\/4x3\/\*\*/g)).toHaveLength(2);
    expect(config.match(/assets\/flags\/\*\*/g)).toHaveLength(2);
  });

  it("derives the complete package contract from synthetic manifest paths", () => {
    expect(
      expectedPackageFlagFiles(
        JSON.stringify([
          { flag_4x3: "flags/4x3/aa.svg" },
          { flag_4x3: "flags/4x3/synthetic-region.svg" },
        ]),
      ),
    ).toEqual(new Set(["aa.svg", "synthetic-region.svg"]));
  });

  it.each([
    ["invalid JSON", "{"],
    ["non-array root", JSON.stringify({ flag_4x3: "flags/4x3/aa.svg" })],
    ["malformed row", JSON.stringify([null])],
    ["missing path", JSON.stringify([{}])],
    ["path outside 4x3", JSON.stringify([{ flag_4x3: "../aa.svg" }])],
    [
      "duplicate path",
      JSON.stringify([{ flag_4x3: "flags/4x3/aa.svg" }, { flag_4x3: "flags/4x3/aa.svg" }]),
    ],
  ])("rejects a %s manifest without publishing a catalogue", (_case, manifest) => {
    expect(() => expectedPackageFlagFiles(manifest)).toThrow(/flag-icons country\.json/);
  });

  it("publishes neither layer when the package manifest read fails", () => {
    const packageFiles = vi.fn(() => ["aa.svg"]);
    const localOverrideOrigin = vi.fn(() => "local" as const);
    expect(() =>
      buildFlagIsoCodes({
        expectedPackageFiles: () => {
          throw new Error("ENOENT country.json");
        },
        packageFiles,
        localOverrideOrigin,
      }),
    ).toThrow(/ENOENT country\.json/);
    expect(packageFiles).not.toHaveBeenCalled();
    expect(localOverrideOrigin).not.toHaveBeenCalled();
  });

  it("publishes neither layer when package enumeration fails", () => {
    const localOverrideOrigin = vi.fn(() => "local" as const);
    expect(() =>
      buildFlagIsoCodes({
        expectedPackageFiles: () => ["aa.svg"],
        packageFiles: () => {
          throw new Error("EACCES");
        },
        localOverrideOrigin,
      }),
    ).toThrow(/EACCES/);
    expect(localOverrideOrigin).not.toHaveBeenCalled();
  });

  it("rejects a successful but partial package listing before consulting local overrides", () => {
    const localOverrideOrigin = vi.fn(() => "local" as const);
    expect(() =>
      buildFlagIsoCodes({
        expectedPackageFiles: () => ["aa.svg", "bb.svg"],
        packageFiles: () => ["aa.svg"],
        localOverrideOrigin,
      }),
    ).toThrow(/incomplete flag-icons package: missing bb\.svg/);
    expect(localOverrideOrigin).not.toHaveBeenCalled();
  });

  it("rejects a complete package listing when any local override is unavailable", () => {
    expect(() =>
      buildFlagIsoCodes({
        expectedPackageFiles: () => ["aa.svg"],
        packageFiles: () => ["aa.svg"],
        localOverrideOrigin: () => "package",
      }),
    ).toThrow(/local override/);
  });

  it("does not memoise a failed load and retries the whole transaction", () => {
    let attempts = 0;
    const load = memoizeFlagCatalogue(() => {
      attempts++;
      if (attempts === 1) throw new Error("transient package read failure");
      return new Set(["AA", "BB"]);
    });

    expect(load).toThrow(/transient package read failure/);
    expect([...load()]).toEqual(["AA", "BB"]);
    expect(load()).toBe(load());
    expect(attempts).toBe(2);
  });
});

describe("final flag byte read", () => {
  it.each(["local", "package"] as const)("propagates an admitted %s-layer read fault", (layer) => {
    const local = tempDirWith({});
    const pkg = tempDirWith({});
    const code = layer === "local" ? "XX" : "YY";
    const file = `${code.toLowerCase()}.svg`;
    mkdirSync(join(layer === "local" ? local : pkg, file));

    const overrides = layer === "local" ? { [code]: file } : {};
    expect(() => readFlagSvg(code, overrides, { local, package: pkg })).toThrow();
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

describe("flagParamToIso — the allow-list gate on the public flag route", () => {
  it("accepts a code the set actually carries and normalises its case", () => {
    // Asserting through the live Set rather than a literal keeps this a test of the GATE, not
    // of which countries happen to exist in the package.
    const [someIso] = [...flagIsoCodes()];
    expect(someIso).toBeDefined();
    expect(flagParamToIso(`${someIso}.svg`)).toBe(someIso);
    expect(flagParamToIso(`${someIso!.toLowerCase()}.svg`)).toBe(someIso);
  });

  it("rejects every traversal shape before anything touches the filesystem", () => {
    // Each of these reached `path.join` + `readFileSync` unvalidated before this gate existed.
    // `join()` collapses the parent-directory segments, so one of them resolved to a real file
    // OUTSIDE the flag directory and was returned with a 200 from this site's own origin — and
    // SVG is active content, so navigating to such a URL runs any script it carries in our
    // origin. The encoded variants matter because params are decoded per-segment by the
    // router, so an encoded separator survives to this string as a real one.
    for (const param of [
      "../../../../etc/hosts.svg",
      "../../../assets/flags/qn.svg",
      "..%2f..%2fqn.svg",
      "%2e%2e%2fqn.svg",
      "a/b.svg",
      "TR/../TR.svg",
      " TR.svg",
      "T\0R.svg",
    ]) {
      expect(flagParamToIso(param), param).toBeNull();
    }
  });

  it("rejects a well-formed code that is simply not ours", () => {
    // The two-letter shape is not enough on its own: membership is what makes the served set
    // and the prerendered set the same set. `ZZ` has the right shape and no asset.
    expect(flagParamToIso("ZZ.svg")).toBeNull();
  });

  it("rejects the package's keys that are not ISO alpha-2 shaped", () => {
    // Measured live before the fix: /flags/ES-CT.svg, /flags/GB-ENG.svg and /flags/EU.svg all
    // returned 200. The first two die on the shape check here.
    for (const param of ["ES-CT.svg", "GB-ENG.svg", "SH-AC.svg", "ARAB.svg", "ASEAN.svg"]) {
      expect(flagParamToIso(param), param).toBeNull();
    }
  });

  it("still admits two-letter package keys outside our corpus — a different layer stops those", () => {
    // Worth stating, because the first draft of this file asserted the opposite and CI caught
    // it. `EU` is two ASCII letters and the package carries `eu.svg`, so it passes here; so do
    // 58 territory codes (`ai`, `aw`, `fk`, `gi`, `je`, …) that are perfectly valid ISO
    // alpha-2 and simply have no page on this site.
    //
    // That is the design, not a leak, and the two boundaries are different:
    //   * THIS gate bounds the FILESYSTEM READ to the flag directories. That is the security
    //     property, and it holds for every input.
    //   * `loadFlagSvgForRequest` intersects this asset Set with the current API corpus before
    //     the read. That is the corpus property, and it keeps /flags/EU.svg at 404 while still
    //     admitting a country learned after the web build.
    expect(flagParamToIso("EU.svg")).toBe("EU");
    expect(flagIsoCodes().has("EU")).toBe(true);
  });

  it("rejects anything without the .svg suffix, including a bare code", () => {
    expect(flagParamToIso("TR")).toBeNull();
    expect(flagParamToIso("TR.png")).toBeNull();
    expect(flagParamToIso("")).toBeNull();
    expect(flagParamToIso(".svg")).toBeNull();
  });
});
