import type { MarineOverview, MarinePointListItem, MarineValue } from "@/lib/api/types";
import { basinLabel, groupPointsByBasin, type SeaBasin } from "@/lib/marine/basins";
import { coastalPlateCodes } from "@/lib/marine/coastal";
import { marinePublishableBlocks } from "@/lib/marine/overview";

/**
 * "Bugün denizler" — the homepage's four-basin digest of the `/deniz` value payload.
 *
 * ## What this module is allowed to invent: NOTHING
 *
 * The basin set, the basin ORDER and the basin HEADINGS all come from
 * `lib/marine/basins.ts`, which reads them off the payload's own `seaBasin`, `displayOrder`
 * and `coastLabelTr/En`. There is no basin table here and there must never be one — a second
 * copy would be a geography fact living outside the api (`CONVENTIONS.md` §4).
 *
 * ## Why the MEDIAN, and why the point count is printed with it
 *
 * A basin holds up to fifteen reference points that legitimately disagree. Picking one to
 * stand for the basin is an editorial choice nobody made, and it lets a single bad probe
 * mis-state a whole sea. The median is the reduction that survives one bad point, and it is
 * reported WITH its `pointCount` so the number is presented as what it is — a digest of N
 * points — rather than as a reading taken somewhere. The full per-point table stays one click
 * away on `/deniz`, which is where a reader who wants a specific place should land.
 *
 * ## The three states the api can be in, and the ONE signal the page reads
 *
 * `status` is the contract's reason-carrying field and the three non-`ok` values are NOT
 * interchangeable:
 *
 * - `ok` — a number. The only kind that enters a median.
 * - `not_supported` — a PERMANENT product truth (CMEMS publishes no wave field in the
 *   Marmara). Its row is simply absent; a permanent absence rendered as a dash reads as a
 *   fault.
 * - `no_data` / `unavailable` — a transient gap. Also absent, for the same reason: this
 *   surface is a four-card digest with no room to explain a status, and `/deniz` explains all
 *   three properly.
 *
 * So a basin with no usable value produces NO CARD (never an empty one), and a summary with
 * no cards is the page's single "there is nothing to show" signal
 * (`marineSummaryShowsValues`). The homepage heading, the card grid, the künye and the
 * attribution block all read that ONE function — the lesson `lib/marine/overview.ts` records
 * from `/deniz`, where a lede and an `<h2>` computing the same question separately let the
 * page promise values it could not show.
 */

/** One quantity, digested across a basin's points. Never constructed without a real number. */
export interface MarineMetricSummary {
  /** Median of the basin's `ok` values for this quantity. */
  readonly median: number;
  /** The contract unit those values shared; drives the `Marine.unit.*` symbol. */
  readonly unit: MarineValue["unit"];
  /** How many points fed the median — printed beside it, so it is never read as a reading. */
  readonly pointCount: number;
}

/** One basin card. Exists only if at least one of its quantities does. */
export interface MarineBasinSummary {
  /** The contract's basin key — a stable React key, never a display string. */
  readonly basin: SeaBasin;
  /** The heading, taken from the group's own `coastLabelTr` / `coastLabelEn`. */
  readonly label: string;
  /** Sea surface temperature, or `null` when the basin publishes none this render. */
  readonly seaSurfaceTemperature: MarineMetricSummary | null;
  /** Significant wave height, or `null` (permanently so in the Marmara). */
  readonly waveHeight: MarineMetricSummary | null;
}

/** The digest the homepage renders, plus the exact values its künye may speak for. */
export interface MarineHomeSummary {
  /** Basin cards in the api's coastal-traverse order. Empty means "no values this render". */
  readonly basins: readonly MarineBasinSummary[];
  /**
   * Every `ok` value that fed a printed median — and nothing else.
   *
   * This is what `<VintageLine>` receives, so the künye speaks for exactly the numbers on
   * screen: a value that was filtered out cannot contribute its timestamp to a line claiming
   * to describe what the reader is looking at.
   */
  readonly values: readonly MarineValue[];
}

/** How much coastline the marine surface covers — the value-LESS card's honest facts. */
export interface MarineScope {
  /** Distinct sea basins in the published point set. */
  readonly basinCount: number;
  /** Published offshore reference points. */
  readonly pointCount: number;
  /** Distinct provinces those points are published under (three provinces own two). */
  readonly provinceCount: number;
}

/**
 * The ONE signal deciding whether the homepage may make a value claim this render.
 *
 * Deliberately `basins.length > 0` rather than `marineShowsValues(overview)`: the overview
 * gate answers "is there a publishable payload", which is necessary but not sufficient here.
 * A payload whose every field came back `no_data` passes that gate and still yields no card,
 * and a heading reading "Bugün denizler" over nothing is precisely the broken promise this
 * whole shape exists to prevent. The implication still holds in the direction that matters —
 * no publishable payload ⇒ no basins — and `marine-summary.test.ts` pins it.
 */
export function marineSummaryShowsValues(summary: MarineHomeSummary): boolean {
  return summary.basins.length > 0;
}

/**
 * Digests the `/deniz` value payload into at most one card per basin.
 *
 * `null` (an outage, or an api that does not serve the route) and the contract's
 * `dataAvailable: false` publish gate both collapse to an empty summary through
 * `marinePublishableBlocks` — the same function `/deniz` reads, so the two surfaces can never
 * hold different opinions about whether today has values.
 */
export function buildMarineHomeSummary(
  overview: MarineOverview | null,
  locale: string,
): MarineHomeSummary {
  const blocks = marinePublishableBlocks(overview);
  if (blocks.length === 0) return { basins: [], values: [] };

  // Group by the points the payload carries with it, so the digest inherits the api's own
  // basin set, traverse order and headings rather than restating any of the three.
  const groups = groupPointsByBasin(blocks.map((block) => block.point));
  // Keyed by OBJECT IDENTITY, not by slug: `groupPointsByBasin` regroups and reorders the very
  // point objects it was handed (it copies arrays, never members), so identity is the exact
  // join and it depends on no field being unique. A slug key would quietly mis-pair two blocks
  // the day the payload repeated a `slugTr`.
  const blockByPoint = new Map(blocks.map((block) => [block.point, block]));

  const basins: MarineBasinSummary[] = [];
  const values: MarineValue[] = [];

  for (const group of groups) {
    const label = basinLabel(group, locale);
    if (label === null) continue;

    const members = group.points
      .map((point) => blockByPoint.get(point))
      .filter((block) => block !== undefined);

    const sst = digest(members.map((block) => block.seaSurfaceTemperature));
    const wave = digest(members.map((block) => block.waveHeight));
    if (sst === null && wave === null) continue;

    basins.push({
      basin: group.basin,
      label,
      seaSurfaceTemperature: sst?.summary ?? null,
      waveHeight: wave?.summary ?? null,
    });
    if (sst !== null) values.push(...sst.contributors);
    if (wave !== null) values.push(...wave.contributors);
  }

  return { basins, values };
}

/**
 * The published marine scope — the four facts the value-less card states.
 *
 * Every one is COUNTED from the payload, never written down: a hardcoded "30 nokta" is a
 * geography fact on the web side, and it would go quietly wrong the day the probe set moves.
 * An empty list yields all zeroes, and the caller then prints its count-less sentence rather
 * than "0 denizde 0 nokta".
 *
 * The province count is `coastalPlateCodes()` — the SAME function the province pages' coastal
 * gate reads — rather than a second `new Set(…plateCode)` written here. "How many provinces
 * have a coast" is one question, and two independent derivations of it would drift the day
 * that rule changes (`lib/marine/coastal.ts` owns it).
 */
export function marineScope(points: readonly MarinePointListItem[]): MarineScope {
  return {
    basinCount: new Set(points.map((point) => point.seaBasin)).size,
    pointCount: points.length,
    provinceCount: coastalPlateCodes(points).size,
  };
}

/**
 * One quantity across one basin: keep the `ok` values, take their median, and hand back both
 * the summary and the exact values that produced it (the künye's input).
 *
 * Returns `null` when nothing qualifies — which is what makes an empty cell unrepresentable
 * rather than merely discouraged.
 *
 * MIXED UNITS ABORT THE METRIC. Every value of one field shares a unit by construction today,
 * but averaging across two units would print a number that is true in neither. If it ever
 * happens the row disappears, which is visible and harmless, instead of silently wrong.
 */
function digest(
  candidates: readonly MarineValue[],
): { summary: MarineMetricSummary; contributors: MarineValue[] } | null {
  const contributors = candidates.filter(
    (value): value is MarineValue & { value: number } =>
      value.status === "ok" && value.value !== null && Number.isFinite(value.value),
  );
  if (contributors.length === 0) return null;

  const first = contributors[0];
  if (first === undefined) return null;
  const unit = first.unit;
  if (contributors.some((value) => value.unit !== unit)) return null;

  return {
    summary: {
      median: median(contributors.map((value) => value.value)),
      unit,
      pointCount: contributors.length,
    },
    contributors,
  };
}

/**
 * Median of a non-empty list. Even counts average the two middle values — for a temperature
 * or a wave height that is the ordinary convention, and the result is rounded for display by
 * the same `MARINE_VALUE_FRACTION_DIGITS` table `/deniz` uses, so no extra precision is
 * claimed here.
 */
function median(numbers: readonly number[]): number {
  const sorted = [...numbers].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle];
  if (upper === undefined) return Number.NaN; // unreachable: callers pass non-empty lists
  if (sorted.length % 2 === 1) return upper;
  const lower = sorted[middle - 1];
  return lower === undefined ? upper : (lower + upper) / 2;
}
