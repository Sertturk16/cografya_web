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

## `world-countries.geojson` — world (regional) country boundary polygons

| Field                      | Value                                                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Source dataset**         | **Natural Earth** — Admin-0 Countries, **1:50m** scale (`ne_50m_admin_0_countries`)                                             |
| **Source file**            | `raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson`                        |
| **Fetched (UTC)**          | 2026-07-13                                                                                                                      |
| **Scope**                  | **Regional subset** — the 8 seeded pilot countries + geographic-context neighbours (27 features), NOT the full ~195-country set |
| **Format**                 | GeoJSON `FeatureCollection`, Polygon / MultiPolygon, coordinates `[lon, lat]` (WGS84)                                           |
| **Per-feature properties** | `{ "iso": "<ISO 3166-1 alpha-2>", "name": "<Natural Earth ADMIN>" }` — filtered down from Natural Earth's full property set     |
| **Licence**                | **Public Domain** — "no restrictions … may use in any manner" (Natural Earth Terms of Use). Attribution NOT required.           |
| **Attribution (courtesy)** | Shown as **"Sınır verisi: Natural Earth (kamu malı)"** next to the map — a voluntary courtesy credit, not a licence obligation. |

### Editorial & scope decisions (→ DEC 2026-07-13, world-map SPEC)

- **Contested-borders policy = Option A (Natural Earth's default / de-facto rendering)** —
  not the Türkiye-POV variant, not neutral disputed-shading. Locked by owner ruling.
- **Regional (not full-world) scope is a deliberate pilot choice.** Only the 8 pilot
  countries are seeded, so the committed subset covers just their region (Balkans → Caucasus
  → Middle East). This also keeps the snapshot lean (Russia's full geometry alone is ~177 kB
  of mostly off-frame Siberia, so it is excluded from the context set). The 5 pending
  sovereignty-recognition entities (Cyprus, Kosovo, Israel-capital, Palestine, Taiwan) are
  **none of them in this region and none among the 8 seeded**, and are deliberately NOT
  drawn — so this pilot map is unblocked by those open rulings. Full-world sourcing is a
  tracked follow-up once more countries are seeded + those rulings land.

### The ISO join

Features are keyed by **ISO 3166-1 alpha-2** (`iso`), the stable join key to the api's
`Country.isoCode`. The generator emits SVG paths keyed by that code; the map component joins
those shapes to live api country data by ISO — a country renders interactive/linked ONLY
when the api's country-map-summary carries its ISO (i.e. it is seeded), the rest render as
inert backdrop (same active-vs-inert grammar as the Türkiye il map).

### Regenerating

```
pnpm generate:world-map
```

Reads this file, rewrites `lib/map/world-countries.generated.ts` (projected + simplified,
framed on the seeded 8). Re-run only if the snapshot is refreshed (update "Fetched" above)
or the projection / simplification parameters change. Both the snapshot **and** the
generated artifact are committed, so CI and runtime never invoke the generator.
