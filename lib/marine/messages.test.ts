import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import enMessages from "@/messages/en.json";
import trMessages from "@/messages/tr.json";
import { COMPASS_POINTS, MARINE_COMPASS_KEY, MARINE_DIRECTION_CONVENTION_KEY } from "./direction";
import { MARINE_EXPLAINER_KEYS } from "./explainers";
import { MARINE_UNIT_KEY } from "./units";
import { MARINE_FRESHNESS_STALE_KEY, MARINE_VALUE_STATUS_KEY } from "./value-state";

/**
 * MESSAGE-KEY RESOLUTION GUARD for the `/deniz` surface (the I7 regression-guard pattern,
 * as used by `lib/seo/province-description.test.ts`).
 *
 * next-intl's default behaviour for a missing or typo'd key is a `console.error` plus the
 * dotted key path rendered in place of the copy — it does NOT fail the build. On `/deniz`
 * that would mean shipping "Deniz.a4" as an indexable paragraph, or "Marine" in a table
 * cell, with CI fully green. This file is the net: every key the marine surface can emit
 * must exist and be a non-empty string in the catalogue that is expected to carry it.
 *
 * Structural only (`CONVENTIONS.md` §2): it asserts that keys RESOLVE, never what the copy
 * says. Wording is the content pipeline's business, not a test's.
 */

type Catalogue = Record<string, unknown>;

/** Walks a nested message object into `a.b.c` → value pairs. */
function flatten(node: unknown, prefix = ""): Map<string, unknown> {
  const out = new Map<string, unknown>();
  if (typeof node !== "object" || node === null) return out;

  for (const [key, value] of Object.entries(node as Catalogue)) {
    const path = prefix === "" ? key : `${prefix}.${key}`;
    if (typeof value === "object" && value !== null) {
      for (const [nested, nestedValue] of flatten(value, path)) out.set(nested, nestedValue);
    } else {
      out.set(path, value);
    }
  }
  return out;
}

const trDeniz = flatten((trMessages as Catalogue).Deniz);
const enDeniz = flatten((enMessages as Catalogue).Deniz);
const trMarine = flatten((trMessages as Catalogue).Marine);
const enMarine = flatten((enMessages as Catalogue).Marine);

/** The `Deniz` keys that hold the Turkish-only narrative; everything else is chrome. */
const explainerKeys = new Set<string>(
  MARINE_EXPLAINER_KEYS.flatMap((entry) => [entry.question, entry.answer]),
);

function expectNonEmptyString(catalogue: Map<string, unknown>, key: string): void {
  const value = catalogue.get(key);
  expect(typeof value, `${key} must be a string`).toBe("string");
  expect((value as string).trim().length, `${key} must not be empty`).toBeGreaterThan(0);
}

describe("Deniz.* explainer keys resolve (I7 regression guard)", () => {
  // Derived from the declaration itself, not hand-copied: adding an eighth block to
  // MARINE_EXPLAINER_KEYS without writing its copy fails here instead of in production.
  for (const entry of MARINE_EXPLAINER_KEYS) {
    it(`tr.json Deniz.${entry.question} / Deniz.${entry.answer} are non-empty strings`, () => {
      expectNonEmptyString(trDeniz, entry.question);
      expectNonEmptyString(trDeniz, entry.answer);
    });
  }

  it("en.json deliberately carries NO explainer keys (the machine-translation ban)", () => {
    // `SEO-POLICY.md` §B14 bars machine-translating the narrative, so `/en/sea` renders no
    // blocks at all (`rendersExplainers`). If genuine English blocks are ever WRITTEN, this
    // assertion is the reminder that the render gate has to open in the same commit.
    const present = [...explainerKeys].filter((key) => enDeniz.has(key));
    expect(present).toEqual([]);
  });
});

describe("Deniz.* chrome keys exist in both catalogues", () => {
  // Everything that is not narrative renders in BOTH locales (title, lede, headings,
  // Kaynaklar). Derived from the TR catalogue so a newly added chrome key cannot be
  // forgotten on the English side.
  for (const key of [...trDeniz.keys()].filter((key) => !explainerKeys.has(key))) {
    it(`Deniz.${key} is a non-empty string in tr and en`, () => {
      expectNonEmptyString(trDeniz, key);
      expectNonEmptyString(enDeniz, key);
    });
  }
});

describe("Marine.* keys exist in both catalogues", () => {
  // The `Marine` namespace is pure UI vocabulary (units, direction conventions, status
  // words, table chrome) — no narrative — so it is fully symmetric by design, and the
  // symmetry itself is the invariant worth pinning.
  it("tr and en declare exactly the same key set", () => {
    expect([...enMarine.keys()].sort()).toEqual([...trMarine.keys()].sort());
  });

  for (const key of [...trMarine.keys()].sort()) {
    it(`Marine.${key} is a non-empty string in tr and en`, () => {
      expectNonEmptyString(trMarine, key);
      expectNonEmptyString(enMarine, key);
    });
  }

  it("carries the six SPEC §7.14 frozen keys the value band renders", () => {
    // The SPEC freezes these strings by name. The remaining two are born with the things they
    // annotate — `straits.lowConfidence` with the province section (W2b) and
    // `series.sourceDiffersNotice` with the chart it explains (W2c) — per the mapping block in
    // `app/[locale]/deniz/page.tsx`.
    const frozen = [
      "disclaimer.educationalOnly",
      "point.referencePointHint",
      "status.notSupported",
      "status.noData",
      "status.unavailable",
      "freshness.stale",
    ];
    for (const key of frozen) {
      expectNonEmptyString(trMarine, key);
      expectNonEmptyString(enMarine, key);
    }
  });

  it("declares catalogue.nextPhase as a string distinct from status.notSupported", () => {
    // HALF of the A1 guard: the two CATALOGUE ENTRIES must not carry the same copy. Atlas
    // ruling A1 moved the catalogue's "arriving later" wording to its own key so one string
    // could not mean both that and the contract's "never arriving" one section apart. This
    // assertion sees only the JSON — the component half is the test below it, and the two
    // are deliberately separate because each catches a different way of undoing A1.
    expectNonEmptyString(trMarine, "catalogue.nextPhase");
    expectNonEmptyString(enMarine, "catalogue.nextPhase");
    expect(trMarine.get("status.notSupported")).not.toBe(trMarine.get("catalogue.nextPhase"));
    expect(enMarine.get("status.notSupported")).not.toBe(enMarine.get("catalogue.nextPhase"));
  });
});

describe("the catalogue COMPONENT renders the key A1 gave it", () => {
  /**
   * The other half of the A1 guard, and the one the catalogue assertions above cannot make.
   *
   * Reverting `layer-catalogue.tsx` to `tm("status.notSupported")` leaves both catalogue
   * entries in place and every JSON assertion green, while putting the frozen key back in
   * the status column — precisely the state A1 exists to prevent. This repo's vitest
   * environment is `node`, and the catalogue is an async server component that awaits
   * `next-intl/server`, so it cannot be rendered here; the honest guard at this level is
   * therefore the source symbol, scoped to the ONE file the ruling is about.
   *
   * `value-cell.tsx` and `reference-points.tsx` legitimately reach for the frozen key
   * (through `MARINE_VALUE_STATUS_KEY`, never as a literal) — they are the section where it
   * means what the contract says. Only the catalogue is asserted against.
   */
  const source = readFileSync(
    new URL("../../components/marine/layer-catalogue.tsx", import.meta.url),
    "utf8",
  );

  it('calls tm("catalogue.nextPhase") in the status column', () => {
    expect(source).toMatch(/tm\("catalogue\.nextPhase"\)/);
  });

  it("does not translate the frozen status.notSupported key anywhere in that file", () => {
    expect(source).not.toMatch(/tm\("status\.notSupported"\)/);
  });
});

/**
 * DERIVED-KEY GUARD for the value band (the PR #33 pattern, extended).
 *
 * Every expectation below is read from the TYPE-EXHAUSTIVE map that the rendering code itself
 * uses, never from a list hand-copied into this file. That is the whole point: adding a sixth
 * value state, a ninth compass sector or a fifth unit to the contract makes `tsc` demand a new
 * entry in the map, and this test then demands its copy in both catalogues. A hand-written
 * list here would go stale in exactly the case it exists to catch.
 */
describe("value-band message keys are derived from the render code, not hand-listed", () => {
  const derived: [label: string, keys: string[]][] = [
    ["value status", Object.values(MARINE_VALUE_STATUS_KEY)],
    ["freshness", [MARINE_FRESHNESS_STALE_KEY, "freshness.staleNoInstant"]],
    ["compass sector", Object.values(MARINE_COMPASS_KEY)],
    ["direction convention", Object.values(MARINE_DIRECTION_CONVENTION_KEY)],
    ["unit", Object.values(MARINE_UNIT_KEY)],
  ];

  for (const [label, keys] of derived) {
    for (const key of keys) {
      it(`${label} key Marine.${key} resolves in tr and en`, () => {
        expectNonEmptyString(trMarine, key);
        expectNonEmptyString(enMarine, key);
      });
    }
  }

  it("covers every compass sector the bucketing function can emit", () => {
    expect(Object.keys(MARINE_COMPASS_KEY).sort()).toEqual([...COMPASS_POINTS].sort());
  });

  it("names each of the three non-numeric states distinctly in both catalogues", () => {
    // The five-render rule is only real if the three status words differ. Identical copy would
    // pass every structural check above while telling a reader that a permanent gap and a
    // transient outage are the same thing.
    for (const catalogue of [trMarine, enMarine]) {
      const rendered = Object.values(MARINE_VALUE_STATUS_KEY).map((key) => catalogue.get(key));
      expect(new Set(rendered).size).toBe(rendered.length);
    }
  });
});
