import { describe, expect, it } from "vitest";
import { resolveName } from "../../scripts/lib/osm-names.mjs";

/**
 * The OSM display-name precedence, pinned.
 *
 * This is the one rule in the inland-water pipeline that has ALREADY been wrong in a shipped
 * commit: the resolver preferred `name:en` over `name`, and the committed snapshot carried
 * "Atatürk Reservoir", "Akyatan Lagoon" and "Hirfanlı Dam" into a Turkish-first product.
 * Nothing caught it — no test existed, and `scripts/fetch-tr-inland-water.mjs` cannot host
 * one because it fires a network request at import time (PR #39 review T3).
 *
 * The failure mode this guards is a QUIET one. Reordering the two fallbacks changes no type,
 * no shape and no count; it changes ~6 strings in a 1.1 MB snapshot that no Faz-1 surface
 * renders yet, so it would surface for the first time in front of a reader on the day the
 * label layer ships. The test lives beside the artifact tests, and imports the script module
 * directly, exactly as `path-encode.test.ts` does.
 *
 * STRUCTURE, NOT FACTS. Nothing here asserts what any real lake is called; the inputs are
 * synthetic tag bags that isolate one precedence decision each. Which name OSM actually
 * carries for a given body is a source-data question the snapshot answers.
 */

describe("resolveName", () => {
  it("prefers an explicit Turkish name above everything else", () => {
    expect(
      resolveName({
        "name:tr": "Atatürk Barajı",
        name: "Ataturk Baraji",
        "name:en": "Ataturk Dam",
      }),
    ).toBe("Atatürk Barajı");
  });

  it("prefers the untagged name over the English one — the ordering that regressed", () => {
    // THE assertion this file exists for. On a Turkish feature the plain `name` IS the
    // Turkish name; `name:en` is a translation FOR foreigners. A resolver that reads
    // `name:tr → name:en → name` passes every other test in this file and fails this one.
    expect(resolveName({ name: "Akyatan Gölü", "name:en": "Akyatan Lagoon" })).toBe("Akyatan Gölü");
  });

  it("falls back to the English name only when nothing else is tagged", () => {
    expect(resolveName({ "name:en": "Some Lake" })).toBe("Some Lake");
  });

  it("returns null for an unnamed feature rather than a placeholder string", () => {
    // The caller prints "unnamed" in its reject report; inventing a name here would put a
    // fabricated string into the committed ODbL snapshot.
    expect(resolveName({})).toBeNull();
    expect(resolveName({ natural: "water", water: "lake" })).toBeNull();
  });
});
