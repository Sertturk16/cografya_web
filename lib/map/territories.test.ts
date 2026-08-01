import { describe, expect, it } from "vitest";
import { TERRITORIES, centreFor, figureText, territoryFor } from "./territories";
import { COUNTRY_SHAPES } from "./world-countries.generated";

/**
 * Structural invariants for the `/dunya` territory hover-card data and its one piece of
 * rendering logic. These assert SHAPE, not facts: whether Grönland's population is 56.542 is
 * a content question settled by the independent fact-check and the owner's approval, not by a
 * test file — hard-coding figures or copy here would only pin today's version of them in a
 * second place that then drifts. What a test CAN own is the set of rules a future edit could
 * silently break.
 *
 * WHAT THIS FILE DELIBERATELY DOES NOT COVER. The card's interaction layer —
 * `map-hover-card.tsx`'s Escape dismissal, the `[data-shape]` delegation selector that lets
 * an SVG `<g>` open a card at all, and the `data-clickable` pointer-affordance gate — has no
 * coverage here because the repo runs a single `node` vitest environment with no jsdom, and
 * standing up a DOM harness is a follow-up this PR does not own (same constraint documented
 * in `components/game/game-map.nav-guard.test.ts`). Those three behaviours are verified
 * empirically, in a browser, on the PR's rendered samples. Pretending otherwise with a
 * mocked-DOM test would be coverage theatre.
 */
describe("territory card data", () => {
  const shapeIsos = new Set(COUNTRY_SHAPES.map((shape) => shape.iso));

  it("covers the 43 non-country shapes the brief scoped", () => {
    expect(TERRITORIES).toHaveLength(43);
  });

  it("joins to a real map shape for every entry", () => {
    const orphans = TERRITORIES.filter((t) => !shapeIsos.has(t.iso)).map((t) => t.iso);
    expect(orphans).toEqual([]);
  });

  it("leaves no synthetic map shape without a territory entry", () => {
    // The reverse join. A regenerated `world-countries.generated.ts` can introduce a new
    // `x-…` Natural Earth entity with no ISO code; without an entry here it would render as
    // permanently mute land with a green CI — the exact failure that made Somaliland and the
    // Siachen Glacier invisible before this module existed. Only the synthetic keys are
    // asserted: a real ISO shape without an entry is a normal not-yet-seeded country.
    const unclaimed = COUNTRY_SHAPES.filter(
      (shape) => shape.iso.startsWith("x-") && territoryFor(shape.iso) === undefined,
    ).map((shape) => shape.iso);
    expect(unclaimed).toEqual([]);
  });

  it("has no duplicate shape keys", () => {
    const isos = TERRITORIES.map((t) => t.iso);
    expect(new Set(isos).size).toBe(isos.length);
  });

  it("never claims Türkiye", () => {
    // The TR shape is hand-wired to the `/turkiye` hub and `/dunya/turkiye` must never exist
    // (IA → DEC 2026-07-13 / 2026-07-26 K1). A territory entry for TR would put a card on
    // top of that link.
    expect(territoryFor("TR")).toBeUndefined();
  });

  it("keeps every status sentence within the 90-character card cap", () => {
    // CONTENT-STYLE §22: card description = 1 sentence / 90 characters. The source brief was
    // brought under this cap in its correction round; this pins it against a later edit.
    const overCap = TERRITORIES.filter((t) => t.statusTr.length > 90).map(
      (t) => `${t.iso}:${t.statusTr.length}`,
    );
    expect(overCap).toEqual([]);
  });

  it("has non-blank names in both locales, a non-blank status, and non-blank centres", () => {
    // `.trim()` on purpose: a whitespace-only string is truthy and non-empty, and would ship
    // an invisible card row.
    for (const territory of TERRITORIES) {
      expect(territory.nameTr.trim().length, territory.iso).toBeGreaterThan(0);
      expect(territory.nameEn.trim().length, territory.iso).toBeGreaterThan(0);
      expect(territory.statusTr.trim().length, territory.iso).toBeGreaterThan(0);
      if (territory.centre !== undefined) {
        expect(territory.centre.trim().length, territory.iso).toBeGreaterThan(0);
      }
      if (territory.centreEn !== undefined) {
        expect(territory.centreEn.trim().length, territory.iso).toBeGreaterThan(0);
      }
    }
  });

  it("only overrides the EN centre where a centre exists at all", () => {
    const dangling = TERRITORIES.filter((t) => t.centreEn !== undefined && t.centre === undefined);
    expect(dangling.map((t) => t.iso)).toEqual([]);
  });

  it("uses uppercase ISO alpha-2 badges only, and only where a code exists", () => {
    for (const territory of TERRITORIES) {
      if (territory.badge === undefined) {
        // The two Natural Earth entities with no ISO at all carry the generator's
        // synthetic key and must NOT be given an invented code.
        expect(territory.iso.startsWith("x-"), territory.iso).toBe(true);
        continue;
      }
      expect(territory.badge, territory.iso).toMatch(/^[A-Z]{2}$/);
      expect(territory.badge, territory.iso).toBe(territory.iso);
    }
  });

  it("orders every range figure low-to-high and keeps figures finite", () => {
    for (const territory of TERRITORIES) {
      for (const figure of [territory.population, territory.areaKm2]) {
        if (figure.kind === "range") {
          // Both ends finite: `{ max: Infinity }` satisfies `min < max` and would render
          // as "1.000–∞" on the card.
          expect(Number.isFinite(figure.min), territory.iso).toBe(true);
          expect(Number.isFinite(figure.max), territory.iso).toBe(true);
          expect(figure.min, territory.iso).toBeLessThan(figure.max);
          expect(figure.min, territory.iso).toBeGreaterThan(0);
        }
        if (figure.kind === "exact") {
          expect(Number.isFinite(figure.value), territory.iso).toBe(true);
          expect(figure.value, territory.iso).toBeGreaterThan(0);
        }
      }
    }
  });

  it("never marks an AREA as 'none'", () => {
    // `none` renders as the "no permanent population" wording, which is meaningless for an
    // area. An area that cannot be published is `unknown` (row omitted).
    const wrong = TERRITORIES.filter((t) => t.areaKm2.kind === "none").map((t) => t.iso);
    expect(wrong).toEqual([]);
  });

  it("shows no population row for the six contested entities", () => {
    // Their figures each need a caveat a 258px card cannot carry and none was owner-ruled
    // (→ DEC 2026-08-01 / 2026-08-01b ruled the SENTENCES only).
    const contested = ["EH", "x-somaliland", "x-siachen-glacier", "FK", "GS", "IO"];
    for (const iso of contested) {
      const territory = territoryFor(iso);
      expect(territory, iso).toBeDefined();
      expect(territory?.population.kind, iso).toBe("unknown");
      expect(territory?.centre, iso).toBeUndefined();
    }
  });

  it("pins the set of entities with nothing to render on the stat-only EN card", () => {
    // `/en/dunya` shows no status sentence (→ DEC 2026-08-01e item 4), so an entity with no
    // badge and no publishable figure has zero card content and falls through to the inert
    // backdrop instead of opening a name-only panel. Today that set is exactly one. Pinning
    // it is structural — it documents the ruled state and forces a deliberate decision if a
    // later edit grows the set of shapes that go silent on the English map.
    const nothingToRender = TERRITORIES.filter(
      (t) =>
        t.badge === undefined &&
        t.population.kind === "unknown" &&
        t.areaKm2.kind === "unknown" &&
        centreFor(t, "en") === undefined,
    ).map((t) => t.iso);
    expect(nothingToRender).toEqual(["x-siachen-glacier"]);
  });

  it("resolves a known key and rejects an unknown one", () => {
    // Asserts the JOIN, not the copy: `nameTr === "Grönland"` would pin a content literal in
    // a second place, which this file's own doctrine (and REVIEW-POLICY §4) forbids.
    expect(territoryFor("GL")?.iso).toBe("GL");
    expect(territoryFor("ZZ")).toBeUndefined();
  });
});

describe("centreFor", () => {
  const base = { iso: "ZZ", nameTr: "x", nameEn: "x", statusTr: "x" } as const;
  const figures = { population: { kind: "unknown" }, areaKm2: { kind: "unknown" } } as const;

  it("serves the same proper noun to both locales when there is no override", () => {
    const territory = { ...base, ...figures, centre: "Nuuk" };
    expect(centreFor(territory, "tr")).toBe("Nuuk");
    expect(centreFor(territory, "en")).toBe("Nuuk");
  });

  it("keeps a Turkish-qualified centre off the English card", () => {
    const territory = { ...base, ...figures, centre: "Brades (fiili)", centreEn: "Brades" };
    expect(centreFor(territory, "tr")).toBe("Brades (fiili)");
    expect(centreFor(territory, "en")).toBe("Brades");
  });

  it("reports no centre at all as undefined", () => {
    expect(centreFor({ ...base, ...figures }, "tr")).toBeUndefined();
    expect(centreFor({ ...base, ...figures }, "en")).toBeUndefined();
  });
});

/**
 * The card's only new pure logic. It lives in this module rather than inside the async
 * Server Component that consumes it precisely so these four branches are reachable from a
 * node test: a `default:`/`"—"` fallback slipped into the `unknown` branch would grow a
 * placeholder dash row on every contested entity — the one thing the module's own doc
 * forbids — and nothing else in CI would notice.
 */
describe("figureText", () => {
  // Stub formatter: locale-aware grouping is next-intl's job and is covered by its own
  // tests. What matters here is which branch produces output at all.
  const formatNumber = (value: number) => `#${value}`;

  it("prints an exact figure, with the unit when one is given", () => {
    expect(figureText({ kind: "exact", value: 394 }, { formatNumber })).toBe("#394");
    expect(figureText({ kind: "exact", value: 394 }, { formatNumber, unit: "km²" })).toBe(
      "#394\u00A0km²",
    );
  });

  it("prints a range as an unspaced en-dash interval", () => {
    expect(
      figureText({ kind: "range", min: 42914, max: 50255 }, { formatNumber, unit: "km\u00B2" }),
    ).toBe("#42914\u2013#50255\u00A0km\u00B2");
  });

  it("glues the unit to its number with a non-breaking space", () => {
    // The 258px card cannot fit Antarktika's 7-digit area RANGE plus "km2" on one line; with
    // an ordinary space the browser orphans the unit onto a line of its own. The wrap has to
    // land after the en dash instead, which only happens while the unit is glued on.
    const value = figureText({ kind: "exact", value: 1 }, { formatNumber, unit: "km\u00B2" });
    expect(value).toBe("#1\u00A0km\u00B2");
    expect(value).not.toContain("\u0020km\u00B2");
  });

  it("prints the caller's wording for `none`, unit-free, and nothing without wording", () => {
    const none = { kind: "none" } as const;
    expect(figureText(none, { formatNumber, noneText: "Kalıcı nüfus yok" })).toBe(
      "Kalıcı nüfus yok",
    );
    // The area call passes no wording on purpose: "there is no area" is not a fact, so the
    // row drops rather than borrowing the population sentence.
    expect(figureText(none, { formatNumber, unit: "km²" })).toBeUndefined();
  });

  it("returns undefined for `unknown` — the row is omitted, never a placeholder", () => {
    expect(figureText({ kind: "unknown" }, { formatNumber })).toBeUndefined();
    expect(
      figureText({ kind: "unknown" }, { formatNumber, noneText: "Kalıcı nüfus yok", unit: "km²" }),
    ).toBeUndefined();
  });
});
