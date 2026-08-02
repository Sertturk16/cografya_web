import { getFormatter, getTranslations } from "next-intl/server";
import type { MarineLayer, MarineValue } from "@/lib/api/types";
import {
  MARINE_COMPASS_KEY,
  MARINE_DIRECTION_CONVENTION_KEY,
  marineDirectionView,
} from "@/lib/marine/direction";
import { MODEL_INSTANT_FORMAT, parseModelInstant } from "@/lib/marine/model-run";
import {
  KMH_FRACTION_DIGITS,
  MARINE_UNIT_KEY,
  MARINE_VALUE_FRACTION_DIGITS,
  kmhCompanion,
} from "@/lib/marine/units";
import {
  MARINE_FRESHNESS_STALE_KEY,
  MARINE_VALUE_STATUS_KEY,
  hasNumber,
  marineValueView,
} from "@/lib/marine/value-state";
import { DirectionArrow } from "./direction-arrow";
import styles from "./marine.module.css";

interface ValueCellProps {
  /** The magnitude (wave height, wind speed, sea temperature). */
  magnitude: MarineValue;
  /** Its catalogue row, which publishes the calm threshold. `undefined` = no threshold. */
  magnitudeLayer: MarineLayer | undefined;
  /** The paired direction value, for the two quantities that have one. */
  direction?: MarineValue;
  /** The direction's catalogue row, which publishes the direction convention. */
  directionLayer?: MarineLayer | undefined;
}

/**
 * ONE measured quantity, rendered honestly — the cell body shared by every value surface.
 *
 * It renders a `<td>`'s CONTENT, not the `<td>` itself, so table semantics stay owned by the
 * table (`basin-values-table.tsx`) and this component can be reused inside the `<dl>` the
 * province section will use (W2b) without carrying table markup into it.
 *
 * Every decision it makes was already taken by a pure function — `marineValueView` for the
 * five renders, `marineDirectionView` for the arrow/calm gate, `kmhCompanion` for the
 * second unit. That is deliberate: this repo's test environment is `node` with no DOM, so a
 * decision made in JSX is a decision no test can reach. What is left here is markup.
 *
 * THREE RULES VISIBLE IN THE MARKUP BELOW:
 *
 * 1. **The word carries the meaning, never the colour** (WCAG 1.4.1). Each of the three
 *    non-numeric states has its own sentence; the tint next to it is reinforcement.
 * 2. **The arrow is decoration.** Its whole meaning is written out beside it, so it is
 *    `aria-hidden` and the cell loses nothing when it is not drawn.
 * 3. **A bearing with no published convention is printed as a bare number.** Saying "geldiği
 *    yön" when the api has not stated what a degree means here would be inventing the one
 *    fact the arrow-unlock rule exists to protect.
 */
export async function ValueCell({
  magnitude,
  magnitudeLayer,
  direction,
  directionLayer,
}: ValueCellProps) {
  const tm = await getTranslations("Marine");
  const format = await getFormatter();

  const view = marineValueView(magnitude);

  if (!hasNumber(view)) {
    return (
      <span className={styles.valueStatus} data-state={view.status}>
        {tm(MARINE_VALUE_STATUS_KEY[view.status])}
      </span>
    );
  }

  // Widened to `string | undefined` deliberately: `tsc` proves the maps cover today's
  // contract, these locals cover a payload from an api that has moved ahead of this build.
  // A number whose unit we cannot name is shown WITHOUT a symbol rather than with the
  // namespace name next-intl renders for a missing key.
  const unitKey: string | undefined = MARINE_UNIT_KEY[view.unit];
  const digits: number | undefined = MARINE_VALUE_FRACTION_DIGITS[view.unit];
  const number = format.number(view.value, {
    minimumFractionDigits: digits ?? 1,
    maximumFractionDigits: digits ?? 1,
  });
  const primary = unitKey === undefined ? number : `${number} ${tm(unitKey)}`;

  // Owner ruling A6: m/s stays the published unit and stays first; km/h rides along in
  // parentheses for readers who have a feel for road speeds. Gated on the UNIT, so it
  // appears and disappears with the contract rather than with a column index.
  const kmh = kmhCompanion(view.value, view.unit);
  const staleSince = parseModelInstant(view.staleSinceUtc);

  const directionView =
    direction === undefined
      ? null
      : marineDirectionView({ magnitude, magnitudeLayer, direction, directionLayer });
  const directionValue = direction === undefined ? null : marineValueView(direction);

  return (
    <>
      <span className={styles.valuePrimary}>
        {primary}
        {kmh !== null && (
          <span className={styles.valueSecondary}>
            {tm("values.kmh", {
              value: format.number(kmh, {
                minimumFractionDigits: KMH_FRACTION_DIGITS,
                maximumFractionDigits: KMH_FRACTION_DIGITS,
              }),
            })}
          </span>
        )}
      </span>

      {/* A stale number stays on screen and says WHEN it stopped being refreshed. Hiding it
          would trade a true-but-old number for no number at all; `ok + stale` is a normal,
          frequent state, not a failure. The instant is absolute UTC — a relative phrase
          would be computed once and then cached by ISR into being wrong. */}
      {view.stale && (
        <span className={styles.valueStale}>
          {staleSince === null
            ? tm("freshness.staleNoInstant")
            : tm(MARINE_FRESHNESS_STALE_KEY, {
                since: format.dateTime(staleSince, MODEL_INSTANT_FORMAT),
              })}
        </span>
      )}

      {directionView?.kind === "arrow" && (
        <span className={styles.valueDirection}>
          <DirectionArrow rotationDeg={directionView.rotationDeg} />
          {tm("values.direction", {
            label: tm(MARINE_DIRECTION_CONVENTION_KEY[directionView.convention]),
            compass: tm(MARINE_COMPASS_KEY[directionView.compass]),
            degrees: format.number(directionView.bearing, { maximumFractionDigits: 0 }),
          })}
        </span>
      )}

      {directionView?.kind === "calm" && (
        <span className={styles.valueCalm}>{tm("calm.label")}</span>
      )}

      {/* `kind: "none"` splits into two honest renders: a bearing we have but cannot
          interpret (no published convention) is printed bare, and a bearing we do not have
          reports its own state rather than silently vanishing under a wind speed that IS
          present. */}
      {directionView?.kind === "none" && directionValue !== null && (
        <span className={styles.valueDirection}>
          {hasNumber(directionValue)
            ? tm("values.bearingOnly", {
                degrees: format.number(directionValue.value, { maximumFractionDigits: 0 }),
              })
            : tm("values.directionStatus", {
                status: tm(MARINE_VALUE_STATUS_KEY[directionValue.status]),
              })}
        </span>
      )}
    </>
  );
}
