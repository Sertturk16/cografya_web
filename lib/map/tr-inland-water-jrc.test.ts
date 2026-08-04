import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import enMessages from "../../messages/en.json";
import trMessages from "../../messages/tr.json";

/**
 * Invariants of the SECOND water source — the JRC Global Surface Water derivative — and of
 * the boundary between it and the ODbL OpenStreetMap snapshot (P7 plan §11, T5–T7 + T10–T11).
 *
 * These assert RULES and STRUCTURE, never facts. No lake area, no official figure and no
 * count taken from the data is written down: whether Tuz Gölü is 1 663 km² is a question the
 * raster answers and a human checks at the sample gate, and freezing it here would turn a
 * cartography decision into a test failure. What a test can own is what a future refresh,
 * retune or careless merge could silently break.
 *
 * Three of those things would be invisible without this file:
 *
 *  - **the licence boundary.** ODbL's share-alike attaches to a derived DATABASE. The two
 *    snapshots must never be merged on disk; they meet only as pixels in one rendered SVG
 *    (→ DEC 2026-08-01r-1). Nothing about a JSON file enforces that by itself, and the most
 *    plausible way to break it is someone helpfully copying features between the two.
 *  - **the attribution string.** `Source: EC JRC/Google` is the licensor's own wording and
 *    is verbatim in BOTH locales (→ DEC 2026-08-02q §F). A translator, a copy pass or a
 *    "let's shorten this" is exactly what this guards; the last two owner gates failed on
 *    precisely this class of drift. This is not a fact literal — it is the string the
 *    licence obliges us to render.
 *  - **component leakage.** The recipe grows a body from a hand-pinned identity box plus a
 *    distance rule. Get either wrong and it swallows the neighbouring lake — which is not a
 *    hypothetical: the first pass drew Hirfanlı Baraj Gölü as part of Tuz Gölü, and the
 *    result looked exactly like a lake (→ DEC 2026-08-04d).
 */

const jrc = readCollection("../../data/tr-inland-water-jrc.geojson");
const osm = readCollection("../../data/tr-inland-water.geojson");

type Ring = [number, number][];

interface Feature {
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates: unknown };
}

interface Collection {
  metadata?: Record<string, unknown>;
  features: Feature[];
}

function readCollection(relative: string): Collection {
  return JSON.parse(
    readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8"),
  ) as Collection;
}

/** Outer rings of a feature, whichever geometry type it uses. Holes are ignored. */
function outerRings(feature: Feature): Ring[] {
  const polygons = (
    feature.geometry.type === "MultiPolygon"
      ? (feature.geometry.coordinates as Ring[][])
      : [feature.geometry.coordinates as Ring[]]
  ).filter(Array.isArray);
  return polygons.map((polygon) => polygon[0]).filter((ring): ring is Ring => Array.isArray(ring));
}

function bboxOf(rings: Ring[]): [number, number, number, number] {
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const ring of rings) {
    for (const [lon, lat] of ring) {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }
  return [minLon, minLat, maxLon, maxLat];
}

function bboxesOverlap(a: [number, number, number, number], b: [number, number, number, number]) {
  return a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
}

/** Standard even–odd ray cast. Boundary cases are irrelevant here — leakage is bulk, not edges. */
function pointInRing(point: [number, number], ring: Ring): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (!a || !b) continue;
    const intersects =
      a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0];
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInAnyRing(point: [number, number], rings: Ring[]): boolean {
  return rings.some((ring) => pointInRing(point, ring));
}

/** Spherical ring area in km² — the same formula both fetch steps use. */
function ringAreaKm2(ring: Ring): number {
  const radius = 6371008.8;
  const rad = Math.PI / 180;
  let total = 0;
  for (let i = 0; i < ring.length; i++) {
    const lower = ring[(i - 1 + ring.length) % ring.length];
    const middle = ring[i];
    const upper = ring[(i + 1) % ring.length];
    if (!lower || !middle || !upper) continue;
    total += (upper[0] - lower[0]) * rad * Math.sin(middle[1] * rad);
  }
  return Math.abs((total * radius * radius) / 2) / 1e6;
}

describe("T5 — the two water databases stay separate", () => {
  it("declares a different licence on each file", () => {
    // The files' own provenance headers are the thing a human reads first; if they ever
    // agree, one has been overwritten by the other. The generator throws on this too.
    expect(jrc.metadata?.licence).toBeTruthy();
    expect(osm.metadata?.licence).toBeTruthy();
    expect(jrc.metadata?.licence).not.toBe(osm.metadata?.licence);
  });

  it("keeps every OSM identifier out of the JRC file", () => {
    // Not just `osmId`: ANY field carrying an OSM key would make this file a derivative of
    // the ODbL database, which is the whole thing the separation exists to prevent.
    for (const feature of jrc.features) {
      expect(feature.properties.osmId).toBeUndefined();
      const serialised = JSON.stringify(feature.properties);
      expect(serialised).not.toMatch(/"[rw]\d{3,}"/);
    }
  });

  it("keeps every JRC identifier out of the OSM file", () => {
    for (const feature of osm.features) {
      expect(feature.properties.id).toBeUndefined();
      expect(String(feature.properties.osmId)).toMatch(/^[rw]\d+$/);
    }
  });

  it("gives every JRC body a `gsw-NN` key, unique across the file", () => {
    // → DEC 2026-08-03c, Q8. A name slug would put a NAME in the artifact, which
    // DEC 2026-08-01r-4 forbids; a Wikidata QID is not available for every body.
    const ids = jrc.features.map((feature) => feature.properties.id);
    for (const id of ids) expect(id).toMatch(/^gsw-\d{2}$/);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("records the recipe that produced the file", () => {
    // Provenance the reader can see without opening the script. Values are NOT asserted —
    // they are the owner's to rule — only that the file cannot claim geometry with no recipe.
    const recipe = jrc.metadata?.recipe as Record<string, unknown> | undefined;
    expect(recipe).toBeDefined();
    for (const key of [
      "occurrenceThresholdPercent",
      "closingRadiusM",
      "fillInteriorHoles",
      "componentRule",
      "identityNeighbourM",
      "snapshotEpsilonSvgUnits",
    ]) {
      expect(recipe?.[key]).toBeDefined();
    }
    // Granule digests: the raster step has no CI gate (505 MB, network), so the checksums
    // ARE its gate. A file that lost them could not be reproduced or audited.
    const granules = jrc.metadata?.granules as Record<string, { sha256?: string }> | undefined;
    expect(Object.keys(granules ?? {}).length).toBeGreaterThan(0);
    for (const granule of Object.values(granules ?? {})) {
      expect(granule.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});

describe("T6 — the registry obeys the naming rule", () => {
  it("names every body with the generic term for a lake", () => {
    // K2 of DEC 2026-08-02q §B: a body drawn in this class is one whose own name says it is
    // a lake. The match is case-insensitive because "Acıgöl" is one word and lower-cased —
    // the rule is about the WORD, not its capitalisation.
    for (const feature of jrc.features) {
      expect(String(feature.properties.name)).toMatch(/(göl|gölü)$/i);
    }
  });

  it("carries an identity and a window box for every body", () => {
    // The identity box is the one step of the recipe a human decided, so the file has to show
    // it: without it, "why is this lake shaped like this" is unanswerable from the data.
    for (const feature of jrc.features) {
      for (const key of ["identity", "window"] as const) {
        const box = feature.properties[key] as Record<string, number> | undefined;
        expect(box).toBeDefined();
        expect(box?.minLon).toBeLessThan(box?.maxLon ?? -Infinity);
        expect(box?.minLat).toBeLessThan(box?.maxLat ?? -Infinity);
      }
    }
  });
});

describe("T7 — no body swallows another", () => {
  const jrcBodies = jrc.features.map((feature) => ({
    id: String(feature.properties.id),
    rings: outerRings(feature),
  }));

  it("keeps the JRC bodies disjoint from each other", () => {
    for (const a of jrcBodies) {
      for (const b of jrcBodies) {
        if (a.id >= b.id) continue;
        if (!bboxesOverlap(bboxOf(a.rings), bboxOf(b.rings))) continue;
        const leaked = a.rings.flat().filter((point) => pointInAnyRing(point, b.rings));
        expect(`${a.id}⊂${b.id}: ${leaked.length}`).toBe(`${a.id}⊂${b.id}: 0`);
      }
    }
  });

  it("keeps every JRC body clear of the OSM bodies that are still drawn", () => {
    // SEMANTICS, so nobody over-trusts this: the check is VERTEX-IN-POLYGON, not a full
    // polygon intersection. It catches the failure mode it was built for — one body grossly
    // containing another — and it would go red on a literal Hirfanlı regression, because
    // `r1028112` is still drawn from OSM. It CANNOT see leakage into water that neither
    // snapshot draws, which is exactly how Çöl Gölü got into Yay Gölü unnoticed
    // (→ DEC 2026-08-04g). The tripwire for THAT class is the synthetic selection test in
    // `jrc-morphology.test.ts` (T12), not this one.

    // THE component-leakage detector. Each JRC body grows from a hand-pinned seed box; a box
    // one step too wide takes the neighbour with it, and the output still looks like a lake.
    // Only the OSM bodies that are actually DRAWN matter — a superseded record is expected to
    // sit under its JRC replacement, and a sub-rung body is not on the map to collide with.
    const minAreaKm2 = 30;
    // Mirrors SUPERSEDED_BY_JRC in scripts/generate-tr-inland-water.mjs. Duplicated on
    // purpose: if the generator's map changes, a human must look at this list rather than have
    // it silently follow along, because "which OSM record does this JRC body replace" is
    // exactly the decision a leak would hide. All nine are listed here (not just the six that
    // are drawn) because a sub-rung record still sits under its replacement geometrically.
    const superseded = new Set([
      "r2411676",
      "r16862988",
      "r2385434",
      "r17069201",
      "r1761470",
      "r17083287",
      "r1721352",
      "w492757813",
    ]);

    const drawnOsm = osm.features
      .filter((feature) => Number(feature.properties.areaKm2) >= minAreaKm2)
      .filter((feature) => !superseded.has(String(feature.properties.osmId)))
      .map((feature) => ({ id: String(feature.properties.osmId), rings: outerRings(feature) }));

    for (const body of drawnOsm) {
      const bbox = bboxOf(body.rings);
      for (const lake of jrcBodies) {
        if (!bboxesOverlap(bbox, bboxOf(lake.rings))) continue;
        const swallowed = body.rings.flat().filter((point) => pointInAnyRing(point, lake.rings));
        // Reported with the ids in the message: a bare `0` tells whoever sees the red
        // nothing about WHICH lake ate WHICH.
        expect(`${lake.id} swallowed ${body.id}: ${swallowed.length}`).toBe(
          `${lake.id} swallowed ${body.id}: 0`,
        );
      }
    }
  });
});

describe("T10 — the attribution string is verbatim in both locales", () => {
  const REQUIRED = "Source: EC JRC/Google";

  it("renders the licensor's own wording untranslated on the map surfaces", () => {
    // The English half is a SEPARATE key from the Turkish label precisely so it can be
    // rendered inside `lang="en"` (WCAG 3.1.2) without wrapping Turkish prose in it. Both
    // locales must carry the identical English string — it is the licence, not copy.
    expect(trMessages.Map.attributionJrcEnglish).toContain(REQUIRED);
    expect(enMessages.Map.attributionJrcEnglish).toContain(REQUIRED);
    expect(trMessages.Map.attributionJrcEnglish).toBe(enMessages.Map.attributionJrcEnglish);
  });

  it("keeps the journal citation identical in both locales", () => {
    // A citation is a lookup key, not prose. Translating "High-resolution mapping of global
    // surface water…" would break the one job it has.
    expect(trMessages.About.dataJrcCitation).toBe(enMessages.About.dataJrcCitation);
    expect(trMessages.About.dataJrcDoi).toBe(enMessages.About.dataJrcDoi);
    expect(trMessages.About.dataJrcEnglish).toBe(enMessages.About.dataJrcEnglish);
    expect(trMessages.About.dataJrcEnglish).toContain(REQUIRED);
  });

  it('marks every untranslated English string with lang="en" where it renders', () => {
    // The strings are only half the obligation; the wrapper is the other half, and a message
    // file cannot assert it. Read the render sites as SOURCE — the repo runs a single `node`
    // vitest environment with no jsdom, the same constraint `tr-inland-water.test.ts`
    // documents. `marine-attribution.tsx` is the pattern being matched.
    const sites: [string, string][] = [
      ["../../components/map/turkey-map-section.tsx", "attributionJrcEnglish"],
      ["../../components/game/game-map.tsx", "attributionJrcEnglish"],
      ["../../components/marine/marine-map.tsx", "attributionJrcEnglish"],
      ["../../app/[locale]/hakkimizda/page.tsx", "dataJrcEnglish"],
      ["../../app/[locale]/hakkimizda/page.tsx", "dataJrcCitation"],
    ];
    for (const [relative, key] of sites) {
      const source = readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
      const rendered = source.indexOf(`t("${key}")`);
      expect(rendered, `${relative} does not render ${key}`).toBeGreaterThan(-1);
      // The nearest enclosing element before the interpolation must open a lang="en" scope.
      const before = source.slice(0, rendered);
      const lastSpan = before.lastIndexOf('<span lang="en">');
      const lastClose = before.lastIndexOf("</span>");
      expect(lastSpan, `${relative}: ${key} is not inside a lang="en" span`).toBeGreaterThan(
        lastClose,
      );
    }
  });

  it("renders the JRC credit on exactly the surfaces that draw the JRC geometry", () => {
    // The licence obligation travels WITH the material. A surface that gains the layer but
    // not the credit is a licence breach; a surface that gains the credit without the layer
    // claims a source it does not use. Both directions are asserted from source.
    const surfaces = [
      "../../components/map/turkey-map-section.tsx",
      "../../components/game/game-map.tsx",
      "../../components/marine/marine-map.tsx",
      "../../components/map/world-map-section.tsx",
    ];
    for (const relative of surfaces) {
      const source = readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
      const drawsLayer = source.includes("InlandWaterLayer");
      const credits = source.includes("attributionJrcEnglish");
      expect(credits, `${relative}: draws=${drawsLayer} credits=${credits}`).toBe(drawsLayer);
    }
  });
});

describe("T11 — the file's own numbers agree with its geometry", () => {
  it("re-measures every recorded area from the geometry it ships", () => {
    // The P6 lesson (C1): metadata drifts into narrative unless something recomputes it.
    // The tolerance is not zero and cannot be: `areaKm2` is measured on the TRACED rings and
    // the geometry is the Douglas–Peucker reduction of them, so a small, one-directional
    // loss is expected. What this catches is a recorded figure that stopped being a
    // measurement of the shipped shape at all.
    for (const feature of jrc.features) {
      const recorded = Number(feature.properties.areaKm2);
      const measured = outerRings(feature).reduce((sum, ring) => sum + ringAreaKm2(ring), 0);
      expect(Math.abs(measured - recorded) / recorded).toBeLessThan(0.05);
    }
  });

  it("counts its own rings and nodes correctly", () => {
    for (const feature of jrc.features) {
      const rings = outerRings(feature);
      expect(rings).toHaveLength(Number(feature.properties.rings));
      expect(rings.reduce((sum, ring) => sum + ring.length, 0)).toBe(
        Number(feature.properties.nodes),
      );
    }
  });
});
