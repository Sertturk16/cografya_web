import { getFormatter, getTranslations } from "next-intl/server";
import type { MarineLayer, MarineValue } from "@/lib/api/types";
import {
  MARINE_COMPASS_KEY,
  MARINE_DIRECTION_CONVENTION_KEY,
  displayBearing,
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

/**
 * THE VALUE VOCABULARY, AS BRIDGE TOKENS.
 *
 * Every line below used to read a raw Terra token through `marine.module.css`
 * (`--color-ink` for the magnitude, `--color-slate` for everything quieter). The `.dark`
 * block redefines neither, so in dark mode the whole cell was frozen at its light value and
 * only stayed legible because `.provinceBlock` painted a literal `#fff` behind it — the white
 * card on the dark page. `text-foreground`/`text-muted-foreground` are the same two voices
 * bound to tokens that move with the theme: measured (`lib/theme/contrast.ts`) 14.73:1 and
 * 7.79:1 on `--card` in dark, 14.97:1 and 7.92:1 in light.
 *
 * The SIZES are the module's own, to the hundredth of a rem, so the conversion moves colour
 * and nothing else.
 */
/** The published magnitude: the one thing in the cell that is not quiet. */
const PRIMARY = "block font-semibold tabular-nums whitespace-nowrap text-foreground";
/** The km/h companion, riding along inside `PRIMARY`'s own weight. */
const SECONDARY = "ml-[5px] font-normal text-muted-foreground";
/** The direction line: arrow, screen-reader convention, compass name. */
const DIRECTION = "mt-[3px] flex items-baseline gap-[5px] text-[0.8rem] text-muted-foreground";
/** "Sakin" and the stale marker — WORDS, sharing one voice (WCAG 1.4.1). */
const NOTE = "mt-[3px] block text-[0.8rem] text-muted-foreground";
/** "Sakin" alone carries the module's extra weight. Composed, so the voice cannot drift. */
const CALM = `${NOTE} font-semibold`;
/** The three non-numeric states, which render instead of a number rather than beside one. */
const STATUS = "inline-block text-[0.85rem] text-muted-foreground";

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
 *
 * THE ARROW CELL NO LONGER PREFIXES "Geldiği yön:" (deniz-notlar.txt madde 4). Every cell used
 * to repeat the convention word ("Geldiği yön" / "Gittiği yön") in front of the compass name —
 * ~60 times across the hub's 30 rows × 2 directional columns, plus once more per province page.
 * The reading key beneath the hub's tables (`Marine.values.readingKeyArrow`) already states
 * the convention once for the whole page ("Ok... gittiği yönü gösterir; yanındaki yazı geldiği
 * yönü söyler."), so the per-cell prefix was the same fact stated 60 more times. `MARINE_
 * DIRECTION_CONVENTION_KEY` (`direction.from`/`direction.towards`) is UNCHANGED and still fully
 * used elsewhere — `layer-catalogue.tsx`'s own "Yön" column states which convention a LAYER
 * publishes, a genuinely different, un-repeated fact this fix does not touch.
 *
 * AN AT-ONLY RESTATEMENT WAS ADDED BACK (A11Y121-I1, this fix round). The simplification above
 * stands for sighted readers — no visible prefix, no 60×-repeated text. But a linear- or
 * heading-navigating screen-reader user does not necessarily reach the page-bottom reading key
 * before a value cell, so each arrow cell now also carries a `.srOnly` span restating the exact
 * convention word computed from `directionView.convention` (never hardcoded), giving AT users
 * back the same accessible name the pre-removal cell had, while the visible text node is
 * unchanged.
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
      <span className={STATUS} data-state={view.status}>
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
      <span className={PRIMARY}>
        {primary}
        {kmh !== null && (
          <span className={SECONDARY}>
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
        <span className={NOTE}>
          {staleSince === null
            ? tm("freshness.staleNoInstant")
            : tm(MARINE_FRESHNESS_STALE_KEY, {
                since: format.dateTime(staleSince, MODEL_INSTANT_FORMAT),
              })}
        </span>
      )}

      {directionView?.kind === "arrow" && (
        <span className={DIRECTION}>
          <DirectionArrow rotationDeg={directionView.rotationDeg} />
          <span className="sr-only">
            {tm(MARINE_DIRECTION_CONVENTION_KEY[directionView.convention])}:{" "}
          </span>
          {tm("values.direction", {
            compass: tm(MARINE_COMPASS_KEY[directionView.compass]),
            degrees: format.number(directionView.bearing, { maximumFractionDigits: 0 }),
          })}
        </span>
      )}

      {directionView?.kind === "calm" && <span className={CALM}>{tm("calm.label")}</span>}

      {/* `kind: "none"` splits into two honest renders: a bearing we have but cannot
          interpret (no published convention) is printed bare, and a bearing we do not have
          reports its own state rather than silently vanishing under a wind speed that IS
          present. */}
      {directionView?.kind === "none" && directionValue !== null && (
        <span className={DIRECTION}>
          {hasNumber(directionValue)
            ? tm("values.bearingOnly", {
                // Same rounding rule as the arrow branch: 359.6° is "0°", never "360°".
                degrees: format.number(displayBearing(directionValue.value), {
                  maximumFractionDigits: 0,
                }),
              })
            : tm("values.directionStatus", {
                status: tm(MARINE_VALUE_STATUS_KEY[directionValue.status]),
              })}
        </span>
      )}
    </>
  );
}
