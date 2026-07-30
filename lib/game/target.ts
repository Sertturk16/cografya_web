import type { ProvinceMapSummary } from "@/lib/api/types";
import type { GameModeId } from "./config";
import type { GameShapeTargetEntry } from "./map-shapes";

export { GAME_MODE_IDS, isGameModeId, type GameModeId } from "./config";

/**
 * What a round asks about, and how a map shape answers it (SPEC §5.6, §6).
 *
 * The split this module exists to enforce: the ENGINE (`lib/game/round.ts`) only ever
 * sees `{ id, label, kind }` — it has no idea a target is drawn as a polygon. Binding a
 * target to the shapes that answer it is a PRESENTATION concern and lives here, in the
 * `plateToTarget` lookup. That is what keeps a future Faz-2 layer (a mountain drawn as a
 * point, a river drawn as a line) from needing a single engine change: it would ship its
 * own binding and reuse the same round logic untouched.
 *
 * No geography facts are encoded here (CONVENTIONS §4). Region membership, province
 * names and slugs all arrive from the api through `GameShapeTargetEntry`; region LABELS arrive
 * as a translated lookup from the `Regions` message namespace. This module only groups
 * and orders what it is handed.
 */

/** One thing a round can ask for. Deliberately presentation-free (SPEC §5.6). */
export interface GameTarget {
  /** Stable identity: the region enum key, or the province's plaka kodu. */
  readonly id: string;
  /** Localized display name — what the question and the end-of-round list show. */
  readonly label: string;
  readonly kind: "region" | "province";
  /**
   * Province detail slug for the end-of-round "provinces you missed" links, `null` for a
   * region (regions have no page of their own today). Not used by the engine.
   */
  readonly slug: string | null;
}

/** A mode's full question pool plus the shape binding its answers need. */
export interface GameTargetSet {
  readonly modeId: GameModeId;
  readonly targets: readonly GameTarget[];
  /**
   * Plaka kodu → target id. A plain object rather than a `Map` because this crosses the
   * server→client boundary as a prop; it is also the ONLY thing the island needs in
   * order to turn a clicked `<path>` into an answer, so no province table is duplicated
   * as JavaScript (SPEC §3.3).
   */
  readonly plateToTarget: Readonly<Record<string, string>>;
}

/** Localized region names, keyed by the api's region enum (the `Regions` namespace). */
export type RegionLabels = Readonly<Record<ProvinceMapSummary["region"], string>>;

/**
 * Mode 2 — "81 İl Bulma": one target per SEEDED shape, in plaka-kodu (artifact) order.
 *
 * An unseeded plate produces no target at all, so it can never be asked for and never
 * counts as a right answer. Ordering is the artifact's, which makes the pool
 * deterministic; the round shuffles it (SPEC §5.1), the pool never randomizes itself.
 */
export function buildProvinceTargetSet(shapes: readonly GameShapeTargetEntry[]): GameTargetSet {
  const targets: GameTarget[] = [];
  const plateToTarget: Record<string, string> = {};

  for (const shape of shapes) {
    if (!shape.target) continue;
    targets.push({
      id: shape.plateCode,
      label: shape.target.name,
      kind: "province",
      slug: shape.target.slug,
    });
    plateToTarget[shape.plateCode] = shape.plateCode;
  }

  return { modeId: "provinces", targets, plateToTarget };
}

/**
 * Mode 1 — "Bölge Bulma": one target per region that actually has a seeded province.
 *
 * Every province of a region maps to that region's target, so clicking ANY province of
 * the asked region answers it (SPEC §6.1) — and no region polygon has to be generated,
 * which is why this mode needs zero new data. A region with no seeded province is simply
 * absent from the pool rather than being asked about an unclickable area.
 *
 * Target order follows first appearance in artifact order, so the pool is deterministic
 * for the same reason as above.
 */
export function buildRegionTargetSet(
  shapes: readonly GameShapeTargetEntry[],
  regionLabels: RegionLabels,
): GameTargetSet {
  const targets: GameTarget[] = [];
  const seen = new Set<string>();
  const plateToTarget: Record<string, string> = {};

  for (const shape of shapes) {
    if (!shape.target) continue;
    const region = shape.target.region;
    plateToTarget[shape.plateCode] = region;
    if (seen.has(region)) continue;
    seen.add(region);
    targets.push({ id: region, label: regionLabels[region], kind: "region", slug: null });
  }

  return { modeId: "regions", targets, plateToTarget };
}

/** Index a target set by id — the label lookup the HUD and end screen need. */
export function targetsById(targets: readonly GameTarget[]): Map<string, GameTarget> {
  return new Map(targets.map((target) => [target.id, target]));
}
