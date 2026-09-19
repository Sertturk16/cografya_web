import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stripComments, stripCssComments } from "@/lib/test-support/strip-comments";
import { FAULT_IDENTITY, faultIdentityOf, type FaultId } from "./fault-identity";
import { FAULT_TINTS } from "./fault-palette.test";

/**
 * The table is self-consistent, and every token it names is one `app/globals.css` declares.
 *
 * Its risk is not arithmetic, it is copy-paste: three near-identical entries, written out in
 * full because Tailwind cannot see an assembled class, where one stale `daf` inside the `bafs`
 * entry paints a fault in another fault's colour and renders perfectly. So every assertion
 * below is of the form "this entry names ITS OWN token and no other's".
 */
const IDS: readonly FaultId[] = ["kaf", "daf", "bafs"];

/** Every member that is a class string, so a new one cannot quietly go unchecked. */
const CLASS_MEMBERS = ["label", "surface", "badge", "articleEdge", "card", "chip"] as const;

describe("the fault identity table", () => {
  it("covers exactly the three faults the token set declares — no more, no fewer", () => {
    expect(Object.keys(FAULT_IDENTITY).sort()).toEqual([...IDS].sort());
    expect(Object.keys(FAULT_TINTS).sort()).toEqual([...IDS].sort());
  });

  it("checks every class member, not a sample — positive control", () => {
    // If a member is added to the interface and not to this list, the per-member assertions
    // below would silently stop covering it.
    for (const id of IDS) {
      const stringKeys = Object.entries(FAULT_IDENTITY[id])
        .filter(([, v]) => typeof v === "string" && v !== id)
        .map(([k]) => k)
        .sort();
      expect(stringKeys).toEqual([...CLASS_MEMBERS].sort());
    }
  });

  it.each(IDS)("%s names its own token in every member, and no other fault's", (id) => {
    for (const member of CLASS_MEMBERS) {
      const value = FAULT_IDENTITY[id][member];
      expect(value, `${id}.${member} names no --fault-${id} token`).toContain(`--fault-${id}`);
      for (const other of IDS) {
        if (other === id) continue;
        expect(
          value.includes(`--fault-${other}-`) || value.includes(`--fault-${other})`),
          `${id}.${member} names --fault-${other} — a fault is wearing another's colour`,
        ).toBe(false);
      }
    }
  });

  it.each(IDS)("%s's id field is its own key", (id) => {
    expect(FAULT_IDENTITY[id].id).toBe(id);
    expect(faultIdentityOf(id)).toBe(FAULT_IDENTITY[id]);
  });

  it.each(IDS)("%s's badge carries all three members the tint surface needs", (id) => {
    // A badge missing its border reads as a flat chip; a badge missing its label inherits
    // whatever colour is around it, which is exactly the shape that made six of seven region
    // badges disagree with their own map fill.
    expect(FAULT_IDENTITY[id].badge).toContain(`--fault-${id}-tint`);
    expect(FAULT_IDENTITY[id].badge).toContain(`--fault-${id}-text`);
    expect(FAULT_IDENTITY[id].badge).toContain(`border-[var(--fault-${id})]/30`);
  });

  it("gives every fault a DIFFERENT string in every member", () => {
    // The blunt version of the copy-paste check: three entries, one value each, no collisions.
    for (const member of CLASS_MEMBERS) {
      const values = IDS.map((id) => FAULT_IDENTITY[id][member]);
      expect(new Set(values).size, `two faults share the same ${member}`).toBe(IDS.length);
    }
  });

  it("names only tokens app/globals.css actually declares", () => {
    const css = stripCssComments(
      readFileSync(fileURLToPath(new URL("../../app/globals.css", import.meta.url)), "utf8"),
    );
    const declared = new Set([...css.matchAll(/(--fault-[a-z-]+)\s*:/g)].map((m) => m[1]!));
    // Anti-vacuity: an empty set would make the loop below pass against a module naming
    // anything at all.
    expect(declared.size).toBe(9);
    const source = stripComments(
      readFileSync(fileURLToPath(new URL("./fault-identity.ts", import.meta.url)), "utf8"),
    );
    const referenced = new Set([...source.matchAll(/var\((--fault-[a-z-]+)\)/g)].map((m) => m[1]!));
    expect(referenced.size).toBeGreaterThan(0);
    for (const token of referenced) {
      expect(declared.has(token), `${token} is used here but declared nowhere`).toBe(true);
    }
  });

  it("spells no raw palette class and inlines no colour value", () => {
    // The module that exists to remove raw hues must not be the file that keeps one. Comments
    // stripped: the docblock names `badgeClass` and the files it replaced, and an un-stripped
    // read could be tripped by prose.
    const source = stripComments(
      readFileSync(fileURLToPath(new URL("./fault-identity.ts", import.meta.url)), "utf8"),
    );
    expect(source).toMatch(/FAULT_IDENTITY/);
    expect(source).not.toMatch(
      /\b(?:text|bg|border|from|to|via|ring|fill|stroke)-(?:red|blue|emerald|amber|orange|rose|cyan|teal)-\d{2,3}\b/,
    );
    expect(source).not.toMatch(/#[0-9a-fA-F]{6}/);
  });
});
