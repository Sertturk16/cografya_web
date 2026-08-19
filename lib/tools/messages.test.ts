import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import enMessages from "@/messages/en.json";
import trMessages from "@/messages/tr.json";

/**
 * MESSAGE-KEY RESOLUTION GUARD for the CBS tool tier (the `lib/marine/messages.test.ts`
 * pattern, → PR #73 review `TEST73-I1`).
 *
 * next-intl does not fail a build on a missing key — it logs and renders the dotted key path.
 * On this tier that path reaches the SEO surface directly:
 * `app/[locale]/araclar/mesafe-olcme/page.tsx` feeds `Tools.mesafe.metaTitle` and
 * `metaDescription` straight into `buildMetadata`, so one renamed key ships
 * `<title>Tools.mesafe.metaTitle</title>` on an indexable page with all three CI jobs green
 * (`ENGINEERING.md` §4 #2).
 *
 * The TR-only / both-locale split is the second half and the sharper one. Only ten keys are
 * rendered outside the `rendersProse` / `rendersIntro` gates; the rest exist in Turkish alone
 * because `SEO-POLICY.md` §B14 bars machine-translating the narrative. Nothing pinned that
 * boundary, and PR-C/PR-D are obliged to rewrite several of these same keys.
 *
 * Structural only (`CONVENTIONS.md` §2): every assertion is about whether a key RESOLVES, what
 * shape its value has, or which catalogue carries it — never about what any string says. The
 * one content-shaped assertion is a licence NEGATIVE guard on our own catalogue (AK-32), which
 * is the `components/book/attribution-gate.test.ts` precedent rather than a fact assertion.
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

const trTools = flatten((trMessages as Catalogue).Tools);
const enTools = flatten((enMessages as Catalogue).Tools);

/**
 * The namespaces whose copy is gated behind `locale === routing.defaultLocale`, and the ones
 * that are pure interface vocabulary and therefore symmetric. Asserted against the catalogue
 * below, so a new `Tools.*` namespace cannot slip past this file by not being mentioned in it.
 */
const PROSE_NAMESPACES = ["hub", "mesafe"] as const;
const CHROME_NAMESPACES = ["map", "ui"] as const;

/** Keys inside a prose namespace that BOTH locales render — head, headings, cards, JSON-LD. */
const BOTH_LOCALE_KEYS = [
  "hub.metaTitle",
  "hub.metaDescription",
  "hub.heading",
  "hub.mesafeName",
  "hub.mesafeBody",
  "mesafe.metaTitle",
  "mesafe.metaDescription",
  "mesafe.heading",
  "mesafe.teaches",
  "mesafe.toolHeading",
] as const;

/** Keys inside a prose namespace that exist in Turkish ONLY (§B14, the `/deniz` precedent). */
const TR_ONLY_KEYS = [
  "hub.introP1",
  "hub.introP2",
  "mesafe.lede",
  "mesafe.nedirHeading",
  "mesafe.nedirP1",
  "mesafe.nedirP2",
  "mesafe.karayoluHeading",
  "mesafe.karayoluP1",
  "mesafe.karayoluP2",
  "mesafe.olcekHeading",
  "mesafe.olcekP1",
  "mesafe.olcekP2",
  "mesafe.olcekP3",
  "mesafe.buyukdaireHeading",
  "mesafe.buyukdaireP1",
  "mesafe.buyukdaireP2",
  "mesafe.buyukdaireP3",
  "mesafe.sonucHeading",
  "mesafe.sonucP1",
  "mesafe.sonucP2",
  "mesafe.sonucP3",
  "mesafe.kaynak",
] as const;

function expectNonEmptyString(catalogue: Map<string, unknown>, key: string): void {
  const value = catalogue.get(key);
  expect(typeof value, `Tools.${key} must be a string`).toBe("string");
  expect((value as string).trim().length, `Tools.${key} must not be empty`).toBeGreaterThan(0);
}

function keysUnder(catalogue: Map<string, unknown>, namespace: string): string[] {
  return [...catalogue.keys()].filter((key) => key.startsWith(`${namespace}.`)).sort();
}

describe("the Tools namespace is fully classified", () => {
  it("declares exactly the namespaces this file knows how to judge", () => {
    // The anchor for everything below: a new `Tools.alan` namespace has to be classified as
    // prose or chrome here before its keys can ship, rather than silently falling outside
    // every assertion in this file.
    expect(Object.keys((trMessages as Catalogue).Tools as Catalogue).sort()).toEqual(
      [...PROSE_NAMESPACES, ...CHROME_NAMESPACES].sort(),
    );
  });

  it("classifies every prose key as both-locale or TR-only, in both directions", () => {
    const declared = [...BOTH_LOCALE_KEYS, ...TR_ONLY_KEYS].sort();
    const actual = PROSE_NAMESPACES.flatMap((namespace) => keysUnder(trTools, namespace)).sort();
    // Equality, not containment: a new prose key must be classified (or it is unguarded), and a
    // classified key that no longer exists must be removed (or the lists rot into a claim about
    // yesterday's catalogue — review `TA56-M4`).
    expect(actual).toEqual(declared);
  });
});

describe("Tools.* keys both locales render", () => {
  for (const key of BOTH_LOCALE_KEYS) {
    it(`Tools.${key} is a non-empty string in tr and en`, () => {
      expectNonEmptyString(trTools, key);
      expectNonEmptyString(enTools, key);
    });
  }
});

describe("Tools.* keys that are Turkish-only by policy", () => {
  for (const key of TR_ONLY_KEYS) {
    it(`Tools.${key} exists in tr and NOT in en`, () => {
      expectNonEmptyString(trTools, key);
      // The absence is the assertion. `SEO-POLICY.md` §B14 bars machine-translating the
      // narrative, so `/en/tools*` renders the notice instead of these blocks. If genuine
      // English prose is ever WRITTEN, this is the reminder that the render gate has to open in
      // the same commit — the same shape `lib/marine/messages.test.ts` uses for `/en/sea`.
      expect(enTools.has(key)).toBe(false);
    });
  }
});

describe("Tools.* interface vocabulary is symmetric", () => {
  for (const namespace of CHROME_NAMESPACES) {
    it(`Tools.${namespace} declares the same key set in tr and en`, () => {
      expect(keysUnder(enTools, namespace)).toEqual(keysUnder(trTools, namespace));
    });

    it(`every Tools.${namespace} value is a non-empty string in both locales`, () => {
      const keys = keysUnder(trTools, namespace);
      expect(keys.length).toBeGreaterThan(0);
      for (const key of keys) {
        expectNonEmptyString(trTools, key);
        expectNonEmptyString(enTools, key);
      }
    });
  }

  it("keeps every cardinal letter exactly one character long", () => {
    // `lib/map/measure.ts`'s `CardinalLetters` contract, pinned at the BUNDLE for the first
    // time (→ review `CODE73-M10`). Its own test pins local fixtures, not these values, so a
    // copy edit to "Kuzey"/"North" would make every typed DMS coordinate unreadable — killing
    // the primary keyboard input path with CI green.
    for (const key of ["ui.north", "ui.south", "ui.east", "ui.west"]) {
      expect((trTools.get(key) as string).length, `Tools.${key} (tr)`).toBe(1);
      expect((enTools.get(key) as string).length, `Tools.${key} (en)`).toBe(1);
    }
  });
});

describe("licence compliance of the shipped tool copy", () => {
  // Atlas ruling AK-32: KGM's site terms bar commercial use, so its road-distance figure and
  // its name stay out of shipped strings (`CONVENTIONS.md` §7). The road-distance block names
  // only the DIRECTION of the difference. md.7.1 obliges PR-C/PR-D to restore three-tool
  // wording from the same draft revision that once carried the KGM sentence, which is why this
  // is a standing gate rather than the one-time grep it was.
  const BARRED_SOURCE = /\bKGM\b|Karayolları Genel Müdürlüğü/i;

  it("names no barred source anywhere in the Tools catalogue", () => {
    for (const [catalogue, label] of [
      [trTools, "tr"],
      [enTools, "en"],
    ] as const) {
      for (const [key, value] of catalogue) {
        expect(BARRED_SOURCE.test(String(value)), `Tools.${key} (${label})`).toBe(false);
      }
    }
  });

  it("uses a pattern that can actually see the barred source", () => {
    // Self-check: without it the assertion above means both "clean" and "the pattern is wrong",
    // and nothing in a green run tells the two apart. The control literals live here, never in
    // the catalogue they measure.
    for (const control of ["Kaynak: KGM, 2024.", "Karayolları Genel Müdürlüğü verisi"]) {
      expect(BARRED_SOURCE.test(control)).toBe(true);
    }
    expect(BARRED_SOURCE.test("Karayolu mesafesinden farkı")).toBe(false);
  });
});

/**
 * CONSUMER SCAN — the half the hand-maintained lists above cannot do.
 *
 * The lists can only prove that yesterday's keys still resolve. Discovering every file that
 * reaches for a `Tools.*` namespace, and reading the keys it asks for, ties them to the code:
 * a key requested by a file these lists have never heard of goes red here instead of rendering
 * its own dotted path in production (`components/site-nav/messages.test.ts:61-72`).
 */
const CONSUMER_ROOTS = [
  { label: "app/[locale]/araclar", url: new URL("../../app/[locale]/araclar/", import.meta.url) },
  { label: "components/tools", url: new URL("../../components/tools/", import.meta.url) },
] as const;

interface ToolsBinding {
  readonly path: string;
  /** The local translator name, e.g. `t` or `tHub`. */
  readonly binding: string;
  /** The namespace it was opened with, e.g. `Tools.hub`. */
  readonly namespace: string;
  readonly requested: readonly string[];
}

/** `useTranslations("Tools.ui")` and both `getTranslations` spellings. */
const DIRECT_NAMESPACE =
  /const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?(?:use|get)Translations\(\s*"([^"]+)"\s*\)/g;
const OBJECT_NAMESPACE =
  /const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?(?:use|get)Translations\(\s*\{[^}]*namespace:\s*"([^"]+)"[^}]*\}\s*\)/g;

const bindings: ToolsBinding[] = CONSUMER_ROOTS.flatMap(({ label, url }) =>
  readdirSync(fileURLToPath(url), { recursive: true, encoding: "utf8" })
    .filter((name) => /\.(?:ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name))
    .flatMap((name) => {
      // Comments stripped first: a docblock naming a key must not be read as a request, and a
      // docblock naming a namespace must not mint a binding.
      const source = readFileSync(fileURLToPath(new URL(name, url)), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/^[ \t]*\/\/.*$/gm, " ");
      const declared = [
        ...source.matchAll(DIRECT_NAMESPACE),
        ...source.matchAll(OBJECT_NAMESPACE),
      ].filter((match) => match[2]?.startsWith("Tools"));

      return declared.map((match) => {
        const binding = match[1]!;
        const namespace = match[2]!;
        // `(?<![\w$.])` keeps `t(` from matching `format.t(` or `next(`; `.rich` is how the
        // page passes the two province links into `karayoluP1`.
        const calls = new RegExp(String.raw`(?<![\w$.])${binding}(?:\.rich)?\(\s*"([^"]+)"`, "g");
        return {
          path: `${label}/${name}`,
          binding,
          namespace,
          requested: [...source.matchAll(calls)].map((call) => call[1]!),
        };
      });
    }),
);

describe("every Tools key the code asks for exists", () => {
  it("discovers a consumer for each of the four namespaces", () => {
    // Anti-vacuity, and the reason it is an equality: a scan that found nothing, or that lost a
    // surface to a refactor, would satisfy every per-key assertion below by having nothing to
    // check.
    expect([...new Set(bindings.map((entry) => entry.namespace))].sort()).toEqual([
      "Tools.hub",
      "Tools.map",
      "Tools.mesafe",
      "Tools.ui",
    ]);
  });

  it.each(bindings)("$path asks $namespace for keys the catalogue carries", (entry) => {
    expect(
      entry.requested.length,
      `${entry.path}: ${entry.binding} requests no key`,
    ).toBeGreaterThan(0);
    for (const key of entry.requested) {
      expectNonEmptyString(trTools, `${entry.namespace.replace(/^Tools\./, "")}.${key}`);
    }
  });
});
