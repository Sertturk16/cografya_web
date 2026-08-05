import { describe, expect, it } from "vitest";
import type { Continent, GeographicRegion } from "@/lib/api/types";
import enMessages from "@/messages/en.json";
import trMessages from "@/messages/tr.json";

/**
 * ENUM → MESSAGE-KEY COVERAGE for the two namespaces whose keys are CONTRACT VALUES, not
 * hand-written key names (`Continents`, `Regions`).
 *
 * ## The failure this exists for, which actually happened
 *
 * Those two namespaces are looked up with a runtime string that came from the api
 * (`tContinents(country.continent)`). next-intl does not fail on a missing key — it logs and
 * renders the dotted path — so the day the api began publishing a seventh continent, EN and TR
 * Antarctica surfaces printed the literal text "Continents.ANTARKTIKA" to readers and to
 * Googlebot, on indexable pages, with CI green (→ the 2026-08-05 fix round). Nothing in the
 * type system could see it, because the value did not exist in the contract THIS repo had
 * committed.
 *
 * ## The two halves of the guard, and the honest limit of each
 *
 * 1. COMPILE TIME — the `Record<Continent, …>` / `Record<GeographicRegion, …>` below are
 *    exhaustive maps over the contract unions. When a contract sync (`pnpm codegen`) adds an
 *    enum value, they stop typechecking until someone lists it here, which forces the person
 *    doing the sync to notice a new user-visible value exists.
 * 2. RUN TIME — every listed value must resolve to a non-empty string in BOTH catalogues.
 *    Both locales, always: `Continents`/`Regions` render on `"localized"` surfaces where TR
 *    and EN are equally indexable, so "missing in en" is a defect, not a translation backlog.
 *
 * The limit, stated plainly: this cannot catch a value the LIVE api emits before the contract
 * is synced into this repo — that is a contract-sync gap, and it is what bit us. It converts
 * the NEXT one from a silent raw key on a live page into a red build at sync time, which is
 * the earliest moment this repo can see it at all.
 *
 * Structural only (`CONVENTIONS.md` §2): it never asserts what a label says.
 */

/** Exhaustive over the contract union — see half 1 above. The value is the key itself. */
const CONTINENTS: Record<Continent, true> = {
  ASYA: true,
  AVRUPA: true,
  AFRIKA: true,
  KUZEY_AMERIKA: true,
  GUNEY_AMERIKA: true,
  OKYANUSYA: true,
};

const REGIONS: Record<GeographicRegion, true> = {
  MARMARA: true,
  EGE: true,
  AKDENIZ: true,
  IC_ANADOLU: true,
  KARADENIZ: true,
  DOGU_ANADOLU: true,
  GUNEYDOGU_ANADOLU: true,
};

/**
 * Values the LIVE api publishes that the committed contract does not carry yet. Listing one
 * here is not a workaround — it is the record of a known contract-sync debt, and it keeps the
 * catalogue guard covering the value in the meantime.
 *
 * `ANTARKTIKA`: published by the api for AQ (dalga-1). Remove this list the moment the
 * contract sync lands and the union covers it on its own.
 */
const AHEAD_OF_CONTRACT_CONTINENTS = ["ANTARKTIKA"] as const;

/**
 * Only the two enum namespaces are pulled in — deliberately narrow. A whole-catalogue map
 * would not typecheck anyway (some namespaces nest a sub-object), and widening it would make
 * this file about message catalogues in general rather than about enum coverage.
 */
type EnumNamespace = "Continents" | "Regions";

const catalogues: Record<string, Record<EnumNamespace, Record<string, string>>> = {
  tr: { Continents: trMessages.Continents, Regions: trMessages.Regions },
  en: { Continents: enMessages.Continents, Regions: enMessages.Regions },
};

function expectResolves(namespace: EnumNamespace, key: string) {
  for (const [locale, catalogue] of Object.entries(catalogues)) {
    const value: string | undefined = catalogue[namespace]?.[key];
    expect(value, `${locale}: ${namespace}.${key}`).toBeTypeOf("string");
    expect(String(value).trim().length, `${locale}: ${namespace}.${key}`).toBeGreaterThan(0);
  }
}

describe("Continents namespace", () => {
  it.each(Object.keys(CONTINENTS))("resolves the contract value %s in both locales", (key) => {
    expectResolves("Continents", key);
  });

  it.each(AHEAD_OF_CONTRACT_CONTINENTS)("resolves the live-api value %s too", (key) => {
    expectResolves("Continents", key);
  });

  it("carries the same key set in both locales", () => {
    expect(Object.keys(enMessages.Continents).sort()).toEqual(
      Object.keys(trMessages.Continents).sort(),
    );
  });
});

describe("Regions namespace", () => {
  it.each(Object.keys(REGIONS))("resolves the contract value %s in both locales", (key) => {
    expectResolves("Regions", key);
  });

  it("carries the same key set in both locales", () => {
    expect(Object.keys(enMessages.Regions).sort()).toEqual(Object.keys(trMessages.Regions).sort());
  });
});
