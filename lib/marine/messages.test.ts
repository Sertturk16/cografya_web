import { describe, expect, it } from "vitest";
import enMessages from "@/messages/en.json";
import trMessages from "@/messages/tr.json";
import { MARINE_EXPLAINER_KEYS } from "./explainers";

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

  it("carries the three SPEC §7.14 frozen keys W1a renders", () => {
    // The SPEC freezes these strings by name; the other five are born with the values they
    // annotate (see the mapping block in `app/[locale]/deniz/page.tsx`).
    const frozen = [
      "disclaimer.educationalOnly",
      "status.notSupported",
      "point.referencePointHint",
    ];
    for (const key of frozen) {
      expectNonEmptyString(trMarine, key);
      expectNonEmptyString(enMarine, key);
    }
  });
});
