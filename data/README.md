# `data/` — committed static data snapshots

Reference/geographic data that the build reads at **generate time only**. Nothing here is
fetched from a third party during `next build` or at runtime — we own the snapshot so the
build is reproducible and independent of any upstream repo's availability (same "own it,
don't live-fetch it" discipline the platform applies to editorial content; see the api
repo's `data-provenance.md` for the editorial-content ledger this mirrors).

---

## `tr-il-boundaries.geojson` — Türkiye il (province) boundary polygons

| Field                      | Value                                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Source repo**            | `github.com/cihadturhan/tr-geojson`                                                                                |
| **Source file**            | `geo/tr-cities-utf8.json` (raw: `raw.githubusercontent.com/cihadturhan/tr-geojson/master/geo/tr-cities-utf8.json`) |
| **Fetched (UTC)**          | 2026-07-10                                                                                                         |
| **Bytes**                  | 241,284                                                                                                            |
| **Format**                 | GeoJSON `FeatureCollection`, 81 features (Polygon / MultiPolygon), coordinates `[lon, lat]` (WGS84)                |
| **Per-feature properties** | `{ "name": "<il adı>" }` — name only, **no plate code** (see the join note below)                                  |
| **Licence**                | **ODbL** (Open Database License) — OpenStreetMap-derived data                                                      |
| **Required attribution**   | **© OpenStreetMap katkıcıları, ODbL** — rendered visibly next to every map that ships (see `components/map/`)      |

### Why it is transformed at build time (not shipped as-is)

Per the locked SPEC (`Owner's Inbox/interactive-map-hover-spec/SPEC.md` §5.2 + DEC
2026-07-10): the raw GeoJSON is **never sent to the client**. A one-shot generator projects
and simplifies these polygons into inline SVG `<path>` data
(`scripts/generate-map-paths.mjs` → `lib/map/tr-provinces.generated.ts`). Rendering ODbL data
to a produced SVG work is a lighter licence obligation than distributing the source database,
and it is better for CWV (no map library, no tile requests) and SEO (paths + the province
links land in the first-response HTML). The **ODbL attribution stays visible regardless**.

### The name → plaka-kodu join

The source features carry only a `name` (and some are informal, e.g. `"Afyon"` for
Afyonkarahisar). Province identity in our API is keyed by the stable, unique **plaka kodu**
(`plateCode`). The generator therefore maps each GeoJSON `name` → its official 2-digit plate
code via a hand-verified table (`scripts/generate-map-paths.mjs`), and emits the SVG paths
keyed by `plateCode`. The map component then joins those shapes to live API province data by
plate code — so the source's informal names never reach the UI (the API's `nameTr` is the
display name).

### Regenerating

```
pnpm generate:map
```

Reads this file, rewrites `lib/map/tr-provinces.generated.ts`. Re-run only if the source
snapshot is refreshed (update the "Fetched" date above when you do) or the projection /
simplification parameters change. Both this snapshot **and** the generated artifact are
committed, so CI and runtime never invoke the generator.

---

## `world-countries.geojson` — full-world country boundary polygons

| Field                      | Value                                                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Source dataset**         | **Natural Earth** — Admin-0 Countries, **1:50m** scale (`ne_50m_admin_0_countries`)                                                  |
| **Source file**            | `raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson`                             |
| **Fetched (UTC)**          | 2026-07-13                                                                                                                           |
| **Scope**                  | **Full world** — every Natural Earth Admin-0 entity (242 features), incl. non-UN / de-facto entities Natural Earth's default carries |
| **Format**                 | GeoJSON `FeatureCollection`, Polygon / MultiPolygon, coordinates `[lon, lat]` (WGS84), rounded to 3 dp (~111 m) on ingest            |
| **Per-feature properties** | `{ "iso": "<join key>", "name": "<Natural Earth ADMIN>" }` — filtered down from Natural Earth's full 168-property set                |
| **Licence**                | **Public Domain** — "no restrictions … may use in any manner" (Natural Earth Terms of Use). Attribution NOT required.                |
| **Attribution (courtesy)** | Shown as **"Sınır verisi: Natural Earth (kamu malı)"** next to the map — a voluntary courtesy credit, not a licence obligation.      |

### Editorial & scope decisions (→ DEC 2026-07-13, world-map SPEC + sovereignty rulings)

- **Contested-borders policy = Option A (Natural Earth's default / de-facto rendering)** —
  not the Türkiye-POV variant, not neutral disputed-shading. Locked by owner ruling. Under
  this de-facto view Natural Earth already splits several entities into separate features,
  which is exactly what the platform's rulings require (see the Cyprus split below).
- **Full-world scope.** The regional pilot (27 features, framed on the 8 pilot countries) is
  retired now that ~190 countries are seeded and the 6 sovereignty entities are ruled. The
  snapshot is the complete Natural Earth Admin-0 set; the generator decides what to draw.

### The ISO join (+ how the 6 sovereignty entities map)

Features are keyed by a **join key** in `iso`, the stable link to the api's `Country.isoCode`.
Derivation at snapshot-build (see the build note below): prefer `ISO_A2_EH` (Natural Earth's
human-edited alpha-2, which fills in many `-99`s such as Kosovo → `XK` and Taiwan → `TW`),
else `ISO_A2`, with two deliberate exceptions:

- **Cyprus is split in the source** into **`Cyprus`** (`ISO_A2 = CY`, southern polygon — the
  internationally-recognised government) and a separate **`Northern Cyprus`** feature (no ISO
  in the source). The latter is remapped to the api's private-use **`QN`** (KKTC, → DEC
  2026-07-13). Both therefore render as **independently hoverable/clickable regions** once
  each is seeded — the owner's split-island map requirement, met by Natural Earth's own
  geometry, not faked.
- **De-facto entities Natural Earth carries with no usable ISO** (Somaliland, Siachen
  Glacier) get a synthetic lowercase `x-…` backdrop key. These are >2-char / lowercase so
  they can **never** match an uppercase 2-char api `isoCode` → they always render as inert
  backdrop (filling the map so there is no visual gap), never as a link.

The generator emits SVG paths keyed by that join key; the map component links a shape ONLY
when the api's country-map-summary carries its code (i.e. it is seeded), the rest render inert
(same active-vs-inert grammar as the Türkiye il map). It also **merges features that share a
key** (e.g. Australia + its external territories) into one shape → one link per country.

### Regenerating

```
pnpm generate:world-map
```

Reads this file, rewrites `lib/map/world-countries.generated.ts` (Natural-Earth-1-projected +
simplified). **Every snapshot feature is drawn — there is no exclusion list.** Antarctica
(`AQ`) used to be the single deliberate omission; that was reversed on owner instruction
("the world map must not have holes", 2026-07-26). It is drawn at a coarser simplification
tolerance (0.8 vs the global 0.15, `SIMPLIFY_EPSILON_BY_ISO`) because it is non-navigable
backdrop mass, and its genuinely sub-pixel islets are dropped by `MIN_RING_AREA_BY_ISO`
(< 1 svg unit² ≈ < 1 px at world scale): 6.0 kB raw / 2.2 kB gzipped instead of ~19.8 kB raw.
The area bar is measured on the **true projected ring, before simplification** — measuring the
simplified ring instead deletes real islands that the coarse tolerance merely flattened
(PR #23 review I1: 18 real Antarctic rings, largest 4.6 u², were being dropped). Of AQ's 108
outer rings, 72 are true sub-pixel noise and 36 are drawn; the 18 the coarse pass would have
flattened into hairlines are re-simplified at the global 0.15 so they render as islands rather
than as coastal "hair". Both overrides are keyed per ISO and default to
"no override", so no other country path is touched. Framing it extends the
viewBox south (`0 0 1000 447` → `0 0 1000 521`); the projected X extent and the northern edge
are unchanged. Re-run only if the snapshot is
refreshed (update "Fetched" above) or the projection / simplification parameters change. Both the
snapshot **and** the generated artifact are committed, so CI and runtime never invoke the
generator. `pnpm generate:world-map:check` re-runs the generator and fails on any diff; it is
wired into CI, so a hand-edit of the artifact cannot ship.

### Topological simplification + relative encoding (2026-08-02)

Simplification is **topological**, via the shared `scripts/lib/map-topology.mjs`. Douglas-Peucker
used to run once per country, so a border shared by two neighbours was decided twice and they
routinely kept different subsets of the same source vertices — measured on this snapshot,
**1,198 of the 19,258 shared vertices (6.2%) were decided asymmetrically**, and every one of
them is a sliver of sea showing through a land border. The generator now cuts the ring set into
shared arcs, simplifies each arc **once**, and reassembles; the epsilon of a shared arc is the
finest of its owners', so a coarse backdrop override can never degrade a neighbour. The
generator re-measures symmetry on its own output and **throws if it is not 0**.

Emission is **relative** (`scripts/lib/path-encode.mjs`): one absolute `M` per shape, then an
`l` run of deltas. The cursor is tracked in the same 0.1-unit quantised space the SVG parser
reconstructs, so rounding error is bounded per-vertex instead of accumulating along a coastline.
Verified by round-tripping the emitted paths back to absolute: **26,339 vertices, maximum
deviation 0.**

Combined, at the unchanged 0.15 tolerance: **326.3 KiB → 177.9 KiB raw (−45%), 81.4 → 50.9 KiB
brotli (−37%)**, same outlines. Relaxing the tolerance further was measured and **rejected**:
0.25 collapses Malta, Saint Kitts, Turks and Caicos and the US/British Virgin Islands from real
outlines to fallback markers, and the artifact is already far inside budget.

### Enclave holes

Interior rings are **drawn as holes** (they used to be dropped). All 12 in this snapshot are
enclaves, each exactly coincident with the enclosed state's own outline: Lesotho in South
Africa, San Marino and the Vatican in Italy, Uzbek/Tajik exclaves in Kyrgyzstan, Malawi's two
in Mozambique, and the Armenia/Azerbaijan/UAE/Uzbekistan pairs. Dropping them made the
surrounding country paint over the enclave whenever it drew later in ISO order — **Lesotho was
invisible and unclickable on the live map** (its `<a>` was in the HTML, so this was a rendering
defect, not an SEO one). Holes are emitted as extra subpaths and the component must paint with
`fill-rule="evenodd"`, which makes them holes without trusting the source's ring winding.
DEC 2026-07-26's "the world map must not have holes" is about **missing landmass**; an enclave
hole is the opposite — the enclave draws its own shape into it.

Two dispersed micro-archipelagos (**Maldives, British Virgin Islands**) now fall back to the
marker diamond. Every one of their islands is sub-pixel at world scale, so they were previously
emitting zero-area degenerate subpaths — present in the artifact, invisible on screen. The
marker is the artifact's standing guarantee that a country is never unrepresentable; the
per-axis `MARKER_MIN_SPAN` bbox test misses them because the _chain_ spans several units even
though every island in it does not.

> **Snapshot rebuild (one-off, not part of the committed pipeline):** the `{iso, name}` snapshot
> itself is produced from the raw 168-property Natural Earth download by the ISO-derivation +
> 3 dp-rounding transform described above. That transform is a throwaway step run once when
> re-sourcing; only its output (this file) and the generator output are committed.
