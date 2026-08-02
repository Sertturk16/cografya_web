// @ts-check
/**
 * Display-name resolution for OpenStreetMap features.
 *
 * ## Why this is its own module and not a helper inside the fetch script
 *
 * It got the precedence WRONG once already, and nothing failed. `scripts/fetch-*.mjs` runs
 * top-level `await` against the network the moment it is imported, so its internals cannot be
 * unit-tested at all — the resolver was therefore the one rule in the inland-water pipeline
 * with no coverage anywhere, and it is also the rule most likely to be "corrected" by someone
 * reading a stale doc (PR #39 review C2 + T3). Sitting here, it is importable, pure, and
 * pinned by `lib/map/osm-names.test.ts`.
 */

/** @typedef {Record<string, string | undefined>} OsmTags */

/**
 * Resolve a feature's display name: **`name:tr` → `name` → `name:en`**.
 *
 * `name` comes BEFORE `name:en`, and that ordering is a correction made from a real fetch
 * report rather than a preference. On a Turkish feature the untagged `name` IS the Turkish
 * name, and several of these bodies carry an English `name:en` with no `name:tr` at all.
 * Preferring `name:en` produced **"Atatürk Reservoir"**, **"Akyatan Lagoon"** and
 * **"Hirfanlı Dam"** in a Turkish-first product whose whole reason for using OSM over Natural
 * Earth is that the names arrive in Turkish (NE calls Karakaya "Saksak Dagi").
 *
 * Faz-1 draws no labels, but the snapshot must already carry the right string so the label
 * layer, when it lands, does not inherit a wrong name.
 *
 * @param {OsmTags} tags
 * @returns {string | null} The resolved name, or `null` when the feature is unnamed.
 */
export function resolveName(tags) {
  return tags["name:tr"] ?? tags.name ?? tags["name:en"] ?? null;
}
