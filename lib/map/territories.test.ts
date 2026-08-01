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

  /**
   * LABEL INVARIANTS (→ DEC 2026-08-01m/n for TR, DEC 2026-08-01p for EN). The card's second
   * line is a label in parity with the continent name a country card shows in the same slot —
   * max 3 words, no verb, no punctuation. The CONTENT-STYLE §22 90-character sentence cap
   * (and TF's ruled exception to it) is gone with the sentences it governed: nothing on this
   * surface is a sentence any more, so a character cap would only license one.
   *
   * BOTH locales are held to the identical rule, deliberately in one loop rather than a
   * Turkish branch and an English one: the English column is the same ruling in the other
   * language, not a translation with its own budget, so a constraint that held for TR and
   * silently lapsed for EN is exactly the drift worth failing on.
   *
   * A trailing parenthetical qualifier does not count toward the three words: "Özel İdari
   * Bölge (Çin)" is the approved HK/MO label, where the parenthesis carries the administering
   * state rather than a fourth word of description (approved table §3.5). Hyphenated forms
   * count as the one word they are written as — "Non-Self-Governing Territory" (EH) and
   * "Sovereign City-State" (VA) are the UN's and the approved table's own spellings.
   */
  const WORD_CAP = 3;
  const labelWords = (label: string): string[] =>
    label
      .replace(/\s*\([^)]*\)$/, "")
      .split(/\s+/)
      .filter((word) => word.length > 0);
  /** Every label on the surface, tagged with the entity + locale it belongs to. */
  const allLabels = (): { id: string; label: string }[] =>
    TERRITORIES.flatMap((t) => [
      { id: `${t.iso}/tr`, label: t.labelTr },
      { id: `${t.iso}/en`, label: t.labelEn },
    ]);

  it("keeps every card label within the three-word cap, in both locales", () => {
    const tooLong = allLabels()
      .filter(({ label }) => labelWords(label).length > WORD_CAP)
      .map(({ id, label }) => `${id}:${labelWords(label).length}`);
    expect(tooLong).toEqual([]);
  });

  it("keeps every card label free of sentence punctuation, in both locales", () => {
    // The structural half of "no verb". Verbs cannot be detected from a string, and a test
    // that tried would be a fact-check in disguise (that screening happened in the approved
    // label table). What IS structural: the retired sentences all carried a clause separator
    // or a final stop, and a noun-phrase label carries neither — so this fails the moment a
    // sentence starts growing back into the slot. The hyphen is NOT in the set: it joins a
    // compound modifier ("Non-Self-Governing"), it does not end or split a clause.
    const punctuated = allLabels()
      .filter(({ label }) => /[.;,:!?]/.test(label))
      .map(({ id }) => id);
    expect(punctuated).toEqual([]);
  });

  it("has non-blank names, labels and centres in both locales", () => {
    // `.trim()` on purpose: a whitespace-only string is truthy and non-empty, and would ship
    // an invisible card row. 43 entities × 2 locales = 86 labels, all required: an entity
    // whose label went blank in ONE locale is the asymmetry the English round removed.
    for (const territory of TERRITORIES) {
      expect(territory.nameTr.trim().length, territory.iso).toBeGreaterThan(0);
      expect(territory.nameEn.trim().length, territory.iso).toBeGreaterThan(0);
      expect(territory.labelTr.trim().length, territory.iso).toBeGreaterThan(0);
      expect(territory.labelEn.trim().length, territory.iso).toBeGreaterThan(0);
      // Untrimmed whitespace would also survive the word/punctuation checks above.
      expect(territory.labelTr, territory.iso).toBe(territory.labelTr.trim());
      expect(territory.labelEn, territory.iso).toBe(territory.labelEn.trim());
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

  it("keeps every published figure finite and positive", () => {
    for (const territory of TERRITORIES) {
      for (const figure of [territory.population, territory.areaKm2]) {
        if (figure.kind === "exact" || figure.kind === "approx") {
          expect(Number.isFinite(figure.value), territory.iso).toBe(true);
          expect(figure.value, territory.iso).toBeGreaterThan(0);
        }
      }
    }
  });

  it("publishes no figure as an interval", () => {
    // → DEC 2026-08-01l: a card shows ONE value, chosen by a deterministic source ladder,
    // with the source variance recorded in the provenance file instead of on a 258px card.
    // Seven figures were intervals before that ruling. The union member is gone, so this
    // widened `kind` read is the data-level guard the ruling asked for: it fails if an
    // interval is reintroduced through a cast or a regenerated data file.
    const kinds = new Set<string>(TERRITORIES.flatMap((t) => [t.population.kind, t.areaKm2.kind]));
    expect(kinds.has("range")).toBe(false);
    expect([...kinds].sort()).toEqual(["approx", "exact", "none", "unknown"]);
  });

  it("pins the set of figures published as approximations", () => {
    // Two rulings meet here: DEC 2026-08-01g item 3 restored the brief's "≈" on Somaliland
    // and Chagos, and DEC 2026-08-01l added Antarktika (the retired interval collapses to a
    // rounded single value, and rounded is not pinned). Asserted as a set because the second
    // half of both rulings is "no OTHER figure changes kind": this fails if one of these
    // silently reverts to `exact` and if a later edit promotes some other rounded number
    // into an approximation without a ruling. Order is TERRITORIES' own reading order.
    const approx = TERRITORIES.filter(
      (t) => t.population.kind === "approx" || t.areaKm2.kind === "approx",
    ).map((t) => t.iso);
    expect(approx).toEqual(["AQ", "x-somaliland", "IO"]);
  });

  it("pins the entities that publish no area at all", () => {
    // An omitted area row is always a ruling, never an oversight: Siachen's area was never
    // owner-ruled, and TF's was REMOVED (→ DEC 2026-08-01g item 2) because ~98% of the
    // 439.672 km² total is Adélie Land — outside the drawn shape and frozen by the
    // Antarctic Treaty, so printing it measured a territorial claim into a number.
    const noArea = TERRITORIES.filter((t) => t.areaKm2.kind === "unknown").map((t) => t.iso);
    expect(noArea).toEqual(["TF", "x-siachen-glacier"]);
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

  it("leaves no shape with an empty card in either locale", () => {
    // THIS TEST REPLACES A RENDER-PATH GUARD. While `/en/dunya` was label-less (→ DEC
    // 2026-08-01n item 3), exactly one entity — the Siachen Glacier: no ISO badge, both
    // figures deliberately `unknown`, no centre — had zero English card content, and
    // `world-map-section.tsx` carried a branch that dropped such a shape to the inert
    // backdrop rather than opening a bare-name panel. The English labels (→ DEC 2026-08-01p)
    // gave Siachen content, which made that branch unreachable, and unreachable code whose
    // comment narrates a state that no longer exists is worse than no code: it decays into a
    // false explanation. So the branch is gone and its GUARANTEE lives here instead, where it
    // is checked against all 43 entities in both locales at once.
    //
    // The predicate mirrors the render path's content sources exactly (badge · locale label ·
    // population · area · locale centre). It fails the day an edit leaves an entity with
    // nothing to show — which is now a data bug to fix in this module, not a silent shape.
    const empty = (["tr", "en"] as const).flatMap((locale) =>
      TERRITORIES.filter(
        (t) =>
          t.badge === undefined &&
          (locale === "en" ? t.labelEn : t.labelTr).trim().length === 0 &&
          t.population.kind === "unknown" &&
          t.areaKm2.kind === "unknown" &&
          centreFor(t, locale) === undefined,
      ).map((t) => `${t.iso}/${locale}`),
    );
    expect(empty).toEqual([]);
  });

  it("resolves a known key and rejects an unknown one", () => {
    // Asserts the JOIN, not the copy: `nameTr === "Grönland"` would pin a content literal in
    // a second place, which this file's own doctrine (and REVIEW-POLICY §4) forbids.
    expect(territoryFor("GL")?.iso).toBe("GL");
    expect(territoryFor("ZZ")).toBeUndefined();
  });
});

describe("centreFor", () => {
  const base = { iso: "ZZ", nameTr: "x", nameEn: "x", labelTr: "x", labelEn: "x" } as const;
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

  it("marks an approximate figure with a leading ≈ and keeps the unit glued on", () => {
    // The whole point of the member: the rendered string must be visibly DIFFERENT from the
    // `exact` one. If this ever prints the same text as `exact`, a rounded figure is being
    // published as a pinned one (→ DEC 2026-08-01g item 3).
    const unit = "km²";
    const value = figureText({ kind: "approx", value: 176000 }, { formatNumber, unit });
    expect(value).toBe("≈#176000 km²");
    expect(value).not.toBe(figureText({ kind: "exact", value: 176000 }, { formatNumber, unit }));
    // Unit-free call (the population slot) keeps the marker.
    expect(figureText({ kind: "approx", value: 60 }, { formatNumber })).toBe("≈#60");
  });

  it("speaks the approximation as a word when the accessible-name pass asks for one", () => {
    // U+2248 is silent in every screen reader, so the spoken card would present a rounded
    // figure as a pinned one (review finding sov-r3-m1). The word REPLACES the glyph \u2014 a
    // label that said both would read "yakla\u015F\u0131k almost-equals 176.000" in the readers that
    // do announce the symbol.
    const spoken = figureText(
      { kind: "approx", value: 176000 },
      { formatNumber, unit: "km\u00B2", approxWord: "yakla\u015F\u0131k" },
    );
    expect(spoken).toBe("yakla\u015F\u0131k #176000\u00A0km\u00B2");
    expect(spoken).not.toContain("\u2248");
    // The option is inert for every other kind: nothing else carries uncertainty.
    expect(
      figureText({ kind: "exact", value: 394 }, { formatNumber, approxWord: "yakla\u015F\u0131k" }),
    ).toBe("#394");
  });

  it("glues the unit to its number with a non-breaking space", () => {
    // The 258px card cannot fit Antarktika's 7-digit area plus "km2" on one line; with an
    // ordinary space the browser orphans the unit onto a line of its own. The wrap has to
    // land at the label/value boundary instead, which only happens while the unit is glued
    // on.
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
