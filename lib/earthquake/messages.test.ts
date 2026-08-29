import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import enMessages from "@/messages/en.json";
import trMessages from "@/messages/tr.json";
import { WINDOW_OPTIONS } from "@/components/earthquake/earthquake-filters";
import { bindingSentenceKey, type EarthquakeBindingKind } from "./binding-sentence";

/**
 * MESSAGE-KEY RESOLUTION GUARD for the `/deprem` surface (the `lib/marine/messages.test.ts`
 * pattern).
 *
 * next-intl's default behaviour for a missing or typo'd key is a `console.error` plus the
 * dotted key path rendered in place of the copy — it does NOT fail the build. On an
 * indexable page that would mean shipping `"Earthquake.heading"` as the `<h1>`, with CI fully
 * green. This file is the net.
 *
 * Unlike `Deniz`/`Marine` (a `"trNarrative"` surface with a genuine TR-only narrative half),
 * `Earthquake` is `"localized"` (§5.14) — its substance is data, not translated prose — so
 * EVERY key is expected in BOTH catalogues, with no TR-only carve-out. The one Turkish-only
 * string this surface renders (`disclaimerTr`) is api DATA, not a message key, and is
 * therefore out of this file's scope entirely (it cannot typo — there is no key to miss).
 *
 * Structural only (`CONVENTIONS.md` §2): every assertion is about whether a key RESOLVES,
 * never about what the copy says.
 */

type Catalogue = Record<string, unknown>;

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

const trEarthquake = flatten((trMessages as Catalogue).Earthquake);
const enEarthquake = flatten((enMessages as Catalogue).Earthquake);

function expectNonEmptyString(catalogue: Map<string, unknown>, key: string): void {
  const value = catalogue.get(key);
  expect(typeof value, `Earthquake.${key} must be a string`).toBe("string");
  expect((value as string).trim().length, `Earthquake.${key} must not be empty`).toBeGreaterThan(0);
}

describe("Earthquake.* — fully symmetric, both locales (localized surface)", () => {
  it("tr and en declare exactly the same key set", () => {
    expect([...enEarthquake.keys()].sort()).toEqual([...trEarthquake.keys()].sort());
  });

  for (const key of [...trEarthquake.keys()].sort()) {
    it(`Earthquake.${key} is a non-empty string in tr and en`, () => {
      expectNonEmptyString(trEarthquake, key);
      expectNonEmptyString(enEarthquake, key);
    });
  }
});

describe("Breadcrumb.deprem resolves in both locales", () => {
  it("is a non-empty string in tr and en", () => {
    const trBreadcrumb = flatten((trMessages as Catalogue).Breadcrumb);
    const enBreadcrumb = flatten((enMessages as Catalogue).Breadcrumb);
    expectNonEmptyString(trBreadcrumb, "deprem");
    expectNonEmptyString(enBreadcrumb, "deprem");
  });
});

describe("dataStatus-driven copy — every state the contract can emit (§5.11)", () => {
  // `EarthquakeMetaDto.dataStatus`/`EarthquakeListMetaDto.dataStatus`'s own three-valued enum
  // (`cografya_api/src/earthquake/earthquake.types.ts`). No runtime array exists on the web
  // side to derive this from (it is a TS union only), so the three values are named here —
  // the same posture `lib/marine/messages.test.ts` takes for the SPEC's own frozen keys.
  const states = ["ok", "stale", "unavailable"] as const;

  for (const state of states) {
    it(`Earthquake.lede.${state} resolves in tr and en`, () => {
      expectNonEmptyString(trEarthquake, `lede.${state}`);
      expectNonEmptyString(enEarthquake, `lede.${state}`);
    });

    it(`Earthquake.meta.freshness.${state} resolves in tr and en`, () => {
      expectNonEmptyString(trEarthquake, `meta.freshness.${state}`);
      expectNonEmptyString(enEarthquake, `meta.freshness.${state}`);
    });
  }

  it("names each dataStatus distinctly — identical copy would misreport a real state", () => {
    for (const catalogue of [trEarthquake, enEarthquake]) {
      const rendered = states.map((state) => catalogue.get(`lede.${state}`));
      expect(new Set(rendered).size).toBe(rendered.length);
    }
  });
});

describe("bindingKind sentence keys — all three states, derived from the source symbol", () => {
  // Derived from `bindingSentenceKey` itself (not hand-listed), so a fourth bindingKind or a
  // renamed key fails here rather than only in `binding-sentence.test.ts`.
  const allStates: EarthquakeBindingKind[] = ["inside", "offshore_near", "across_border"];

  for (const state of allStates) {
    const key = bindingSentenceKey(state);
    if (key === null) {
      it(`"${state}" needs no Earthquake.binding.* key`, () => {
        expect(key).toBeNull();
      });
      continue;
    }
    it(`Earthquake.binding.${key} resolves in tr and en, with a {province} placeholder`, () => {
      expectNonEmptyString(trEarthquake, `binding.${key}`);
      expectNonEmptyString(enEarthquake, `binding.${key}`);
      expect(trEarthquake.get(`binding.${key}`) as string).toContain("{province}");
      expect(enEarthquake.get(`binding.${key}`) as string).toContain("{province}");
    });
  }
});

describe("filter control options — derived from the component's own offered values", () => {
  // Derived from `WINDOW_OPTIONS` (`earthquake-filters.tsx`) rather than hand-listed, so
  // adding a sixth time-window option without writing its copy fails here.
  for (const days of WINDOW_OPTIONS) {
    it(`Earthquake.filters.window${days} resolves in tr and en`, () => {
      expectNonEmptyString(trEarthquake, `filters.window${days}`);
      expectNonEmptyString(enEarthquake, `filters.window${days}`);
    });
  }
});

/**
 * CONSUMER SCAN — the half the hand-maintained assertions above cannot do (the
 * `lib/tools/messages.test.ts` pattern). They can only prove that a key the catalogue
 * declares still resolves; this discovers every STATIC `t("Earthquake.…")` call the actual
 * `/deprem` surface makes and ties it back to the catalogue, so a renamed/typo'd key goes red
 * HERE instead of rendering `Earthquake.meta.freshnessLabel` in production. Caught for real
 * during this build's own render-sample pass — `meta.freshnessLabel` was called from
 * `app/[locale]/deprem/page.tsx` but never declared in either catalogue, and no assertion
 * above it would have failed on that, because none of them read the PAGE's source at all.
 */
const CONSUMER_ROOTS = [
  { label: "app/[locale]/deprem", url: new URL("../../app/[locale]/deprem/", import.meta.url) },
  { label: "components/earthquake", url: new URL("../../components/earthquake/", import.meta.url) },
] as const;

/** `useTranslations("Earthquake")` and both `getTranslations` spellings. */
const DIRECT_NAMESPACE =
  /const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?(?:use|get)Translations\(\s*"(Earthquake)"\s*\)/g;
const OBJECT_NAMESPACE =
  /const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?(?:use|get)Translations\(\s*\{[^}]*namespace:\s*"(Earthquake)"[^}]*\}\s*\)/g;

/** Comments out, so a docblock naming a key is not a request. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");
}

interface EarthquakeBinding {
  readonly path: string;
  readonly binding: string;
  /** STATIC keys only — a literal `t("a.b.c")` call. Backtick/template calls
   *  (`t(\`meta.freshness.${…}\`)`) are covered explicitly by the dedicated describe blocks
   *  above, which know the real closed set of values the interpolation can take; a generic
   *  scanner cannot verify a runtime-computed suffix. */
  readonly requested: readonly string[];
}

function scanEarthquakeBindings(source: string): Omit<EarthquakeBinding, "path">[] {
  const declared = [
    ...source.matchAll(DIRECT_NAMESPACE),
    ...source.matchAll(OBJECT_NAMESPACE),
  ].sort((a, b) => a.index - b.index);

  return declared.map((match, index) => {
    const binding = match[1]!;
    const repeated = declared.filter((entry) => entry[1] === binding).length > 1;
    const next = declared.slice(index + 1).find((later) => later[1] === binding);
    const first = declared.findIndex((entry) => entry[1] === binding) === index;
    const window = repeated
      ? source.slice(first ? 0 : match.index, next?.index ?? source.length)
      : source;
    const calls = new RegExp(String.raw`(?<![\w$.])${binding}\(\s*"([^"]+)"`, "g");
    return { binding, requested: [...window.matchAll(calls)].map((call) => call[1]!) };
  });
}

const earthquakeBindings: EarthquakeBinding[] = CONSUMER_ROOTS.flatMap(({ label, url }) =>
  readdirSync(fileURLToPath(url), { recursive: true, encoding: "utf8" })
    .filter((name) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name))
    .flatMap((name) =>
      scanEarthquakeBindings(
        stripComments(readFileSync(fileURLToPath(new URL(name, url)), "utf8")),
      ).map((entry) => ({ ...entry, path: `${label}/${name}` })),
    ),
);

describe("the consumer scan itself", () => {
  // POSITIVE CONTROL — fabricated source, not the files it measures: a green suite below
  // means both "every static key resolves" and "the scan actually found the binding".
  const FIXTURE =
    'export async function generateMetadata() { const t = await getTranslations({ locale, namespace: "Earthquake" }); return t("metaTitle"); }';

  it("finds a binding and its requested key in a fabricated source", () => {
    expect(scanEarthquakeBindings(FIXTURE)).toEqual([{ binding: "t", requested: ["metaTitle"] }]);
  });
});

describe("every static Earthquake.* key the code asks for exists", () => {
  it("discovers at least one real Earthquake.* consumer — anti-vacuity", () => {
    expect(earthquakeBindings.length).toBeGreaterThan(0);
    expect(earthquakeBindings.some((entry) => entry.requested.length > 0)).toBe(true);
  });

  it.each(earthquakeBindings.filter((entry) => entry.requested.length > 0))(
    "$path asks for static keys the catalogue carries",
    (entry) => {
      for (const key of entry.requested) {
        expectNonEmptyString(trEarthquake, key);
      }
    },
  );
});
