import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import enMessages from "@/messages/en.json";
import trMessages from "@/messages/tr.json";
import { stripComments } from "@/lib/test-support/strip-comments";
import { WINDOW_OPTIONS } from "./query";
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

describe("resolves the ProvinceDetail keys the earthquake section renders (PR-B)", () => {
  // The same reasoning `lib/marine/messages.test.ts`'s own "resolves the two ProvinceDetail
  // keys the marine section renders" test states: the province section's `<h2>`, its
  // empty-state line, its licence block's heading and its hub-link live in the PAGE's own
  // `ProvinceDetail` namespace, not in `Earthquake.*` — because both are about the province
  // page, not about the earthquake vocabulary — so they fall outside every guard above and
  // need their own.
  const trProvince = flatten((trMessages as Catalogue).ProvinceDetail);
  const enProvince = flatten((enMessages as Catalogue).ProvinceDetail);

  for (const key of [
    "earthquakeHeading",
    "earthquakeEmptyState",
    "earthquakeSourcesHeading",
    "earthquakeHubLink",
  ]) {
    it(`ProvinceDetail.${key} is a non-empty string in tr and en`, () => {
      expectNonEmptyString(trProvince, key);
      expectNonEmptyString(enProvince, key);
    });
  }

  it("earthquakeHeading and earthquakeEmptyState both carry a {name} placeholder", () => {
    // Both are rendered with the province's own name (`t("earthquakeHeading", { name })`);
    // a copy edit that dropped the interpolation would ship a page that never names its own
    // province, which is exactly the class of defect a resolves-only check cannot see.
    for (const key of ["earthquakeHeading", "earthquakeEmptyState"]) {
      expect(trProvince.get(key) as string).toContain("{name}");
      expect(enProvince.get(key) as string).toContain("{name}");
    }
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
  // Derived from `WINDOW_OPTIONS` (`lib/earthquake/query.ts`) rather than hand-listed, so
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
 * `app/[locale]/(site)/deprem/page.tsx` but never declared in either catalogue, and no assertion
 * above it would have failed on that, because none of them read the PAGE's source at all.
 */
const CONSUMER_ROOTS = [
  {
    label: "app/[locale]/(site)/deprem",
    url: new URL("../../app/[locale]/(site)/deprem/", import.meta.url),
  },
  { label: "components/earthquake", url: new URL("../../components/earthquake/", import.meta.url) },
] as const;

/** `useTranslations("Earthquake")` and both `getTranslations` spellings. */
const DIRECT_NAMESPACE =
  /const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?(?:use|get)Translations\(\s*"(Earthquake)"\s*\)/g;
const OBJECT_NAMESPACE =
  /const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?(?:use|get)Translations\(\s*\{[^}]*namespace:\s*"(Earthquake)"[^}]*\}\s*\)/g;

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

describe("declared-but-unconsumed keys — a recorded debt on an exact-list ratchet", () => {
  /**
   * ORPHANS — RECORDED, DELIBERATELY NOT DELETED (the `lib/tools/messages.test.ts` ratchet).
   *
   * The scan above can only prove that a key the code ASKS FOR resolves. This closes the
   * other direction: a key the catalogue DECLARES that no file opens. Both catalogues are
   * fully symmetric (the first describe block asserts that), so measuring TR measures EN.
   *
   * WHY THESE ARE KEPT RATHER THAN DELETED. `EARTHQUAKE_SURFACE` is `"localized"` (§5.14),
   * `/deprem` is in the sitemap, and the page that serves it today — `V2EarthquakeExplorer`
   * plus `app/[locale]/(site)/deprem/page.tsx` — writes ALL of its prose inline, in Turkish,
   * for both locales. So the EN half of this namespace is not dead weight: it is most of the
   * translation a real, still-open localisation defect needs. Deleting it would delete the
   * fix, quietly, and leave nothing recording that the surface is untranslated.
   *
   * TWO ORIGINS, one list:
   *   - The V2 rewrite of `/deprem` stranded the page's own copy (`metaTitle`, `heading`,
   *     `lede.*`, `meta.scopeBuffer*`, `meta.freshness*`) — these were already orphaned
   *     before T-036 and nothing measured them.
   *   - T-036 stranded the rest (`map.*`, `list.emptyState`, `filters.*`) by deleting
   *     `earthquake-map.tsx`/`earthquake-filters.tsx`, the V1 client island no Next.js entry
   *     point reached. `filters.window*` still resolve through `WINDOW_OPTIONS` above; that
   *     block asserts they EXIST, which is a different question from whether anything reads
   *     them, and is why the two can disagree without either being wrong.
   *
   * The list is exact and the assertion is an equality against it, so it ratchets in BOTH
   * directions: a 28th orphan fails here, and so does re-adopting one of these 27 without
   * shortening the list. It cannot quietly become the new normal.
   */
  const ORPHANED_BY_THE_V2_REWRITE_AND_T036 = [
    "filters.apply",
    "filters.loadFailed",
    "filters.loadMore",
    "filters.loading",
    "filters.magnitudeLabel",
    "filters.magnitudeOption",
    "filters.resultsFound",
    "filters.window1",
    "filters.window30",
    "filters.window7",
    "filters.window90",
    "filters.windowLabel",
    "heading",
    "lede.ok",
    "lede.stale",
    "lede.unavailable",
    "list.emptyState",
    "map.description",
    "map.title",
    "meta.freshness.ok",
    "meta.freshness.stale",
    "meta.freshness.unavailable",
    "meta.freshnessLabel",
    "meta.scopeBufferLabel",
    "meta.scopeBufferValue",
    "metaDescription",
    "metaTitle",
  ];

  it("every declared key is either asked for by a real consumer or on the recorded list", () => {
    const requested = new Set(earthquakeBindings.flatMap((entry) => entry.requested));
    // Anti-vacuity: a scan that found nothing would report the whole namespace orphaned and
    // make the equality below meaningless the moment someone pasted the output back in.
    expect(requested.size).toBeGreaterThan(0);

    const unconsumed = [...trEarthquake.keys()].filter((key) => !requested.has(key)).sort();
    expect(unconsumed).toEqual([...ORPHANED_BY_THE_V2_REWRITE_AND_T036].sort());
  });

  it("every name on the recorded list is really a declared key", () => {
    // A typo here would silently excuse a key that was never in the catalogue, and — because
    // the assertion above is an equality — would take a real orphan down with it.
    for (const key of ORPHANED_BY_THE_V2_REWRITE_AND_T036) {
      expect([...trEarthquake.keys()], `Earthquake.${key} is not a declared key`).toContain(key);
    }
  });
});
