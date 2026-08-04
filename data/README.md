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

## `tr-inland-water.geojson` — Türkiye lakes + reservoirs (P6)

| Field                      | Value                                                                                                                              |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Source**                 | OpenStreetMap via the Overpass API (`gall.openstreetmap.de` / `overpass-api.de` / `lambert.openstreetmap.de`)                      |
| **`timestamp_osm_base`**   | **2026-08-02T16:29:06Z** — the OSM database moment this snapshot represents                                                        |
| **Fetched (UTC)**          | 2026-08-02                                                                                                                         |
| **Bytes**                  | 1,140,794                                                                                                                          |
| **Format**                 | GeoJSON `FeatureCollection`, 114 features (Polygon / MultiPolygon), coordinates `[lon, lat]` (WGS84), plus a `metadata` block      |
| **Per-feature properties** | `osmId`, `name` (`name:tr` → `name` → `name:en`), `water`, `wikidata`, `intermittent`, `areaKm2`, `verbatimNodes`, `snapshotNodes` |
| **Licence**                | **ODbL** — same source and the same obligation as `tr-il-boundaries.geojson`                                                       |
| **Required attribution**   | **© OpenStreetMap katkıcıları, ODbL** — already rendered next to every map surface; no new attribution surface was needed          |

### Licence hygiene — this file is never merged with Natural Earth data

Public-domain Natural Earth data (the future sea / neighbouring-land layer, and the `/dunya`
lakes) stays in its **own** files. ODbL's share-alike applies to a _derived database_, so
combining an ODbL source and a public-domain source into one data file risks pulling the
public-domain side into ODbL. Keeping them physically separate preserves the "collective
database" position (→ DEC 2026-08-01r-1). Rendering both into one SVG is a _produced work_
and is not affected.

### The exact query

Reproduced verbatim in the snapshot's own `metadata.query`, and generated by
`scripts/fetch-tr-inland-water.mjs`:

```
[out:json][timeout:900];
(
  relation(id:<100 ids ≥ 10 km², + 2 curriculum ids>);
  way(id:<7 ids ≥ 10 km², + 5 curriculum ids>);
);
out geom meta;
```

Selection is **ID-pinned**, never by name — "Acıgöl" is two different lakes, and a name query
changes its result set whenever a mapper renames something. The pinned list was produced by a
measured sweep rather than hand-picked; the sweep is reproducible:

```
# 1 — every natural=water feature in Türkiye, ids + bounding boxes only (21,838 features)
[out:json][timeout:900];
area["ISO3166-1"="TR"][admin_level=2]->.tr;
( way["natural"="water"](area.tr); relation["natural"="water"](area.tr); );
out ids bb;

# 2 — keep bbox area ≥ 7 km² (a bbox is an upper bound on area, so nothing ≥ 10 km² is lost):
#     561 features. Fetch their tags, keep water ∈ {lake, reservoir, lagoon, pond, ∅}: 331.
# 3 — fetch geometry, stitch relation members into rings, measure spherical area outer−inner.
# 4 — keep ≥ 10 km²: 107 bodies. relation/1142386 (Teşrin, SYRIA, 134.6 km²) is excluded by
#     the id pin — it clears the top tier and is inside the TR area query.
```

10 km² is the widest rung of the owner's drawing-threshold ladder (40 / 30 / 10 km², →
DEC 2026-08-02k md. 3), so every rung can be rendered from this one snapshot without
another network round trip.

**The owner ruled the middle rung — 30 km² (S1, 2026-08-02).** **50 of the 114 bodies** in
this file clear it and the generator draws **49** of them (42.2 kB artifact); the other 64
stay in the snapshot, unread, so a future re-ruling is a `pnpm generate:water` and not a
fetch. The rung is what brings the curriculum bodies that sit between the two candidate cuts
onto the map — Marmara Gölü (38.6 km²), Suğla, Seyhan, Sır and Balık Gölü. It also admits
**Karamık Gölü (39.99 km²)**, one of the three bodies the source review flagged as
cartographically doubtful (OSM also tags it `alt_name = Karamık Bataklığı`, i.e. a marsh); it
enters by the rule rather than by preference, and it is in the owner's sample set for that
reason.

**The 50th body is held back as a DUPLICATE, not by the rung.** `relation/7336746` "Hoyran
Gölü" (138.01 km²) is the northern lobe of `relation/1410914` "Eğirdir Gölü" (453.02 km²), and
OSM's Eğirdir relation already covers that lobe: sampling Hoyran's interior on a 900 × 900 grid
puts **99.94 %** of it inside Eğirdir (→ DEC 2026-08-02q md. A). Drawing both painted ~138 km²
of water twice and, because the two bodies simplify at different tolerances, drew the shared
shoreline twice a fraction of a unit apart — a doubled shore plus a spurious line across open
water at the strait. The same overlap sweep across all 50 bodies **above the rung** — the 49
drawn plus Hoyran, i.e. the set as it stood before this exclusion — found **no other pair
overlapping by more than 1 %**. The feature stays in this snapshot (it is a real OSM object and
this file is the record of the sweep, not of the map); the exclusion lives in
`scripts/generate-tr-inland-water.mjs` as `DRAWN_DUPLICATES`, next to its measurement, and the
generator refuses to apply it if Eğirdir itself ever stops being drawn.

### Filters applied at fetch time

| Filter                                               | Why                                                                                |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| every pinned id must come back, or the script throws | a silently missing id is how a lake disappears from the map unnoticed              |
| `natural=water` required                             | `natural=caldera` and friends are not water bodies                                 |
| `water ∈ {lake, reservoir, lagoon, pond, ∅}`         | `river` / `canal` / `basin` / `wastewater` dominate the largest-feature list       |
| `water=dry_lake` rejected                            | Tuz Gölü has three large unnamed seasonal aprons tagged this way                   |
| relation rings must close                            | an unclosed ring is a lake with a bite out of it — refused, never silently dropped |
| name resolved `name:tr` → `name` → `name:en`         | the file must already carry the right string before any label layer exists         |

**The name order is `name:tr` → `name` → `name:en`, and the middle term is load-bearing.** On a
Turkish feature the untagged `name` IS the Turkish name; `name:en` is a translation for
foreigners. Reading `name:en` second put "Atatürk Reservoir", "Akyatan Lagoon" and "Hirfanlı
Dam" into this snapshot once. The rule lives in `scripts/lib/osm-names.mjs` and is pinned by
`lib/map/osm-names.test.ts` — if this paragraph and that test ever disagree, the test is right.

**Re-deriving the provenance row above.** `timestamp_osm_base` and the byte count are NOT
narrative — copy them out of the committed artifact, never from a previous fetch's console
output (both were once a fetch out of date here, describing an OSM database state that would
replay differently):

```
node -e "const f=require('fs');const j=JSON.parse(f.readFileSync('data/tr-inland-water.geojson'));\
console.log(j.metadata.timestampOsmBase, f.statSync('data/tr-inland-water.geojson').size)"
```

### Reduced, not rewritten

Verbatim, the 114 bodies are **1,430,002 nodes / ~34 MB**: OSM traces reservoir shorelines
at ~10 m from imagery (Keban alone is 215,488 nodes). That is three orders of magnitude finer
than this map can render — the viewBox is 1000 units wide and one unit is ~1.68 km — and
~240× the province snapshot it has to register against. So the fetch step applies
Douglas–Peucker at **0.05 svg units (≈ 84 m)** in the pinned frame: **46,960 nodes, 1.09 MB**.

This is a **vertex subset**, not a rewrite. Every coordinate in the file is an unmodified
7-decimal OSM value; nothing is rounded, averaged or invented. `areaKm2` is measured on the
**verbatim** rings _before_ reduction, so the drawing threshold is decided by the source's own
geometry and cannot wobble across a rung because a tolerance changed.

**The reduction is verified invisible at drawing resolution, not assumed to be.** Re-running
the generator's own simplification against the VERBATIM Overpass geometry and comparing it to
the result from this snapshot, across the **39 bodies the 40 km² rung drew**: **identical
vertex count**, and a maximum vertex displacement of **0.185 svg units (0.31 km)** — under a
fifth of a pixel at the 1000 px render width, worst case Hotamış Depolaması.

The **11 further bodies** the ruled 30 km² rung adds were not individually re-measured, because
that needs another network fetch of the 34 MB verbatim geometry. All 11 are below ~101 km², so
the generator draws them at its `ε_min` of 0.12 svg units — its FINEST tolerance, 2.4× this
snapshot's 0.05, which is exactly the headroom case the measurement above covers.

### Regenerating

```
node scripts/fetch-tr-inland-water.mjs   # network, manual, deliberately NOT a pnpm script
pnpm generate:water                      # offline: snapshot → lib/map/tr-inland-water.generated.ts
pnpm generate:water:check                # CI drift gate
```

Refresh when a reservoir's extent changes materially — **Yusufeli is still filling** (it began
impounding in 2022 and its polygon shows an intermediate state), so its area will grow.

---

## `tr-inland-water-jrc.geojson` — Türkiye seasonal + salt lakes (P7)

| Field                      | Value                                                                                                                                                                              |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Source dataset**         | **JRC Global Surface Water v1.5 (1984–2024)**, `occurrence` + `extent` layers, 30 m                                                                                                |
| **Publisher**              | European Commission Joint Research Centre / Google                                                                                                                                 |
| **Bytes**                  | 83,611                                                                                                                                                                             |
| **Format**                 | GeoJSON `FeatureCollection`, 9 features (MultiPolygon), coordinates `[lon, lat]` (WGS84), plus a `metadata` block                                                                  |
| **Per-feature properties** | `id`, `name`, `wikidata`, `areaKm2`, `rings`, `nodes`, `identity`, `window`, `identityNeighbourPx`, `componentsIdentity`, `componentsUsed`, `componentsTotal`, `extentCoveragePct` |
| **Licence**                | Copernicus / EC JRC open data — free reuse **with attribution and citation**                                                                                                       |
| **Required attribution**   | **`Source: EC JRC/Google`** — verbatim, never translated, rendered next to every TR-frame map                                                                                      |
| **Required citation**      | Pekel et al. 2016, rendered on `/hakkimizda` (see below)                                                                                                                           |

### Why this file exists at all — the hybrid

OSM traces a lake from one satellite moment. For a body that fills and dries, that moment is
arbitrary: our OSM Tuz Gölü was 939 km² in three fragments, an artefact of a single 2024 edit.
GSW's `occurrence` layer answers a different question — _what share of 1984–2024 observations
at this pixel were water_ — and for the seasonal and salt class that is the only honest
description available (→ DEC 2026-08-02q §D).

The same statistic is exactly why **dams and permanent lakes stay on OSM**. A reservoir
impounded in 2018 has been water for six of the forty-one years, so its occurrence is low
everywhere: measured, Ilısu falls 286.0 → 22.2 km². The denominator is the trap, and the
hybrid exists to avoid walking into it.

### Licence hygiene — this file is never merged with the ODbL snapshot

ODbL's share-alike applies to a _derived database_. Merging JRC geometry into
`tr-inland-water.geojson` would pull the merged result under ODbL, which the Copernicus terms
do not grant. The two files therefore meet only in `scripts/generate-tr-inland-water.mjs`, and
only as geometry that is rendered into one SVG — a _produced work_, which carries no such
obligation (→ DEC 2026-08-01r-1). `lib/map/tr-inland-water-jrc.test.ts` asserts the separation
in both directions, and this file carries **no OSM identifier of any kind**: names and Wikidata
QIDs are typed by hand, not copied.

The identity boxes are hand-typed for the same reason. Using our OSM polygon as an identity
filter was proposed and declined — "we only used it to choose which pixels to keep" is exactly
the argument the separation exists to avoid having to make.

### The recipe

```
granule (cached, SHA-256 pinned)
  → window read
  → threshold occurrence >= 10 %          ← never `== 100`; 255 (no data) removed first
  → 4-connected component labelling
  → IDENTITY TEST                          ← core box + components within N px of the body
  → morphological closing, r = 300 m       ← bridges dry salt-crust seams; reach is 2·r
  → interior hole filling                  ← a dried lake bed is part of the lake
  → `extent` cross-check                   ← every selected pixel must be inside max extent
  → boundary tracing (marching squares)
  → Douglas–Peucker at 0.05 svg units      ← the ODbL snapshot's own SNAPSHOT_EPSILON
```

Every constant is pinned at the top of `scripts/fetch-tr-jrc-water.mjs` with its rationale and
is copied into this file's `metadata.recipe`. They interact strongly — on Tuz Gölü, changing
only the closing radius moves the result from 1,292.6 km² (10 px) to 1,374.9 km² (20 px) — so
the recipe is an executable, not a paragraph, and the owner approves a **rendered frame**,
never a number (→ DEC 2026-08-02q §C).

**Distances are pinned in PIXELS, not metres (→ DEC 2026-08-04g §2).** A GSW pixel is
0.00025° of arc — ~21.8 m east-west and ~27.8 m north-south at Türkiye's lake latitudes, not
30 m — so a metre-quoted radius both rounds (135 m and 164 m are the same structuring element)
and misdescribes its own ground footprint. That cost a defect: a documented "150 m keeps Yay
Gölü and Çöl Gölü apart" was really 5 px, and 5 px merges them. The neighbour reach is
therefore an integer pixel count, globally `IDENTITY_NEIGHBOUR_PX` and per body via the
registry's optional `neighbourPx` — which `gsw-09` uses (4 px) because Çöl Gölü joins at 5.

**The identity test replaced an earlier "every component touching a seed box" rule** after that
rule drew **Hirfanlı Baraj Gölü** as part of Tuz Gölü (→ DEC 2026-08-04d). The reservoir's
264 km² component reaches into any box wide enough to hold Tuz, because the two overlap in both
latitude and longitude; no rectangle separates them. The window stays wide regardless — it must
be at least 2 × the closing radius clear of the finished body, because outside the window is dry
and closing shaves anything reaching the edge.

### The bodies

| id       | Name          | Wikidata |    km² | rings | nodes |
| -------- | ------------- | -------- | -----: | ----: | ----: |
| `gsw-01` | Tuz Gölü      | Q211823  | 1292.6 |   268 |  2732 |
| `gsw-02` | Akşehir Gölü  | Q617319  |  194.1 |    10 |   167 |
| `gsw-03` | Eber Gölü     | Q1284379 |  109.9 |     6 |   161 |
| `gsw-04` | Tersakan Gölü | Q6161851 |   50.6 |    15 |   171 |
| `gsw-05` | Marmara Gölü  | Q1093090 |   61.4 |     2 |    77 |
| `gsw-06` | Karamık Gölü  | Q6151136 |   37.8 |    21 |   175 |
| `gsw-07` | Seyfe Gölü    | Q3383191 |   63.2 |    13 |   233 |
| `gsw-08` | Acıgöl        | Q2820091 |  155.1 |    22 |   289 |
| `gsw-09` | Yay Gölü      | —        |   84.8 |     1 |   139 |

`areaKm2` is measured on the traced rings, before reduction — it is a **drawing** measurement,
not a figure for publication. **No number from this file is ever published as fact**: GSW is a
cartographic source, and the areas a reader is taught come from the content pipeline
(→ DEC 2026-08-01r-4).

### Granules — 505.0 MB, cached, never committed

The six granules tiling Türkiye's bounding box, for both layers, live in a gitignored
`.jrc-cache/`. Their SHA-256 digests are **pinned in the fetch script and copied into this
file's `metadata.granules`**: the download URL carries no version beyond `VER1-5`, so a silent
republication would otherwise change our lakes with nothing in the diff. A mismatch throws.

| Granule                            | SHA-256                                                          |
| ---------------------------------- | ---------------------------------------------------------------- |
| `occurrence_20E_40N_v1_5_2024.tif` | 0c1bc09f08317d9b893a6858e0fc9a26628fed322c0eb97b0ab0d1b04924f937 |
| `occurrence_30E_40N_v1_5_2024.tif` | dc41507f8e22a9d36da5793f9f9ff9ceba222ff8abe7d618b37e03c93d62f9df |
| `occurrence_40E_40N_v1_5_2024.tif` | 30db9dbcae93d6b297b87584aa358729d0aef4a43ec5bd298fbf2e5810333e50 |
| `occurrence_20E_50N_v1_5_2024.tif` | 6a1163a9563219c3d147f6e7f1cf274b9e64cddf45465b6ef6dc4f15a7c3b83b |
| `occurrence_30E_50N_v1_5_2024.tif` | f128ac90c5698a48c19df7cf29141a0294d38bdfeb534b602525d8c5b62e0f25 |
| `occurrence_40E_50N_v1_5_2024.tif` | 725266cdc5058b7c9de80834cd4506c0f110d69c93b9ff72373e2fdea5241975 |
| `extent_20E_40N_v1_5_2024.tif`     | de73cd84bf3e330063dd61d9e96915848e904db976d7f3bf1879e228bb00ff37 |
| `extent_30E_40N_v1_5_2024.tif`     | e9c4efc9d4bccf2a7e753d4eeea25e2f35d2ac575a5276e33b28e2410072b7dc |
| `extent_40E_40N_v1_5_2024.tif`     | ce9f8c1cffd21ee687bbe29d5be61a379e86a36f1155484781b0f5c179ed1d61 |
| `extent_20E_50N_v1_5_2024.tif`     | 67c7285fc41719b578fd677b620483f5d205c18bccd7c41b427af47a2ade7f2c |
| `extent_30E_50N_v1_5_2024.tif`     | b252ee4abab6aadc7f72ff9544052d5f8cdc9971cb68317e7a0b32e10d5dbe18 |
| `extent_40E_50N_v1_5_2024.tif`     | 7e3be46611a8aac49213ddc966e9837814d6c129925a7fda41affe7de2eac5bc |

**The raster step has no CI gate** — it needs the network and 505 MB. That is a deliberate,
accepted gap (→ DEC 2026-08-03c, Q10); its compensating controls are the pinned checksums, the
committed derivative behind `pnpm generate:water:check`, and the owner's sample gate.

### Regenerating

```
node scripts/fetch-tr-jrc-water.mjs      # network + 505 MB, manual, deliberately NOT a pnpm script
pnpm generate:water                      # offline: BOTH snapshots → lib/map/tr-inland-water.generated.ts
pnpm generate:water:check                # CI drift gate
```

Refresh when JRC publishes a new GSW edition. Environment overrides
(`JRC_OCCURRENCE_THRESHOLD`, `JRC_CLOSING_RADIUS_M`, `JRC_COMPONENT_RULE`,
`JRC_IDENTITY_NEIGHBOUR_M`, `JRC_OUT`, and `JRC_SOURCE` on the generator) exist **only** to
render the owner's variant frames into `.jrc-cache/variants/`. They are never set in CI, so the
committed file and artifact stay deterministic.

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
The encoding step is lossless at the 0.1 quantum — verified by round-tripping the emitted paths
back to absolute (maximum deviation 0) and pinned by a synthetic-input unit test
(`lib/map/path-encode.test.ts`).

The simplification step, by contrast, **does re-decide outlines** — arcs are anchored at
junctions instead of at each ring's own start vertex, so the surviving vertex set differs from
the old per-ring pass. Two guards bound what that can cost: every junction-free loop force-keeps
its source ring's start vertex (the anchor the old pass had), and an **area-preservation guard**
re-simplifies any loop whose enclosed area would fall below 80% of the true ring's
(`LOOP_AREA_RATIO`) — DP measures perpendicular distance, which for near-tolerance rings says
nothing about area, and small islands measurably collapsed without it (Bahrain to a triangle at
−45% painted area). Measured against the previous artifact, the smallest listed countries now
sit between −6.8% (Brunei, a shared-border redistribution) and +139% (Malta — the OLD pass was
the one under-painting it; the guard bounds loss against the TRUE ring, so several small
countries are now closer to the source than before). An emitted ring must also keep at least
`MIN_VISIBLE_RING_AREA` (0.01 u² ≈ 1.4 px² at max zoom): a ring below it is invisible at any
zoom, and this bar — not an accident of collapse — is now what removes the zero-area
degenerate-subpath class.

Combined, at the unchanged 0.15 tolerance: **326.3 KiB → 191.5 KiB raw (−41%), 81.4 → 54.2 KiB
brotli (−33%)**. Relaxing the tolerance further was measured and **rejected**: 0.25 collapses
Malta, Saint Kitts, Turks and Caicos and the US/British Virgin Islands from real outlines to
fallback markers, and the artifact is already far inside budget. That ruling is now enforced in
code: `MUST_STAY_POLYGON` (SG, MT, BH, CY, QN, PS, XK) makes the generator **throw** if any of
them ever demotes to a marker, so a future retune cannot pass CI on a clean drift diff alone.

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

**11 of the 12 holes reach the artifact.** A hole ring gets a preservation floor in the
topology pass: the coastline epsilon is the wrong tolerance for a ring whose whole job is to
make room for another state, so a hole that would collapse below 3 vertices is re-simplified
finer, together with its coincident enclave outline (they share the arc, so the pair re-emerges
in lockstep — Artsvashen in Azerbaijan and Barak in Uzbekistan were still being painted over
without this, the Lesotho failure mode at ~2–3 px scale). The single residue is **Italy's
Vatican hole (0.001 u²)**: it is below `MIN_VISIBLE_RING_AREA` and below the 0.1-unit path
quantisation itself, and the Vatican is a marker-fallback micro-state whose diamond draws over
Italy at that exact spot — nothing is visually or navigationally lost. The hole census (11) is
pinned by `lib/map/world-shapes.test.ts`.

Two dispersed micro-archipelagos (**Maldives, Wallis and Futuna**) render as marker diamonds by
rule (`MARKER_MIN_AREA`): their total true painted area (0.048 / 0.097 u²) is a fraction of
what the 2 u² marker itself paints, so "polygons" would mean invisible specks — which is what
they were: both previously emitted zero-area degenerate subpaths, present in the artifact,
invisible on screen. The per-axis `MARKER_MIN_SPAN` bbox test cannot see them because the
_chain_ spans several units even though every island in it does not. The **British Virgin
Islands** (0.102 u²) sit just above the bar and render their three ≥ 0.01 u² islands as real,
area-true polygons. A marker is insurance, never geometry: a join key that has any real polygon
(e.g. Australia and its sub-visible Coral Sea Islands territory feature) never receives one.

> **Snapshot rebuild (one-off, not part of the committed pipeline):** the `{iso, name}` snapshot
> itself is produced from the raw 168-property Natural Earth download by the ISO-derivation +
> 3 dp-rounding transform described above. That transform is a throwaway step run once when
> re-sourcing; only its output (this file) and the generator output are committed.
