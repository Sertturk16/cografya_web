"use client";

import { type FormEvent, type ReactNode, useCallback, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { EarthquakeEvent } from "@/lib/api/types";
import { buildEarthquakeQuery } from "@/lib/earthquake/query";
import { EarthquakeList } from "./earthquake-list";
import { EarthquakeMap } from "./earthquake-map";
import styles from "./earthquake.module.css";

/** The magnitude-floor options the control offers. `2.5` matches the api's own default. */
export const MAGNITUDE_OPTIONS = [1, 2, 2.5, 3, 4, 5] as const;

/** The time-window options, in days. `7` matches the api's own default. */
export const WINDOW_OPTIONS = [1, 7, 30, 90] as const;
type WindowDays = (typeof WINDOW_OPTIONS)[number];

/** How many rows one page fetches — the api's own default `pageSize`. */
const PAGE_SIZE = 50;

/** Give up on a fetch rather than leaving the control silently spinning forever. */
const FETCH_TIMEOUT_MS = 10_000;

interface ActiveFilter {
  minMagnitude: number;
  days: WindowDays;
  /** The concrete instants the FIRST page of this filter was fetched with — "load more"
   *  reuses them so a later page cannot silently drift onto a different `toUtc` than page 1
   *  was drawn against. */
  fromUtc: string;
  toUtc: string;
}

interface ClientResult {
  items: EarthquakeEvent[];
  hasMore: boolean;
  page: number;
}

interface EarthquakeFiltersProps {
  locale: string;
  defaultMinMagnitude: number;
  /** The api's own `defaultWindowDays` (`EarthquakeMetaDto`) — a plain `number` on the wire.
   *  Narrowed to the nearest offered {@link WINDOW_OPTIONS} member below; it is documented as
   *  a stable structural constant (7 today), but the contract does not type it as a literal,
   *  so this control never crashes if it ever diverges from the five offered values. */
  defaultWindowDays: number;
  /** `bindingPlateCode` → the province's `nameTr` (§5.7's binding-sentence context). */
  provinceNameByPlateCode: ReadonlyMap<string, string>;
  /** The server-rendered default view (`EarthquakeMap` + `EarthquakeList`) — shown until the
   *  reader changes a filter or loads another page, exactly the progressive-enhancement shape
   *  `SearchCombobox` already uses in this repo (pre-hydration/no-JS-equivalent = the real
   *  server content, never a placeholder). */
  children: ReactNode;
}

/**
 * The client filter/pagination island (§5.5, `deprem-sayfalari` plan).
 *
 * `apiGet` is `server-only`, so this re-fetches against `/api/earthquakes` — this repo's own
 * Route Handler proxy — never the api directly. It does NOT navigate: the canonical URL stays
 * exactly `/deprem` (§5.5/§5.10 — no `?minMagnitude=`/`?page=` variants), so nothing here ever
 * calls `router.push`/changes `location`.
 *
 * REPLACES, RATHER THAN DUPLICATES, THE DEFAULT VIEW. `children` carries the server-rendered
 * `EarthquakeMap`/`EarthquakeList` for the api's own default filter — shown as-is until the
 * reader's first interaction. Applying a filter or loading another page switches to this
 * component's OWN client-side render of the same two presentational components
 * (`EarthquakeMap`/`EarthquakeList` are plain, hook-free functions for exactly this reason —
 * see their own docblocks), fed by local state instead of the server fetch. The two never
 * render at once, so there is no risk of the reader seeing stale server content next to fresh
 * client content.
 */
export function EarthquakeFilters({
  locale,
  defaultMinMagnitude,
  defaultWindowDays,
  provinceNameByPlateCode,
  children,
}: EarthquakeFiltersProps) {
  const t = useTranslations("Earthquake");
  const baseId = useId();

  const [minMagnitude, setMinMagnitude] = useState<number>(defaultMinMagnitude);
  const [days, setDays] = useState<WindowDays>(
    (WINDOW_OPTIONS as readonly number[]).includes(defaultWindowDays)
      ? (defaultWindowDays as WindowDays)
      : 7,
  );
  const [active, setActive] = useState<ActiveFilter | null>(null);
  const [result, setResult] = useState<ClientResult | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const inFlight = useRef(false);

  const strings = {
    tableSummary: t("list.tableSummary"),
    scrollRegionLabel: t("list.scrollRegionLabel"),
    colMagnitude: t("list.colMagnitude"),
    colPlace: t("list.colPlace"),
    colTime: t("list.colTime"),
    emptyState: t("list.emptyState"),
    bindingOffshoreNear: (province: string) => t("binding.offshoreNear", { province }),
    bindingAcrossBorder: (province: string) => t("binding.acrossBorder", { province }),
  };

  const runFetch = useCallback(async (filter: ActiveFilter, page: number, append: boolean) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setStatus("loading");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const qs = buildEarthquakeQuery({
        minMagnitude: filter.minMagnitude,
        fromUtc: filter.fromUtc,
        toUtc: filter.toUtc,
        page,
        pageSize: PAGE_SIZE,
      });
      const response = await fetch(`/api/earthquakes${qs}`, { signal: controller.signal });
      if (!response.ok) throw new Error(`earthquake fetch responded ${response.status}`);
      const payload: unknown = await response.json();
      if (!isEarthquakeListPayload(payload)) throw new Error("earthquake payload malformed");
      setActive(filter);
      setResult((previous) => ({
        items: append && previous !== null ? [...previous.items, ...payload.items] : payload.items,
        hasMore: payload.hasMore,
        page,
      }));
      setStatus("idle");
    } catch {
      setStatus("error");
    } finally {
      clearTimeout(timeout);
      inFlight.current = false;
    }
  }, []);

  const onApply = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const toUtc = new Date().toISOString();
    const fromUtc = new Date(Date.now() - days * 86_400_000).toISOString();
    void runFetch({ minMagnitude, days, fromUtc, toUtc }, 1, false);
  };

  const onLoadMore = () => {
    if (active === null || result === null) return;
    void runFetch(active, result.page + 1, true);
  };

  const magnitudeId = `${baseId}-magnitude`;
  const windowId = `${baseId}-window`;

  return (
    <div className={styles.filters}>
      <form className={styles.filterForm} onSubmit={onApply}>
        <div className={styles.filterField}>
          <label htmlFor={magnitudeId}>{t("filters.magnitudeLabel")}</label>
          <select
            id={magnitudeId}
            value={minMagnitude}
            onChange={(event) => setMinMagnitude(Number(event.target.value))}
          >
            {MAGNITUDE_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {t("filters.magnitudeOption", {
                  value: new Intl.NumberFormat(locale, {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  }).format(value),
                })}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.filterField}>
          <label htmlFor={windowId}>{t("filters.windowLabel")}</label>
          <select
            id={windowId}
            value={days}
            onChange={(event) => setDays(Number(event.target.value) as WindowDays)}
          >
            {WINDOW_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {t(`filters.window${value}`)}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className={styles.filterApply} disabled={status === "loading"}>
          {t("filters.apply")}
        </button>
      </form>

      <div
        aria-live="polite"
        className={
          status === "error"
            ? `${styles.filterStatus} ${styles.filterStatusError}`
            : styles.filterStatus
        }
      >
        {status === "loading" && t("filters.loading")}
        {status === "error" && t("filters.loadFailed")}
        {/* WCAG 4.1.3 (review A11Y104-I2): the region announced "loading" and "error" but
            never a result on SUCCESS — a screen-reader user heard "Yükleniyor…" then silence.
            `active !== null` gates this to an actual completed fetch, never the initial
            server-rendered view (no client fetch has run yet, so nothing to announce). */}
        {status === "idle" &&
          active !== null &&
          result !== null &&
          t("filters.resultsFound", { count: result.items.length })}
      </div>

      {result === null ? (
        children
      ) : (
        <div className={styles.filterResults}>
          <EarthquakeMap
            locale={locale}
            events={result.items}
            title={t("map.title")}
            description={t("map.description", { count: result.items.length })}
            idSuffix="filtered"
          />
          <EarthquakeList
            locale={locale}
            events={result.items}
            provinceNameByPlateCode={provinceNameByPlateCode}
            strings={strings}
          />
          {result.hasMore && (
            <button
              type="button"
              className={styles.loadMore}
              onClick={onLoadMore}
              disabled={status === "loading"}
            >
              {t("filters.loadMore")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Narrow, structural check on the fetched payload — network input, never trusted by type. */
function isEarthquakeListPayload(
  value: unknown,
): value is { items: EarthquakeEvent[]; hasMore: boolean } {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { items?: unknown }).items) &&
    typeof (value as { hasMore?: unknown }).hasMore === "boolean"
  );
}
