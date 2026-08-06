import { describe, expect, it, vi } from "vitest";
import { getPathname } from "@/i18n/navigation";
import type { CountryMapSummary, ProvinceMapSummary } from "@/lib/api/types";
import { TERRITORIES } from "@/lib/map/territories";
import {
  countryPool,
  featuredPopulationFact,
  istanbulDayKey,
  pickDailyCountries,
  pickDailyProvinces,
} from "./featured";

/**
 * The daily-draw contract (→ DEC 2026-08-05a).
 *
 * SYNTHETIC FIXTURES, deliberately (`CONVENTIONS.md` §2, → DEC 2026-07-12): every invariant
 * here is structural — determinism within a day, movement across days, the country-only pool,
 * the cap, the locale split, and "a drawn card is always a published entity". None of them
 * says anything about a real province or country, and asserting them against live data would
 * turn a structural guard into a geography-fact test.
 *
 * The one place a real module is imported is `TERRITORIES`: the pool rule is defined IN TERMS
 * of that register, so the test exercises the register itself rather than a copy of two ISO
 * codes that could drift away from it.
 */

function province(slugTr: string, over: Partial<ProvinceMapSummary> = {}): ProvinceMapSummary {
  return {
    plateCode: "99",
    nameTr: `${slugTr}-tr`,
    region: "MARMARA",
    slugTr,
    slugEn: `${slugTr}-en`,
    population: 1234,
    populationYear: 2024,
    areaKm2: 100,
    districtCount: 5,
    ...over,
  };
}

function country(slugTr: string, over: Partial<CountryMapSummary> = {}): CountryMapSummary {
  return {
    isoCode: "ZZ",
    nameTr: `${slugTr}-tr`,
    nameEn: `${slugTr}-en`,
    continent: "AVRUPA",
    // Contract sync (openapi #88): CountryMapSummaryDto now requires entityType +
    // statusLabelTr/En + areaIsApproximate. The entityType default is "country" —
    // countryPool's own territory-register filter is unchanged by this sync (see featured.ts's
    // countryPool docstring: switching it to `entityType === "country"` is a follow-up handed
    // to Atlas, not silently done here), so these defaults only keep every EXISTING fixture
    // literal type-valid; none of the new fields is read by this module yet.
    entityType: "country",
    statusLabelTr: null,
    statusLabelEn: null,
    areaIsApproximate: false,
    slugTr,
    slugEn: `${slugTr}-en`,
    population: 5678,
    populationYear: null,
    areaKm2: 200,
    neighborCount: 3,
    ...over,
  };
}

/** A pool big enough that a draw of three is a real choice rather than the whole list. */
function provincePool(size: number): ProvinceMapSummary[] {
  return Array.from({ length: size }, (_, index) =>
    province(`p-${index}`, { plateCode: String(index + 1).padStart(2, "0") }),
  );
}

function countryPoolFixture(size: number): CountryMapSummary[] {
  return Array.from({ length: size }, (_, index) =>
    // Three-character synthetic codes: no ISO alpha-2, so no fixture can collide with a real
    // entry in `TERRITORIES` and quietly remove itself from its own pool.
    country(`c-${index}`, { isoCode: `Q${String(index).padStart(2, "0")}` }),
  );
}

/** Every day of a month, as instants — enough to see the draw move without being a fact. */
function daysOfMonth(count: number): string[] {
  return Array.from(
    { length: count },
    (_, index) => `2026-03-${String(index + 1).padStart(2, "0")}T09:00:00Z`,
  );
}

describe("istanbulDayKey", () => {
  it("is the ISTANBUL calendar day, not the host's and not UTC's", () => {
    // 20:59 UTC is still the 5th in Istanbul (UTC+3); 21:01 UTC is already the 6th.
    expect(istanbulDayKey("2026-08-05T20:59:00Z")).toBe("2026-08-05");
    expect(istanbulDayKey("2026-08-05T21:01:00Z")).toBe("2026-08-06");
  });

  it("uses the same offset in winter (Türkiye keeps UTC+3 year-round)", () => {
    expect(istanbulDayKey("2026-01-15T21:30:00Z")).toBe("2026-01-16");
  });

  it("accepts a Date as well as an ISO string", () => {
    expect(istanbulDayKey(new Date("2026-08-05T09:00:00Z"))).toBe("2026-08-05");
  });

  it("emits a zero-padded, sortable key", () => {
    expect(istanbulDayKey("2026-01-02T09:00:00Z")).toBe("2026-01-02");
  });
});

describe("pickDailyProvinces", () => {
  it("gives the SAME cards for every instant of one Istanbul day", () => {
    const pool = provincePool(40);
    const morning = pickDailyProvinces(pool, "tr", "2026-03-14T05:00:00Z");
    const evening = pickDailyProvinces(pool, "tr", "2026-03-14T20:30:00Z");

    expect(evening).toEqual(morning);
  });

  it("moves across days rather than pinning one set forever", () => {
    const pool = provincePool(40);
    const draws = daysOfMonth(28).map((day) =>
      pickDailyProvinces(pool, "tr", day)
        .map((item) => item.slug)
        .join("|"),
    );

    expect(new Set(draws).size).toBeGreaterThan(1);
  });

  it("does not depend on the order the api returned the pool in", () => {
    const pool = provincePool(40);
    const reversed = [...pool].reverse();

    expect(pickDailyProvinces(reversed, "tr", "2026-03-14T09:00:00Z")).toEqual(
      pickDailyProvinces(pool, "tr", "2026-03-14T09:00:00Z"),
    );
  });

  it("draws DISTINCT entities", () => {
    const drawn = pickDailyProvinces(provincePool(40), "tr", "2026-03-14T09:00:00Z");

    expect(new Set(drawn.map((item) => item.plateCode)).size).toBe(drawn.length);
  });

  it("only ever draws entities the api published (a soft-404 link is unconstructible)", () => {
    const pool = provincePool(40);
    const published = new Set(pool.map((item) => item.slugTr));

    for (const day of daysOfMonth(28)) {
      for (const card of pickDailyProvinces(pool, "tr", day)) {
        expect(published.has(card.slug)).toBe(true);
      }
    }
  });

  it("never exceeds the cap, and yields fewer when the pool is smaller", () => {
    expect(pickDailyProvinces(provincePool(40), "tr", "2026-03-14T09:00:00Z")).toHaveLength(3);
    expect(pickDailyProvinces(provincePool(2), "tr", "2026-03-14T09:00:00Z")).toHaveLength(2);
    expect(pickDailyProvinces(provincePool(40), "tr", "2026-03-14T09:00:00Z", 1)).toHaveLength(1);
  });

  it("emits the LOCALE's slug and never leaks the other one", () => {
    const pool = [province("alpha", { slugEn: "alpha-english" })];

    expect(pickDailyProvinces(pool, "tr", "2026-03-14T09:00:00Z")[0]?.slug).toBe("alpha");
    expect(pickDailyProvinces(pool, "en", "2026-03-14T09:00:00Z")[0]?.slug).toBe("alpha-english");
  });

  it("returns an empty list — not a throw — when the api published nothing", () => {
    expect(pickDailyProvinces([], "tr", "2026-03-14T09:00:00Z")).toEqual([]);
  });

  it("carries a null population through rather than substituting a number", () => {
    const pool = [province("alpha", { population: null, populationYear: null })];

    expect(pickDailyProvinces(pool, "tr", "2026-03-14T09:00:00Z")[0]?.population).toBeNull();
  });

  it("passes the region through as the CONTRACT ENUM, not a translated string", () => {
    const pool = [province("alpha", { region: "KARADENIZ" })];

    expect(pickDailyProvinces(pool, "tr", "2026-03-14T09:00:00Z")[0]?.region).toBe("KARADENIZ");
  });
});

describe("pool ordering", () => {
  /**
   * The draw is a function of POSITION in the sorted pool, so the sort is part of the seed:
   * anything that can reorder the pool can change which cards a day shows. The sort must
   * therefore depend on nothing but the keys themselves.
   *
   * This is the guard for → PR #46 review CR-FR2-1. The previous implementation sorted with
   * `localeCompare` and no explicit locale, i.e. in the RUNTIME's default collation — ambient
   * state, exactly like the host clock the day key already refuses to trust. The failure is
   * latent (both keys are ASCII, where tr and en collations agree today) and would surface as
   * two servers disagreeing about "bugün", which is the hardest possible bug to see.
   *
   * Rather than trying to boot a second ICU locale, this pins the property directly: replace
   * `localeCompare` with a deliberately INVERTED collation and require the draw not to move.
   * Had either sort still gone through it, both assertions below would fail.
   */
  const DAY = "2026-03-14T09:00:00Z";

  it("ignores the runtime's default collation entirely", () => {
    const provinces = provincePool(40);
    const countries = countryPoolFixture(40);
    const expectedProvinces = pickDailyProvinces(provinces, "tr", DAY);
    const expectedCountries = pickDailyCountries(countries, "tr", DAY);

    const spy = vi.spyOn(String.prototype, "localeCompare").mockImplementation(function (
      this: string,
      that: string,
    ) {
      return this < that ? 1 : this > that ? -1 : 0;
    });

    try {
      expect(pickDailyProvinces(provinces, "tr", DAY)).toEqual(expectedProvinces);
      expect(pickDailyCountries(countries, "tr", DAY)).toEqual(expectedCountries);
    } finally {
      spy.mockRestore();
    }
  });
});

describe("countryPool", () => {
  it("holds out EVERY registered territory and keeps everything else", () => {
    const territories = TERRITORIES.map((territory, index) =>
      country(`t-${index}`, { isoCode: territory.iso }),
    );
    const real = countryPoolFixture(3);

    expect(countryPool([...territories, ...real]).map((item) => item.isoCode)).toEqual(
      real.map((item) => item.isoCode),
    );
  });

  it("leaves an all-country payload untouched", () => {
    const real = countryPoolFixture(5);

    expect(countryPool(real)).toEqual(real);
  });

  // REMOVAL-GUARD FIRED (→ PR #46 review CR-FR2-4), deliberately not auto-actioned here. The
  // `@ts-expect-error` this test used to carry went stale the moment the WEB-KOPPEN openapi
  // sync brought `entityType` into `CountryMapSummaryDto` (`tsc` failed with TS2578, as
  // designed). The guard's job was only to force a human to look — it was not licence to
  // silently switch `countryPool`'s production filter. `featured.ts`'s own `countryPool`
  // docstring is explicit that the entityType migration is "a follow-up handed to Atlas, not a
  // silent TODO" (it also changes real filtering behaviour: VA is a KNOWN IMPERFECTION today).
  // So: guard deleted (its purpose served), `countryPool` left exactly as it was, and the
  // migration is surfaced to Atlas rather than performed inline in this PR.
});

describe("pickDailyCountries", () => {
  it("never draws a territory, on any day, even when the cap could reach one", () => {
    const territories = TERRITORIES.map((territory, index) =>
      country(`t-${index}`, { isoCode: territory.iso }),
    );
    const pool = [...territories, ...countryPoolFixture(3)];
    const territoryIsoCodes = new Set(TERRITORIES.map((territory) => territory.iso));

    for (const day of daysOfMonth(28)) {
      for (const card of pickDailyCountries(pool, "tr", day, 10)) {
        expect(territoryIsoCodes.has(card.isoCode)).toBe(false);
      }
    }
  });

  it("gives the SAME cards for every instant of one Istanbul day", () => {
    const pool = countryPoolFixture(40);

    expect(pickDailyCountries(pool, "tr", "2026-03-14T20:30:00Z")).toEqual(
      pickDailyCountries(pool, "tr", "2026-03-14T05:00:00Z"),
    );
  });

  it("moves across days", () => {
    const pool = countryPoolFixture(40);
    const draws = daysOfMonth(28).map((day) =>
      pickDailyCountries(pool, "tr", day)
        .map((item) => item.slug)
        .join("|"),
    );

    expect(new Set(draws).size).toBeGreaterThan(1);
  });

  it("does not move in lockstep with the province row", () => {
    // Identically-shaped pools, the same days: the two rows carry different seed suffixes, so
    // their draws must not be the same sequence of POSITIONS. Compared over a whole month
    // rather than one day — two independent draws can coincide once, and a guard that would
    // fail on that coincidence is a flaky guard.
    const provinceSeries = daysOfMonth(28).map((day) =>
      pickDailyProvinces(provincePool(40), "tr", day).map((item) => Number(item.plateCode) - 1),
    );
    const countrySeries = daysOfMonth(28).map((day) =>
      pickDailyCountries(countryPoolFixture(40), "tr", day).map((item) =>
        Number(item.isoCode.slice(1)),
      ),
    );

    expect(countrySeries).not.toEqual(provinceSeries);
  });

  it("draws DISTINCT entities the api published", () => {
    const pool = countryPoolFixture(40);
    const published = new Set(pool.map((item) => item.isoCode));
    const drawn = pickDailyCountries(pool, "tr", "2026-03-14T09:00:00Z");

    expect(new Set(drawn.map((item) => item.isoCode)).size).toBe(drawn.length);
    for (const card of drawn) expect(published.has(card.isoCode)).toBe(true);
  });

  it("emits the locale's name AND slug together", () => {
    const pool = [country("alpha", { nameTr: "Alfa", nameEn: "Alpha", slugEn: "alpha-en" })];

    expect(pickDailyCountries(pool, "tr", "2026-03-14T09:00:00Z")[0]).toMatchObject({
      name: "Alfa",
      slug: "alpha",
    });
    expect(pickDailyCountries(pool, "en", "2026-03-14T09:00:00Z")[0]).toMatchObject({
      name: "Alpha",
      slug: "alpha-en",
    });
  });

  it("never exceeds the cap", () => {
    expect(pickDailyCountries(countryPoolFixture(40), "tr", "2026-03-14T09:00:00Z")).toHaveLength(
      3,
    );
  });

  it("carries a null population through rather than substituting a number", () => {
    const pool = [country("alpha", { population: null })];

    expect(pickDailyCountries(pool, "tr", "2026-03-14T09:00:00Z")[0]?.population).toBeNull();
  });

  it("passes the continent through as the CONTRACT ENUM, not a translated string", () => {
    const pool = [country("alpha", { continent: "OKYANUSYA" })];

    expect(pickDailyCountries(pool, "tr", "2026-03-14T09:00:00Z")[0]?.continent).toBe("OKYANUSYA");
  });

  it("returns an empty list — not a throw — when the api published nothing", () => {
    expect(pickDailyCountries([], "tr", "2026-03-14T09:00:00Z")).toEqual([]);
  });
});

/**
 * The fact row's two branches. Both are the kind that fail SILENTLY — a card that quietly
 * stops printing its population, or one that prints "Nüfus (null)" — so each is pinned here
 * rather than left inside the page component, which this repo's node-environment harness
 * cannot render.
 */
describe("featuredPopulationFact", () => {
  it("prints NO row for a null population, whatever the year says", () => {
    expect(featuredPopulationFact(null, 2024)).toBeNull();
    expect(featuredPopulationFact(null, null)).toBeNull();
  });

  it("drops the year clause when the contract publishes no year (the country case)", () => {
    expect(featuredPopulationFact(1234, null)).toEqual({
      labelKey: "population",
      population: 1234,
    });
  });

  it("names the year when the contract publishes one (the province case)", () => {
    expect(featuredPopulationFact(1234, 2024)).toEqual({
      labelKey: "populationWithYear",
      year: 2024,
      population: 1234,
    });
  });

  it("still prints a row for a population of zero (an absence, not a falsy number)", () => {
    expect(featuredPopulationFact(0, null)).toEqual({ labelKey: "population", population: 0 });
  });
});

/**
 * The hrefs the cards carry are built by `getPathname`, never by string concatenation — the
 * same rule the SEO layer is held to (`lib/seo/routes.fixture.ts`). This exercises the REAL
 * routing table, so a localized-segment change (`/turkiye` ↔ `/en/turkiye`) can never leave
 * the homepage pointing at a path that no longer exists.
 */
describe("daily card hrefs", () => {
  it("resolve through the routing table for both locales", () => {
    const trHref = getPathname({
      locale: "tr",
      href: { pathname: "/turkiye/[slug]", params: { slug: "alpha" } },
    });
    const enHref = getPathname({
      locale: "en",
      href: { pathname: "/dunya/[slug]", params: { slug: "alpha-en" } },
    });

    expect(trHref.startsWith("/")).toBe(true);
    expect(trHref).toContain("alpha");
    expect(enHref.startsWith("/en/")).toBe(true);
    expect(enHref).toContain("alpha-en");
  });
});
