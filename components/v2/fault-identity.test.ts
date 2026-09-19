import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stripComments } from "@/lib/test-support/strip-comments";
import { FAULT_IDENTITY, type FaultId } from "@/lib/theme/fault-identity";

const IDS: readonly FaultId[] = ["kaf", "daf", "bafs"];

/**
 * The classes this task exists to remove: a palette family with a numeric shade.
 *
 * A local copy of `scripts/palette-inventory.mjs`'s `RAW_PALETTE` shape rather than an import of
 * it, for the reason `basin-identity.test.ts` states: that regex carries the `g` flag for the
 * counter, and a shared `g` regex is stateful across `.test()` calls.
 */
const RAW_HUE =
  /\b(?:text|bg|border|from|to|via|ring|fill|stroke|decoration|outline|shadow|accent|caret|divide)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950)\b/;

const read = (rel: string): string =>
  stripComments(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8"));

/**
 * Brace matcher, so an assertion can be scoped to the block that PRODUCES a field rather than
 * run against a whole file. Skips strings and comments, and throws rather than returning a
 * short block, so it fails closed.
 *
 * A local copy for the same reason the other three identity pins each carry one: these pins
 * must not be able to break each other.
 */
function matchBraces(source: string, open: number, pair: "{}" | "[]" = "{}"): string {
  const [OPEN, CLOSE] = [pair[0]!, pair[1]!];
  let depth = 0;
  let quote: string | null = null;
  let comment: "line" | "block" | null = null;
  for (let i = open; i < source.length; i++) {
    const c = source[i]!;
    if (comment === "line") {
      if (c === "\n") comment = null;
      continue;
    }
    if (comment === "block") {
      if (c === "*" && source[i + 1] === "/") {
        comment = null;
        i++;
      }
      continue;
    }
    if (quote !== null) {
      if (c === "\\") i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === "/" && source[i + 1] === "/") {
      comment = "line";
      i++;
    } else if (c === "/" && source[i + 1] === "*") {
      comment = "block";
      i++;
    } else if (c === '"' || c === "'" || c === "`") quote = c;
    else if (c === OPEN) depth++;
    else if (c === CLOSE && --depth === 0) return source.slice(open, i + 1);
  }
  throw new Error(`unbalanced ${pair} in the table being read`);
}

/**
 * The offset of a top-level declaration's VALUE, i.e. the bracket after its `=` — never the
 * first bracket after the name, which belongs to the TYPE annotation.
 */
function valueAt(source: string, name: string, pair: "{}" | "[]"): number {
  const decl = source.indexOf(name);
  if (decl < 0) throw new Error(`${name} is not declared in this file`);
  const assign = source.indexOf(`= ${pair[0]!}`, decl);
  if (assign < 0) throw new Error(`${name} has no ${pair[0]!} value`);
  return assign + 2;
}

/**
 * The call sites, pinned on the FIELD that feeds each surface.
 *
 * Every assertion below runs on source with comments STRIPPED, matches the block that produces
 * the field rather than the whole file, and requires exactly ONE producer. That standard is not
 * theoretical: the first version of the region pin in this repo did a file-wide regex and was
 * defeated by right-looking text planted in a line comment.
 *
 * `fay-hatlari/page.tsx` earns the harshest version of it. Its metric strip is hand-rolled
 * precisely so its three figures can carry the fault hues, and the ruling in its own comment
 * says the tile colour "has to agree with the card below it". Agreement used to mean two files
 * being compared by eye; a per-fault producer check is what makes it a property.
 */
describe("every fault surface reads the one module, and names its own fault", () => {
  it("fault-lines-data: each zone's three class fields come from its own identity", () => {
    const source = read("../../lib/earthquake/fault-lines-data.ts");
    const data = matchBraces(source, valueAt(source, "FAULT_LINES_DATA", "[]"), "[]");
    // Anti-vacuity: the slice really is the array, not an empty or truncated match.
    expect(data, "the FAULT_LINES_DATA slice is not the array").toContain("badgeClass");

    for (const id of IDS) {
      // Per ENTRY, not per file: the entry that declares `id: "daf"` must be the entry that
      // reads DAF's identity. A file-wide check would pass on three zones all painted red.
      const idAt = data.indexOf(`id: "${id}"`);
      expect(idAt, `FAULT_LINES_DATA has no entry with id ${id}`).toBeGreaterThan(-1);
      const entry = matchBraces(data, data.lastIndexOf("{", idAt));
      for (const [field, member] of [
        ["badgeClass", "badge"],
        ["borderClass", "articleEdge"],
        ["accentColor", "label"],
      ] as const) {
        const producer = `${field}: FAULT_IDENTITY.${id}.${member}`;
        expect(entry, `the ${id} entry's ${field} does not read its own identity`).toContain(
          producer,
        );
        // Exactly one producer, file-wide. A second spelling anywhere — decoy, copy-paste, or a
        // real second badge nobody has measured — reds this.
        expect(
          source.split(producer).length - 1,
          `${producer} must appear exactly once in fault-lines-data.ts`,
        ).toBe(1);
      }
    }
    // Three zones, three of each assignment. A fourth would be a fault wearing something
    // nobody measured; a missing one would be a literal hue coming back.
    for (const field of ["badgeClass:", "borderClass:", "accentColor:"]) {
      expect(data.match(new RegExp(field, "g")), `${field} count in FAULT_LINES_DATA`).toHaveLength(
        3,
      );
    }
  });

  it("deprem/page: the three summary cards each read their own fault, on all three members", () => {
    const source = read("../../app/[locale]/(site)/deprem/page.tsx");
    // Anti-vacuity: the section this pin is about is still in the file.
    expect(source).toContain("Sismotektonik Yapı");
    for (const id of IDS) {
      for (const member of ["card", "label", "chip"] as const) {
        const producer = `FAULT_IDENTITY.${id}.${member}`;
        expect(
          source.split(producer).length - 1,
          `${producer} must appear exactly once in deprem/page.tsx`,
        ).toBe(1);
      }
    }
    // Nine producers and no tenth: a fourth card, or a second spelling of an existing one,
    // has to be looked at rather than counted.
    expect(source.match(/FAULT_IDENTITY\.\w+\.\w+/g)).toHaveLength(9);
  });

  it("fay-hatlari: the metric strip reads the same identities the cards below it do", () => {
    const source = read("../../app/[locale]/(site)/deprem/fay-hatlari/page.tsx");
    // The three coloured figures, one producer each. The fourth tile in that strip carries no
    // fault and is `text-primary`, so it must NOT gain one.
    for (const id of IDS) {
      const producer = `FAULT_IDENTITY.${id}.label`;
      expect(
        source.split(producer).length - 1,
        `${producer} must appear exactly once in fay-hatlari/page.tsx`,
      ).toBe(1);
    }
    expect(source.match(/FAULT_IDENTITY\.\w+\.\w+/g)).toHaveLength(3);
    // …and the cards below still render the data module's fields, which is the other half of
    // "the tile agrees with the card": both ends read the same module.
    for (const field of ["fault.borderClass", "fault.badgeClass", "fault.accentColor"]) {
      expect(source, `the fault article no longer renders ${field}`).toContain(field);
    }
  });

  it.each([
    "../../lib/earthquake/fault-lines-data.ts",
    "../../app/[locale]/(site)/deprem/page.tsx",
    "../../app/[locale]/(site)/deprem/fay-hatlari/page.tsx",
  ])("%s holds no raw palette hue by name", (rel) => {
    // A ratchet the shared budget cannot give: a budget is a ceiling over the whole tree, so a
    // hue coming back here could be paid for by a hue leaving somewhere else. Comments are
    // stripped, because `fay-hatlari` carries a long ruling that DESCRIBES the hues it removed
    // and an un-stripped read would be tripped by the explanation.
    const source = read(rel);
    expect(source.match(new RegExp(RAW_HUE.source, "g"))).toBeNull();
  });

  it("the module the three of them read is the one this file imports — not a lookalike", () => {
    // Positive control on the premise: if `FAULT_IDENTITY` were renamed or emptied, every
    // producer string above would be checking a name that means nothing.
    expect(Object.keys(FAULT_IDENTITY).sort()).toEqual([...IDS].sort());
    for (const id of IDS) {
      expect(FAULT_IDENTITY[id].badge).toContain(`--fault-${id}`);
    }
    for (const rel of [
      "../../lib/earthquake/fault-lines-data.ts",
      "../../app/[locale]/(site)/deprem/page.tsx",
      "../../app/[locale]/(site)/deprem/fay-hatlari/page.tsx",
    ]) {
      expect(read(rel), `${rel} does not import the fault identity module`).toContain(
        'from "@/lib/theme/fault-identity"',
      );
    }
  });
});
