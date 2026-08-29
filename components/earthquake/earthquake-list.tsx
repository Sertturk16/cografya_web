import type { EarthquakeEvent } from "@/lib/api/types";
import { bindingSentenceKey } from "@/lib/earthquake/binding-sentence";
import { formatEarthquakeOccurredAt } from "@/lib/earthquake/time";
import { MagnitudeBadge } from "./magnitude-badge";
import styles from "./earthquake.module.css";

export interface EarthquakeListStrings {
  tableSummary: string;
  scrollRegionLabel: string;
  colMagnitude: string;
  colPlace: string;
  colTime: string;
  emptyState: string;
  /** `Earthquake.binding.offshoreNear`, already given `{province}`. */
  bindingOffshoreNear: (province: string) => string;
  /** `Earthquake.binding.acrossBorder`, already given `{province}`. */
  bindingAcrossBorder: (province: string) => string;
}

interface EarthquakeListProps {
  locale: string;
  events: readonly EarthquakeEvent[];
  /** `bindingPlateCode` → the province's `nameTr`, for the binding-sentence context (§5.7). */
  provinceNameByPlateCode: ReadonlyMap<string, string>;
  strings: EarthquakeListStrings;
}

/**
 * The default-view event list (§5.11, `deprem-sayfalari` plan): a server-rendered `<table>`,
 * newest first (the api's own order), one row per event.
 *
 * THE `bindingKind` SENTENCE (§5.7/§10) renders ONLY for `offshore_near`/`across_border` rows,
 * and only when the bound province can actually be named — never "an earthquake occurred in
 * {province}" for these two states, because the provider's `province` field means "nearest
 * Turkish province", not "where this happened". `"inside"` rows print no extra sentence:
 * `placeNameTr` already carries the province in parentheses for that case, so a second
 * sentence saying the same thing would be the mechanical/redundant copy `CONTENT-STYLE.md`
 * §22 bars.
 *
 * A plain, hook-free presentational component for the same dual-context reason
 * `EarthquakeMap` states in full: the client filter island re-renders this exact shape after
 * a fetch (§5.5), so it cannot depend on a server-only translation hook.
 */
export function EarthquakeList({
  locale,
  events,
  provinceNameByPlateCode,
  strings,
}: EarthquakeListProps) {
  if (events.length === 0) {
    return <p className={styles.emptyState}>{strings.emptyState}</p>;
  }

  return (
    <div
      className={styles.tableScroll}
      role="region"
      aria-label={strings.scrollRegionLabel}
      tabIndex={0}
    >
      <table className={styles.table}>
        <caption className={styles.tableCaption}>{strings.tableSummary}</caption>
        <thead>
          <tr>
            <th scope="col">{strings.colMagnitude}</th>
            <th scope="col">{strings.colPlace}</th>
            <th scope="col">{strings.colTime}</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => {
            const key = bindingSentenceKey(event.bindingKind);
            const province =
              event.bindingPlateCode !== null
                ? (provinceNameByPlateCode.get(event.bindingPlateCode) ?? null)
                : null;
            const bindingNote =
              key !== null && province !== null
                ? key === "offshoreNear"
                  ? strings.bindingOffshoreNear(province)
                  : strings.bindingAcrossBorder(province)
                : null;

            return (
              <tr key={event.id}>
                <td>
                  <MagnitudeBadge
                    magnitude={event.magnitude}
                    magnitudeType={event.magnitudeType}
                    locale={locale}
                  />
                </td>
                <td>
                  {/* `placeNameTr` is Turkish in BOTH locales (§5.7's own docblock) —
                      `lang="tr"` so `/en/earthquakes` (`<html lang="en">`) never reads it with
                      English phonetics (WCAG 3.1.2, review VAL104-M1). */}
                  <span className={styles.placeName} lang="tr">
                    {event.placeNameTr}
                  </span>
                  {bindingNote !== null && (
                    <span className={styles.bindingNote}>{bindingNote}</span>
                  )}
                </td>
                <td>{formatEarthquakeOccurredAt(event.occurredAtUtc, locale)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
