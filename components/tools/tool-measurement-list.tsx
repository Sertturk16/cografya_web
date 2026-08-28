"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import type { MeasurementType } from "@/lib/api/types";
import { removeMeasurement, type MeasurementRecord } from "@/lib/measurements/client";
import styles from "./tools.module.css";

type FetchStatus = "idle" | "pending" | "settled";

/**
 * The current-user-only saved-measurements recall/list surface (UYELIK-12 plan §5.6) —
 * modelled on `GameHistoryPanel`'s shape for the fetch/empty/list skeleton, with two
 * genuine additions this domain needs: a distinct error state and per-row actions
 * (recall, delete).
 *
 * `mode`/`measurements` are typed from the leaf `lib/api/types`/`lib/measurements/client`
 * aliases rather than importing `tool-island.tsx`'s own `ToolMode` — the same circular-
 * import-avoidance reasoning `tool-measurement-save.tsx`'s docblock states.
 *
 * Sits behind a native `<details>`, closed by default (Product judgment call #4) — the
 * `.controls` panel is already dense before this task adds anything, and most visits
 * either place one measurement or arrive with nothing yet saved.
 */
export function ToolMeasurementList({
  mode,
  locale,
  measurements,
  status,
  onRecall,
  onDeleted,
  onDeleteFailed,
}: {
  readonly mode: MeasurementType;
  readonly locale: Locale;
  /** `null` is the distinct ERROR state (settled, but the fetch failed) — `[]` is the
   *  distinct, genuinely EMPTY state. Collapsing the two, the way `GameHistoryPanel`
   *  collapses `rounds === null || rounds.length === 0`, would silently drop Acceptance
   *  Criterion 4's own "error" a11y state. */
  readonly measurements: readonly MeasurementRecord[] | null;
  readonly status: FetchStatus;
  readonly onRecall: (measurement: MeasurementRecord) => void;
  readonly onDeleted: (id: string) => void;
  readonly onDeleteFailed: (measurement: MeasurementRecord) => void;
}) {
  const t = useTranslations("Measurements");
  const tHub = useTranslations("Tools.hub");
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  /** Rows whose most recent delete attempt failed and was rolled back — tracked locally
   *  (this component's own concern, not `ToolIsland`'s) purely to show the inline
   *  `role="status"` error on THAT row once it reappears (plan §5.6's own "shows an
   *  inline role='status' error on that row"). Cleared the instant a fresh delete of the
   *  same row is attempted. */
  const [failedDeleteIds, setFailedDeleteIds] = useState<ReadonlySet<string>>(new Set());

  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }),
    [locale],
  );

  // No new i18n key for the type-fallback label — the list is already filtered to this
  // page's own single `mode` (`tool-island.tsx` §5.4 item 5), so the existing
  // `Tools.hub.{mesafeName|alanName|koordinatName}` strings are reused directly.
  const typeFallbackLabel =
    mode === "distance"
      ? tHub("mesafeName")
      : mode === "area"
        ? tHub("alanName")
        : tHub("koordinatName");

  // Still fetching / not yet asked: render nothing rather than a premature statement — the
  // same "never a premature statement" reasoning `GameHistoryPanel` states for its own
  // pending state; `tool-island.tsx` already gates mounting this component on
  // `authState === "authenticated"`, so `"checking"`/`"anonymous"` never reach here at all
  // (Product judgment call #3 — no generically-true sentence for an anonymous reader here,
  // and no action of its own to invite them into; the save control carries that already).
  if (status === "idle" || status === "pending") return null;

  async function handleDelete(measurement: MeasurementRecord) {
    setFailedDeleteIds((previous) => {
      if (!previous.has(measurement.id)) return previous;
      const next = new Set(previous);
      next.delete(measurement.id);
      return next;
    });
    onDeleted(measurement.id);
    // The activated "Sil" button unmounts with its row the instant the optimistic removal
    // above lands — without this, focus falls to `<body>` (WCAG 2.4.3). Moved here rather
    // than only inside the failure branch below: the row disappears immediately on EVERY
    // delete attempt, not only a failed one.
    headingRef.current?.focus();
    const result = await removeMeasurement(measurement.id);
    if (!result.ok) {
      onDeleteFailed(measurement);
      setFailedDeleteIds((previous) => new Set(previous).add(measurement.id));
    }
  }

  return (
    <details className={styles.measurementsPanel}>
      <summary className={styles.label}>{t("listToggleLabel")}</summary>
      {/* The focus-landing target after a delete (WCAG 2.4.3) — a deliberate simplification
          (plan §5.6/§10) rather than replicating `removePoint`'s full successor-tracking
          logic: this is a secondary panel, not the primary point-list keyboard-deletion
          path that logic exists for. Visually hidden: the `<summary>` above it already
          states the same fact for a sighted reader, so a second visible heading would be
          exactly the restatement `CONTENT-STYLE.md` §22 asks not to write. */}
      <h2 ref={headingRef} tabIndex={-1} className={styles.srOnly}>
        {t("listHeading")}
      </h2>
      {measurements === null ? (
        <p className={styles.error} role="status">
          {t("listError")}
        </p>
      ) : measurements.length === 0 ? (
        <p className={styles.note}>{t("listEmpty")}</p>
      ) : (
        <ul className={styles.points} role="list">
          {measurements.map((measurement) => {
            const label = measurement.title ?? typeFallbackLabel;
            return (
              <li key={measurement.id} className={styles.measurementRow}>
                <span className={styles.measurementLabel}>
                  <span>{label}</span>
                  <time dateTime={measurement.createdAt}>
                    {dateFormatter.format(new Date(measurement.createdAt))}
                  </time>
                </span>
                <span className={styles.measurementActions}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    aria-label={t("recallAria", { label })}
                    onClick={() => onRecall(measurement)}
                  >
                    {t("recallLabel")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    aria-label={t("deleteAria", { label })}
                    onClick={() => void handleDelete(measurement)}
                  >
                    {t("deleteLabel")}
                  </button>
                </span>
                {failedDeleteIds.has(measurement.id) && (
                  <p role="status" className={styles.error}>
                    {t("deleteError")}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </details>
  );
}
